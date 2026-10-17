// One live decision slot (SPEC.md §6, "Live decision slots"): from round 3, combat runs on
// the server clock. Tick n is due at openedAt + n / ticksPerSecond, so a late timer catches
// up on the next call instead of slowing the game down. The engine (a worker in the server)
// owns the slot's full timeline; this side keeps only the latest state and frame.
// The series decides what a finished slot means; this class only keeps time.

import { SEATS } from '../engine/index.js';

export class LiveSlot {
  /** Starts a slot from the state saved at its opening. */
  static async begin({ engine, state, clock, settings, openedAt }) {
    return new LiveSlot({ engine, clock, settings, openedAt, live: await engine.beginLive(state) });
  }

  constructor({ engine, clock, settings, openedAt, live }) {
    this.engine = engine;
    this.clock = clock;
    this.openedAt = openedAt;
    this.tickMs = 1000 / settings.match.ticksPerSecond;
    this.totalTicks = Math.round(settings.match.roundSeconds * settings.match.ticksPerSecond);
    this.live = live; // { state, ticks, timeline } (timeline: towers + latest frames)
    this.timer = null;
  }

  get state() { return this.live.state; }

  /** All ticks have run, or a base fell. */
  get finished() { return this.live.ticks >= this.totalTicks || !!this.live.state.over; }

  /** Runs every tick that is due by now. Returns true if a new spectator frame was recorded. */
  async catchUp() {
    const due = Math.min(this.totalTicks, Math.floor((this.clock.now() - this.openedAt) / this.tickMs));
    const before = this.live.timeline.frames.at(-1)?.t;
    if (this.live.ticks < due) this.live = await this.engine.advanceLive(this.live, due);
    return this.live.timeline.frames.at(-1)?.t !== before;
  }

  /** Calls onTick when the next tick is due. */
  arm(onTick) {
    this.disarm();
    const due = this.openedAt + (this.live.ticks + 1) * this.tickMs;
    this.timer = this.clock.setTimeout(onTick, Math.max(0, due - this.clock.now()));
  }

  disarm() {
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Applies both bundles at the slot end: { state, timeline, summary, hash }. */
  finish(bundles) {
    this.disarm();
    return this.engine.finishLive(this.live, bundles);
  }

  /** Drops the slot without resolving it (match ended early, host restart or cancel). */
  async discard() {
    this.disarm();
    await this.engine.discardLive?.();
  }

  /** Public picture for spectators: the latest frame, towers and scoreboard numbers. */
  snapshot() {
    const frame = this.live.timeline.frames.at(-1);
    if (!frame) return null;
    const s = this.live.state;
    return {
      match: s.match,
      round: s.round,
      frame,
      towers: this.live.timeline.towers,
      players: Object.fromEntries(SEATS.map((seat) => {
        const p = s.players[seat];
        return [seat, { base: p.base, gold: p.gold, kills: p.kills }];
      })),
    };
  }
}
