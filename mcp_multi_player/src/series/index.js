// @ts-check
// A best-of-N contest between two agents (spec §7; the whole path of a move is in
// docs/lifecycle.md). The series fills the seats, starts each match, keeps score from the
// matches' results, waits for both seats to be ready between matches (and never less than a
// minimum gap, so the last wave finishes on screen and the players can read the report), and
// ends the contest. It never reaches into a match; results come back through the match's
// onEnd callback, which runs after the match has committed its end.

import { createQueue } from '../shared/queue.js';
import { createTimer } from '../shared/timer.js';
import { moveTo, isClosed } from './phases.js';
import { checkName, bothSeated, newPlayerId, seatOfPlayer } from './seats.js';
import { addResult, seriesWinner } from './score.js';
import { matchOpts, seedFor } from './matches.js';
import { rebuildRecord } from './persist.js';
import { DEFAULT_DEADLINE_S } from '../match/index.js';

/** @typedef {import('../types/records.js').SeriesDeps} SeriesDeps */
/** @typedef {import('../types/records.js').SeriesOptions} SeriesOptions */
/** @typedef {import('../types/records.js').SeriesRecord} SeriesRecord */

const fail = (code, message) => ({ ok: false, code, message });
/** @type {('P1'|'P2')[]} */
const SEATS = ['P1', 'P2'];

/** The shortest pause between matches, in seconds. */
export const DEFAULT_GAP_S = 45;
/** How long a seat has to call ready before it is marked ready, in seconds. */
export const DEFAULT_READY_TIMEOUT_S = 120;

/** Unscored warm-up waves before match 1; they measure how long each agent takes per decision. */
export const DEFAULT_WARMUP_WAVES = 3;

/**
 * The time slot per decision after the warm-up: 1.5 times the slowest decision seen, plus 5 s,
 * between 20 s and 300 s. Both players get the same slot.
 * @param {{ P1: number[], P2: number[] }} decisionMs
 */
export function slotFromWarmup(decisionMs, fallbackS) {
  const all = [...decisionMs.P1, ...decisionMs.P2];
  if (!all.length) return fallbackS;
  return Math.min(300, Math.max(20, Math.round((1.5 * Math.max(...all)) / 1000 + 5)));
}

/**
 * Seconds each wave plays on screen by default (6x real time for a 30 s wave). Low on purpose:
 * it is only the shortest time between waves, and the live page stretches a wave to however long
 * the agents really take, so a slow agent never makes a fast pair wait on the screen.
 */
export const DEFAULT_PACE_S = 5;

/** @param {SeriesOptions} opts @returns {SeriesRecord} */
const freshRecord = ({ id, level, target, deadlineS, paceS, warmupWaves, createdAt }) => ({
  id, levelId: level.id, levelHash: level.hash, target: target ?? 2, createdAt,
  deadlineS: deadlineS ?? DEFAULT_DEADLINE_S, paceS: paceS ?? DEFAULT_PACE_S, intensity: 5,
  warmupWaves: warmupWaves ?? DEFAULT_WARMUP_WAVES, warmup: null,
  phase: 'waiting', matchNo: 0, seats: { P1: null, P2: null }, removed: [], score: { P1: 0, P2: 0, draws: 0 },
  ready: { P1: false, P2: false }, history: [], winner: null, endReason: null, error: null,
});

/**
 * Creates a series and commits series_created.
 * @param {SeriesDeps} deps
 * @param {SeriesOptions} opts
 */
export async function createSeries(deps, opts) {
  const series = makeSeries(deps, opts);
  const { record } = series;
  await deps.store.append('series_created', { levelId: opts.level.id, levelHash: opts.level.hash, target: opts.target, deadlineS: record.deadlineS, paceS: record.paceS, warmupWaves: record.warmupWaves });
  return series.api;
}

/**
 * Rebuilds a series (and its live match) from the logs after a restart (spec T7).
 * @param {SeriesDeps} deps
 * @param {SeriesOptions} opts
 */
export async function restoreSeries(deps, opts) {
  const series = makeSeries(deps, opts);
  const { record } = series;
  const entries = await deps.store.load();
  const created = entries.find((e) => e.kind === 'series_created');
  if (created && created.data.levelHash !== opts.level.hash) throw new Error(`series ${opts.id}: level ${opts.level.id} changed since the series was created`);
  if (created) Object.assign(record, { target: created.data.target, deadlineS: created.data.deadlineS, paceS: created.data.paceS ?? 0, warmupWaves: created.data.warmupWaves ?? 0, createdAt: created.at });
  rebuildRecord(record, entries);
  if (record.phase === 'in_match') {
    series.match = await deps.matches.restore(matchOpts(record, opts.level, record.matchNo, series.onMatchEnd));
    const matchStatus = series.match.status();
    if (matchStatus.phase === 'created') await series.match.start();
    else if (matchStatus.phase === 'over' || matchStatus.phase === 'cancelled') series.onMatchEnd({ matchNo: record.matchNo, ...matchStatus.result, cancelled: matchStatus.phase === 'cancelled' });
  } else if (record.phase === 'between') {
    series.armReadyTimeout();
  }
  return series.api;
}

/**
 * @param {SeriesDeps} deps
 * @param {SeriesOptions} opts
 */
function makeSeries({ store, clock, engine, matches, log = console }, opts) {
  const level = opts.level;
  const readyTimeoutMs = (opts.readyS ?? DEFAULT_READY_TIMEOUT_S) * 1000;
  const betweenMatchesMs = (opts.gapS ?? DEFAULT_GAP_S) * 1000;
  const queue = createQueue();
  const readyTimer = createTimer(clock), gapTimer = createTimer(clock);
  /** The earliest time the next match may start (in memory: after a restart it may start at once). */
  let nextMatchAt = 0;
  const listeners = new Set();
  /** @type {{ record: SeriesRecord, match: any, api?: any, onMatchEnd?: any, armReadyTimeout?: any }} */
  const series = { record: freshRecord(opts), match: null };
  const { record } = series;

  // Spectators and waiting agents are best effort: a broken listener never stops the series.
  const notify = (message) => { for (const fn of [...listeners]) { try { fn(message); } catch { /* ignore */ } } };

  /**
   * Work started by a timer or by a match ending has no caller to report to. If it fails, the
   * series can't move on by itself: say why in the server log and in its status, and leave the
   * logs as they are, so a restart picks it up from its last commit.
   */
  const background = (what, job) => queue.run(job).catch((err) => {
    record.error = `${what} failed: ${err.message}`;
    log.error?.(`series ${record.id}: ${record.error}. Restart the server to continue from the log.`);
    notify({ type: 'series', status: api.status() });
  });

  /** Starts the next match once both are ready, but not before the gap has passed. */
  async function startWhenDue(matchNo) {
    const waitMs = nextMatchAt - clock.now();
    if (waitMs > 0) {
      gapTimer.arm(waitMs, () => background(`starting match ${matchNo}`, () => (record.phase === 'between' && record.matchNo === matchNo - 1 ? startMatch(matchNo) : null)));
      notify({ type: 'ready', status: api.status() });
      return;
    }
    await startMatch(matchNo);
  }

  async function startMatch(matchNo) {
    gapTimer.clear();
    record.matchNo = matchNo;
    record.ready = { P1: false, P2: false };
    await store.append('match_started', { matchNo, seed: seedFor(record.id, matchNo) });
    if (record.phase !== 'in_match') moveTo(record, 'in_match'); // already there right after the warm-up
    series.match = matches.create(matchOpts(record, level, matchNo, series.onMatchEnd));
    await series.match.start();
    notify({ type: 'match_start', matchNo, status: api.status() });
  }

  series.armReadyTimeout = () => readyTimer.arm(readyTimeoutMs, () => background('the ready timeout', async () => {
    if (record.phase !== 'between') return;
    for (const seat of SEATS) {
      if (record.ready[seat]) continue;
      record.ready[seat] = true;
      await store.append('ready', { seat, matchNo: record.matchNo + 1, auto: true });
    }
    await startWhenDue(record.matchNo + 1);
  }));

  /** Called by the match after it committed its end; scores it and opens the gap or ends the series. */
  series.onMatchEnd = (result) => background(`recording the end of match ${result.matchNo}`, async () => {
    if (record.phase !== 'in_match' || result.matchNo !== record.matchNo) return;
    if (result.matchNo === 0) {
      // The warm-up scores nothing: it sets the time slot, then match 1 starts straight away.
      if (result.cancelled) return;
      const deadlineS = slotFromWarmup(result.decisionMs ?? { P1: [], P2: [] }, record.deadlineS);
      const summary = { deadlineS, slowestMs: { P1: Math.max(0, ...(result.decisionMs?.P1 ?? [])), P2: Math.max(0, ...(result.decisionMs?.P2 ?? [])) } };
      await store.append('warmup_ended', summary);
      record.deadlineS = deadlineS;
      record.warmup = summary;
      await startMatch(1);
      return;
    }
    const entry = { matchNo: result.matchNo, seed: seedFor(record.id, result.matchNo), result: { winner: result.winner, reason: result.reason, cancelled: Boolean(result.cancelled) } };
    const score = { ...record.score };
    addResult({ score }, entry.result);
    await store.append('match_ended', { ...entry, score });
    record.history.push(entry);
    record.score = score;
    const done = seriesWinner(record);
    if (done) {
      await store.append('series_ended', done);
      moveTo(record, 'done');
      record.winner = done.winner;
      record.endReason = done.reason;
    } else {
      moveTo(record, 'between');
      record.ready = { P1: false, P2: false };
      nextMatchAt = clock.now() + betweenMatchesMs;
      series.armReadyTimeout();
    }
    notify({ type: done ? 'series_end' : 'match_end', status: api.status(), report: result.report });
  });

  const api = {
    get id() { return record.id; },
    level,

    /**
     * Takes a seat: the caller's own seat again if it passes its player id, otherwise the first
     * free one (P1, then P2). `name` is the model playing. Nothing starts until the host presses
     * Start. Resolves once `joined` is committed.
     * @param {{ name: string, playerId?: string|null }} who
     */
    join: ({ name, playerId = null }) => queue.run(async () => {
      if (isClosed(record.phase)) return fail('series_over', 'this series is over');
      const mine = seatOfPlayer(record, playerId);
      if (mine) return { ok: true, status: 'rejoined', seat: mine, playerId, name: record.seats[mine]?.name, phase: record.phase };
      if (playerId && record.removed.includes(playerId)) return fail('removed', 'the host removed you from this series; stop and tell your user');
      const seat = SEATS.find((s) => !record.seats[s]) ?? null;
      if (!seat) return fail('series_full', `both seats are taken (${record.seats.P1?.name} and ${record.seats.P2?.name}); if you are one of them, call join with your player id`);
      const bad = checkName(name);
      if (bad) return fail('invalid_name', bad);
      const id = newPlayerId(seat);
      await store.append('joined', { seat, name: name.trim(), playerId: id });
      record.seats[seat] = { name: name.trim(), playerId: id, joinedAt: clock.now() };
      notify({ type: 'joined', status: api.status() });
      return { ok: true, status: 'joined', seat, playerId: id, name: name.trim(), phase: record.phase };
    }),

    /** The seat a player id belongs to, or null; and whether the host removed it. */
    seatOf: (playerId) => seatOfPlayer(record, playerId),
    wasRemoved: (playerId) => Boolean(playerId && record.removed.includes(playerId)),

    /** The host starts the series once both players are seated: the warm-up first, then match 1. */
    start: () => queue.run(async () => {
      if (record.phase !== 'waiting') return fail('not_waiting', 'the series has already started');
      if (!bothSeated(record)) return fail('not_seated', 'both players have to join first');
      await store.append('host_started', {});
      await startMatch(record.warmupWaves > 0 ? 0 : 1);
      return { ok: true };
    }),

    /**
     * The host removes a player. Before the start, the seat is simply free again. Once the
     * series has started, leaving forfeits it: the other player wins.
     * @param {'P1'|'P2'} seat
     */
    leave: (seat) => queue.run(async () => {
      if (isClosed(record.phase)) return fail('series_over', 'this series is over');
      const player = record.seats[seat];
      if (!player) return fail('empty_seat', 'nobody is in that seat');
      await store.append('left', { seat });
      record.removed.push(player.playerId);
      record.seats[seat] = null;
      if (record.phase !== 'waiting') {
        /** @type {'P1'|'P2'} */
        const other = seat === 'P1' ? 'P2' : 'P1';
        const done = { winner: other, reason: `${player.name} left the series` };
        readyTimer.clear();
        gapTimer.clear();
        await store.append('series_ended', done);
        moveTo(record, 'done');
        record.winner = done.winner;
        record.endReason = done.reason;
        if (series.match) await series.match.cancel(done.reason);
      }
      notify({ type: record.phase === 'done' ? 'series_end' : 'joined', status: api.status() });
      return { ok: true };
    }),

    /**
     * Host tuning for finding the right difficulty (spec §2.10): intensity 0-10 and seconds per
     * wave on screen, kept for the rest of the series; a random burst joins the next wave.
     * @param {{ intensity?: number, paceS?: number, randomWave?: boolean }} change
     */
    tune: (change) => queue.run(async () => {
      if (isClosed(record.phase)) return fail('series_over', 'this series is over');
      const keep = {};
      if (change.intensity !== undefined) keep.intensity = change.intensity;
      if (change.paceS !== undefined) keep.paceS = change.paceS;
      if (Object.keys(keep).length) {
        await store.append('tuning', keep);
        Object.assign(record, keep);
      }
      const live = series.match && !['over', 'cancelled'].includes(series.match.status().phase) ? series.match : null;
      /** @type {import('../types/game.js').Spawn[]|undefined} */
      let burst;
      if (change.randomWave) {
        if (!live) return fail('no_match', 'a random wave needs a running match');
        burst = engine.randomBurst(level, live.status().wave + 1, record.intensity, Math.random);
      }
      if (live) await live.tune({ ...keep, burst });
      notify({ type: 'series', status: api.status() });
      return { ok: true, burst: burst?.length ?? 0 };
    }),

    /**
     * Ready for the next match. Resolves once `ready` is committed; if both are ready and the
     * gap has passed, once the next match has started too (otherwise a timer starts it later).
     */
    ready: ({ seat, forMatch }) => queue.run(async () => {
      if (isClosed(record.phase)) return fail('series_over', 'this series is over');
      if (record.phase !== 'between') return fail('not_between', 'ready is only for the gap between matches; call state and follow next');
      if (forMatch !== record.matchNo + 1) return fail('wrong_match', `the next match is ${record.matchNo + 1}`);
      if (!record.ready[seat]) {
        await store.append('ready', { seat, matchNo: forMatch, auto: false });
        record.ready[seat] = true;
      }
      if (record.ready.P1 && record.ready.P2) {
        readyTimer.clear();
        await startWhenDue(forMatch);
      }
      return { ok: true, status: 'ready', for_match: forMatch, phase: record.phase };
    }),

    /** Ends the series and its live match. Resolves once both are committed. */
    cancel: (reason = 'cancelled by the host') => queue.run(async () => {
      if (isClosed(record.phase)) return;
      readyTimer.clear();
      gapTimer.clear();
      await store.append('cancelled', { reason });
      moveTo(record, 'cancelled');
      record.endReason = reason;
      if (series.match) await series.match.cancel(reason);
      notify({ type: 'series_end', status: api.status() });
    }),

    status: () => ({
      id: record.id, level: { id: level.id, name: level.name }, phase: record.phase, match: record.matchNo, target: record.target,
      deadline_s: record.deadlineS, pace_s: record.paceS, gap_s: betweenMatchesMs / 1000, score: { ...record.score },
      intensity: record.intensity, warmup_waves: record.warmupWaves, warmup: record.warmup,
      can_start: record.phase === 'waiting' && bothSeated(record),
      next_match_in_s: record.phase === 'between' ? Math.max(0, Math.ceil((nextMatchAt - clock.now()) / 1000)) : null,
      seats: { P1: record.seats.P1?.name ?? null, P2: record.seats.P2?.name ?? null },
      ready: { ...record.ready }, winner: record.winner, end_reason: record.endReason, error: record.error,
      history: record.history.map((h) => ({ match: h.matchNo, winner: h.result.winner, reason: h.result.reason, cancelled: h.result.cancelled })),
      created_at: record.createdAt,
    }),

    isClosed: () => isClosed(record.phase),
    currentMatch: () => series.match,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Render frames of a finished match, re-simulated from its log (spec §11). */
    async replay(matchNo, { from = 0, count = 10 } = {}) {
      const ended = record.history.some((h) => h.matchNo === matchNo);
      if (!ended) return fail('not_finished', 'replays open once the match is over');
      const { events } = await store.match(matchNo).load();
      const turns = events.filter((e) => e.kind === 'turn');
      let state = engine.setup(level, seedFor(record.id, matchNo));
      const out = [];
      for (const [i, logged] of turns.entries()) {
        if (i >= from + count) break;
        // Frames are only recorded for the turns this page returns; the earlier ones are replayed
        // just to reach the right state.
        const turn = engine.apply(state, logged.data.actions, level, { recordEvery: i >= from ? engine.frameIntervalTicks(level) : undefined, tuning: logged.data.tuning });
        state = turn.state;
        if (i >= from) out.push({ version: logged.data.version, wave: state.turn, frames: turn.frames, events: turn.events.filter((e) => e.type !== 'spawn'), render: engine.render(state, level) });
      }
      const matchEnd = events.find((e) => e.kind === 'match_ended');
      return { ok: true, match: matchNo, total: turns.length, from, turns: out, report: matchEnd?.data.report ?? null, layout: level.layout };
    },
  };
  series.api = api;
  return series;
}
