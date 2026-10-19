// Makes and copies the whole match state (spec §4.2). All waves are generated here, at
// setup; the state is plain JSON and round-trips unchanged.

import { generateWaves } from './waves.js';
import { makeBoard } from './board.js';

export const SEATS = ['P1', 'P2'];
export const other = (seat) => (seat === 'P1' ? 'P2' : 'P1');

export function makeState(level, seed) {
  return {
    seed, turn: 0,
    waves: generateWaves(level, seed),
    boards: { P1: makeBoard(level), P2: makeBoard(level) },
  };
}

export const cloneState = (state) => structuredClone(state);
