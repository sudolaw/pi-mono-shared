// The broadcast band across the top (spec §11): names, health bars, gold, kills, leaked,
// wave n / total, the phase and the series score. Board numbers only appear for the host.

const $ = (id) => document.getElementById(id);
const set = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = String(v); };

export function phaseText(series) {
  if (series.error) return `stuck: ${series.error} (restart the server)`;
  if (series.phase === 'waiting') return series.can_start ? 'ready: press Start' : 'waiting for players';
  if (series.phase === 'between') {
    // The server sends the countdown once; count it down here from when it arrived.
    const left = series.next_match_in_s ? Math.max(0, Math.ceil(series.next_match_in_s - (Date.now() - (series.receivedAt ?? Date.now())) / 1000)) : 0;
    return `match ${series.match} over · ${left ? `next in ${left} s` : 'waiting for ready'}`;
  }
  if (series.phase === 'done') return series.winner ? `${series.seats?.[series.winner] ?? series.winner} wins the series` : 'series drawn';
  if (series.phase === 'cancelled') return 'cancelled';
  if (series.match_phase === 'collecting') return 'agents deciding';
  if (series.match_phase === 'resolving') return 'wave running';
  return series.match_phase ?? series.phase;
}

export function updateScoreboard(series, boards, startHealth, submitted) {
  for (const seat of ['P1', 'P2']) {
    const k = seat.toLowerCase(), b = boards?.[seat];
    set(`${k}-name`, series.seats[seat] ?? 'empty seat');
    set(`${k}-wins`, series.score[seat]);
    set(`${k}-health`, b ? b.health : '–');
    set(`${k}-gold`, b ? b.gold : '–');
    set(`${k}-kills`, b ? b.kills : '–');
    set(`${k}-leaked`, b ? b.leaked : '–');
    set(`${k}-lost`, b ? b.towers_lost ?? 0 : '–');
    $(`${k}-hp`).style.width = b ? `${(100 * Math.max(0, b.health)) / startHealth}%` : '0%';
    set(`${k}-move`, submitted ? (submitted[seat] ? 'move in' : 'thinking…') : '');
  }
  // Match 0 is the unscored warm-up: say so, and count its few waves, not the match's.
  const warmup = series.phase === 'in_match' && series.match === 0;
  set('wave', series.wave); set('wave-max', warmup ? series.warmup_waves : series.of);
  set('match-no', warmup ? 'warm-up' : series.match || '–');
  set('phase', phaseText(series));
  $('phase').className = 'pill ' + (series.phase === 'done' ? 'done' : series.phase === 'in_match' ? 'live' : '');
}
