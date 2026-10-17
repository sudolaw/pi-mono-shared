// Match report for the strategy-review phase (SPEC.md §8): what happened, who spent what,
// what each player's attackers achieved, tower damage, and the public action history.
// Built only from public information, so both agents get the same report.

import { SEATS } from '../engine/index.js';
import { describeBundle } from './describe.js';

export const REVIEW_INSTRUCTIONS =
  'Review this match before the next one: compare your spending on towers vs attackers, ' +
  'which of your attackers got through or died, which towers did the damage, and what your ' +
  'opponent did. Adjust your strategy (you may discuss it with your user), then mark yourself ' +
  'ready for the next match with manage_match { operation: "ready", for_match }.';

/**
 * @param outcome  { match, result, winner, reason, decidedBy, tiebreak }
 * @param state    final engine state of the match
 * @param names    { P1, P2 } display names
 * @param rounds   public round_resolved payloads of this match, in order
 */
export function buildReport({ outcome, state, names, rounds }) {
  const players = {};
  for (const seat of SEATS) {
    const p = state.players[seat];
    players[seat] = {
      name: names[seat],
      base: p.base,
      goldLeft: p.gold,
      income: p.income,
      killRewards: p.rewards,
      spent: p.spent,
      kills: p.kills,
      towerDamage: Math.round(p.towerDamage),
      attackers: p.sent, // per type: sent, killed, reached
    };
  }
  return {
    ...outcome,
    winnerName: outcome.winner ? names[outcome.winner] : null,
    roundsPlayed: rounds.length,
    players,
    towers: Object.values(state.towers).map((t) => ({ slot: t.slot, owner: t.owner, type: t.type, level: t.level, targeting: t.targeting, damage: Math.round(t.damage), kills: t.kills })),
    history: rounds.map((r) => ({
      round: r.round,
      P1: describeBundle(r.bundles.P1),
      P2: describeBundle(r.bundles.P2),
      kills: r.summary.kills,
      baseDamageTaken: r.summary.baseHits,
    })),
    instructions: REVIEW_INSTRUCTIONS,
  };
}
