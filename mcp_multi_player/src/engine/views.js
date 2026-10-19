// @ts-check
// What each agent receives (spec §3, §10.3): its own board only. No opponent data and no
// future waves; the opponent appears only in the match report once the match is over.

import { legalFor } from './moves.js';
import { towerStats, upgradeCost } from './stats.js';

/** A tower as the agent sees it; damage is what it will deal in the coming wave `wave`. */
export function towerView(level, t, lastTurn, wave = 1) {
  return {
    slot: t.slot, type: t.type, health: t.health, max_health: level.rules.towerHealth,
    ups: { ...t.ups }, ...towerStats(level, t, wave), targeting: t.targeting, upgrade_cost: upgradeCost(level, t.type),
    last_wave: lastTurn?.towers[t.slot] ?? { damage: 0, kills: 0, shots: 0 }, total: { ...t.totals },
  };
}

export function view(state, seat, level) {
  const b = state.boards[seat], length = level.layout.path.length;
  const byType = {};
  for (const a of b.attackers) byType[a.type] = (byType[a.type] ?? 0) + 1;
  const closest = [...b.attackers].sort((x, y) => y.dist - x.dist || x.id - y.id).slice(0, 5)
    .map((a) => ({ id: a.id, type: a.type, hp: Math.max(0, a.hp), max_hp: a.maxHp, progress: Math.round((a.dist / length) * 100) / 100 }));
  return {
    seat,
    wave: { done: state.turn, of: level.waves.count },
    me: {
      health: b.health, gold: b.gold, kills: b.kills, leaked: b.leaked, spent: b.spent, towers_lost: b.towersLost,
      towers: Object.values(b.towers).sort((x, y) => x.slot.localeCompare(y.slot)).map((t) => towerView(level, t, b.lastTurn, state.turn + 1)),
      leak_order: level.layout.leakOrder.filter((id) => b.towers[id]),
    },
    last_wave: { ...b.lastTurn, towers: undefined },
    threats: { on_board: b.attackers.length, by_type: byType, closest },
    legal: legalFor(b, level),
  };
}

/** The end-of-match report: both boards' final numbers, shown to both agents (spec §3). */
export function report(state, level, result) {
  const side = (b) => ({ health: b.health, kills: b.kills, leaked: b.leaked, spent: b.spent, gold: b.gold, towers_lost: b.towersLost,
    towers: Object.values(b.towers).sort((x, y) => x.slot.localeCompare(y.slot))
      .map((t) => ({ slot: t.slot, type: t.type, ups: { ...t.ups }, health: t.health, damage: Math.round(t.totals.damage), kills: t.totals.kills })) });
  return { waves_played: state.turn, of: level.waves.count, result, P1: side(state.boards.P1), P2: side(state.boards.P2) };
}
