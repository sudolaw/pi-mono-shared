// @ts-check
// The engine's only public face (spec §5). Pure functions: no I/O, no clock, no unseeded
// randomness, and inputs are never mutated. The match imports this file and nothing else.

import { makeState, cloneState, SEATS } from './state.js';
import { startTurn, payIncome } from './board.js';
import { validateActions, applyActions, legalFor } from './moves.js';
import { runTurn } from './tick.js';
import { view as viewOf, report } from './views.js';
import { render as renderOf } from './render.js';
import { outcome as outcomeOf } from './outcome.js';
import { hashValue } from '../shared/hash.js';
import { tuneWave } from './tuning.js';

export { SEATS, report };
export { randomBurst, NORMAL_INTENSITY } from './tuning.js';

/** @typedef {import('../types/game.js').Level} Level */
/** @typedef {import('../types/game.js').State} State */
/** @typedef {import('../types/game.js').Action} Action */

/** Seconds of game time one wave lasts: its ticks times the tick length. */
export const waveSeconds = (/** @type {Level} */ level) => level.rules.ticksPerTurn * level.rules.dt;

/** Ticks between two recorded spectator frames: one frame per second of game time. */
export const frameIntervalTicks = (/** @type {Level} */ level) => Math.max(1, Math.round(1 / level.rules.dt));

/** @param {Level} level @param {number} seed @returns {State} */
export const setup = (level, seed) => makeState(level, seed);

export const validate = (state, seat, actions, level) => validateActions(state.boards[seat], actions, level);

export const legalMoves = (state, seat, level) => legalFor(state.boards[seat], level);

/**
 * Plays one turn on both boards: each board applies its actions, queues the wave, runs the
 * ticks and is paid its income. Returns the next state and what happened. With
 * opts.recordEvery (in ticks), also returns per-board frames for the spectator's animation.
 * opts.tuning is the host's intensity and extra attackers for this wave (both boards alike).
 * @param {State} state
 * @param {{ P1?: Action[], P2?: Action[] }} actions
 * @param {Level} level
 * @param {{ recordEvery?: number, tuning?: import('./tuning.js').Tuning }} [opts]
 */
export function apply(state, actions, level, opts = {}) {
  const next = cloneState(state);
  const wave = tuneWave(next.turn < level.waves.count ? next.waves[next.turn] : null, level, opts.tuning);
  const events = [];
  const frames = opts.recordEvery ? {} : null;
  for (const seat of SEATS) {
    const board = next.boards[seat], list = actions?.[seat] ?? [];
    const check = validateActions(board, list, level);
    if (check.ok === false) throw new Error(`engine.apply: invalid actions for ${seat}: ${check.message}`);
    const ctx = { level, seat, events, wave: next.turn + 1, turnTick: 0, frames: frames ? (frames[seat] = []) : null, recordEvery: opts.recordEvery };
    startTurn(board, wave);
    applyActions(ctx, board, list, level);
    runTurn(ctx, board);
    payIncome(board, level);
  }
  next.turn++;
  return { state: next, events, frames };
}

export const view = viewOf;
export const render = renderOf;
export const outcome = outcomeOf;
export const hash = (state) => hashValue(state);
