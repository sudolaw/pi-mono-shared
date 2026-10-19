// @ts-check
// Everything that happens to attackers over a turn (spec §2.3, §2.6): spawn with the wave's
// health scale, move along the path (slowed if chilled), pay the reward on death, and do one
// point of damage on arrival: to the tower closest to the base while any stand, then to the
// base itself.

import { pointAt } from './geometry.js';
import { emit } from './events.js';
import { credit } from './board.js';

export const isSlowed = (a, board) => a.slowUntil > board.tick;

export function speedOf(ctx, board, a) {
  return ctx.level.attackers[a.type].speed * (isSlowed(a, board) ? a.slowFactor : 1);
}

export function spawn(ctx, board) {
  while (board.queue.length && board.queue[0].atTick <= ctx.turnTick) {
    const s = board.queue.shift();
    const hp = Math.round(ctx.level.attackers[s.type].hp * s.hpScale);
    const a = { id: board.nextId++, type: s.type, hp, maxHp: hp, dist: 0, slowUntil: 0, slowFactor: 1, lastHit: null };
    board.attackers.push(a);
    board.lastTurn.spawned++;
    emit(ctx, 'spawn', { id: a.id, unit: a.type, hp });
  }
}

export function move(ctx, board) {
  for (const a of board.attackers) a.dist += speedOf(ctx, board, a) * ctx.level.rules.dt;
}

export function removeDead(ctx, board) {
  board.attackers = board.attackers.filter((a) => {
    if (a.hp > 0) return true;
    const reward = ctx.level.attackers[a.type].reward;
    board.gold += reward; board.earned += reward; board.kills++;
    board.lastTurn.killed++; board.lastTurn.earned += reward;
    if (a.lastHit) credit(board, a.lastHit, 'kills');
    const p = pointAt(ctx.level.layout.path, a.dist);
    emit(ctx, 'death', { id: a.id, unit: a.type, x: p.x, y: p.y, reward });
    return false;
  });
}

export function arrivals(ctx, board) {
  const length = ctx.level.layout.path.length;
  board.attackers = board.attackers.filter((a) => {
    if (a.dist < length) return true;
    board.leaked++; board.lastTurn.leaked++;
    const slot = ctx.level.layout.leakOrder.find((id) => board.towers[id]);
    if (slot) {
      const t = board.towers[slot];
      t.health--; board.lastTurn.tower_hits++;
      emit(ctx, 'leak', { id: a.id, unit: a.type, hit: slot, left: t.health });
      if (t.health <= 0) {
        delete board.towers[slot];
        board.towersLost++; board.lastTurn.towers_lost.push(slot);
        emit(ctx, 'tower_lost', { slot, tower: t.type });
      }
    } else {
      board.health = Math.max(0, board.health - 1); board.lastTurn.base_hits++;
      emit(ctx, 'leak', { id: a.id, unit: a.type, hit: 'base', left: board.health });
    }
    return false;
  });
}
