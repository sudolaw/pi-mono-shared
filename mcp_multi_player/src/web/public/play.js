// Turns a turn's frames and events into animation (spec §11). A wave plays in real time by
// default (30 s for 30 s of game time). Units glide along the path between the recorded
// frames (one per second of game time) by their distance, so they follow the corners; shots,
// splashes, kills, leaks and destroyed towers appear at their tick. Then the board snaps to
// the final render so drawing never drifts. When turns pile up (a slow tab, a fast replay),
// queued turns play a little faster (half again per waiting turn) instead of being skipped. Live, the page also learns how long turns
// really take (agents think between waves) and stretches each wave to match, so the screen keeps
// moving instead of playing fast and then freezing until the next turn arrives.
//
// Contract (test/play.test.js):
// - play(turn) resolves once that turn has been shown (animated, or snapped when far behind)
//   or dropped by clear().
// - clear() drops every queued turn and stops the running animation at its next frame; nothing
//   queued before clear() is drawn after it. Switching between live and replay calls clear().
// - Drawing, the frame scheduler and the clock are passed in, so this file has no DOM access.

const SEATS = ['P1', 'P2'];

function pathOf(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { points, cum, length: cum.at(-1) };
}

function pointAt(path, d) {
  const { points, cum } = path;
  if (d <= 0) return { ...points[0] };
  if (d >= path.length) return { ...points.at(-1) };
  let i = 1;
  while (cum[i] < d) i++;
  const a = points[i - 1], b = points[i], t = (d - cum[i - 1]) / (cum[i] - cum[i - 1]);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
}

function lerpBoard(path, a, b, f) {
  if (!a) return b;
  const before = new Map(a.units.map((u) => [u.id, u]));
  return { ...b, units: b.units.map((u) => {
    const p = before.get(u.id);
    if (!p || p.d === undefined || u.d === undefined) return u;
    return { ...u, ...pointAt(path, p.d + (u.d - p.d) * f), hp: p.hp + (u.hp - p.hp) * f };
  }) };
}

/** Events grouped by tick, so each frame looks only at the few ticks around it. */
function byTick(events) {
  const buckets = new Map();
  for (const e of events) {
    if (!buckets.has(e.tick)) buckets.set(e.tick, []);
    buckets.get(e.tick).push(e);
  }
  return buckets;
}

/** The longest any effect stays on screen, in ticks (a destroyed tower's flash). */
const LONGEST_EFFECT = 15;

function effectsAt(buckets, tick, instant) {
  const fx = { beams: [], tracers: [], booms: [], pops: [], leak: false, hits: new Set(), lost: [] };
  const recent = [];
  for (let t = Math.floor(tick) - LONGEST_EFFECT; t <= Math.ceil(tick) + 1; t++) if (buckets.has(t)) recent.push(...buckets.get(t));
  for (const e of recent) {
    const age = tick - e.tick;
    if (e.type === 'shot') {
      if (instant[e.tower] && Math.abs(age) <= 1) fx.beams.push(e);
      else if (!instant[e.tower] && age >= 0 && age < 3) fx.tracers.push({ ...e, k: age / 3 });
    } else if (e.type === 'splash' && age >= 0 && age < 4) fx.booms.push({ ...e, k: (age + 0.5) / 4 });
    else if (e.type === 'death' && age >= 0 && age < 5) fx.pops.push({ ...e, k: age / 5 });
    else if (e.type === 'leak' && age >= 0 && age < 10) { if (e.hit === 'base') fx.leak = true; else fx.hits.add(e.hit); }
    else if (e.type === 'tower_lost' && age >= 0 && age < 15) fx.lost.push({ ...e, k: age / 15 });
  }
  return fx;
}

/**
 * @param {object} o
 * @param {object} o.layout       the series layout from /api/series/:id
 * @param {object} o.ctxs         { P1, P2 } drawing targets handed to drawBoard
 * @param {Function} o.drawBoard  (ctx, layout, board, seat, fx) => void
 * @param {number} [o.ticksPerTurn]  ticks in one wave
 * @param {number} [o.waveSeconds]   seconds of game time in one wave (played in real time at 1x)
 * @param {(fn: (now: number) => void) => void} [o.frame]  requestAnimationFrame
 * @param {() => number} [o.now]   performance.now
 * @param {boolean} [o.reducedMotion]  snap every turn instead of animating
 */
export function createPlayer({ layout, ctxs, drawBoard, ticksPerTurn = 300, waveSeconds = 30, frame = (fn) => requestAnimationFrame(fn), now = () => performance.now(), reducedMotion = false }) {
  let settled = { P1: null, P2: null }, queue = [], busy = false, speed = 1;
  /** Live only: a running average of the time between turns arriving (ms), or null. */
  let turnGapMs = null, lastArrival = null;
  /** Bumped by clear(); an animation from an older generation stops without drawing. */
  let generation = 0;
  const path = pathOf(layout.path);
  const instant = Object.fromEntries(Object.entries(layout.towers).map(([k, t]) => [k, t.instant]));
  const draw = (boards, fx = {}) => SEATS.forEach((s) => drawBoard(ctxs[s], layout, boards[s], s, fx[s]));

  function show(render) { settled = { ...render.boards }; draw(settled); }

  /**
   * How fast to play right now: the chosen speed, plus half again for every turn waiting. A gentle
   * catch-up keeps the motion smooth; a hard jump (4x) made playback lurch between slow and fast.
   */
  const rate = () => speed * (1 + 0.5 * queue.length);

  /** A wave's length on screen at 1x: the pace, or (live) the time turns are really taking. */
  const waveMsNow = () => Math.max(waveSeconds * 1000, turnGapMs ?? 0);

  function animate(turn) {
    const mine = generation, waveMs = waveMsNow();
    return new Promise((resolve) => {
      let progress = 0, last = now();
      const events = { P1: [], P2: [] };
      for (const e of turn.events ?? []) events[e.board]?.push(e);
      const buckets = { P1: byTick(events.P1), P2: byTick(events.P2) };
      const step = (at) => {
        if (mine !== generation) return resolve(); // cleared: stop without drawing
        // Progress is integrated frame by frame, so a turn already playing speeds up as soon as
        // others queue behind it, and jumps to its end when far behind.
        progress = queue.length >= 3 ? 1 : progress + ((at - last) * rate()) / waveMs;
        last = at;
        const p = Math.min(1, progress), boards = {}, fx = {};
        for (const s of SEATS) {
          const fr = turn.frames?.[s];
          if (!fr?.length) { boards[s] = turn.render.boards[s]; continue; }
          const pos = p * fr.length, k = Math.min(fr.length - 1, Math.floor(pos));
          boards[s] = lerpBoard(path, k === 0 ? settled[s] : fr[k - 1], fr[k], Math.min(1, pos - k));
          fx[s] = effectsAt(buckets[s], p * ticksPerTurn, instant);
        }
        draw(boards, fx);
        if (p < 1) frame(step);
        else { show(turn.render); resolve(); }
      };
      frame(step);
    });
  }

  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const turn = queue.shift();
      // Behind by a turn or two: play faster (see rate). Far behind: jump to the latest result.
      if (reducedMotion || queue.length >= 3) show(turn.render);
      else await animate(turn);
      turn.onDone?.();
    }
    busy = false;
  }

  return {
    show,
    play(turn) { return new Promise((resolve) => { queue.push({ ...turn, onDone: resolve }); pump(); }); },
    /**
     * Live turns call this as they arrive. The average gap becomes the wave's length on screen,
     * so a wave ends about when the next one arrives. (Stretching beyond the gap made the screen
     * fall further behind with every wave.)
     */
    noteArrival() {
      const at = now();
      if (lastArrival !== null) {
        const gap = at - lastArrival;
        turnGapMs = turnGapMs === null ? gap : 0.6 * turnGapMs + 0.4 * gap;
      }
      lastArrival = at;
    },
    /** Forget the learned pace (a new match, or switching to a replay). */
    resetPace() { turnGapMs = null; lastArrival = null; },
    setSpeed(x) { speed = x; },
    /** Seconds one wave takes on screen at 1x (the series' pace, which the host can change). */
    setWaveSeconds(x) { if (x > 0) waveSeconds = x; },
    /** Drops queued turns (their play() promises resolve) and stops the running animation. */
    clear() {
      generation++;
      const dropped = queue;
      queue = [];
      for (const t of dropped) t.onDone?.();
    },
    get boards() { return settled; },
  };
}
