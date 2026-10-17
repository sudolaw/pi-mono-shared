// Match state: plain JSON-safe data, so it can be hashed, saved and sent as-is.
// Everything that must survive between rounds lives here (SPEC.md §6): attacker
// positions, health, slows, tower cooldowns, projectiles in flight, spawn queues/timers.

import { SEATS } from './board.js';

export function newMatchState(cfg, matchNo) {
  const players = {};
  for (const seat of SEATS) {
    players[seat] = {
      gold: cfg.economy.startingGold,
      base: cfg.match.baseHealth,
      kills: 0, // enemy attackers this player's towers killed
      towerDamage: 0, // damage this player's towers actually removed from enemy attackers
      income: 0, // total income received
      rewards: 0, // total kill rewards received
      spent: { towers: 0, upgrades: 0, attackers: 0 },
      // outcome of the attackers this player sent, per type
      sent: Object.fromEntries(Object.keys(cfg.attackers).map((t) => [t, { sent: 0, killed: 0, reached: 0 }])),
      queue: [], // attacker types waiting to spawn, in order
      spawnWait: 0, // ticks until this player's next spawn may happen
    };
  }
  return {
    match: matchNo, // 0 = warm-up
    round: 1, // the round currently open for bundles
    tick: 0, // ticks simulated so far in this match
    nextId: 1, // attacker / projectile ids, in creation order
    over: null, // { result: 'win' | 'draw', winner, reason, round }
    players,
    towers: {}, // slot id → { slot, owner, type, level, targeting, cooldown, damage, kills }
    attackers: [], // { id, owner, type, dist, hp, maxHp, slow, slowLeft, lastHit }
    projectiles: [], // { id, slot, owner, type, x, y, targetId, damage }
  };
}

/** Attackers a player has alive on the board plus waiting in their queue. */
export function attackersOnBoard(state, seat) {
  return state.attackers.filter((a) => a.owner === seat).length + state.players[seat].queue.length;
}
