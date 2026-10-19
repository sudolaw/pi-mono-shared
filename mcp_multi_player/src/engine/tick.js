// The heartbeat (spec §2.6): one turn is a fixed number of ticks, and every tick runs the same
// steps in the same order. Each board runs on its own; boards never touch.

import { spawn, move, removeDead, arrivals } from './attackers.js';
import { towersAct } from './towers.js';
import { moveProjectiles } from './projectiles.js';
import { renderBoard } from './render.js';

export function runTurn(ctx, board) {
  const { ticksPerTurn } = ctx.level.rules;
  for (let t = 0; t < ticksPerTurn; t++) {
    ctx.turnTick = t;
    board.tick++;
    spawn(ctx, board);
    move(ctx, board);
    towersAct(ctx, board);
    moveProjectiles(ctx, board);
    removeDead(ctx, board);
    arrivals(ctx, board);
    if (ctx.frames && (t + 1) % ctx.recordEvery === 0) ctx.frames.push(renderBoard(board, ctx.level));
  }
}
