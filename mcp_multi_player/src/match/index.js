// @ts-check
// One game (spec §6; the whole path of a move is in docs/lifecycle.md). The match owns its
// state and version, holds both seats' moves hidden until both are in (or the deadline
// passes), asks the engine for the next state, commits it to the log, and tells waiting agents
// and spectators. Waves are paced: the next one never runs until the last has had its time on
// screen, so spectators see every wave in real time and fast players gain nothing by hurrying.
//
// Every change runs through the match's queue, in the order validate → append to the log (the
// commit point) → change memory → notify. Resolving a wave and ending the match live here,
// next to the state they change.

import { createQueue } from '../shared/queue.js';
import { hashValue } from '../shared/hash.js';
import { moveTo, isFinished } from './phases.js';
import { createPending } from './pending.js';
import { createReplies } from './idempotency.js';
import { createSubscribers } from './subscribers.js';
import { createTimer } from '../shared/timer.js';
import { buildCache } from './cache.js';
import { rebuild, SNAPSHOT_EVERY, turnText } from './persist.js';

/** @typedef {import('../types/game.js').Level} Level */
/** @typedef {import('../types/game.js').Action} Action */
/** @typedef {import('../types/records.js').MatchDeps} MatchDeps */
/** @typedef {import('../types/records.js').MatchOptions} MatchOptions */
/** @typedef {import('../types/records.js').MatchRecord} MatchRecord */
/** @typedef {import('../types/records.js').MatchStatus} MatchStatus */
/** @typedef {import('../types/records.js').MatchResult} MatchResult */

const fail = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

export const DEFAULT_DEADLINE_S = 60;
const SEATS = /** @type {const} */ (['P1', 'P2']);

/**
 * @param {MatchDeps} deps
 * @param {MatchOptions} opts
 */
export function createMatch(deps, opts) {
  return makeMatch(deps, opts).api;
}

/**
 * Rebuilds a match from its log (spec T7). A match that never started comes back as created.
 * A turn whose two moves were both in when the server stopped resolves straight away.
 * @param {MatchDeps} deps
 * @param {MatchOptions} opts
 */
export async function restoreMatch(deps, opts) {
  const match = makeMatch(deps, opts);
  const files = await deps.store.load();
  if (!files.events.some((e) => e.kind === 'match_started')) return match.api;
  const rebuilt = rebuild(deps.engine, opts.level, opts.seed, files);
  Object.assign(match.record, { state: rebuilt.state, version: rebuilt.version, misses: rebuilt.misses });
  if (rebuilt.ended) {
    const ended = rebuilt.ended.data;
    Object.assign(match.record, { phase: ended.cancelled ? 'cancelled' : 'over', version: ended.version, result: ended.result, report: ended.report });
  } else {
    match.record.phase = 'collecting';
    for (const p of rebuilt.pending) {
      match.pending.put(p.data.seat, { actions: p.data.actions });
      match.replies.remember(p.data.seat, p.data.requestId, p.data.argsHash, { ok: true, status: 'accepted', version: rebuilt.version });
    }
  }
  match.refreshCache(null);
  if (match.record.phase === 'collecting') {
    // The pace is kept only in memory, so after a restart the next wave may run at once.
    if (match.pending.both()) await match.queue.run(() => match.resolveWave());
    else match.armDeadline();
  }
  return match.api;
}

/**
 * The match's private context. Only this module changes `record`; everything outside goes
 * through `api`.
 * @param {MatchDeps} deps
 * @param {MatchOptions} opts
 */
function makeMatch({ engine, store, clock, log = console }, opts) {
  const level = opts.level;
  const decisionTimeoutMs = (opts.deadlineS ?? DEFAULT_DEADLINE_S) * 1000;
  let waveOnScreenMs = (opts.paceS ?? 0) * 1000;
  const missLimit = opts.missLimit ?? level.rules.missLimit;
  /** A warm-up stops after this many waves, whatever the boards look like. */
  const maxWaves = opts.maxWaves ?? null;
  const frameEvery = engine.frameIntervalTicks(level);

  /** @type {MatchRecord} */
  const record = {
    id: opts.id, seriesId: opts.seriesId, matchNo: opts.matchNo, seed: opts.seed, levelHash: level.hash,
    phase: 'created', version: 0, state: null, deadlineAt: null, misses: { P1: 0, P2: 0 }, result: null, report: null, error: null,
  };
  const queue = createQueue(), pending = createPending(), replies = createReplies(), subs = createSubscribers(clock);
  const deadline = createTimer(clock), paceTimer = createTimer(clock);
  let cache = null;
  /** When the wave now on screen has had its time; the next wave can't resolve before this. */
  let nextWaveAt = 0;
  /** Seats whose move this turn was filled in by the deadline (for the readable log). */
  let missed = { P1: false, P2: false };
  /** When the current decision opened, and how long each seat took per decision (ms). */
  let decisionOpenedAt = 0;
  /** @type {{ P1: number[], P2: number[] }} */
  const decisionMs = { P1: [], P2: [] };
  /** The host's tuning for the coming wave: intensity (kept) and extra attackers (used once). */
  let intensity = opts.intensity ?? engine.NORMAL_INTENSITY;
  /** @type {import('../types/game.js').Spawn[]} */
  let extra = [];
  /** When the wave now on screen started (to re-time it if the host changes the pace). */
  let lastWaveAt = 0;

  const refreshCache = (lastTurn) => { cache = buildCache(engine, level, record, lastTurn ?? cache); };

  /** @returns {MatchStatus} */
  const status = () => {
    const collecting = record.phase === 'collecting';
    return {
      match: record.matchNo, phase: record.phase, version: record.version, wave: record.state?.turn ?? 0, of: level.waves.count,
      submitted: pending.submitted(), deadline_at: collecting ? record.deadlineAt : null,
      deadline_in_s: collecting && record.deadlineAt ? Math.max(0, Math.round((record.deadlineAt - clock.now()) / 1000)) : null,
      next_wave_in_s: collecting ? Math.max(0, Math.ceil((nextWaveAt - clock.now()) / 1000)) : null,
      deadline_s: decisionTimeoutMs / 1000, pace_s: waveOnScreenMs / 1000, warmup: Boolean(opts.warmup), max_waves: maxWaves,
      intensity, extra_queued: extra.length,
      misses: { ...record.misses }, result: record.result, error: record.error,
    };
  };

  /**
   * Background work (timers) has no caller to report to. If it fails, the game can't move on
   * by itself: say why in the server log and in every status, and leave the logs as they are,
   * so a restart picks the match up from its last commit.
   */
  const background = (what, job) => queue.run(job).catch((err) => {
    record.error = `${what} failed: ${err.message}`;
    log.error?.(`match ${record.id}: ${record.error}. Restart the server to continue from the log.`);
    subs.notify({ type: 'phase', version: record.version, status: status() });
  });

  function armDeadline() {
    const armedFor = record.version;
    decisionOpenedAt = clock.now();
    record.deadlineAt = deadline.arm(decisionTimeoutMs, () => background('deadline processing', () => onDeadline(armedFor)));
  }

  async function onDeadline(armedFor) {
    if (record.phase !== 'collecting' || record.version !== armedFor) return;
    const missing = SEATS.filter((s) => !pending.has(s));
    for (const seat of missing) {
      record.misses[seat]++;
      await store.append('miss', { seat, version: record.version, misses: record.misses[seat] });
    }
    const out = SEATS.filter((s) => record.misses[s] >= missLimit);
    if (out.length) {
      /** @type {MatchResult} */
      const result = out.length === 2
        ? { over: true, winner: null, reason: `both seats missed ${missLimit} deadlines` }
        : { over: true, winner: out[0] === 'P1' ? 'P2' : 'P1', reason: `${out[0]} missed ${missLimit} deadlines (forfeit)` };
      return endMatch(result, { bumpVersion: true });
    }
    for (const seat of missing) {
      pending.put(seat, { actions: [] });
      missed[seat] = true;
    }
    return tryResolve();
  }

  /** Both moves are in: run the wave now, or once the wave on screen has had its time. */
  async function tryResolve() {
    if (record.phase !== 'collecting' || !pending.both()) return;
    const waitMs = nextWaveAt - clock.now();
    if (waitMs > 0) {
      const armedFor = record.version;
      paceTimer.arm(waitMs, () => background('starting the next wave', () => (record.version === armedFor ? tryResolve() : null)));
      return;
    }
    return resolveWave();
  }

  /**
   * The moment of change (spec T4): apply both action lists, judge the outcome, commit the
   * turn to the log, then swap the state, start the next wave's time on screen and notify. If
   * the commit fails, nothing changes and the turn stays open. Runs inside the queue.
   */
  async function resolveWave() {
    if (!record.state) throw new Error('resolveWave before start'); // collecting implies a state
    moveTo(record, 'resolving');
    const actions = pending.actions();
    let turn;
    try {
      turn = engine.apply(record.state, actions, level, { recordEvery: frameEvery, tuning: { intensity, extra } });
    } catch (err) {
      return endMatch({ over: true, winner: null, reason: `engine error: ${err.message}` }, { bumpVersion: true, cancelled: true });
    }
    let result = engine.outcome(turn.state, level);
    if (result.over !== true && maxWaves && turn.state.turn >= maxWaves) result = { over: true, winner: null, reason: `warm-up done after ${maxWaves} waves` };
    const version = record.version + 1;
    try {
      await store.append('turn', { version, turn: turn.state.turn, actions, tuning: { intensity, extra } }, { stateHash: engine.hash(turn.state) });
    } catch (err) {
      moveTo(record, 'collecting');
      throw err;
    }
    // Best effort: snapshots only speed up a restart, and the text log is for people.
    if (turn.state.turn % SNAPSHOT_EVERY === 0) await store.snapshot(turn.state.turn, { version, state: turn.state }).catch(() => {});
    await store.text(turnText(turn.state, actions, missed)).catch(() => {});

    record.state = turn.state;
    record.version = version;
    pending.clear();
    missed = { P1: false, P2: false };
    paceTimer.clear();
    extra = [];
    lastWaveAt = clock.now();
    nextWaveAt = lastWaveAt + waveOnScreenMs;
    refreshCache(turn);
    subs.notify({ type: 'turn', version, events: turn.events, frames: turn.frames, render: cache.render, status: status() });

    if (result.over === true) return endMatch(result, { bumpVersion: false });
    moveTo(record, 'collecting');
    armDeadline();
  }

  /**
   * Closes the match (spec T5): log the result and the report, stop the clocks, tell the
   * waiting agents and spectators, then hand the result to the series. The series callback
   * runs after this returns (on the next turn of the event loop), outside this queue.
   * @param {MatchResult} result
   */
  async function endMatch(result, { bumpVersion, cancelled = false }) {
    if (bumpVersion) record.version++;
    const report = engine.report(record.state, level, result);
    await store.append('match_ended', { version: record.version, result, report, cancelled });
    await store.text(`Result: ${result.winner ? result.winner + ' wins' : 'no winner'} (${result.reason})`).catch(() => {}); // best effort
    moveTo(record, cancelled ? 'cancelled' : 'over');
    record.result = result;
    record.report = report;
    deadline.clear();
    paceTimer.clear();
    refreshCache(null);
    subs.notify({ type: 'match_end', version: record.version, result, report, render: cache.render, status: status() });
    const timings = { P1: [...decisionMs.P1], P2: [...decisionMs.P2] };
    setImmediate(() => opts.onEnd?.({ matchNo: record.matchNo, ...result, cancelled, report, decisionMs: timings }));
  }

  const api = {
    get id() { return record.id; },
    get matchNo() { return record.matchNo; },
    status,

    /** Sets up the board, commits match_started and opens the first decision. */
    start: () => queue.run(async () => {
      if (record.phase !== 'created') return;
      record.state = engine.setup(level, record.seed);
      record.version = 1;
      await store.append('match_started', { matchNo: record.matchNo, seed: record.seed, levelId: level.id, levelHash: level.hash, version: 1 }, { stateHash: engine.hash(record.state) });
      moveTo(record, 'collecting');
      refreshCache(null);
      armDeadline();
      subs.notify({ type: 'match_start', version: 1, render: cache.render, status: status() });
    }),

    /**
     * A seat's move for the open turn. Resolves once the move is durable (in the audit log)
     * and, if it was the second move and the pace allows, once the wave is committed too. The
     * reply's version is the turn the move was for; read state for the new one.
     * @param {{ seat: 'P1'|'P2', forVersion: number, requestId?: string, actions: Action[] }} move
     */
    submit: ({ seat, forVersion, requestId, actions }) => queue.run(async () => {
      const argsHash = hashValue({ forVersion, actions });
      const seen = requestId ? replies.check(seat, requestId, argsHash) : null;
      if (seen?.duplicate) return { ...seen.duplicate, status: 'duplicate' };
      if (seen?.conflict) return fail('request_id_reused', 'this request_id was already used with different arguments; use a new one');
      if (isFinished(record.phase)) return fail('match_over', 'this match is over', { current_version: record.version });
      if (record.phase !== 'collecting') return fail('not_open', 'no turn is open right now; call state and follow next', { current_version: record.version });
      if (forVersion !== record.version) return fail('stale_version', `the match is at version ${record.version}; your move was for ${forVersion}. Read state again and resubmit.`, { current_version: record.version });
      if (pending.has(seat)) return fail('already_submitted', 'you already submitted for this turn; moves lock once in', { current_version: record.version });
      const check = engine.validate(record.state, seat, actions, level);
      if (check.ok === false) {
        await store.audit('rejected', { seat, version: record.version, actions, code: check.code }).catch(() => {}); // best effort
        return fail(check.code, check.message, { index: check.index, current_version: record.version, legal: engine.legalMoves(record.state, seat, level) });
      }
      await store.audit('pending', { seat, version: record.version, actions, requestId, argsHash });
      pending.put(seat, { actions });
      decisionMs[seat].push(clock.now() - decisionOpenedAt);
      const reply = { ok: true, status: 'accepted', version: record.version };
      if (requestId) replies.remember(seat, requestId, argsHash, reply);
      subs.notify({ type: 'phase', version: record.version, status: status() });
      await tryResolve();
      return reply;
    }),

    /**
     * The seat's view; with `since`, waits up to waitMs for a newer version.
     * @param {{ seat: 'P1'|'P2', since?: number|null, waitMs?: number, signal?: AbortSignal }} query
     */
    async getView({ seat, since = null, waitMs = 0, signal }) {
      const until = clock.now() + waitMs;
      while (since !== null && record.version <= since && !signal?.aborted) {
        const left = until - clock.now();
        if (left <= 0) break;
        await subs.wait(left, signal);
      }
      const finished = isFinished(record.phase);
      return {
        changed: since === null || record.version > since, version: record.version, status: status(),
        view: cache && !finished ? cache.views[seat] : null,
        report: finished ? record.report : null,
      };
    },

    /** The latest committed render, with the events and frames of the wave that produced it. */
    getRender: () => ({
      version: record.version, status: status(),
      render: cache?.render ?? null, events: cache?.events ?? [], frames: cache?.frames ?? null,
      report: record.report,
    }),

    subscribe: (fn) => subs.listen(fn),

    /**
     * Host tuning (spec §2.10). Intensity applies from the next wave on; a random burst joins the
     * next wave only; a new pace re-times the wave now on screen. Logged with the turn they
     * shape, so replays stay exact.
     * @param {{ intensity?: number, burst?: import('../types/game.js').Spawn[], paceS?: number }} change
     */
    tune: (change) => queue.run(async () => {
      if (isFinished(record.phase)) return status();
      if (change.intensity !== undefined) intensity = change.intensity;
      if (change.burst) extra = [...extra, ...change.burst];
      if (change.paceS !== undefined) {
        waveOnScreenMs = change.paceS * 1000;
        if (lastWaveAt) nextWaveAt = lastWaveAt + waveOnScreenMs;
        if (record.phase === 'collecting' && pending.both()) { paceTimer.clear(); await tryResolve(); }
      }
      subs.notify({ type: 'phase', version: record.version, status: status() });
      return status();
    }),

    /** Ends the match without a winner. Resolves once match_ended is committed. */
    cancel: (reason) => queue.run(async () => {
      if (isFinished(record.phase)) return;
      if (record.phase === 'created') { record.phase = 'cancelled'; record.result = { over: true, winner: null, reason }; return; }
      await endMatch({ over: true, winner: null, reason }, { bumpVersion: true, cancelled: true });
    }),

    /** Read-only access for replays and the web door. */
    state: () => record.state,
  };

  return { api, record, queue, pending, replies, refreshCache, armDeadline, resolveWave };
}
