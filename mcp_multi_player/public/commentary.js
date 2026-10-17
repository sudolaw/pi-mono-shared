// Plain-words commentary for people watching (build ticket #28), made only from public
// events. Each function returns a list of short lines, e.g. "Codex sends 6 Crawlers".

const TOWER = { laser: 'Laser', plasma: 'Plasma', cryo: 'Cryo' };
const UNIT = { crawler: 'Crawler', runner: 'Runner', scarab: 'Scarab' };
// "4–1" with the winner's score first, so the line reads naturally.
export const winnerFirst = (wins, winner) => `${wins[winner]}–${wins[winner === 'P1' ? 'P2' : 'P1']}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function commentaryFor(event, names) {
  const who = (seat) => names[seat] || seat;
  const p = event.payload ?? {};
  switch (event.type) {
    case 'player_joined': return [`${p.name} takes the ${p.seat} seat.`];
    case 'player_left': return [`${who(p.seat)} leaves the series.`];
    case 'player_ready': return [`${who(p.seat)} is ready for match ${p.forMatch}.`];
    case 'warmup_started': return [`Warm-up: ${p.rounds} practice rounds that don't count. The server is timing both players.`];
    case 'deadline_set': return [p.seconds ? `Opening-round deadline set to ${p.seconds} s (${deadlineReason(p)}). Combat runs continuously from round 3.` : 'No opening-round deadline. Combat runs continuously from round 3.'];
    case 'match_started': return [`Match ${p.match} begins: ${names.P1} vs ${names.P2}!${p.tiebreak ? ' Tiebreak match: a draw goes to kills, then tower damage.' : ''}`];
    case 'deadline_missed': return [`${who(p.seat)} missed the deadline (${p.misses}/${p.of}) and saves gold this round.`];
    case 'round_resolved': return roundLines(event, who);
    case 'match_ended': return [matchEnded(p, who)];
    case 'strategy_review_started': return [`Strategy review: both players study the match report before match ${p.nextMatch}.`];
    case 'series_ended': return [p.cancelled ? 'The host cancelled the series.' : `${p.winnerName} wins the series ${winnerFirst(p.wins, p.winner)}!`];
    case 'series_restarted': return ['The host restarted the series: back to the start screen, waiting for agents to join.'];
    case 'host_action': return [p.action === 'start' ? `The host presses Start: ${names.P1} vs ${names.P2}!` : p.action === 'forfeit' ? `The host declares a forfeit for ${who(p.seat)}.` : p.action === 'cancel_match' ? 'The host cancels this match; it will be replayed.' : 'The host cancels the series.'];
    default: return [];
  }
}

function roundLines(event, who) {
  const p = event.payload;
  const lines = [];
  for (const seat of ['P1', 'P2']) {
    const b = p.bundles[seat] ?? [];
    if (p.autoFilled?.[seat]) continue;
    const builds = b.filter((a) => a.type === 'build').map((a) => `a ${TOWER[a.tower]} at ${a.slot}`);
    const ups = b.filter((a) => a.type === 'upgrade').length;
    const sends = {};
    for (const a of b.filter((x) => x.type === 'send')) for (const u of a.units) sends[u.type] = (sends[u.type] ?? 0) + u.count;
    const parts = [];
    if (builds.length) parts.push(`builds ${builds.join(' and ')}`);
    if (ups) parts.push(`upgrades ${plural(ups, 'tower')}`);
    const sendText = Object.entries(sends).map(([t, n]) => plural(n, UNIT[t])).join(' and ');
    if (sendText) parts.push(`sends ${sendText}`);
    if (parts.length) lines.push(`${who(seat)} ${parts.join(', ')}.`);
    else if (b.length === 0 && !p.warmup) lines.push(`${who(seat)} saves gold.`);
  }
  const k = p.summary.kills;
  for (const seat of ['P1', 'P2']) {
    if (k[seat] >= 5) lines.push(`${who(seat)}'s towers shred the wave: ${k[seat]} kills!`);
  }
  for (const seat of ['P1', 'P2']) {
    const hits = p.summary.baseHits[seat];
    if (hits > 0) lines.push(`${plural(hits, 'attacker')} break${hits === 1 ? 's' : ''} into ${who(seat)}'s base: ${p.end[seat].base} left.`);
  }
  return lines;
}

function matchEnded(p, who) {
  if (p.result === 'void') return `Match ${p.match} is cancelled.`;
  if (p.result === 'draw') return `Match ${p.match} ends in a draw${p.tiebreak ? '; still tied after the tiebreak, so it will be replayed' : ' and will be replayed'}.`;
  const how = {
    base_destroyed: "by destroying the enemy base",
    round_limit: 'on base health at the round limit',
    tiebreak_kills: 'on the tiebreak (more kills)',
    tiebreak_damage: 'on the tiebreak (more tower damage)',
    forfeit: 'by forfeit',
    resigned: 'after the opponent resigned',
    deadline_forfeit: 'after the opponent missed too many deadlines',
  }[p.decidedBy] ?? '';
  return `${p.winnerName ?? who(p.winner)} wins match ${p.match} ${how}! Series: ${who('P1')} ${p.wins.P1}, ${who('P2')} ${p.wins.P2}.`;
}

function deadlineReason(p) {
  if (p.mode !== 'auto') return 'set by the host';
  const measured = p.warmupAverageMs && (p.warmupAverageMs.P1 || p.warmupAverageMs.P2);
  return measured ? "twice the slower player's warm-up time" : 'the automatic minimum; no warm-up was measured';
}
