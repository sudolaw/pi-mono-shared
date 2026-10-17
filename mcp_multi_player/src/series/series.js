// One series: seats, phases, rounds, warm-up, deadline, draws/tiebreaks, best of N
// (SPEC.md §6, §8–§10). The engine does the game maths; this class decides *when* things
// happen, keeps both players honest, and writes everything to the store before replying.
//
// Phases: waiting_for_players → waiting_for_start → warmup → awaiting_actions
//         → strategy_review → … → series_finished (or cancelled at any time by the host)
// Agents only join; the host presses Start on the start screen to begin the warm-up and
// match 1. Between matches, both agents mark themselves ready for the next match.
//
// Mutations return { ok: true, ... } or { ok: false, error }. Player-facing mutations go
// through request() so a retried request id gets the original answer (idempotency).
// Every public method runs in the series' serial queue (queue.js); live slots keep time in
// live.js and the opening deadline is computed in deadline.js.

import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createEngine, SEATS, other } from '../engine/index.js';
import { applyOverrides } from '../config.js';
import { roundLine, describeOutcome } from './describe.js';
import { buildReport } from './report.js';
import { newRecord, freshGame } from './record.js';
import { SerialQueue } from './queue.js';
import { LiveSlot } from './live.js';
import { deadlineFor } from './deadline.js';

export const NAME_RE = /^[A-Za-z0-9 ._()-]{1,32}$/;

// Mutations that can be called from outside: each one is queued unless already inside a job.
const QUEUED = ['request', 'join', 'leave', 'ready', 'resign', 'submit',
  'hostStart', 'hostRestart', 'hostForfeit', 'hostCancelMatch', 'hostCancelSeries',
  'onDeadline', 'onLiveTick'];
// Notifications that wait until the job that raised them is on disk.
const HELD = new Set(['changed', 'event', 'combat']);

const realClock = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h) };

export class Series extends EventEmitter {
  /** Creates a brand-new series and writes it to the store. */
  static async create(store, { overrides = {}, clock = realClock, engineFactory = createEngine } = {}) {
    const settings = applyOverrides(overrides); // throws on bad overrides
    const id = `s_${randomBytes(4).toString('hex')}`;
    const record = newRecord({ id, createdAt: new Date(clock.now()).toISOString(), overrides, settings });
    await store.createSeriesDir(id);
    const series = new Series({ store, record, state: null, requests: {}, clock, engine: await engineFactory(settings) });
    await series.emitEvent('series_created', null, { settings: record.settings, overrides });
    if (Object.keys(overrides).length) await series.emitEvent('settings', null, { overrides });
    await series.persist();
    return series;
  }

  /** Loads a series after a restart. Pending bundles and "waiting on" come back as they were. */
  static async load(store, id, { clock = realClock, engineFactory = createEngine } = {}) {
    const record = await store.loadSeries(id);
    await store.prepareHistory(id);
    const state = record.stateRef ? await store.loadState(id, record.stateRef.match, record.stateRef.round) : null;
    const series = new Series({ store, record, state, requests: await store.loadRequests(id), clock, engine: await engineFactory(record.settings) });
    const last = record.history.at(-1);
    if (last) series.lastReport = await store.loadReport(id, last.match);
    if (series.isPlayingPhase()) {
      // The deadline of the open round starts again in full after a restart.
      record.round.openedAt = clock.now();
      if (series.isLiveRound()) await series.startLiveSlot();
      else series.armDeadline();
    }
    await series.audit('recovered', { phase: record.phase });
    return series;
  }

  constructor({ store, record, state, requests, clock, engine = createEngine(record.settings) }) {
    super();
    this.setMaxListeners(1000); // many long-polls and spectator streams may wait at once
    this.store = store;
    this.record = record;
    this.state = state; // engine state of the open round (warm-up or match)
    this.requests = requests;
    this.clock = clock;
    this.engine = engine;
    this.timer = null; // opening-round deadline
    this.live = null; // LiveSlot while a live decision slot runs
    this.dirty = false; // record changed since the last save
    this.lastReport = null;
    this.queue = new SerialQueue({
      commit: () => (this.dirty ? this.persist() : undefined),
      publish: (held) => {
        // Many changes in one job wake long-polls once, with the final version.
        const lastChange = held.findLastIndex(([event]) => event === 'changed');
        held.forEach(([event, args], index) => {
          if (event !== 'changed' || index === lastChange) super.emit(event, ...args);
        });
      },
      onFault: () => {
        this.clearTimers();
        super.emit('fault', new Error('series operation failed; restart recovery required'));
      },
    });
    for (const name of QUEUED) {
      const method = this[name].bind(this);
      this[name] = (...args) => (this.queue.inside ? method(...args) : this.queue.mutate(() => method(...args)));
    }
  }

  emit(event, ...args) {
    if (this.queue.buffering && HELD.has(event)) {
      this.queue.hold(event, args);
      return true;
    }
    return super.emit(event, ...args);
  }

  /** Waits for queued work; rejects if the series has failed. */
  idle() { return this.queue.idle(); }

  /** Runs fn between mutations, so it never sees a half-applied change. */
  read(fn) { return this.queue.read(fn); }

  get id() { return this.record.id; }
  get phase() { return this.record.phase; }
  seatOf(playerId) { return SEATS.find((s) => this.record.seats[s]?.playerId === playerId) ?? null; }
  names() { return { P1: this.record.seats.P1?.name ?? null, P2: this.record.seats.P2?.name ?? null }; }
  isPlayingPhase() { return this.record.phase === 'warmup' || this.record.phase === 'awaiting_actions'; }
  isLiveRound() {
    // Records written before live slots existed retain their original turn-based rules.
    const opening = this.record.settings.match.openingRounds;
    return this.record.phase === 'awaiting_actions' && opening !== undefined && this.state.round > opening;
  }

  /** The match number agents must mark ready for next (strategy review only), or null. */
  nextReadyMatch() {
    if (this.record.phase === 'strategy_review') return this.record.matchNo + 1;
    return null;
  }

  // ── idempotency ────────────────────────────────────────────────────────────

  /**
   * Runs a player mutation once per (player, request id). Same id + same payload → the
   * stored answer; same id + different payload → rejected.
   */
  async request(playerId, requestId, payload, fn) {
    if (!requestId) return { ok: false, error: 'request_id is required for this call' };
    const key = `${playerId}:${requestId}`;
    const fingerprint = await this.engine.fingerprint(payload);
    const seen = this.requests[key];
    if (seen) {
      if (seen.fingerprint !== fingerprint) {
        await this.audit('request_id_reused', { playerId, requestId });
        return { ok: false, error: `request_id ${requestId} was already used for a different request` };
      }
      await this.audit('idempotent_replay', { playerId, requestId });
      return seen.response;
    }
    const response = await fn();
    this.requests[key] = { fingerprint, response };
    await this.store.appendRequest(this.id, key, this.requests[key]);
    this.dirty = true;
    return response;
  }

  // ── player actions ─────────────────────────────────────────────────────────

  async join(playerId, name) {
    const r = this.record;
    const mine = this.seatOf(playerId);
    if (mine) return { ok: true, seat: mine, name: r.seats[mine].name, rejoined: true };
    if (!NAME_RE.test(name ?? '')) return { ok: false, error: 'name must be 1–32 characters: letters, digits, spaces and . _ - ( )' };
    if (r.phase !== 'waiting_for_players') return { ok: false, error: 'this series already has two players' };
    const seat = SEATS.find((s) => !r.seats[s]);
    r.seats[seat] = { playerId, name, joinedAt: new Date(this.clock.now()).toISOString() };
    await this.emitEvent('player_joined', seat, { seat, name });
    if (r.seats.P1 && r.seats.P2) r.phase = 'waiting_for_start';
    await this.changed();
    return { ok: true, seat, name };
  }

  async leave(playerId) {
    const r = this.record;
    const seat = this.seatOf(playerId);
    if (!seat) return { ok: false, error: 'you are not in this series' };
    if (r.phase !== 'waiting_for_players' && r.phase !== 'waiting_for_start') {
      return { ok: false, error: 'you can only leave before match 1 starts; use resign to give up a match' };
    }
    await this.emitEvent('player_left', seat, { seat });
    r.seats[seat] = null;
    r.ready = { P1: null, P2: null };
    r.phase = 'waiting_for_players';
    await this.changed();
    return { ok: true, left: seat };
  }

  async ready(playerId, forMatch) {
    const r = this.record;
    const seat = this.seatOf(playerId);
    if (!seat) return { ok: false, error: 'you are not in this series' };
    const expected = this.nextReadyMatch();
    if (expected === null) return { ok: false, error: `nothing to be ready for in phase ${r.phase}` };
    // Readiness names the exact upcoming match, so an old "ready" can never start a later match.
    if (forMatch !== expected) return { ok: false, error: `ready must be for match ${expected} (got ${forMatch})` };
    if (r.ready[seat] === expected) return { ok: true, seat, readyFor: expected, already: true };
    r.ready[seat] = expected;
    await this.emitEvent('player_ready', seat, { seat, forMatch: expected });
    if (r.ready.P1 === expected && r.ready.P2 === expected) await this.startMatch(expected);
    await this.changed();
    return { ok: true, seat, readyFor: expected };
  }

  async resign(playerId) {
    const seat = this.seatOf(playerId);
    if (!seat) return { ok: false, error: 'you are not in this series' };
    if (this.record.phase !== 'awaiting_actions') return { ok: false, error: 'there is no match in progress to resign' };
    await this.endMatch({ result: 'win', winner: other(seat), reason: 'resigned' });
    await this.changed();
    return { ok: true, resigned: seat };
  }

  /** Accepts and locks a bundle for the open round, or rejects it whole. */
  async submit(playerId, { match, round, actions }) {
    const r = this.record;
    const seat = this.seatOf(playerId);
    if (!seat) return { ok: false, error: 'you are not in this series' };
    // A delayed timer cannot let an order slip into a slot that has already closed.
    if (this.live) await this.onLiveTick();
    if (!this.isPlayingPhase()) return { ok: false, error: `no round is open (phase ${r.phase})` };
    // Bundles are tied to match + round, never to state_version, so one player's submission
    // can't make the other's stale.
    if (match !== this.state.match || round !== this.state.round) {
      return { ok: false, error: `stale bundle: the open round is match ${this.state.match} round ${this.state.round}` };
    }
    if (r.round.pending[seat]) return { ok: false, error: 'your bundle for this round is already locked' };

    const check = await this.engine.validate(this.state, seat, actions);
    if (!check.ok) {
      await this.audit('bundle_rejected', { seat, match, round, actions, errors: check.errors });
      return { ok: false, error: 'bundle rejected; nothing was changed', rejected: check.errors };
    }

    r.round.pending[seat] = structuredClone(actions);
    const tookMs = this.clock.now() - r.round.openedAt;
    if (r.phase === 'warmup') r.warmup.times[seat].push(tookMs);
    await this.emitEvent('bundle_submitted', seat, { seat }); // the fact only: contents stay hidden
    await this.audit('bundle_accepted', { seat, match, round, actions, cost: check.cost, tookMs });
    if (!this.isLiveRound() && r.round.pending.P1 && r.round.pending.P2) await this.resolveRound();
    await this.changed();
    return { ok: true, accepted: true, cost: check.cost };
  }

  // ── host controls ──────────────────────────────────────────────────────────

  /** Start screen → game: once both players have joined, the host's Start begins play. */
  async hostStart() {
    const r = this.record;
    if (r.phase === 'waiting_for_players') return { ok: false, error: 'both players must join before the game can start' };
    if (r.phase !== 'waiting_for_start') return { ok: false, error: 'the game has already started' };
    await this.emitEvent('host_action', null, { action: 'start' });
    if (r.settings.series.warmupRounds > 0) await this.startWarmup();
    else {
      await this.setDeadline(); // no warm-up: nothing measured
      await this.startMatch(1);
    }
    await this.changed();
    return { ok: true };
  }

  /**
   * Back to the start screen: same series id, but seats, score, matches and the deadline
   * are cleared, so the agents join again and the host presses Start again. The logs keep
   * everything; a series_restarted event marks the cut.
   */
  async hostRestart() {
    const r = this.record;
    await this.stopLive();
    this.clearTimers();
    await this.emitEvent('series_restarted', null, { previous: { phase: r.phase, wins: r.wins, draws: r.draws, matches: r.history.length } });
    await this.store.appendText(this.id, r.matchNo, 'RESTART · the host restarted the series; back to the start screen');
    Object.assign(r, freshGame(), { restarts: (r.restarts ?? 0) + 1 });
    this.state = null;
    await this.changed();
    return { ok: true };
  }

  async hostForfeit(seat) {
    if (!SEATS.includes(seat)) return { ok: false, error: 'seat must be P1 or P2' };
    if (this.record.phase !== 'awaiting_actions') return { ok: false, error: 'no match in progress' };
    await this.emitEvent('host_action', null, { action: 'forfeit', seat });
    await this.endMatch({ result: 'win', winner: other(seat), reason: 'forfeit' });
    await this.changed();
    return { ok: true };
  }

  async hostCancelMatch() {
    if (this.record.phase !== 'awaiting_actions') return { ok: false, error: 'no match in progress' };
    await this.emitEvent('host_action', null, { action: 'cancel_match', match: this.record.matchNo });
    await this.endMatch({ result: 'void', winner: null, reason: 'cancelled' });
    await this.changed();
    return { ok: true };
  }

  async hostCancelSeries() {
    if (['series_finished', 'cancelled'].includes(this.record.phase)) return { ok: false, error: 'series already over' };
    await this.stopLive();
    this.clearTimers();
    await this.emitEvent('host_action', null, { action: 'cancel_series' });
    this.record.phase = 'cancelled';
    this.record.result = { cancelled: true };
    await this.emitEvent('series_ended', null, { cancelled: true, wins: this.record.wins });
    await this.changed();
    return { ok: true };
  }

  // ── flow ───────────────────────────────────────────────────────────────────

  async startWarmup() {
    const r = this.record;
    r.phase = 'warmup';
    r.warmup = { round: 0, times: { P1: [], P2: [] } };
    this.state = this.engine.newMatch(0);
    await this.emitEvent('warmup_started', null, { rounds: r.settings.series.warmupRounds });
    await this.openRound();
  }

  async startMatch(n) {
    const r = this.record;
    r.matchNo = n;
    r.phase = 'awaiting_actions';
    r.tiebreakMatch = r.draws >= r.settings.series.freeDraws;
    r.misses = { P1: 0, P2: 0 };
    r.ready = { P1: null, P2: null };
    this.state = this.engine.newMatch(n);
    await this.emitEvent('match_started', null, { match: n, tiebreak: r.tiebreakMatch, deadlineSeconds: r.deadlineSeconds, names: this.names() });
    await this.openRound();
  }

  async openRound() {
    const r = this.record;
    r.round = { openedAt: this.clock.now(), pending: { P1: null, P2: null }, autoFilled: { P1: false, P2: false } };
    r.stateRef = { match: this.state.match, round: this.state.round };
    await this.store.saveState(this.id, this.state);
    await this.emitEvent('round_published', null, {
      deadlineSeconds: this.isLiveRound() ? r.settings.match.roundSeconds : r.phase === 'warmup' ? null : r.deadlineSeconds,
      mode: this.isLiveRound() ? 'live' : 'waiting',
      gold: { P1: this.state.players.P1.gold, P2: this.state.players.P2.gold },
    });
    if (this.isLiveRound()) await this.startLiveSlot();
    else this.armDeadline();
  }

  async resolveRound() {
    const r = this.record;
    this.clearTimers();
    const live = this.live;
    this.live = null;
    const ordersDiscarded = !!live?.state.over;
    const bundles = ordersDiscarded ? { P1: [], P2: [] } : { P1: r.round.pending.P1 ?? [], P2: r.round.pending.P2 ?? [] };
    const res = live ? await live.finish(bundles) : await this.engine.resolve(this.state, bundles);
    const warmup = r.phase === 'warmup';

    await this.store.saveCombat(this.id, res.timeline, res.timelineJson);
    await this.emitEvent('round_resolved', null, {
      warmup,
      mode: live ? 'live' : 'waiting',
      ordersDiscarded,
      bundles, // revealed now that both are locked
      autoFilled: r.round.autoFilled,
      summary: res.summary,
      end: res.timeline.end,
      combat: `combat/m${String(res.timeline.match).padStart(2, '0')}-r${String(res.timeline.round).padStart(3, '0')}.json`,
      hash: res.hash,
    }, { match: res.timeline.match, round: res.timeline.round });
    await this.store.appendText(this.id, this.state.match, roundLine({
      round: this.state.round, warmup, names: this.names(), bundles, summary: res.summary, end: res.timeline.end, autoFilled: r.round.autoFilled,
    }));
    r.lastRound = { match: res.timeline.match, round: res.timeline.round, bundles, summary: res.summary, autoFilled: r.round.autoFilled };
    this.state = res.state;

    if (warmup) {
      r.warmup.round += 1;
      if (r.warmup.round >= r.settings.series.warmupRounds || this.state.over) await this.finishWarmup();
      else await this.openRound();
    } else if (this.state.over) {
      await this.endMatch(this.state.over);
    } else {
      await this.openRound();
    }
  }

  async finishWarmup() {
    await this.setDeadline();
    await this.startMatch(1);
  }

  /** Shared opening-round deadline, from the warm-up times (deadline.js). */
  async setDeadline() {
    const r = this.record;
    const { seconds, averages } = deadlineFor(r.settings, r.warmup.times);
    r.deadlineSeconds = seconds;
    await this.emitEvent('deadline_set', null, { mode: r.settings.series.deadline.mode, seconds, warmupAverageMs: averages });
  }

  /** Records a finished match and moves to strategy review or the end of the series. */
  async endMatch(over) {
    const r = this.record;
    this.clearTimers();
    await this.stopLive();
    const s = this.state;
    let outcome = { match: r.matchNo, result: over.result, winner: over.winner, reason: over.reason, decidedBy: over.reason, tiebreak: r.tiebreakMatch };

    if (over.result === 'draw' && r.tiebreakMatch) {
      // Tiebreak match: more kills, then more tower damage; still equal → replay.
      const k1 = s.players.P1.kills, k2 = s.players.P2.kills;
      const d1 = Math.round(s.players.P1.towerDamage), d2 = Math.round(s.players.P2.towerDamage);
      if (k1 !== k2) outcome = { ...outcome, result: 'win', winner: k1 > k2 ? 'P1' : 'P2', decidedBy: 'tiebreak_kills' };
      else if (d1 !== d2) outcome = { ...outcome, result: 'win', winner: d1 > d2 ? 'P1' : 'P2', decidedBy: 'tiebreak_damage' };
    }
    if (outcome.result === 'win') r.wins[outcome.winner] += 1;
    if (outcome.result === 'draw') r.draws += 1;

    const rounds = (await this.store.matchRounds(this.id, r.matchNo))
      .map((e) => ({ round: e.round, ...e.payload }));
    const report = buildReport({ outcome, state: s, names: this.names(), rounds });
    await this.store.saveReport(this.id, report);
    this.lastReport = report;
    r.history.push({ ...outcome, base: { P1: s.players.P1.base, P2: s.players.P2.base }, rounds: rounds.length });
    await this.emitEvent('match_ended', null, { ...outcome, winnerName: report.winnerName, base: { P1: s.players.P1.base, P2: s.players.P2.base }, wins: r.wins, draws: r.draws });
    await this.store.appendText(this.id, r.matchNo, `END · ${describeOutcome(outcome, this.names())} · series ${r.wins.P1}–${r.wins.P2}`);

    const need = r.settings.series.winsNeeded;
    const champion = SEATS.find((seat) => r.wins[seat] >= need);
    if (champion) {
      r.phase = 'series_finished';
      r.result = { winner: champion, winnerName: r.seats[champion].name, wins: r.wins, draws: r.draws, matches: r.history.length };
      await this.emitEvent('series_ended', null, r.result);
    } else {
      r.phase = 'strategy_review';
      r.ready = { P1: null, P2: null };
      await this.emitEvent('strategy_review_started', null, { nextMatch: r.matchNo + 1, report: `reports/m${String(r.matchNo).padStart(2, '0')}.json` });
    }
  }

  // ── live decision slots (round 3 onward) ────────────────────────────────────

  async startLiveSlot() {
    this.live = await LiveSlot.begin({ engine: this.engine, state: this.state, clock: this.clock, settings: this.record.settings, openedAt: this.record.round.openedAt });
    this.state = this.live.state;
    this.armLiveTick();
  }

  armLiveTick() {
    if (!this.closed) this.live.arm(() => this.onLiveTick().catch(() => {}));
  }

  /** Runs the due combat ticks; at the end of the slot applies both bundles together. */
  async onLiveTick() {
    if (!this.live || !this.isLiveRound()) return;
    const framed = await this.live.catchUp();
    this.state = this.live.state;
    // Frames go to spectators only. They do not bump state_version: an agent waiting on a
    // locked bundle should wake when the slot changes, not ten times a second.
    if (framed) this.emit('combat', this.live.snapshot());
    if (!this.live.finished) return this.armLiveTick();
    for (const seat of SEATS) {
      if (!this.record.round.pending[seat]) {
        this.record.round.autoFilled[seat] = true;
        this.record.round.pending[seat] = [];
      }
    }
    await this.resolveRound();
    await this.changed();
  }

  liveSnapshot() { return this.live?.snapshot() ?? null; }

  /** Drops a running slot without resolving it. */
  async stopLive() {
    const live = this.live;
    this.live = null;
    await live?.discard();
  }

  // ── opening-round deadline ─────────────────────────────────────────────────

  armDeadline() {
    if (this.closed) return;
    this.clearTimers();
    const r = this.record;
    if (r.phase !== 'awaiting_actions' || !r.deadlineSeconds) return;
    const due = r.round.openedAt + r.deadlineSeconds * 1000;
    this.timer = this.clock.setTimeout(() => this.onDeadline().catch(() => {}), Math.max(0, due - this.clock.now()));
  }

  clearTimers() {
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.live?.disarm();
  }

  /** Deadline passed: missing bundles become empty ones; maxMisses in a match is a forfeit. */
  async onDeadline() {
    this.timer = null;
    const r = this.record;
    if (r.phase !== 'awaiting_actions') return;
    const missed = SEATS.filter((seat) => !r.round.pending[seat]);
    if (missed.length === 0) return;
    for (const seat of missed) {
      r.misses[seat] += 1;
      r.round.pending[seat] = [];
      r.round.autoFilled[seat] = true;
      await this.emitEvent('deadline_missed', seat, { seat, misses: r.misses[seat], of: r.settings.series.maxMisses });
    }
    const out = SEATS.filter((seat) => r.misses[seat] >= r.settings.series.maxMisses);
    if (out.length === 2) await this.endMatch({ result: 'draw', winner: null, reason: 'both_missed_deadlines' });
    else if (out.length === 1) await this.endMatch({ result: 'win', winner: other(out[0]), reason: 'deadline_forfeit' });
    else await this.resolveRound();
    await this.changed();
  }

  // ── events, persistence, waiting ───────────────────────────────────────────

  /** Appends a public event (also to the audit log) and tells live listeners. */
  async emitEvent(type, actorSeat, payload, at = {}) {
    const r = this.record;
    r.seq += 1;
    const event = {
      seq: r.seq,
      ts: new Date(this.clock.now()).toISOString(),
      seriesId: r.id,
      match: at.match ?? this.state?.match ?? r.matchNo,
      round: at.round ?? this.state?.round ?? null,
      type,
      actor: actorSeat ? { seat: actorSeat, name: r.seats[actorSeat]?.name ?? null } : null,
      payload,
    };
    await this.store.appendEvent(r.id, event);
    this.emit('event', event);
  }

  /** Private audit entry: never shown to players or spectators. */
  async audit(type, payload) {
    await this.store.appendAudit(this.id, { ts: new Date(this.clock.now()).toISOString(), seriesId: this.id, private: true, type, payload });
  }

  async persist() {
    await this.store.saveSeries(this.record);
    this.dirty = false;
  }

  /** Bumps the version, saves, and wakes long-polls. Call after every state change. */
  async changed() {
    this.record.version += 1;
    this.dirty = true;
    this.emit('changed', this.record.version);
  }

  /** Resolves when the version moves past `since`, or after `ms`, or when `signal` aborts. */
  waitForChange(since, ms, signal) {
    if (this.record.version > since || ms <= 0) return Promise.resolve(this.record.version > since);
    return new Promise((resolve) => {
      const done = (changed) => {
        this.off('changed', onChange);
        clearTimeout(t);
        signal?.removeEventListener?.('abort', onAbort);
        resolve(changed);
      };
      const onChange = (v) => { if (v > since) done(true); };
      const onAbort = () => done(false);
      const t = setTimeout(() => done(false), ms);
      this.on('changed', onChange);
      signal?.addEventListener?.('abort', onAbort);
    });
  }

  get closed() { return this.queue.closed; }

  close() {
    this.clearTimers();
    this.closing ??= this.queue.close().then(() => this.engine.close?.()).catch(() => {});
    return this.closing;
  }
}
