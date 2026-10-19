// What a hit does (spec §2.2). A tower type lists its effects in the level file; adding a
// tower made of existing effects needs no code. Damage is credited to the slot that dealt it
// (overkill not counted), and the last slot to hit an attacker gets the kill.

import { pointAt, inRange } from './geometry.js';
import { credit } from './board.js';
import { emit } from './events.js';

export function hurt(ctx, board, slot, target, amount) {
  const dealt = Math.max(1, amount - ctx.level.attackers[target.type].armor);
  credit(board, slot, 'damage', Math.round(Math.min(dealt, Math.max(0, target.hp)) * 10) / 10);
  target.hp -= dealt;
  target.lastHit = slot;
}

export const EFFECTS = {
  damage(ctx, board, slot, target, stats) {
    hurt(ctx, board, slot, target, stats.damage);
  },
  splash(ctx, board, slot, target, stats, fx, at) {
    for (const a of board.attackers) {
      if (a === target || a.hp <= 0) continue;
      const p = pointAt(ctx.level.layout.path, a.dist);
      if (inRange(p.x, p.y, at.x, at.y, fx.radius)) hurt(ctx, board, slot, a, stats.damage * fx.share);
    }
    emit(ctx, 'splash', { x: at.x, y: at.y, r: fx.radius });
  },
  slow(ctx, board, slot, target, stats, fx) {
    target.slowFactor = fx.factor;
    target.slowUntil = board.tick + fx.ticks;
  },
};

/** Applies every on-hit effect of a tower type to a target hit at point `at`. */
export function hit(ctx, board, slot, towerType, stats, target, at) {
  for (const fx of ctx.level.towers[towerType].onHit) EFFECTS[fx.effect](ctx, board, slot, target, stats, fx, at);
}
