// The split-screen spectator page (spec §11). With the host key: the live stream, animated.
// Without it: names, phase, wave and score only. Finished matches can be replayed by anyone.

import { setupCanvas, drawBoard } from './draw.js';
import { createPlayer } from './play.js';
import { updateScoreboard } from './scoreboard.js';
import { showSetup } from './setup.js';

const $ = (id) => document.getElementById(id);
const id = location.pathname.split('/').filter(Boolean).pop();
const storage = { get() { try { return sessionStorage.getItem('mmp-host-key') ?? ''; } catch { return ''; } }, set(v) { try { sessionStorage.setItem('mmp-host-key', v); } catch { /* fine */ } } };

let layout, player, series, live = null, replaying = false, lastBoards = null, submitted = null;

function feed(text) {
  const li = document.createElement('li');
  li.innerHTML = text;
  $('feed').prepend(li);
  while ($('feed').children.length > 60) $('feed').lastChild.remove();
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const nameOf = (seat) => series?.seats?.[seat] ?? (seat === 'P1' ? 'left player' : 'right player');
/** Result and reason texts come with seats in them; people read names. */
const named = (text) => esc(String(text ?? '')).replace(/\bP[12]\b/g, (seat) => esc(nameOf(seat)));

/** Keeps the time a series status arrived, so countdowns in it can tick on the page. */
const stamped = (status) => ({ ...status, receivedAt: Date.now() });

function refreshScore() {
  if (!series) return;
  updateScoreboard(series, lastBoards, layout.start_health, submitted);
  $('p1-board-name').textContent = nameOf('P1');
  $('p2-board-name').textContent = nameOf('P2');
  if (series.pace_s) player?.setWaveSeconds(series.pace_s);
  renderHost();
}

// ---- Host controls: start, stop, remove a player, tuning (spec §11) ----

let hostKey = '';

async function hostPost(path, body = {}) {
  const res = await fetch(`/api/series/${id}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': hostKey }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  $('host-state').textContent = out.ok ? '' : out.message ?? 'failed';
  return out;
}

/** A button that has to be clicked twice (the app's browser pane blocks confirm()). */
function twoStep(button, label, run) {
  button.addEventListener('click', async () => {
    if (button.dataset.armed !== 'yes') {
      button.dataset.armed = 'yes'; button.textContent = `Click again to ${label}`;
      setTimeout(() => { button.dataset.armed = ''; renderHost(); }, 4000);
      return;
    }
    button.dataset.armed = '';
    await run();
  });
}

function renderHost() {
  const box = $('host-controls');
  box.hidden = !hostKey || !series;
  if (box.hidden) return;
  const open = !['done', 'cancelled'].includes(series.phase);
  $('btn-start').disabled = !series.can_start;
  $('btn-start').textContent = series.phase === 'waiting' ? 'Start' : 'Started';
  $('btn-stop').disabled = !open;
  for (const seat of ['P1', 'P2']) {
    const b = $(`btn-leave-${seat.toLowerCase()}`);
    b.hidden = !open || !series.seats?.[seat];
    if (b.dataset.armed !== 'yes') b.textContent = `Remove ${nameOf(seat)}`;
  }
  if ($('btn-stop').dataset.armed !== 'yes') $('btn-stop').textContent = 'Stop';
  if (document.activeElement !== $('intensity')) { $('intensity').value = series.intensity ?? 5; $('intensity-value').textContent = series.intensity ?? 5; }
  if (document.activeElement !== $('pace')) { $('pace').value = series.pace_s ?? 5; $('pace-value').textContent = series.pace_s ?? 5; }
  $('btn-random').disabled = series.phase !== 'in_match';
}

$('btn-start').addEventListener('click', () => hostPost('/start'));
twoStep($('btn-stop'), 'stop the series', () => hostPost('/cancel'));
for (const seat of ['P1', 'P2']) twoStep($(`btn-leave-${seat.toLowerCase()}`), `remove ${nameOf(seat)}`, () => hostPost(`/seats/${seat}/leave`));
$('intensity').addEventListener('input', (e) => { $('intensity-value').textContent = e.target.value; });
$('intensity').addEventListener('change', (e) => hostPost('/tuning', { intensity: Number(e.target.value) }));
$('pace').addEventListener('input', (e) => { $('pace-value').textContent = e.target.value; });
$('pace').addEventListener('change', (e) => hostPost('/tuning', { pace_s: Number(e.target.value) }));
$('btn-random').addEventListener('click', async () => {
  const out = await hostPost('/tuning', { random_wave: true });
  if (out.ok) feed(`<b>Random wave:</b> ${out.burst} extra attackers join the next wave on both boards`);
});

/** "+2 damage +1 range", or "base". */
const upgradesText = (upgrades = {}) => ['damage', 'rate', 'range'].filter((stat) => upgrades[stat]).map((stat) => `+${upgrades[stat]} ${stat}`).join(' ') || 'base';

/** One board's line in the match report: totals, then every standing tower and its damage. */
function reportSide(report, seat) {
  const board = report[seat];
  const towers = board.towers.map((t) => `${t.slot} ${t.type} (${upgradesText(t.ups)}; ${t.damage ?? 0} dmg)`).join(', ') || 'none';
  const totals = [`base ${board.health}`, `kills ${board.kills}`, `leaked ${board.leaked}`, `towers lost ${board.towers_lost ?? 0}`, `spent ${board.spent}`];
  return `${esc(nameOf(seat))}: ${totals.join(', ')}, towers ${towers}`;
}

function showReport(report) {
  if (!report) return;
  const result = report.result;
  const headline = `<b>${result.winner ? `${esc(nameOf(result.winner))} wins` : 'No winner'}</b> after ${report.waves_played} waves (${named(result.reason)}).`;
  $('report').dataset.full = 'yes';
  $('report').innerHTML = `${headline}<br>${reportSide(report, 'P1')}<br>${reportSide(report, 'P2')}`;
}

function renderReplays() {
  if (series.history.length && $('report').dataset.full !== 'yes') {
    $('report').innerHTML = series.history.map((h) => `Match ${h.match}: ${h.cancelled ? 'cancelled' : h.winner ? `<b>${esc(nameOf(h.winner))} wins</b>` : 'no winner'} (${named(h.reason)})`).join('<br>');
  }
  const box = $('replays'); box.textContent = '';
  for (const h of series.history) {
    if (h.cancelled) continue;
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = `Replay match ${h.match}`;
    b.addEventListener('click', () => replay(h.match));
    box.append(b);
  }
}

async function loadPublic() {
  const res = await fetch(`/api/series/${id}`);
  if (!res.ok) { $('title').textContent = 'Series not found'; return false; }
  const data = await res.json();
  series = stamped(data.series); layout = layout ?? data.layout;
  $('title').textContent = `Series ${series.id}`;
  $('level').textContent = `level ${series.level.name} · best of ${series.target * 2 - 1}`;
  refreshScore(); renderReplays();
  return true;
}

function turnLine(msg) {
  const by = { P1: { k: 0, l: 0, lost: [] }, P2: { k: 0, l: 0, lost: [] } };
  for (const e of msg.events) {
    if (e.type === 'death') by[e.board].k++;
    if (e.type === 'leak') by[e.board].l++;
    if (e.type === 'tower_lost') by[e.board].lost.push(e.slot);
  }
  const side = (s) => `${esc(nameOf(s))} ${by[s].k} killed${by[s].l ? `, <b>${by[s].l} leaked</b>` : ''}${by[s].lost.length ? `, <b>lost ${by[s].lost.join(' ')}</b>` : ''}`;
  return `<b>w${msg.render.turn}</b> ${side('P1')} · ${side('P2')}`;
}

function startLive(key) {
  hostKey = key;
  live?.close();
  $('gate').hidden = true; $('boards').hidden = false; $('mode').textContent = 'live';
  live = new EventSource(`/api/series/${id}/stream?key=${encodeURIComponent(key)}`);
  live.addEventListener('hello', (ev) => {
    const d = JSON.parse(ev.data);
    series = stamped(d.series); submitted = d.match?.status?.submitted ?? null;
    if (d.match && !replaying) { player.clear(); player.resetPace(); player.show(d.match.render); lastBoards = d.match.render.boards; }
    if (d.match?.report) showReport(d.match.report);
    refreshScore(); renderReplays();
  });
  live.addEventListener('phase', (ev) => { const d = JSON.parse(ev.data); submitted = d.status.submitted; refreshScore(); });
  live.addEventListener('turn', async (ev) => {
    const d = JSON.parse(ev.data);
    series = { ...series, wave: d.status.wave, match_phase: d.status.phase }; submitted = d.status.submitted;
    feed(turnLine(d));
    if (replaying) return;
    player.noteArrival();
    await player.play(d);
    lastBoards = d.render.boards; refreshScore();
  });
  live.addEventListener('match_end', (ev) => { const d = JSON.parse(ev.data); submitted = null; feed(`<b>${d.match === 0 ? 'Warm-up' : `Match ${d.match}`} over:</b> ${d.result.winner ? `${esc(nameOf(d.result.winner))} wins` : 'no winner'} (${named(d.result.reason)})`); showReport(d.report); });
  for (const t of ['series', 'series_end']) live.addEventListener(t, (ev) => { series = stamped(JSON.parse(ev.data).series); refreshScore(); renderReplays(); });
}

/** Each replay (and going back to live) starts a new run; an older run stops at its next step. */
let replayRun = 0;

async function replay(n) {
  const run = ++replayRun;
  const current = () => replaying && run === replayRun;
  replaying = true; player.clear(); player.resetPace();
  $('boards').hidden = false; $('gate').hidden = true; $('back-live').hidden = false;
  $('mode').textContent = `replay of match ${n}`;
  // Start the scoreboard from the replayed match's beginning, not from whatever was on screen.
  series = { ...series, wave: 0, match: n }; lastBoards = null; submitted = null; refreshScore();
  let from = 0, total = Infinity, report = null;
  while (current() && from < total) {
    const res = await fetch(`/api/series/${id}/matches/${n}/replay?from=${from}&count=10`);
    if (!res.ok || !current()) break;
    const page = await res.json();
    total = page.total; report = page.report;
    for (const turn of page.turns) {
      if (!current()) return;
      await player.play(turn);
      if (!current()) return;
      lastBoards = turn.render.boards; series = { ...series, wave: turn.wave, match: n }; refreshScore();
    }
    from += page.turns.length;
    if (!page.turns.length) break;
  }
  if (report && current()) showReport(report);
}

$('back-live').addEventListener('click', () => {
  replaying = false; replayRun++; player.clear(); $('back-live').hidden = true;
  const key = storage.get();
  if (key) startLive(key); else { $('boards').hidden = true; $('gate').hidden = false; $('mode').textContent = 'public'; }
});
$('speed').addEventListener('change', (e) => player.setSpeed(Number(e.target.value)));
$('key-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = $('key').value.trim();
  const ok = (await fetch('/api/host/check', { headers: { 'x-host-key': key } })).ok;
  if (!ok) { $('key-error').textContent = 'That host key is not right. The server prints it when it starts.'; return; }
  storage.set(key); startLive(key);
});

showSetup($('setup')).then((ok) => { $('setup-box').hidden = !ok; });
// Countdowns (the pause between matches) tick once a second without waiting for the server.
setInterval(() => { if (series?.phase === 'between') refreshScore(); }, 1000);

if (await loadPublic()) {
  const ctxs = { P1: setupCanvas($('c1'), layout), P2: setupCanvas($('c2'), layout) };
  player = createPlayer({
    layout, ctxs, drawBoard, ticksPerTurn: layout.ticks_per_wave, waveSeconds: layout.wave_seconds,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  player.setSpeed(Number($('speed').value));
  player.show({ boards: { P1: null, P2: null } });
  const key = storage.get();
  const okKey = key && (await fetch('/api/host/check', { headers: { 'x-host-key': key } })).ok;
  if (okKey) startLive(key);
  else { $('gate').hidden = false; $('mode').textContent = 'public'; }
  setInterval(async () => { if (!live && !replaying) await loadPublic(); }, 3000);
}
