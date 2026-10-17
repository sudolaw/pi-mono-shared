#!/usr/bin/env node
// Re-runs a series from its public log and checks every round's state hash (SPEC.md §13).
// Usage: npm run replay -- <series-id> [--data <dir>]

import { Store, defaultDataDir } from '../src/store/files.js';
import { replaySeries } from '../src/series/replay.js';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const dataIdx = args.indexOf('--data');
const store = new Store(dataIdx >= 0 ? args[dataIdx + 1] : defaultDataDir());
if (!id) {
  console.error('usage: npm run replay -- <series-id> [--data <dir>]');
  process.exit(2);
}
const { rounds, mismatches } = replaySeries(await store.readEvents(id));
if (mismatches.length) {
  console.error(`✗ ${mismatches.length} of ${rounds} rounds differ:`);
  for (const m of mismatches) console.error(`  match ${m.match} round ${m.round}: logged ${m.expected.slice(0, 12)}…, replayed ${m.got.slice(0, 12)}…`);
  process.exit(1);
}
console.log(`✓ replayed ${rounds} rounds of ${id}; every state hash matches`);
