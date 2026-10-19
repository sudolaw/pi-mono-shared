// Append-only JSON-lines files (spec §9). `append` resolves only once the line is safely on
// disk: that is the commit point of every transaction. Lines arriving together are written
// in one batch. Reading drops a half-written last line left by a crash.

import { open, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export function createAppender(file, { sync = true } = {}) {
  let seq = null, pending = [], flushing = null;

  async function init() {
    if (seq !== null) return;
    seq = (await readLines(file)).length;
  }

  async function flush() {
    while (pending.length) {
      const batch = pending; pending = [];
      try {
        await mkdir(dirname(file), { recursive: true });
        const fh = await open(file, 'a');
        try {
          await fh.appendFile(batch.map((b) => b.line).join(''));
          if (sync) await fh.datasync();
        } finally { await fh.close(); }
        batch.forEach((b) => b.resolve(b.entry));
      } catch (err) {
        batch.forEach((b) => b.reject(err));
      }
    }
    flushing = null;
  }

  return {
    /** Appends {seq, at, kind, data, ...extra}; resolves with the entry once it is on disk. */
    async append(kind, data, extra = {}, at = Date.now()) {
      await init();
      const entry = { seq: seq++, at, kind, data, ...extra };
      const done = new Promise((resolve, reject) => pending.push({ line: JSON.stringify(entry) + '\n', entry, resolve, reject }));
      if (!flushing) flushing = flush();
      return done;
    },
  };
}

export async function readLines(file) {
  let text;
  try { text = await readFile(file, 'utf8'); } catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { break; } // a torn last line from a crash
  }
  return out;
}
