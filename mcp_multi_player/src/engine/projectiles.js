// Shots in flight (spec §2.2): each homes on its target's current position, hits when it is
// within one step, and vanishes if the target is already gone. A shell carries the damage it
// was fired with, so it still lands if its tower is destroyed meanwhile.

import { pointAt } from './geometry.js';
import { hit } from './effects.js';

export function moveProjectiles(ctx, board) {
  const { level } = ctx;
  for (const pr of board.projectiles) {
    const target = board.attackers.find((a) => a.id === pr.targetId && a.hp > 0);
    if (!target) { pr.done = true; continue; }
    const p = pointAt(level.layout.path, target.dist);
    const dx = p.x - pr.x, dy = p.y - pr.y, d = Math.hypot(dx, dy), step = pr.speed * level.rules.dt;
    if (d <= step) {
      hit(ctx, board, pr.slot, pr.tower, { damage: pr.damage }, target, p);
      pr.done = true;
    } else {
      pr.x += (dx / d) * step; pr.y += (dy / d) * step;
    }
  }
  board.projectiles = board.projectiles.filter((pr) => !pr.done);
}
