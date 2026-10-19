// Builds event records so every event has the same shape: which board, which tick of the
// turn, what happened (spec §4.2). Positions are rounded to keep the stream small.

const r1 = (v) => Math.round(v * 10) / 10;

export function emit(ctx, type, data = {}) {
  const e = { board: ctx.seat, tick: ctx.turnTick, type };
  for (const [k, v] of Object.entries(data)) e[k] = typeof v === 'number' && !Number.isInteger(v) ? r1(v) : v;
  ctx.events.push(e);
}
