// Engine entry point: pure functions over plain data. No I/O, no clocks, no randomness.
// The series layer calls createEngine(cfg) once per series and keeps the returned object.

import { buildBoard, SEATS } from './board.js';
import { newMatchState } from './state.js';
import { validateBundle, applyBundle } from './actions.js';
import { simulateRound, simulateTick } from './sim.js';
import { hashState, canonicalJson } from './hash.js';
import { incomeAfterRound } from '../config.js';

export { SEATS, other } from './board.js';
export { hashState } from './hash.js';

export function createEngine(cfg) {
  const board = buildBoard(cfg.board);
  return {
    cfg,
    board,
    newMatch: (matchNo) => newMatchState(cfg, matchNo),
    validate: (state, seat, actions) => validateBundle(state, seat, actions, cfg, board),
    fingerprint: canonicalJson,
    resolve: (state, bundles) => resolveRound(state, bundles, cfg, board),
    beginLive: (state) => beginLiveRound(state),
    tickLive: (live) => { simulateTick(live.state, cfg, board, live.ticks++, live.timeline); },
    advanceLive: (live, ticks) => {
      while (live.ticks < ticks && !live.state.over) simulateTick(live.state, cfg, board, live.ticks++, live.timeline);
      return live;
    },
    finishLive: (live, bundles) => finishLiveRound(live, bundles, cfg, board),
    replayLive: (state, bundles) => {
      const live = beginLiveRound(state);
      while (live.ticks < Math.round(cfg.match.roundSeconds * cfg.match.ticksPerSecond) && !live.state.over) {
        simulateTick(live.state, cfg, board, live.ticks++, live.timeline);
      }
      return finishLiveRound(live, bundles, cfg, board);
    },
  };
}

/**
 * Resolves one round atomically (SPEC.md §6 step 4). Both bundles must already have been
 * accepted against `prev`; they are re-checked here so a bug can never apply a bad bundle.
 * Returns { state, timeline, summary, hash }; `prev` is not modified.
 */
export function resolveRound(prev, bundles, cfg, board) {
  if (prev.over) throw new Error('match is already over');
  for (const seat of SEATS) {
    const check = validateBundle(prev, seat, bundles[seat] ?? [], cfg, board);
    if (!check.ok) throw new Error(`bundle for ${seat} is invalid: ${check.errors.map((e) => e.reason).join('; ')}`);
  }

  const state = structuredClone(prev);
  // P1 then P2: they cannot interfere (separate slots and gold), so the order is only for determinism.
  for (const seat of SEATS) applyBundle(state, seat, bundles[seat] ?? [], cfg);

  const timeline = timelineOf(state);
  simulateRound(state, cfg, board, timeline);
  return finishRound(state, timeline, cfg);
}

function timelineOf(state) {
  return {
    match: state.match,
    round: state.round,
    towers: Object.values(state.towers).map(({ slot, owner, type, level, targeting }) => ({ slot, owner, type, level, targeting })),
    start: statsOf(state),
    events: [],
    frames: [],
  };
}

function beginLiveRound(prev) {
  if (prev.over) throw new Error('match is already over');
  const state = structuredClone(prev);
  return { state, timeline: timelineOf(state), ticks: 0 };
}

// New orders apply together at the END of a live slot, after existing combat.
function finishLiveRound(live, bundles, cfg, board) {
  if (!live.state.over) {
    for (const seat of SEATS) {
      const check = validateBundle(live.state, seat, bundles[seat] ?? [], cfg, board);
      if (!check.ok) throw new Error(`invalid live bundle for ${seat}`);
    }
    for (const seat of SEATS) applyBundle(live.state, seat, bundles[seat] ?? [], cfg);
  }
  return finishRound(live.state, live.timeline, cfg);
}

function finishRound(state, timeline, cfg) {
  const start = timeline.start;
  const round = state.round;
  if (!state.over && round >= cfg.match.maxRounds) {
    // Round limit: more base health wins; equal is a draw. Gold and kills never decide this.
    const { P1, P2 } = state.players;
    if (P1.base === P2.base) state.over = { result: 'draw', winner: null, reason: 'round_limit', round };
    else state.over = { result: 'win', winner: P1.base > P2.base ? 'P1' : 'P2', reason: 'round_limit', round };
  }
  if (!state.over) {
    const income = incomeAfterRound(cfg, round);
    for (const seat of SEATS) {
      state.players[seat].gold += income;
      state.players[seat].income += income;
    }
    state.round += 1;
  }

  timeline.end = statsOf(state);
  timeline.over = state.over;

  const kills = { P1: timeline.end.P1.kills - start.P1.kills, P2: timeline.end.P2.kills - start.P2.kills };
  const baseHits = { P1: start.P1.base - timeline.end.P1.base, P2: start.P2.base - timeline.end.P2.base }; // damage taken
  return { state, timeline, summary: { match: state.match, round, kills, baseHits, over: state.over }, hash: hashState(state) };
}

function statsOf(state) {
  const out = {};
  for (const seat of SEATS) {
    const p = state.players[seat];
    out[seat] = { gold: p.gold, base: p.base, kills: p.kills, towerDamage: Math.round(p.towerDamage), queued: p.queue.length };
  }
  return out;
}
