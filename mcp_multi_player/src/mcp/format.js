// Makes the replies an agent reads (spec §10.3): a short text block (summary, your towers
// with what each did last wave, the board as ASCII, the next step) plus the same facts as
// structured content. Every reply says exactly which call to make next. Nothing about the
// opponent's board or future waves is ever included while a match is running.

import { rulesBrief, seriesTerms, onHitText } from './rules.js';

const SEATS = ['P1', 'P2'];

/** An opaque marker that changes whenever something an agent waits for changes. */
export function cursorOf(series) {
  if (!series) return 'none';
  const seriesStatus = series.status(), matchStatus = series.currentMatch()?.status();
  return `${seriesStatus.id}.${seriesStatus.phase}.${seriesStatus.match}.${matchStatus?.version ?? 0}.${matchStatus?.phase ?? 'none'}`;
}

/** A seat's display name (the model playing), or the seat itself while it is empty. */
export const nameOf = (seriesStatus, seat) => seriesStatus?.seats?.[seat] ?? seat;

/** Replaces P1 / P2 in result texts with the players' names. */
export const withNames = (text, seriesStatus) => String(text ?? '').replace(/\bP[12]\b/g, (seat) => nameOf(seriesStatus, seat));

/**
 * The one call the agent should make next, with its arguments and why. `who` is the caller:
 * its seat and player id, or null before it has joined.
 * @param {any} series @param {{ seat: 'P1'|'P2', playerId: string }|null} who @param {any} [matchStatus]
 */
export function nextStep(series, who, matchStatus = series?.currentMatch()?.status()) {
  const seat = who?.seat ?? null, player = who?.playerId;
  const wait = (why) => ({ tool: 'state', args: { ...(player ? { player } : {}), since: cursorOf(series), wait_s: 25 }, why });
  if (!series) return wait('No series is open yet. The host creates one on the dashboard; keep calling state with these args until it appears.');
  const seriesStatus = series.status(), nextMatch = seriesStatus.match + 1;
  const serverError = seriesStatus.error ?? matchStatus?.error;
  if (serverError) return wait(`The game server hit a problem (${serverError}) and is stuck until the host restarts it. Tell your user, then keep calling state with these args.`);
  if (seriesStatus.phase === 'done' || seriesStatus.phase === 'cancelled') {
    return { tool: 'stop', why: `Series ${seriesStatus.id} is over (${withNames(seriesStatus.end_reason, seriesStatus)}). Stop playing and tell your user the result.` };
  }
  if (player && series.wasRemoved(player)) return { tool: 'stop', why: 'The host removed you from this series. Stop playing and tell your user.' };
  if (!seat) {
    const free = ['P1', 'P2'].some((s) => !seriesStatus.seats[s]);
    if (!free) return { tool: 'stop', why: `Both places are taken (${seriesStatus.seats.P1} and ${seriesStatus.seats.P2}). If you are one of them, call join with your player id; otherwise there is no place for you in this series.` };
    return { tool: 'join', args: { name: '<the model you are, e.g. Claude Opus 5.5>', understood: true }, why: 'Read the rules tool first. Then join with the name of the model you are; you get a player id to pass in every later call.' };
  }
  const opponent = nameOf(seriesStatus, seat === 'P1' ? 'P2' : 'P1');
  if (seriesStatus.phase === 'waiting') {
    return wait(seriesStatus.can_start ? 'Both players are in. Waiting for the host to start the game (a few unscored warm-up waves come first). Use the time to study the rules and the board.' : 'Waiting for the other player to join.');
  }
  if (seriesStatus.phase === 'between') {
    if (seriesStatus.ready[seat]) {
      const earliest = seriesStatus.next_match_in_s ? `; the next match starts in ${seriesStatus.next_match_in_s} s at the earliest` : '';
      return wait(`Waiting for ${opponent} to be ready${earliest}.`);
    }
    return { tool: 'ready', args: { player, for_match: nextMatch }, why: `Match ${seriesStatus.match} is over. Compare the two boards in the report (which towers did the damage, where you leaked, what ${opponent} built), change your plan, then call ready for match ${nextMatch}.` };
  }
  if (matchStatus?.phase === 'collecting' && !matchStatus.submitted[seat]) {
    const warm = matchStatus.warmup ? ` This is the warm-up (wave ${matchStatus.wave + 1} of ${matchStatus.max_waves}, not scored): it measures how long you take per decision, and the time slot for the real matches is set from it.` : '';
    return { tool: 'act', args: { player, for_version: matchStatus.version }, why: `Choose your actions for wave ${matchStatus.wave + 1} (build, upgrade {slot, stat}, target; an empty list saves gold) and call act with a new request_id. You have ${matchStatus.deadline_in_s} s.${warm}` };
  }
  if (matchStatus?.phase === 'collecting' && !matchStatus.submitted[seat === 'P1' ? 'P2' : 'P1']) return wait(`Your move is in. Waiting for ${opponent} to move (up to ${matchStatus.deadline_in_s} s), then the wave runs.`);
  if (matchStatus?.phase === 'collecting') return wait(`Both moves are in. The current wave is still playing on screen; the next one runs in ${matchStatus.next_wave_in_s} s.`);
  return wait('Waiting for the match to move on.');
}

/** A one-word summary of where the caller stands. */
function seatStatus(series, who) {
  if (!series) return 'no_series';
  const seat = who?.seat ?? null;
  const seriesStatus = series.status(), matchStatus = series.currentMatch()?.status();
  if (seriesStatus.phase === 'done' || seriesStatus.phase === 'cancelled') return 'series_over';
  if (who?.playerId && series.wasRemoved(who.playerId)) return 'removed';
  if (!seat) return 'join';
  if (seriesStatus.phase === 'waiting') return seriesStatus.can_start ? 'waiting_for_host_start' : 'waiting_for_players';
  if (seriesStatus.phase === 'between') return 'between_matches';
  if (matchStatus?.phase === 'collecting') {
    if (!matchStatus.submitted[seat]) return 'your_move';
    return matchStatus.submitted[seat === 'P1' ? 'P2' : 'P1'] ? 'waiting_for_wave_on_screen' : 'waiting_for_opponent';
  }
  return 'waiting';
}

/** The board as ASCII: towers by type letter, enemies as a count per path tile. */
export function asciiMap(level, board) {
  const { tile, rows } = level.layout;
  const towers = Object.fromEntries((board?.towers ?? []).map((t) => [t.slot, level.towers[t.type].code]));
  const count = {};
  for (const u of board?.units ?? []) { const k = Math.floor(u.y / tile) + ',' + Math.floor(u.x / tile); count[k] = (count[k] ?? 0) + 1; }
  const lines = ['     ' + [...rows[0]].map((_, c) => String(c + 1).padStart(3)).join('')];
  rows.forEach((row, r) => {
    let line = '  ' + String.fromCharCode(65 + r) + '  ';
    [...row].forEach((ch, c) => {
      const id = String.fromCharCode(65 + r) + (c + 1), n = count[r + ',' + c];
      let cell = ch;
      if (ch === 'o') cell = towers[id] ?? 'o';
      else if (n && ch !== '.') cell = n > 9 ? '+' : String(n);
      line += cell.padStart(3);
    });
    lines.push(line);
  });
  return lines.join('\n');
}

const mapKey = (level) => `Key: S spawn, B base, # path, o free slot, digits = enemies on that tile, ${Object.values(level.towers).map((t) => `${t.code} = ${t.name.toLowerCase()}`).join(', ')}.`;

/** "+2 damage +1 range", or "no upgrades". */
const upgradesText = (upgrades) => ['damage', 'rate', 'range'].filter((stat) => upgrades[stat]).map((stat) => `+${upgrades[stat]} ${stat}`).join(' ') || 'no upgrades';

/** One of the agent's towers: health, live numbers, upgrades, targeting, last wave's work. */
export function towerLine(tower) {
  const lastWave = tower.last_wave;
  const parts = [
    `${tower.slot} ${tower.type}`,
    `health ${tower.health}/${tower.max_health}`,
    `damage ${tower.damage}, rate ${tower.rate}/s, range ${tower.range} (${upgradesText(tower.ups)})`,
  ];
  if (tower.targeting !== 'first') parts.push(`targets ${tower.targeting}`);
  parts.push(`last wave ${Math.round(lastWave.damage)} damage, ${lastWave.kills} kills`, `upgrade ${tower.upgrade_cost}`);
  return parts.join(' · ');
}

/**
 * The full reply for the caller: structured content plus the text an agent reads.
 * @param {any} series @param {{ seat: 'P1'|'P2', playerId: string }|null} who @param {object} [extra]
 */
export async function seatReply(series, who, extra = {}) {
  const seat = who?.seat ?? null;
  const data = { ok: true, player: who?.playerId ?? null, seat, ...extra, status: seatStatus(series, who), cursor: cursorOf(series) };
  if (!series) {
    data.next = nextStep(null, who);
    return { data, text: replyText(data, null, null) };
  }
  const level = series.level;
  // Read the match view first, then everything else without awaiting, so the reply never
  // mixes a match that just ended with the next one that just started.
  let match, seen = null;
  for (let tries = 0; tries < 5; tries++) {
    match = series.currentMatch();
    seen = match && series.status().seats[seat] ? await match.getView({ seat }) : null;
    if (series.currentMatch() === match) break;
  }
  const seriesStatus = series.status();
  data.cursor = cursorOf(series);
  data.series = {
    id: seriesStatus.id, level: seriesStatus.level.id, phase: seriesStatus.phase, match: seriesStatus.match, best_of: seriesStatus.target * 2 - 1,
    score: seriesStatus.score, seats: seriesStatus.seats, next_match_in_s: seriesStatus.next_match_in_s, error: seriesStatus.error,
    you: seat ? nameOf(seriesStatus, seat) : null, opponent: seat ? nameOf(seriesStatus, seat === 'P1' ? 'P2' : 'P1') : null,
    time_slot_s: seriesStatus.deadline_s, warmup_result: seriesStatus.warmup,
  };
  let map = null;
  if (seen) {
    const matchStatus = seen.status;
    data.version = seen.version;
    data.match = {
      number: matchStatus.match, phase: matchStatus.phase, wave: matchStatus.wave, of: matchStatus.warmup ? matchStatus.max_waves : matchStatus.of,
      warmup: matchStatus.warmup, you_submitted: matchStatus.submitted[seat],
      deadline_in_s: matchStatus.deadline_in_s, next_wave_in_s: matchStatus.next_wave_in_s, misses: matchStatus.misses[seat], error: matchStatus.error,
    };
    if (seen.view) {
      Object.assign(data, { me: seen.view.me, last_wave: seen.view.last_wave, threats: seen.view.threats, legal: seen.view.legal });
      map = asciiMap(level, match.getRender().render?.boards[seat]);
    }
    if (seen.report) data.report = seen.report;
  }
  data.next = nextStep(series, who, seen?.status);
  return { data, text: replyText(data, map, level) };
}

/** What the model reads: the same facts as the structured data, a section at a time. */
function replyText(data, map, level) {
  const lines = [headerLine(data)];
  if (data.message) lines.push(data.message);
  if (data.match) lines.push(matchLine(data.match));
  if (data.me) lines.push(...boardLines(data));
  if (data.report) lines.push(...reportLines(data.report, data.seat, data.series));
  lines.push(nextLine(data.next));
  if (map) lines.push('', map, mapKey(level));
  return lines.join('\n');
}

function headerLine({ seat, player, series }) {
  if (!series) return 'mcp_multi_player · no series is open';
  const draws = series.score.draws ? `, draws ${series.score.draws}` : '';
  const name = (s) => series.seats[s] ?? 'empty';
  const you = seat ? `you are ${name(seat)} (player id ${player}) vs ${name(seat === 'P1' ? 'P2' : 'P1')}` : 'you have not joined yet';
  const score = `score ${name('P1')} ${series.score.P1} - ${series.score.P2} ${name('P2')}${draws}`;
  return `mcp_multi_player · series ${series.id} (${series.level}) · ${you} · match ${series.match || '-'} · ${score} (first to ${(series.best_of + 1) / 2}) · time slot ${series.time_slot_s} s per decision`;
}

function matchLine(match) {
  let line = match.warmup ? `WARM-UP (not scored): wave ${match.wave} of ${match.of} done.` : `Wave ${match.wave} of ${match.of} done.`;
  if (match.phase === 'collecting') {
    const deadline = match.deadline_in_s !== null ? `, deadline in ${match.deadline_in_s} s` : '';
    line += ` Decision before wave ${match.wave + 1}${deadline}${match.you_submitted ? ' (your move is in)' : ''}.`;
  }
  if (match.misses) line += ` Missed deadlines: ${match.misses}.`;
  return line;
}

/** Your board: totals, the last wave, what is still coming, every tower, leak order, options. */
function boardLines({ me, last_wave: lastWave, threats, legal }) {
  const lines = [`You: base health ${me.health} · gold ${me.gold} · kills ${me.kills} · leaked ${me.leaked} · towers lost ${me.towers_lost} · spent ${me.spent}`];
  if (lastWave?.wave) {
    const lost = lastWave.towers_lost.length ? `, towers destroyed: ${lastWave.towers_lost.join(', ')}` : '';
    lines.push(`Last wave (${lastWave.wave}): ${lastWave.spawned} spawned, ${lastWave.killed} killed, ${lastWave.leaked} leaked (${lastWave.tower_hits} hit towers, ${lastWave.base_hits} hit the base)${lost}, +${lastWave.earned} gold`);
  }
  if (threats.on_board) {
    const byType = Object.entries(threats.by_type).map(([type, n]) => `${n} ${type}`).join(', ');
    lines.push(`Still on your board: ${threats.on_board} (${byType}); furthest at ${Math.round(threats.closest[0].progress * 100)}% of the path`);
  }
  lines.push(me.towers.length ? 'Your towers:' : 'Your towers: none');
  for (const tower of me.towers) lines.push('  ' + towerLine(tower));
  if (me.leak_order.length) lines.push(`Leaks hit: ${me.leak_order.join(' → ')} → base`);
  const costs = Object.entries(legal.build.costs).map(([type, cost]) => `${type} ${cost}`).join(', ');
  lines.push(`You can build on ${legal.build.slots.join(' ') || 'no free slot'} (${costs}). Any tower can be upgraded: {"type":"upgrade","slot":…,"stat":"damage"|"rate"|"range"}.`);
  return lines;
}

/** The end-of-match report: both boards, and what every standing tower did. */
function reportLines(report, seat, series) {
  const result = report.result, name = (s) => series?.seats?.[s] ?? s;
  const lines = [`Match over after ${report.waves_played} waves: ${result.winner ? `${name(result.winner)} wins` : 'no winner'} (${String(result.reason).replace(/\bP[12]\b/g, name)}).`];
  for (const side of SEATS) {
    const board = report[side];
    lines.push(`  ${name(side)}${side === seat ? ' (you)' : ''}: base health ${board.health} · kills ${board.kills} · leaked ${board.leaked} · towers lost ${board.towers_lost} · spent ${board.spent} · gold left ${board.gold}`);
    const towers = board.towers.map((t) => `${t.slot} ${t.type} (${upgradesText(t.ups)}; ${t.damage} damage, ${t.kills} kills)`).join(', ');
    lines.push(`    towers: ${towers || 'none standing'}`);
  }
  return lines;
}

const nextLine = (next) => `Next: ${next.tool}${next.args ? ' ' + JSON.stringify(next.args) : ''}. ${next.why}`;

/** The `rules` reply: the manual, the rules brief with this series' numbers, and the board. */
export function rulesReply(series, seat, manual, level) {
  const seriesStatus = series?.status() ?? null, terms = seriesTerms(level, seriesStatus), rules = level.rules;
  const towers = Object.fromEntries(Object.entries(level.towers).map(([k, t]) => [k, {
    name: t.name, code: t.code, cost: t.cost, upgrade_cost: Math.round(t.cost * rules.upgrade.costShare), base: t.base,
    delivery: t.delivery, on_hit: t.onHit, effects: onHitText(t, rules.dt) || null,
  }]));
  const length = level.layout.path.length, waveSeconds = rules.ticksPerTurn * rules.dt;
  const attackers = Object.fromEntries(Object.entries(level.attackers).map(([k, a]) => [k, {
    name: a.name, hp: a.hp, speed: a.speed, armor: a.armor, reward: a.reward, from_wave: a.fromWave, crosses_path_s: Math.round((length / a.speed) * 10) / 10,
  }]));
  const slots = level.layout.slots.map((s) => ({ id: s.id, cover: s.cover, reach: s.reach, to_base_tiles: s.toBase, leak_rank: level.layout.leakOrder.indexOf(s.id) + 1 }));
  const data = {
    ok: true, seat,
    level: {
      id: level.id, name: level.name, towers, attackers,
      waves: { count: level.waves.count, hp_growth_per_wave: level.waves.hpGrowth, max_units: level.waves.maxUnits },
      escalation: { attacker_health_growth_per_wave: level.rules.escalation.strengthPerWave, tower_damage_loss_per_wave: level.rules.escalation.towerDecayPerWave, compounding: true },
      rules: {
        start_gold: rules.startGold, income_per_wave: rules.income, start_health: rules.startHealth, tower_health: rules.towerHealth,
        wave_seconds: waveSeconds, tick_seconds: rules.dt, pace_s: terms.pace_s, deadline_s: terms.deadline_s, gap_between_matches_s: terms.gap_s,
        miss_limit: rules.missLimit, max_actions: rules.maxActions,
        upgrade: { step_of_base: rules.upgrade.step, cost_share_of_build: rules.upgrade.costShare, max_range_upgrades: rules.upgrade.maxRangeUps, stats: ['damage', 'rate', 'range'] },
      },
      layout: { rows: level.layout.rows, tile: level.layout.tile, slots, leak_order: level.layout.leakOrder, path_tiles: level.layout.path.tiles.length, path_units: length },
    },
    next: nextStep(series, null),
  };
  const L = [manual.trim(), '', '## The rules with this series\' numbers', '', rulesBrief(level, seriesStatus), ''];
  L.push('Board (both players have the same one):', asciiMap(level, null), mapKey(level), '');
  L.push(`Slots. "Reach" lists the stretches of path a tower covers from that slot, as path tile numbers (1 = the spawn tile, ${level.layout.path.tiles.length} = the base), at base range and at the range cap. "Leak" is the order in which towers take leak damage (1 = first).`);
  for (const s of slots) {
    const parts = Object.keys(level.towers).map((k) => `${k} ${s.cover[k]} tiles [${s.reach[k].base.map(([a, b]) => `${a}-${b}`).join(', ')}] → ${s.reach[k].max_tiles} [${s.reach[k].max.map(([a, b]) => `${a}-${b}`).join(', ')}]`);
    L.push(`  ${s.id.padEnd(4)} leak ${String(s.leak_rank).padStart(2)} · ${parts.join(' · ')}`);
  }
  L.push('', nextLine(data.next));
  return { data, text: L.join('\n') };
}
