// The series record: the plain JSON saved as series.json (SPEC.md §13). Creating a series
// and a host restart both start from freshGame(), so the two can never drift apart.

/** A brand-new record for a series that nobody has joined yet. */
export function newRecord({ id, createdAt, overrides, settings }) {
  return { id, createdAt, overrides, settings, version: 1, seq: 0, ...freshGame() };
}

/** Everything a host restart clears: seats, score, matches and the deadline. */
export function freshGame() {
  return {
    phase: 'waiting_for_players',
    seats: { P1: null, P2: null }, // { playerId, name, joinedAt }
    ready: { P1: null, P2: null }, // the match number each seat is ready for
    wins: { P1: 0, P2: 0 },
    draws: 0,
    matchNo: 0, // current/last real match; the warm-up uses engine match 0
    tiebreakMatch: false,
    misses: { P1: 0, P2: 0 }, // deadline misses in the current match
    warmup: { round: 0, times: { P1: [], P2: [] } }, // decision times in ms
    deadlineSeconds: null,
    round: null, // { openedAt, pending: {P1, P2}, autoFilled: {P1, P2} }
    lastRound: null, // last resolved round, bundles revealed
    history: [], // finished matches (outcome + headline numbers)
    stateRef: null, // { match, round } of the saved state file for the open round
    result: null, // series result once finished
  };
}
