#!/usr/bin/env node
// Re-runs a series from its logs and checks every state hash (spec §14). Proves a series can
// be replayed exactly: same level, same seeds, same actions -> same states.
//
//   npm run replay -- <series-id> [--data <dir>]

import { loadLevel } from '../src/config/load.js';
import * as engine from '../src/engine/index.js';
import { createStore } from '../src/store/index.js';
import { defaultDataDir } from '../src/store/paths.js';
import { rebuild } from '../src/match/persist.js';
import { seedFor } from '../src/series/matches.js';

const args = process.argv.slice(2);
const id = args.find((a) => a.startsWith('s_'));
const di = args.indexOf('--data');
const dataDir = di >= 0 ? args[di + 1] : defaultDataDir();
if (!id) { console.error('usage: npm run replay -- <series-id> [--data <dir>]'); process.exit(2); }

const handle = createStore({ dataDir }).openSeries(id);
const log = await handle.load();
const created = log.find((e) => e.kind === 'series_created');
if (!created) { console.error(`no series ${id} in ${dataDir}`); process.exit(2); }
const level = loadLevel(created.data.levelId);
if (level.hash !== created.data.levelHash) console.warn(`warning: level ${level.id} has changed since the series was created; hashes will not match`);

let failed = false;
for (const start of log.filter((e) => e.kind === 'match_started')) {
  const n = start.data.matchNo;
  try {
    const files = await handle.match(n).load();
    const r = rebuild(engine, level, seedFor(id, n), { ...files, snapshot: null });
    const turns = files.events.filter((e) => e.kind === 'turn').length;
    console.log(`match ${n}: ${turns} turns replayed, every hash matches${r.ended ? ` · ${r.ended.data.result.reason}` : ' · still running'}`);
  } catch (err) {
    failed = true;
    console.log(`match ${n}: FAILED, ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
