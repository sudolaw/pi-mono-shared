// Everything on disk (spec §9). Knows about files, not games: one folder per series with a
// series log and, per match, a public log, a private audit log, snapshots and a readable
// text log. The lobby index is rewritten atomically.

import { mkdir, readFile, writeFile, rename, rm, readdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathsFor } from './paths.js';
import { createAppender, readLines } from './log.js';
import { writeSnapshot, latestSnapshot } from './snapshots.js';

export function createStore({ dataDir, sync = true }) {
  const p = pathsFor(dataDir);
  const appenders = new Map();
  const appender = (file) => {
    if (!appenders.has(file)) appenders.set(file, createAppender(file, { sync }));
    return appenders.get(file);
  };

  function openSeries(id) {
    return {
      append: (kind, data, extra) => appender(p.seriesLog(id)).append(kind, data, extra),
      load: () => readLines(p.seriesLog(id)),
      match(n) {
        return {
          append: (kind, data, extra) => appender(p.events(id, n)).append(kind, data, extra),
          audit: (kind, data) => appender(p.audit(id, n)).append(kind, data),
          snapshot: (turn, snap) => writeSnapshot(p.snapshots(id, n), turn, snap),
          async text(line) {
            await mkdir(p.matchDir(id, n), { recursive: true });
            await appendFile(p.text(id, n), line + '\n');
          },
          async load() {
            return { events: await readLines(p.events(id, n)), audit: await readLines(p.audit(id, n)), snapshot: await latestSnapshot(p.snapshots(id, n)) };
          },
        };
      },
    };
  }

  return {
    dataDir,
    openSeries,
    async readIndex() {
      try { return JSON.parse(await readFile(p.lobbyIndex, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return { series: [] }; throw err; }
    },
    async writeIndex(index) {
      await mkdir(dirname(p.lobbyIndex), { recursive: true });
      await writeFile(p.lobbyIndex + '.tmp', JSON.stringify(index, null, 2));
      await rename(p.lobbyIndex + '.tmp', p.lobbyIndex);
    },
    async listSeries() {
      try { return (await readdir(p.seriesRoot)).filter((n) => n.startsWith('s_')); } catch { return []; }
    },
    async deleteSeries(id) {
      for (const [file] of appenders) if (file.startsWith(p.seriesDir(id))) appenders.delete(file);
      await rm(p.seriesDir(id), { recursive: true, force: true });
    },
  };
}
