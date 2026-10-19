// Full copies of the state every few turns (spec §9), so a restart replays only the tail.
// Written to a temporary file and renamed, so a crash never leaves half a snapshot.

import { mkdir, writeFile, rename, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeSnapshot(dir, turn, snap) {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `turn-${String(turn).padStart(3, '0')}.json`);
  await writeFile(file + '.tmp', JSON.stringify(snap));
  await rename(file + '.tmp', file);
}

/** The newest snapshot that parses, or null. */
export async function latestSnapshot(dir) {
  let names;
  try { names = (await readdir(dir)).filter((n) => /^turn-\d+\.json$/.test(n)).sort().reverse(); } catch { return null; }
  for (const n of names) {
    try { return JSON.parse(await readFile(join(dir, n), 'utf8')); } catch { /* fall back to an older one */ }
  }
  return null;
}
