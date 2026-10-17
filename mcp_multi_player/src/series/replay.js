// Deterministic replay (SPEC.md §13): re-run every round of a series from its public log
// (settings + revealed bundles) and check each round's state hash.

import { createEngine } from '../engine/index.js';

/** Returns { rounds, mismatches: [{ match, round, expected, got }] }. */
export function replaySeries(events) {
  const created = events.find((e) => e.type === 'series_created');
  if (!created) throw new Error('no series_created event');
  const engine = createEngine(created.payload.settings);

  // A round may appear twice if the server crashed between logging and saving; the
  // engine is deterministic, so keep the last copy of each (match, round).
  // A host restart starts the matches again from 1, so rounds are keyed by restart epoch too.
  const byRound = new Map();
  let epoch = 0;
  for (const e of events) {
    if (e.type === 'series_restarted') epoch += 1;
    if (e.type === 'round_resolved') byRound.set(`${epoch}:${e.match}:${e.round}`, { ...e, epoch });
  }
  const resolved = [...byRound.values()].sort((a, b) => a.epoch - b.epoch || a.match - b.match || a.round - b.round);

  const mismatches = [];
  let state = null;
  for (const e of resolved) {
    if (!state || state.match !== e.match || state.over || state.epoch !== e.epoch) state = { ...engine.newMatch(e.match), epoch: e.epoch };
    if (state.round !== e.round) throw new Error(`log gap: expected match ${e.match} round ${state.round}, found round ${e.round}`);
    const { epoch, ...plain } = state;
    const res = e.payload.mode === 'live' ? engine.replayLive(plain, e.payload.bundles) : engine.resolve(plain, e.payload.bundles);
    if (res.hash !== e.payload.hash) mismatches.push({ match: e.match, round: e.round, expected: e.payload.hash, got: res.hash });
    state = { ...res.state, epoch };
  }
  return { rounds: resolved.length, mismatches };
}
