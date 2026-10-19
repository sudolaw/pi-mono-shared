// @ts-check
// Judges the match once per turn (spec §2.8): a base at 0 loses; if both fall in the same
// turn or both survive every wave, compare base health, then fewer leaks, then more kills.

/** @typedef {import('../types/game.js').Outcome} Outcome */

/** @param {import('../types/game.js').State} state @param {import('../types/game.js').Level} level @returns {Outcome} */
export function outcome(state, level) {
  const a = state.boards.P1, b = state.boards.P2;
  const out1 = a.health <= 0, out2 = b.health <= 0;
  if (out1 && out2) return tiebreak(a, b, `both bases fell on wave ${state.turn}`);
  if (out1 || out2) {
    const loser = out1 ? 'P1' : 'P2';
    return { over: true, winner: out1 ? 'P2' : 'P1', reason: `${loser}'s base fell on wave ${state.turn}` };
  }
  if (state.turn >= level.waves.count) return tiebreak(a, b, `both survived all ${level.waves.count} waves`);
  return { over: false };
}

/** @returns {Outcome} */
function tiebreak(a, b, why) {
  if (a.health !== b.health) return { over: true, winner: a.health > b.health ? 'P1' : 'P2', reason: `${why}; more base health left` };
  if (a.leaked !== b.leaked) return { over: true, winner: a.leaked < b.leaked ? 'P1' : 'P2', reason: `${why}; same base health, fewer leaks` };
  if (a.kills !== b.kills) return { over: true, winner: a.kills > b.kills ? 'P1' : 'P2', reason: `${why}; same base health and leaks, more kills` };
  return { over: true, winner: null, reason: `${why}; equal on every count, a draw` };
}
