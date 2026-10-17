// On-disk storage for series (SPEC.md §13). One folder per series:
//
//   events.jsonl            public history (spectators, reports, replay)
//   audit.jsonl             everything, including private detail (rejected bundles, request ids…)
//   series.json             current series record (seats, phase, pending bundles, deadline…)
//   requests.jsonl          append-only idempotency records (legacy requests.json still loads)
//   state/mNN-rNNN.json     full match state at the start of each round
//   combat/mNN-rNNN.json    combat timeline of each resolved round (spectator playback)
//   reports/mNN.json        match reports
//   match-NN.log            plain-text log for humans
//
// Writes are asynchronous and ordered per series; callers await them before replying. JSON files are
// written to a temp file and renamed, so a crash never leaves a half-written file.
// Tokens never reach this module.

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { setImmediate as yieldIO } from 'node:timers/promises';

export function defaultDataDir() {
  return process.env.MMP_DATA_DIR || path.join(os.homedir(), '.local', 'share', 'mcp_multi_player');
}

const pad = (n, w) => String(n).padStart(w, '0');
export const stateName = (match, round) => `m${pad(match, 2)}-r${pad(round, 3)}.json`;

export class Store {
  constructor(dataDir = defaultDataDir(), { parser = null } = {}) {
    // Absolute, because combat files are served with res.sendFile (and `--data .tmp/x` is common).
    this.dataDir = path.resolve(dataDir);
    this.seriesRoot = path.join(this.dataDir, 'series');
    this.ready = fs.mkdir(this.seriesRoot, { recursive: true });
    this.writes = new Map();
    this.histories = new Map();
    this.preparing = new Map();
    this.parser = parser;
  }

  dir(id) {
    if (!/^[a-z0-9_-]+$/i.test(id)) throw new Error('bad series id');
    return path.join(this.seriesRoot, id);
  }

  async createSeriesDir(id) {
    await this.ready;
    for (const sub of ['state', 'combat', 'reports']) await fs.mkdir(path.join(this.dir(id), sub), { recursive: true });
    this.histories.set(id, { recent: [], match: null, rounds: [] });
  }

  // Independent series can write concurrently; one series never races a .tmp rename.
  write(id, fn) {
    const next = (this.writes.get(id) ?? this.ready).then(fn);
    this.writes.set(id, next);
    next.catch(() => {}); // the caller observes errors; a failed series stays failed
    return next;
  }

  async listSeriesIds() {
    await this.ready;
    const names = await fs.readdir(this.seriesRoot);
    const found = await Promise.all(names.map(async (name) => {
      try { await fs.access(path.join(this.seriesRoot, name, 'series.json')); return name; }
      catch (err) { if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null; throw err; }
    }));
    return found.filter(Boolean);
  }

  // public events also go to the audit log, so audit.jsonl alone is the complete record
  appendEvent(id, event) {
    return this.write(id, async () => {
      await appendLine(path.join(this.dir(id), 'events.jsonl'), event);
      await appendLine(path.join(this.dir(id), 'audit.jsonl'), event);
      this.rememberEvent(id, event);
    });
  }

  appendAudit(id, entry) {
    return this.write(id, () => appendLine(path.join(this.dir(id), 'audit.jsonl'), entry));
  }

  appendText(id, match, line) {
    return this.write(id, () => fs.appendFile(path.join(this.dir(id), `match-${pad(match, 2)}.log`), line + '\n'));
  }

  saveSeries(record) { return this.write(record.id, () => writeJsonAtomic(path.join(this.dir(record.id), 'series.json'), record)); }
  saveRequests(id, requests) { return this.write(id, () => writeJsonAtomic(path.join(this.dir(id), 'requests.json'), requests)); }
  appendRequest(id, key, record) {
    return this.write(id, () => appendLine(path.join(this.dir(id), 'requests.jsonl'), { key, record }));
  }
  saveState(id, state) { return this.write(id, () => writeJsonAtomic(path.join(this.dir(id), 'state', stateName(state.match, state.round)), state)); }
  saveCombat(id, timeline, json) { return this.write(id, () => writeJsonAtomic(path.join(this.dir(id), 'combat', stateName(timeline.match, timeline.round)), timeline, json)); }
  saveReport(id, report) { return this.write(id, () => writeJsonAtomic(path.join(this.dir(id), 'reports', `m${pad(report.match, 2)}.json`), report)); }

  loadSeries(id) { return readJson(path.join(this.dir(id), 'series.json')); }
  async loadRequests(id) {
    const records = await readJson(path.join(this.dir(id), 'requests.json')) ?? {};
    for (const { key, record } of await this.readLines(path.join(this.dir(id), 'requests.jsonl'))) records[key] = record;
    return records;
  }
  loadState(id, match, round) { return readJson(path.join(this.dir(id), 'state', stateName(match, round))); }
  loadReport(id, match) { return readJson(path.join(this.dir(id), 'reports', `m${pad(match, 2)}.json`)); }

  /** Path of a public combat file, or null if the name is not a combat file. */
  combatPath(id, file) {
    if (!/^m\d{2}-r\d{3}\.json$/.test(file)) return null;
    return path.join(this.dir(id), 'combat', file);
  }

  rememberEvent(id, event) {
    const history = this.histories.get(id);
    if (!history) return;
    history.recent.push(event);
    if (history.recent.length > 400) history.recent.shift();
    if (event.type === 'series_restarted') { history.match = null; history.rounds = []; }
    if (event.type === 'round_resolved' && !event.payload.warmup) {
      if (history.match !== event.match) { history.match = event.match; history.rounds = []; }
      history.rounds.push(event);
    }
  }

  async prepareHistory(id) {
    if (this.preparing.has(id)) return this.preparing.get(id);
    if (this.histories.has(id)) return;
    this.histories.set(id, { recent: [], match: null, rounds: [] });
    const loading = this.readLines(path.join(this.dir(id), 'events.jsonl'), (event) => this.rememberEvent(id, event))
      .catch((err) => { this.histories.delete(id); throw err; })
      .finally(() => this.preparing.delete(id));
    this.preparing.set(id, loading);
    return loading;
  }

  async recentEvents(id) { await this.prepareHistory(id); return [...this.histories.get(id).recent]; }
  async matchRounds(id, match) {
    await this.prepareHistory(id);
    const history = this.histories.get(id);
    return history.match === match ? [...history.rounds] : [];
  }

  async readEvents(id, { after = 0 } = {}) {
    const recent = await this.recentEvents(id);
    if (recent.length && after >= recent[0].seq - 1) return recent.filter((event) => event.seq > after);
    const events = [];
    await this.readLines(path.join(this.dir(id), 'events.jsonl'), (event) => { if (event.seq > after) events.push(event); });
    return events;
  }
  readAudit(id) { return this.readLines(path.join(this.dir(id), 'audit.jsonl')); }

  // Stream in bounded batches. Production parsing runs in the reusable CPU pool.
  async readLines(file, consume) {
    try { await fs.access(file); } catch (err) { if (err.code === 'ENOENT') return []; throw err; }
    const input = createReadStream(file, { encoding: 'utf8' });
    const lines = createInterface({ input, crlfDelay: Infinity });
    const result = [];
    let batch = [];
    let bytes = 0;
    const flush = async () => {
      const values = this.parser ? await this.parser(batch.join('\n')) : batch.map((line) => JSON.parse(line));
      for (const value of values) { if (consume) consume(value); else result.push(value); }
      batch = []; bytes = 0;
      await yieldIO();
    };
    try {
      for await (const line of lines) {
        if (!line) continue;
        batch.push(line); bytes += Buffer.byteLength(line);
        if (batch.length >= 100 || bytes >= 256 * 1024) await flush();
      }
      if (batch.length) await flush();
      return result;
    } finally { lines.close(); input.destroy(); }
  }
}

function appendLine(file, obj) {
  return fs.appendFile(file, JSON.stringify(obj) + '\n');
}

async function writeJsonAtomic(file, obj, json) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, json ?? JSON.stringify(obj));
  await fs.rename(tmp, file);
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
