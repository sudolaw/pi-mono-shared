// What a player (get_match) and a spectator may see (SPEC.md §11, §12).
// Everything is public except an opponent's pending bundle, which never appears here:
// only whether each player has submitted. Credentials are never part of a series record.

import { SEATS, other } from '../engine/index.js';
import { incomeAfterRound, attackerRoster } from '../config.js';

const CLOSEST = 5;

/** Observation for one seat (or for a caller who has not joined: seat = null). */
export function playerView(series, seat, { detail = 'summary', changed = true } = {}) {
  const r = series.record;
  const view = {
    series_id: r.id,
    match: series.state?.match ?? r.matchNo,
    round: series.isPlayingPhase() ? series.state.round : null,
    max_rounds: r.settings.match.maxRounds,
    phase: r.phase,
    warmup: r.phase === 'warmup' ? { round: r.warmup.round + 1, of: r.settings.series.warmupRounds } : undefined,
    state_version: r.version,
    you: seat ? { seat, name: r.seats[seat].name } : null,
    next: nextStep(series, seat),
    ...common(series, detail),
    poll: { changed, retry_after_s: series.isPlayingPhase() || r.phase.startsWith('waiting') || r.phase === 'strategy_review' ? 0 : null },
  };
  if (r.phase === 'strategy_review' || r.phase === 'series_finished') {
    const last = r.history.at(-1);
    if (last) view.report = series.lastReport;
  }
  if (r.result) view.result = r.result;
  return view;
}

/** Public view for spectators: same information, no "you", plus timing for the banner. */
export function spectatorView(series) {
  const r = series.record;
  return {
    series_id: r.id,
    created_at: r.createdAt,
    phase: r.phase,
    match: series.state?.match ?? r.matchNo,
    round: series.isPlayingPhase() ? series.state.round : null,
    max_rounds: r.settings.match.maxRounds,
    warmup: r.phase === 'warmup' ? { round: r.warmup.round + 1, of: r.settings.series.warmupRounds } : null,
    state_version: r.version,
    names: series.names(),
    ready: r.ready,
    next_ready_match: series.nextReadyMatch(),
    waiting_since: series.isPlayingPhase() ? r.round.openedAt : null,
    history: r.history,
    result: r.result,
    overrides: r.overrides,
    ...common(series, 'summary'),
  };
}

function common(series, detail) {
  const r = series.record;
  const s = series.state;
  const cfg = r.settings;
  const playing = series.isPlayingPhase();
  const out = {
    attacker_stats: attackerRoster(cfg, s?.round ?? 1),
    decision_slot: playing ? decisionSlot(series) : null,
    waiting_on: playing ? SEATS.filter((seat) => !r.round.pending[seat]) : waitingOnOutsideRounds(series),
    deadline: deadlineInfo(series),
    series: { wins: r.wins, draws: r.draws, first_to: cfg.series.winsNeeded, tiebreak_match: r.tiebreakMatch, matches_played: r.history.length },
    players: {},
  };
  for (const seat of SEATS) {
    const p = s?.players[seat];
    out.players[seat] = {
      name: r.seats[seat]?.name ?? null,
      base: p?.base ?? cfg.match.baseHealth,
      gold: p?.gold ?? cfg.economy.startingGold,
      income_next: s && !s.over ? incomeAfterRound(cfg, s.round) : null,
      kills: p?.kills ?? 0,
      submitted: playing ? !!r.round.pending[seat] : null,
    };
  }
  if (!s) return out;

  out.towers = Object.values(s.towers).map(({ slot, owner, type, level, targeting }) => ({ slot, owner, type, level, targeting }));
  out.free_slots = {};
  for (const seat of SEATS) out.free_slots[seat] = series.engine.board.slotIds.filter((id) => id.startsWith(seat) && !s.towers[id]);

  out.attackers = {};
  for (const seat of SEATS) {
    // attackers heading to `seat`'s base are the other seat's
    const owner = other(seat);
    const length = series.engine.board.paths[owner].length;
    const mine = s.attackers.filter((a) => a.owner === owner);
    const alive = countBy(mine.map((a) => a.type));
    const queued = countBy(s.players[owner].queue);
    const list = [...mine].sort((a, b) => b.dist - a.dist || a.id - b.id).map((a) => ({
      id: a.id, type: a.type, progress: Math.round((a.dist / length) * 100) / 100, hp: Math.round(a.hp), slowed: a.slow < 1,
    }));
    out.attackers[`toward_${seat}`] = detail === 'full' ? { alive, queued, all: list } : { alive, queued, closest: list.slice(0, CLOSEST) };
  }

  if (r.lastRound) {
    out.last_round = {
      match: r.lastRound.match,
      round: r.lastRound.round,
      P1: r.lastRound.bundles.P1,
      P2: r.lastRound.bundles.P2,
      kills: r.lastRound.summary.kills,
      base_damage_taken: r.lastRound.summary.baseHits,
      missed_deadline: r.lastRound.autoFilled,
    };
  }
  return out;
}

/** When orders apply in the open round, and what happens if one is missing (SPEC.md §6). */
function decisionSlot(series) {
  const r = series.record;
  const cfg = r.settings;
  const live = series.isLiveRound();
  const closesAt = r.round.openedAt + cfg.match.roundSeconds * 1000;
  return {
    mode: live ? 'live' : 'waiting',
    combat_continues: live,
    opening_rounds: cfg.match.openingRounds ?? null,
    seconds: live ? cfg.match.roundSeconds : null,
    closes_at: live ? new Date(closesAt).toISOString() : null,
    left_s: live ? Math.max(0, (closesAt - series.clock.now()) / 1000) : null,
    orders_apply: live ? 'together_at_slot_end' : 'together_before_combat',
    missing_order: live ? 'empty_bundle_no_forfeit' : 'opening_deadline_rules',
  };
}

/** The opening-round deadline (SPEC.md §10): live slots have none, so it is null there. */
function deadlineInfo(series) {
  const r = series.record;
  const cfg = r.settings;
  if (!r.deadlineSeconds) return null;
  const playing = series.isPlayingPhase();
  if (playing && series.isLiveRound()) return null;
  const base = { seconds: r.deadlineSeconds, misses: r.misses, max_misses: cfg.series.maxMisses };
  if (!playing || r.phase !== 'awaiting_actions') return base;
  return {
    ...base,
    left_s: Math.max(0, Math.round((r.round.openedAt + r.deadlineSeconds * 1000 - series.clock.now()) / 1000)),
    empty_bundle_if_missed: true,
  };
}

function waitingOnOutsideRounds(series) {
  const r = series.record;
  if (r.phase === 'waiting_for_players') return SEATS.filter((s) => !r.seats[s]);
  if (r.phase === 'waiting_for_start') return []; // waiting on the host, not a player
  const n = series.nextReadyMatch();
  if (n) return SEATS.filter((s) => r.ready[s] !== n);
  return [];
}

/** The `next` field: exactly what this caller should do now, and why. */
export function nextStep(series, seat) {
  const r = series.record;
  const id = r.id;
  const wait = (why) => ({ do: 'wait', tool: 'get_match', args: { series_id: id, since_version: r.version, wait_s: 25 }, why });

  if (r.phase === 'series_finished') return { do: 'stop', why: `The series is over: ${r.result.winnerName} (${r.result.winner}) won ${r.result.wins.P1}–${r.result.wins.P2}.` };
  if (r.phase === 'cancelled') return { do: 'stop', why: 'The host cancelled this series.' };
  if (!seat) {
    if (r.phase === 'waiting_for_players') return { do: 'join', tool: 'manage_match', args: { operation: 'join', series_id: id, name: '<your name>' }, why: 'A seat is free. Join with a display name.' };
    return { do: 'stop', why: 'This series already has two players.' };
  }
  if (r.phase === 'waiting_for_players') return wait('Waiting for an opponent to join. Meanwhile read the rules and settings with list_games.');
  if (r.phase === 'waiting_for_start') {
    return wait(`Both players are in. Waiting for the host to press Start on the start screen.${r.settings.series.warmupRounds ? ' Optional unscored warm-up rounds come first.' : ''} Read all rules returned by your join or list_games before moving. The first two match rounds wait for both players; later combat continues during five-second decision slots. Keep calling get_match.`);
  }

  const readyFor = series.nextReadyMatch();
  if (readyFor) {
    if (r.ready[seat] === readyFor) return wait(`Waiting for ${other(seat)} to be ready for match ${readyFor}.`);
    const why = `Match ${r.matchNo} is over. Read the report in this response, rethink your strategy (you may ask your user), then mark yourself ready for match ${readyFor}.`;
    return { do: 'ready', tool: 'manage_match', args: { operation: 'ready', series_id: id, for_match: readyFor }, why };
  }

  if (series.isPlayingPhase()) {
    const s = series.state;
    if (r.round.pending[seat]) return wait(series.isLiveRound()
      ? `Your bundle for slot ${s.round} is locked. Combat continues; both players' orders apply together at the slot boundary, even if the opponent sends nothing.`
      : `Your bundle for round ${s.round} is locked. Waiting for ${other(seat)}.`);
    const label = r.phase === 'warmup' ? `Warm-up round ${r.warmup.round + 1} of ${r.settings.series.warmupRounds} (does not count)` : `Match ${s.match} round ${s.round}`;
    return {
      do: 'submit',
      tool: 'submit_action',
      args: { series_id: id, match: s.match, round: s.round, request_id: '<new unique id>', actions: '[…]' },
      why: series.isLiveRound()
        ? `${label} is a live ${r.settings.match.roundSeconds}-second decision slot. Combat does not pause while you think. Submit one hidden bundle before decision_slot.closes_at; both bundles apply together at the end. A missed slot is an empty bundle, without a forfeit. If stale, get_match and plan for the current slot.`
        : `${label} is open and you have not submitted. Send your actions (an empty list saves gold). Combat waits for both players during opening rounds and optional warm-up.`,
    };
  }
  return wait('Waiting.');
}

function countBy(xs) {
  const out = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}
