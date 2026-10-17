// Shared test helpers: a fake clock (no real waiting) and a temp data directory.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store/files.js';
import { Series } from '../src/series/series.js';
import { playerView } from '../src/series/views.js';
import { STRATEGIES } from '../src/bots/strategies.js';

export function fakeClock(start = 1_700_000_000_000) {
  let now = start;
  const timers = new Set();
  return {
    now: () => now,
    setTimeout(fn, ms) { const h = { at: now + ms, fn }; timers.add(h); return h; },
    clearTimeout(h) { timers.delete(h); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const h = [...timers].sort((a, b) => a.at - b.at)[0];
        if (!h || h.at > end) break;
        now = h.at;
        timers.delete(h);
        await h.fn();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}

export function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmp-test-'));
  return { store: new Store(dir), dir };
}

/** A new series with two joined players ('alice' as P1, 'bob' as P2). */
export async function seatedSeries({ overrides = {}, clock = fakeClock(), store = tempStore().store } = {}) {
  const series = await Series.create(store, { overrides, clock });
  await series.join('alice', 'Alice Bot');
  await series.join('bob', 'Bob Bot');
  return { series, clock, store };
}

/**
 * Plays the series in-process with scripted strategies until it finishes (or maxSteps).
 * Each decision "takes" thinkMs of fake time, so warm-up timing and deadlines are exercised.
 */
export async function playOut(series, { P1 = 'turtle', P2 = 'rusher', clock, thinkMs = 1000, maxSteps = 100000 } = {}) {
  for (let step = 0; step < maxSteps; step++) {
    if (series.phase === 'series_finished' || series.phase === 'cancelled') return step;
    if (series.phase === 'waiting_for_start') await series.hostStart(); // the host presses Start
    let acted = false;
    for (const seat of ['P1', 'P2']) {
      const players = { P1: series.record.seats.P1?.playerId, P2: series.record.seats.P2?.playerId };
      const obs = playerView(series, seat);
      const next = obs.next;
      if (next.do === 'ready') { await series.ready(players[seat], next.args.for_match); acted = true; }
      else if (next.do === 'submit') {
        if (!series.isLiveRound()) await clock?.advance(thinkMs);
        const strategy = STRATEGIES[seat === 'P1' ? P1 : P2];
        const res = await series.submit(players[seat], { match: next.args.match, round: next.args.round, actions: strategy(obs, series.record.settings) });
        if (!res.ok) throw new Error(`bot bundle rejected: ${JSON.stringify(res)}`);
        acted = true;
      }
    }
    if (series.isLiveRound()) {
      await clock.advance(series.record.round.openedAt + series.record.settings.match.roundSeconds * 1000 - clock.now());
      acted = true;
    }
    if (!acted) throw new Error(`stuck in phase ${series.phase}`);
  }
  throw new Error('series did not finish');
}
