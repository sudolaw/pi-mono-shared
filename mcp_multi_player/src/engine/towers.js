// The one fire loop every tower type shares (spec §2.2, §2.6): count the cooldown down, pick
// a target with the tower's rule, deliver the shot, and add the fire interval back. Numbers
// come from towerStats, so upgrades apply on the next shot.

import { pointAt, inRange } from './geometry.js';
import { TARGETING } from './targeting.js';
import { speedOf } from './attackers.js';
import { towerStats } from './stats.js';
import { hit } from './effects.js';
import { credit } from './board.js';
import { emit } from './events.js';

export function towersAct(ctx, board) {
  const { level } = ctx, path = level.layout.path;
  for (const slot of level.layout.slots) {
    const tower = board.towers[slot.id];
    if (!tower) continue;
    tower.cooldown -= level.rules.dt;
    if (tower.cooldown > 1e-9) continue;
    const def = level.towers[tower.type];
    // A tower's numbers can't change during a wave (actions apply before the first tick), so
    // they are worked out once per wave and slot.
    const cache = (ctx.statsBySlot ??= new Map());
    if (!cache.has(slot.id)) cache.set(slot.id, towerStats(level, tower, ctx.wave));
    const stats = cache.get(slot.id);
    const candidates = [];
    for (const a of board.attackers) {
      if (a.hp <= 0 || a.dist >= path.length) continue;
      const p = pointAt(path, a.dist);
      if (inRange(p.x, p.y, slot.x, slot.y, stats.range)) candidates.push({ a, p, speed: speedOf(ctx, board, a) });
    }
    if (!candidates.length) { tower.cooldown = 0; continue; }
    const target = TARGETING[tower.targeting](candidates);
    const at = candidates.find((c) => c.a === target).p;
    credit(board, slot.id, 'shots');
    emit(ctx, 'shot', { slot: slot.id, tower: tower.type, target: target.id, x1: slot.x, y1: slot.y, x2: at.x, y2: at.y });
    if (def.delivery.kind === 'instant') hit(ctx, board, slot.id, tower.type, stats, target, at);
    else board.projectiles.push({ id: board.nextShot++, x: slot.x, y: slot.y, targetId: target.id, speed: def.delivery.speed, tower: tower.type, slot: slot.id, damage: stats.damage });
    tower.cooldown += 1 / stats.rate;
  }
}
