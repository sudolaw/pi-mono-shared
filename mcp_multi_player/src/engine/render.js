// What the spectator page draws (spec §4.2, §11): both boards' towers (with health and
// upgrades), attackers with their position, distance along the path and health share,
// projectiles and the scoreboard numbers. Rounded for the wire.

import { pointAt } from './geometry.js';
import { isSlowed } from './attackers.js';
import { towerStats } from './stats.js';
import { SEATS } from './state.js';

const r1 = (v) => Math.round(v * 10) / 10;

export function renderBoard(board, level) {
  const path = level.layout.path;
  return {
    health: board.health, gold: board.gold, kills: board.kills, leaked: board.leaked, spent: board.spent, towers_lost: board.towersLost,
    towers: Object.values(board.towers).map((t) => ({ slot: t.slot, type: t.type, ups: { ...t.ups }, health: t.health, range: towerStats(level, t).range, targeting: t.targeting })),
    units: board.attackers.map((a) => {
      const p = pointAt(path, a.dist);
      return { id: a.id, type: a.type, d: r1(a.dist), x: r1(p.x), y: r1(p.y), dx: p.dx, dy: p.dy, hp: Math.max(0, Math.round((a.hp / a.maxHp) * 100) / 100), slowed: isSlowed(a, board) };
    }),
    shots: board.projectiles.map((p) => ({ x: r1(p.x), y: r1(p.y), tower: p.tower })),
  };
}

export function render(state, level) {
  return {
    turn: state.turn, of: level.waves.count,
    boards: Object.fromEntries(SEATS.map((s) => [s, renderBoard(state.boards[s], level)])),
  };
}
