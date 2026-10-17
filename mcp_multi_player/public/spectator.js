// Spectator page (SPEC.md §14): a TV-style broadcast drawn entirely on one canvas
// (scoreboard, phase banner, board, commentary ticker, key strip) so Record captures
// everything. It only animates results the server already computed: playback speed,
// skipping and closing the tab never affect the game.

import { buildBoard } from '/engine/board.js';
import { commentaryFor, winnerFirst } from '/static/commentary.js';

const seriesId = location.pathname.split('/')[2];

// ── layout (canvas units) ─────────────────────────────────────────────────────
const W = 1600;
const SCORE_H = 96;
const BANNER_H = 34;
const TOP = SCORE_H + BANNER_H; // board starts here
const BOARD_H = 800;
const TICKER_H = 36;
const KEY_H = 44;
const H = TOP + BOARD_H + TICKER_H + KEY_H;

const COLORS = {
  bg: '#0a0a1e', P1: '#00e5ff', P2: '#ff6688', road: '#181840', gold: '#ffd700', text: '#e8eeff', muted: '#8f9bc8',
  crawler: '#88ff66', runner: '#ffee44', scarab: '#cc88ff', laser: '#00e5ff', plasma: '#ff8800', cryo: '#88ccff',
};
const TOWER_NAME = { laser: 'Laser', plasma: 'Plasma', cryo: 'Cryo' };

// ── state ─────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('tv');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

let board = null; // from the series settings, same code as the engine
let maxBase = 20;
let settings = null; // effective settings of this series (start screen summary)
let view = null; // latest spectator view from the server
let names = { P1: 'P1', P2: 'P2' };
let speed = 1;
const queue = []; // public events waiting to be shown, in order
let playing = null; // { event, timeline, t, nextEvent, effects }
let shown = null; // last finished round: { timeline, frame } (static picture while waiting)
let display = null; // scoreboard numbers driven by playback: { match, P1: {base, gold, kills}, P2: … }
let overlay = null; // { title, sub, until } result card
const ticker = []; // commentary lines, newest last
let lastReal = performance.now();
let liveCombat = null; // server snapshots: combat keeps running while agents plan

// ── data in ───────────────────────────────────────────────────────────────────
async function start() {
  settings = await (await fetch(`/api/series/${seriesId}/settings`)).json();
  board = buildBoard(settings.board);
  maxBase = settings.match.baseHealth;
  const es = new EventSource(`/series/${seriesId}/stream`);
  es.addEventListener('history', (m) => loadHistory(JSON.parse(m.data)));
  es.addEventListener('view', (m) => { view = JSON.parse(m.data); names = { P1: view.names.P1 || 'P1', P2: view.names.P2 || 'P2' }; renderSide(); });
  es.addEventListener('event', (m) => { const e = JSON.parse(m.data); queue.push(e); addLog(e); });
  es.addEventListener('combat', (m) => {
    const snapshot = JSON.parse(m.data);
    const previous = liveCombat?.match === snapshot.match && liveCombat?.round === snapshot.round ? liveCombat.frame : snapshot.frame;
    liveCombat = { ...snapshot, previous, receivedAt: performance.now() };
    playing = null;
  });
  requestAnimationFrame(frame);
}

// On connect: show the last finished round as a still picture, fill the logs, don't animate the past.
async function loadHistory(events) {
  if (view) names = { P1: view.names.P1 || 'P1', P2: view.names.P2 || 'P2' }; // the view arrives first
  for (const e of events) {
    if (e.type === 'player_joined') names[e.payload.seat] = e.payload.name;
    addLog(e);
    for (const line of commentaryFor(e, names)) pushTicker(line, false);
  }
  // Only rounds after the latest host restart belong to the current game.
  const restartAt = events.findLastIndex((e) => e.type === 'series_restarted');
  const lastRound = events.slice(restartAt + 1).reverse().find((e) => e.type === 'round_resolved');
  if (lastRound) {
    const timeline = await loadTimeline(lastRound);
    if (timeline) {
      shown = { timeline, frame: timeline.frames.at(-1), match: lastRound.match };
      display = statsFrom(timeline.end, lastRound.match);
    }
  }
}

async function loadTimeline(event) {
  try {
    const res = await fetch(`/series/${seriesId}/${event.payload.combat}`);
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

const statsFrom = (s, match) => ({ match, P1: { ...s.P1 }, P2: { ...s.P2 } });

// ── playback ──────────────────────────────────────────────────────────────────
async function advanceQueue() {
  if (playing || queue.length === 0 || advanceQueue.busy) return;
  advanceQueue.busy = true;
  try {
    // More than 2 rounds behind (a hidden tab pauses animation, or "Live"): resolve the
    // older rounds instantly. Count rounds, not events: each round brings several events.
    while (queue.filter((x) => x.type === 'round_resolved').length > 2) finishInstantly(queue.shift());
    const e = queue.shift();
    if (e.type === 'round_resolved' && e.payload.mode === 'live') { finishInstantly(e); return; }
    if (e.type === 'round_resolved') {
      const timeline = await loadTimeline(e);
      // No combat file (yet): still tell the round's story and move the score on.
      if (!timeline) { finishInstantly(e); return; }
      for (const line of commentaryFor(e, names)) pushTicker(line);
      display = statsFrom(timeline.start, e.match);
      playing = { event: e, timeline, t: 0, nextEvent: 0, effects: [] };
    } else {
      applyInstant(e);
    }
  } finally {
    advanceQueue.busy = false;
  }
}

function finishInstantly(e) {
  if (e.type === 'round_resolved') {
    for (const line of commentaryFor(e, names)) pushTicker(line, false);
    display = statsFrom(e.payload.end, e.match);
    // Keep the board picture: load this round's final frame (only the newest skipped round wins).
    const token = (finishInstantly.latest = e.seq);
    loadTimeline(e).then((tl) => {
      if (tl && finishInstantly.latest === token && !playing) shown = { timeline: tl, frame: tl.frames.at(-1), match: e.match };
    });
  } else applyInstant(e, false);
}

function applyInstant(e, withOverlay = true) {
  if (e.type === 'player_joined') names[e.payload.seat] = e.payload.name;
  for (const line of commentaryFor(e, names)) pushTicker(line);
  if (e.type === 'match_started') { shown = null; display = null; liveCombat = null; }
  if (e.type === 'series_restarted') { shown = null; display = null; liveCombat = null; overlay = null; names = { P1: 'P1', P2: 'P2' }; }
  if (withOverlay && e.type === 'match_ended') {
    const p = e.payload;
    const title = p.result === 'win' ? `${p.winnerName ?? names[p.winner]} wins match ${p.match}` : p.result === 'draw' ? `Match ${p.match} drawn` : `Match ${p.match} cancelled`;
    overlay = { title, sub: `Series: ${names.P1} ${p.wins.P1} · ${names.P2} ${p.wins.P2}`, until: performance.now() + 3500 };
  }
}

function step(dtReal) {
  if (!playing) return;
  const tl = playing.timeline;
  playing.t += dtReal * speed;
  // Timeline events up to now drive effects and the live scoreboard numbers.
  while (playing.nextEvent < tl.events.length && tl.events[playing.nextEvent].t <= playing.t) {
    const ev = tl.events[playing.nextEvent++];
    effectFor(ev, tl);
  }
  playing.effects = playing.effects.filter((f) => f.until > playing.t);
  const end = tl.frames.at(-1)?.t ?? 0;
  if (playing.t >= end) {
    display = statsFrom(tl.end, playing.event.match);
    shown = { timeline: tl, frame: tl.frames.at(-1), match: playing.event.match };
    playing = null;
  }
}

function effectFor(ev, tl) {
  const at = playing.t;
  const pos = (id) => attackerPos(id, at);
  if (ev.type === 'shot' && ev.tower === 'laser') {
    const s = board.slots[ev.slot];
    const p = pos(ev.target);
    if (p) playing.effects.push({ kind: 'beam', x1: s.x, y1: s.y, x2: p[0], y2: p[1], until: at + 0.08 });
  } else if (ev.type === 'kill') {
    const p = pos(ev.id);
    if (p) playing.effects.push({ kind: 'burst', x: p[0], y: p[1], from: at, until: at + 0.35 });
    const defender = ev.owner === 'P1' ? 'P2' : 'P1';
    display[defender].kills += 1;
    display[defender].gold += ev.reward;
  } else if (ev.type === 'base_hit') {
    display[ev.base].base = ev.remaining;
    const [bx, by] = board.bases[ev.base];
    playing.effects.push({ kind: 'basehit', x: bx, y: by, from: at, until: at + 0.5 });
  } else if (ev.type === 'hit' && ev.splash) {
    const p = pos(ev.id);
    if (p) playing.effects.push({ kind: 'splash', x: p[0], y: p[1], from: at, until: at + 0.2 });
  }
}

// Interpolated attacker position (frames are 10 Hz).
function framesAround(tl, t) {
  const fs = tl.frames;
  let i = 0;
  while (i < fs.length - 1 && fs[i + 1].t <= t) i++;
  const f0 = fs[i];
  const f1 = fs[Math.min(i + 1, fs.length - 1)];
  const k = f1.t > f0.t ? Math.min(1, Math.max(0, (t - f0.t) / (f1.t - f0.t))) : 0;
  return { f0, f1, k };
}

function attackerPos(id, t) {
  if (!playing) return null;
  const { f0, f1, k } = framesAround(playing.timeline, t);
  const a0 = f0.a.find((a) => a[0] === id);
  const a1 = f1.a.find((a) => a[0] === id) ?? a0;
  if (!a0) return a1 ? [a1[3], a1[4]] : null;
  return [a0[3] + (a1[3] - a0[3]) * k, a0[4] + (a1[4] - a0[4]) * k];
}

// ── drawing ───────────────────────────────────────────────────────────────────
function frame(now) {
  const dt = Math.min(0.1, (now - lastReal) / 1000);
  lastReal = now;
  advanceQueue();
  step(dt);
  draw(now);
  requestAnimationFrame(frame);
}

const currentMatch = () => playing?.event.match ?? shown?.match ?? view?.match ?? 0;
// Sides swap every other match (display only): even matches show P1 on the right.
const flipped = () => currentMatch() % 2 === 0 && currentMatch() > 0;
const tx = (x, y) => (flipped() ? [board.width - x, board.height - y] : [x, y]);

function draw(now) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  if (!board) return;
  drawBoard();
  if (onStartScreen()) drawStartScreen(now);
  drawScoreboard();
  drawBanner(now);
  drawTicker();
  drawKey();
  if (overlay && overlay.until > now && !onStartScreen()) drawOverlay(overlay.title, overlay.sub);
  else if (view?.phase === 'series_finished' && view.result && queue.length === 0 && !playing) {
    drawOverlay(`${view.result.winnerName} wins the series`, `${winnerFirst(view.result.wins, view.result.winner)}${view.result.draws ? ` · ${view.result.draws} draw${view.result.draws === 1 ? '' : 's'}` : ''}`);
  }
}

function drawBoard() {
  ctx.save();
  ctx.translate(0, TOP);
  ctx.beginPath();
  ctx.rect(0, 0, board.width, board.height);
  ctx.clip();
  // zones
  const third = board.width / 3;
  const zone = (x0, x1, color) => {
    const [ax, ay] = tx(x0, 0);
    const [bx, by] = tx(x1, board.height);
    ctx.fillStyle = color;
    ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
  };
  zone(0, third, '#00e5ff10');
  zone(third, 2 * third, '#ffffff07');
  zone(2 * third, board.width, '#ff668810');
  ctx.font = 'bold 20px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff30';
  const zx = (x) => tx(x, 0)[0];
  ctx.fillText(`${names.P1}'s third`, zx(third / 2), 30);
  ctx.fillText('Shared middle', zx(board.width / 2), 30);
  ctx.fillText(`${names.P2}'s third`, zx(2.5 * third), 30);

  // pipes
  for (const seat of ['P1', 'P2']) {
    const pts = board.paths[seat].points.map(([x, y]) => tx(x, y));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = COLORS.road; ctx.lineWidth = 44; trace(pts); ctx.stroke();
  }
  for (const seat of ['P1', 'P2']) {
    const pts = board.paths[seat].points.map(([x, y]) => tx(x, y));
    ctx.strokeStyle = COLORS[seat] + '77'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); trace(pts); ctx.stroke(); ctx.setLineDash([]);
  }

  // bases
  const stats = scoreNumbers();
  for (const seat of ['P1', 'P2']) {
    const [x, y] = tx(...board.bases[seat]);
    ctx.fillStyle = COLORS[seat];
    ctx.beginPath(); ctx.arc(x, y, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 24px system-ui';
    ctx.fillText(String(stats[seat].base), x, y + 8);
  }

  // slots and towers
  const live = liveCombat?.match === view?.match && view?.decision_slot?.combat_continues ? liveCombat : null;
  const tl = live ?? playing?.timeline ?? shown?.timeline;
  const towers = new Map((tl?.towers ?? []).map((t) => [t.slot, t]));
  for (const id of board.slotIds) {
    const s = board.slots[id];
    const [x, y] = tx(s.x, s.y);
    const t = towers.get(id);
    if (!t) {
      ctx.strokeStyle = COLORS[s.owner] + '55'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke();
      if (s.zone === 'middle') { ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.arc(x, y, 23, 0, Math.PI * 2); ctx.stroke(); }
      continue;
    }
    drawTower(x, y, t);
  }

  // attackers + projectiles
  const pic = live ? interpolated({ frames: [live.previous, live.frame] },
    live.previous.t + Math.min(1, (performance.now() - live.receivedAt) / 100) * (live.frame.t - live.previous.t))
    : playing ? interpolated() : shown?.frame ? { a: shown.frame.a, p: shown.frame.p } : null;
  if (pic) {
    for (const p of pic.p) drawProjectile(...tx(p[2], p[3]), p[1]);
    for (const a of pic.a) drawAttacker(a);
  }
  for (const f of playing?.effects ?? []) drawEffect(f);
  ctx.restore();
}

function interpolated(timeline = playing.timeline, t = playing.t) {
  const { f0, f1, k } = framesAround(timeline, t);
  const next = new Map(f1.a.map((a) => [a[0], a]));
  const a = f0.a.map((a0) => {
    const a1 = next.get(a0[0]) ?? a0;
    return [a0[0], a0[1], a0[2], a0[3] + (a1[3] - a0[3]) * k, a0[4] + (a1[4] - a0[4]) * k, a1[5], a0[6], a1[7], Math.atan2(a1[4] - a0[4], a1[3] - a0[3])];
  });
  const pn = new Map(f1.p.map((p) => [p[0], p]));
  const p = f0.p.map((p0) => { const p1 = pn.get(p0[0]) ?? p0; return [p0[0], p0[1], p0[2] + (p1[2] - p0[2]) * k, p0[3] + (p1[3] - p0[3]) * k]; });
  return { a, p };
}

function drawTower(x, y, t) {
  const sides = { laser: 4, plasma: 0, cryo: 6 }[t.type];
  ctx.fillStyle = COLORS[t.type];
  ctx.strokeStyle = COLORS[t.owner];
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (!sides) ctx.arc(x, y, 17, 0, Math.PI * 2);
  else for (let k = 0; k <= sides; k++) {
    const ang = (Math.PI * 2 * k) / sides + (sides === 4 ? 0 : Math.PI / 6);
    ctx[k ? 'lineTo' : 'moveTo'](x + 19 * Math.cos(ang), y + 19 * Math.sin(ang));
  }
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 16px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(String(t.level), x, y + 6);
  label(`${TOWER_NAME[t.type]} L${t.level} · ${t.targeting}`, x, y + 38, '#ffffff');
}

// a = [id, owner 0|1, type, x, y, hp, maxHp, slowed, angle?]; no name labels on moving units
function drawAttacker(a) {
  const [x, y] = tx(a[3], a[4]);
  const type = a[2];
  ctx.fillStyle = COLORS[type];
  ctx.beginPath();
  if (type === 'crawler') ctx.arc(x, y, 11, 0, Math.PI * 2);
  else if (type === 'runner') {
    const ang = (a[8] ?? 0) + (flipped() ? Math.PI : 0);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.moveTo(14, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath();
    ctx.restore();
  } else {
    ctx.rect(x - 12, y - 12, 24, 24);
    ctx.strokeStyle = '#3a1a5a'; ctx.lineWidth = 5; ctx.stroke();
  }
  ctx.fill();
  if (a[7]) { ctx.strokeStyle = '#bfe8ffcc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke(); }
  const hp = Math.max(0, a[5] / a[6]);
  ctx.fillStyle = '#000000aa'; ctx.fillRect(x - 16, y - 25, 32, 6);
  ctx.fillStyle = hp > 0.6 ? '#00ff88' : hp > 0.3 ? '#ffcc00' : '#ff4444';
  ctx.fillRect(x - 16, y - 25, 32 * hp, 6);
}

function drawProjectile(x, y, type) {
  ctx.fillStyle = COLORS[type];
  ctx.beginPath(); ctx.arc(x, y, type === 'plasma' ? 7 : 4, 0, Math.PI * 2); ctx.fill();
}

function drawEffect(f) {
  if (f.kind === 'beam') {
    const [x1, y1] = tx(f.x1, f.y1); const [x2, y2] = tx(f.x2, f.y2);
    ctx.strokeStyle = '#7ff6ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    return;
  }
  const [x, y] = tx(f.x, f.y);
  const k = (playing.t - f.from) / (f.until - f.from);
  const r = { burst: 10 + 22 * k, splash: 48 * k, basehit: 40 + 30 * k }[f.kind];
  ctx.strokeStyle = { burst: '#ffffff', splash: '#ff8800', basehit: '#ff3344' }[f.kind];
  ctx.globalAlpha = 1 - k; ctx.lineWidth = f.kind === 'basehit' ? 6 : 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}

function scoreNumbers() {
  if (liveCombat?.match === view?.match && view?.decision_slot?.combat_continues) return liveCombat.players;
  if (display && (playing || queue.length || shown)) return display;
  const p = view?.players;
  return {
    P1: { base: p?.P1.base ?? 20, gold: p?.P1.gold ?? 0, kills: p?.P1.kills ?? 0 },
    P2: { base: p?.P2.base ?? 20, gold: p?.P2.gold ?? 0, kills: p?.P2.kills ?? 0 },
  };
}

function drawScoreboard() {
  const stats = scoreNumbers();
  const left = flipped() ? 'P2' : 'P1';
  const right = flipped() ? 'P1' : 'P2';
  ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, SCORE_H);
  const panel = (seat, side) => {
    const x0 = side === 'L' ? 0 : W / 2 + 160;
    const w = W / 2 - 160;
    const g = ctx.createLinearGradient(side === 'L' ? 0 : W, 0, side === 'L' ? w : W - w, 0);
    g.addColorStop(0, COLORS[seat] + '40'); g.addColorStop(1, COLORS[seat] + '00');
    ctx.fillStyle = g; ctx.fillRect(x0, 0, w, SCORE_H);
    const align = side === 'L' ? 'left' : 'right';
    const ex = side === 'L' ? 24 : W - 24;
    ctx.textAlign = align;
    ctx.fillStyle = COLORS[seat]; ctx.font = 'bold 30px system-ui';
    ctx.fillText(`${names[seat]}`, ex, 40);
    ctx.fillStyle = COLORS.muted; ctx.font = '600 18px system-ui';
    ctx.fillText(`${seat} · gold ${stats[seat].gold} · kills ${stats[seat].kills}`, ex, 72);
    // base bar
    const bw = 220, bx = side === 'L' ? 420 : W - 420 - bw;
    ctx.fillStyle = '#222'; ctx.fillRect(bx, 24, bw, 16);
    const frac = Math.max(0, stats[seat].base) / maxBase;
    ctx.fillStyle = COLORS[seat];
    if (side === 'L') ctx.fillRect(bx, 24, bw * frac, 16); else ctx.fillRect(bx + bw * (1 - frac), 24, bw * frac, 16);
    ctx.fillStyle = COLORS.text; ctx.font = '600 16px system-ui';
    ctx.textAlign = side === 'L' ? 'left' : 'right';
    ctx.fillText(`Base ${stats[seat].base} / ${maxBase}`, side === 'L' ? bx : bx + bw, 64);
    // series pips
    const need = view?.series?.first_to ?? 4;
    const wins = view?.series?.wins?.[seat] ?? 0;
    for (let i = 0; i < need; i++) {
      const px = side === 'L' ? 680 + i * 22 : W - 680 - i * 22;
      ctx.beginPath(); ctx.arc(px, 32, 8, 0, Math.PI * 2);
      if (i < wins) { ctx.fillStyle = COLORS[seat]; ctx.fill(); } else { ctx.strokeStyle = COLORS[seat]; ctx.lineWidth = 2; ctx.stroke(); }
    }
  };
  panel(left, 'L');
  panel(right, 'R');
  // centre card
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(W / 2 - 160, 0, 320, SCORE_H);
  ctx.fillStyle = '#05050f';
  ctx.textAlign = 'center';
  const m = currentMatch();
  const first = view?.series?.first_to ?? 4;
  ctx.font = '800 15px system-ui';
  const warm = playing ? playing.event.payload.warmup : view?.phase === 'warmup';
  ctx.fillText(m === 0 ? (warm ? 'WARM-UP' : 'PRE-GAME') : `MATCH ${m} · FIRST TO ${first}${view?.series?.tiebreak_match ? ' · TIEBREAK' : ''}`, W / 2, 22);
  ctx.font = '900 40px system-ui';
  const w = view?.series?.wins ?? { P1: 0, P2: 0 };
  ctx.fillText(`${w[left]} – ${w[right]}`, W / 2, 64);
  ctx.font = '800 15px system-ui';
  const round = playing?.event.round ?? (view?.round ? view.round : shown?.timeline.round);
  ctx.fillText(round ? `ROUND ${round} / ${view?.max_rounds ?? 100}` : ' ', W / 2, 86);
}

function bannerText(now) {
  if (!view) return 'Connecting…';
  if (view.decision_slot?.combat_continues) return `LIVE COMBAT · decision slot ${view.round} · both players' orders apply together every ${view.decision_slot.seconds} s`;
  if (playing) return `${playing.event.payload.warmup ? 'Warm-up' : `Match ${playing.event.match}`} · round ${playing.event.round} · resolving combat`;
  const n = (seat) => names[seat];
  const r = view;
  const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  switch (r.phase) {
    case 'waiting_for_players': return `Waiting for players (${[r.names.P1, r.names.P2].filter(Boolean).length} of 2 joined)`;
    case 'waiting_for_start': return 'Both agents have joined · host: press ▶ Start game';
    case 'warmup':
    case 'awaiting_actions': {
      const waited = clock(Date.now() - r.waiting_since);
      const who = r.waiting_on.length === 2 ? "both players' actions" : `${n(r.waiting_on[0])}'s actions`;
      const pre = r.phase === 'warmup' ? `Warm-up round ${r.warmup.round} / ${r.warmup.of} · ` : '';
      const dl = r.phase === 'awaiting_actions' && r.deadline?.seconds ? ` · deadline ${clock(r.waiting_since + r.deadline.seconds * 1000 - Date.now())} left` : '';
      return `${pre}Waiting for ${who} (${waited})${dl}`;
    }
    case 'strategy_review': {
      const waiting = ['P1', 'P2'].filter((s) => r.ready[s] !== r.next_ready_match).map(n);
      return `Strategy review · waiting for ${waiting.join(' and ')} to be ready for match ${r.next_ready_match}`;
    }
    case 'series_finished': return `Series won by ${r.result.winnerName} ${winnerFirst(r.result.wins, r.result.winner)}`;
    case 'cancelled': return 'Series cancelled by the host';
    default: return r.phase;
  }
}

function drawBanner(now) {
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(0, SCORE_H, W, BANNER_H);
  ctx.fillStyle = '#05050f';
  ctx.font = '800 17px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(bannerText(now).toUpperCase(), W / 2, SCORE_H + 23);
}

function drawTicker() {
  const y = TOP + BOARD_H;
  ctx.fillStyle = '#10102a';
  ctx.fillRect(0, y, W, TICKER_H);
  ctx.fillStyle = COLORS.gold;
  ctx.font = '800 15px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('LIVE', 20, y + 24);
  ctx.fillStyle = COLORS.text;
  ctx.font = '600 17px system-ui';
  ctx.fillText(ticker.at(-1)?.text ?? '', 70, y + 24);
}

function drawKey() {
  const y = TOP + BOARD_H + TICKER_H;
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, y, W, KEY_H);
  let x = 24;
  const cy = y + KEY_H / 2;
  const item = (drawShape, text) => {
    drawShape(x + 10, cy);
    ctx.fillStyle = COLORS.text; ctx.font = '600 15px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(text, x + 26, cy + 5);
    x += 36 + ctx.measureText(text).width;
  };
  const shape = (fn) => (cx, cy2) => { ctx.save(); fn(cx, cy2); ctx.restore(); };
  item(shape((cx, cy2) => { ctx.fillStyle = COLORS.crawler; ctx.beginPath(); ctx.arc(cx, cy2, 8, 0, 7); ctx.fill(); }), 'Crawler');
  item(shape((cx, cy2) => { ctx.fillStyle = COLORS.runner; ctx.beginPath(); ctx.moveTo(cx + 9, cy2); ctx.lineTo(cx - 7, cy2 - 7); ctx.lineTo(cx - 7, cy2 + 7); ctx.fill(); }), 'Runner');
  item(shape((cx, cy2) => { ctx.fillStyle = COLORS.scarab; ctx.strokeStyle = '#3a1a5a'; ctx.lineWidth = 3; ctx.fillRect(cx - 8, cy2 - 8, 16, 16); ctx.strokeRect(cx - 8, cy2 - 8, 16, 16); }), 'Scarab');
  x += 14;
  item(shape((cx, cy2) => { ctx.fillStyle = COLORS.laser; ctx.beginPath(); ctx.moveTo(cx, cy2 - 10); ctx.lineTo(cx + 10, cy2); ctx.lineTo(cx, cy2 + 10); ctx.lineTo(cx - 10, cy2); ctx.fill(); }), 'Laser');
  item(shape((cx, cy2) => { ctx.fillStyle = COLORS.plasma; ctx.beginPath(); ctx.arc(cx, cy2, 9, 0, 7); ctx.fill(); }), 'Plasma');
  item(shape((cx, cy2) => { ctx.fillStyle = COLORS.cryo; ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = (Math.PI * k) / 3 + Math.PI / 6; ctx[k ? 'lineTo' : 'moveTo'](cx + 10 * Math.cos(a), cy2 + 10 * Math.sin(a)); } ctx.fill(); }), 'Cryo');
  x += 14;
  item(shape((cx, cy2) => { ctx.strokeStyle = COLORS.P1; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy2, 8, 0, 7); ctx.stroke(); }), `${names.P1} (P1)`);
  item(shape((cx, cy2) => { ctx.strokeStyle = COLORS.P2; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy2, 8, 0, 7); ctx.stroke(); }), `${names.P2} (P2)`);
  ctx.fillStyle = COLORS.muted; ctx.font = '500 14px system-ui'; ctx.textAlign = 'right';
  ctx.fillText('outline = owner · number = tower level · bar = health · blue ring = slowed', W - 20, cy + 5);
}

// ── start screen ──────────────────────────────────────────────────────────────
// Shown before the game starts: who has joined, how agents connect, and what the host does next.
const onStartScreen = () => !playing && ['waiting_for_players', 'waiting_for_start'].includes(view?.phase);

function drawStartScreen(now) {
  const y0 = TOP;
  ctx.fillStyle = '#05050fe8';
  ctx.fillRect(0, y0, W, BOARD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = '900 64px system-ui';
  ctx.fillText('TOWER DEFENSE DUEL', W / 2, y0 + 110);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 22px system-ui';
  const s = settings?.series;
  ctx.fillText(`First to ${s?.winsNeeded ?? 4} wins · up to ${settings?.match.maxRounds ?? 100} rounds · 2 opening rounds, then live combat`, W / 2, y0 + 150);

  const dots = '.'.repeat(1 + (Math.floor(now / 500) % 3));
  const card = (seat, x) => {
    const joined = !!view.names[seat];
    ctx.fillStyle = joined ? COLORS[seat] + '26' : '#ffffff0a';
    ctx.strokeStyle = joined ? COLORS[seat] : '#ffffff33';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y0 + 200, 560, 230, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS[seat];
    ctx.font = '800 22px system-ui';
    ctx.fillText(seat === 'P1' ? `P1 · left base` : `P2 · right base`, x + 280, y0 + 245);
    ctx.fillStyle = joined ? COLORS.text : COLORS.muted;
    ctx.font = joined ? '900 46px system-ui' : '600 30px system-ui';
    ctx.fillText(joined ? view.names[seat] : `Waiting for an agent${dots}`, x + 280, y0 + 335);
    ctx.font = '700 20px system-ui';
    ctx.fillStyle = joined ? '#00ff88' : COLORS.muted;
    ctx.fillText(joined ? '✓ joined' : 'not joined yet', x + 280, y0 + 395);
  };
  card('P1', 160);
  card('P2', W - 160 - 560);
  ctx.fillStyle = COLORS.text;
  ctx.font = '900 44px system-ui';
  ctx.fillText('VS', W / 2, y0 + 330);

  const both = view.phase === 'waiting_for_start';
  ctx.fillStyle = both ? COLORS.gold : '#ffffff14';
  ctx.beginPath(); ctx.roundRect(W / 2 - 520, y0 + 480, 1040, 70, 12); ctx.fill();
  ctx.fillStyle = both ? '#05050f' : COLORS.text;
  ctx.font = '800 26px system-ui';
  ctx.fillText(both ? 'Both agents are in. Host: press ▶ Start game at the top.' : `Waiting for ${2 - [view.names.P1, view.names.P2].filter(Boolean).length} more agent${[view.names.P1, view.names.P2].filter(Boolean).length === 1 ? '' : 's'} to join${dots}`, W / 2, y0 + 525);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 21px system-ui';
  ctx.fillText(`Agents connect to ${location.origin}/mcp with their own token,`, W / 2, y0 + 620);
  ctx.fillText(`then: "Join series ${seriesId} and play it to completion." (see the Manual)`, W / 2, y0 + 652);
}

function drawOverlay(title, sub) {
  ctx.fillStyle = '#000000aa';
  ctx.fillRect(0, TOP, W, BOARD_H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(W / 2 - 380, TOP + BOARD_H / 2 - 90, 760, 180);
  ctx.fillStyle = '#05050f';
  ctx.textAlign = 'center';
  ctx.font = '900 46px system-ui';
  ctx.fillText(title, W / 2, TOP + BOARD_H / 2 - 10);
  ctx.font = '700 24px system-ui';
  ctx.fillText(sub, W / 2, TOP + BOARD_H / 2 + 44);
}

function label(text, x, y, color) {
  ctx.font = 'bold 15px system-ui';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

const trace = (pts) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };

// ── side panel (HTML; not part of the recording) ──────────────────────────────
function pushTicker(text, live = true) {
  ticker.push({ text });
  if (ticker.length > 200) ticker.shift();
  const li = document.createElement('li');
  li.textContent = text;
  const list = document.getElementById('commentary');
  list.prepend(li);
  while (list.children.length > 150) list.lastChild.remove();
  if (!live) li.classList.add('past');
}

function addLog(e) {
  const list = document.getElementById('log');
  const li = document.createElement('li');
  const where = e.type === 'round_resolved' ? `${e.payload.warmup ? 'W' : `M${e.match} R`}${e.round}` : e.match ? `M${e.match}` : '';
  li.innerHTML = `<span class="tag">${where}</span> ${escapeHtml(logText(e))}`;
  list.prepend(li);
  while (list.children.length > 300) list.lastChild.remove();
}

function logText(e) {
  const p = e.payload ?? {};
  const desc = (b) => (b?.length ? b.map((a) => a.type === 'send' ? `send ${a.units.map((u) => `${u.count}×${u.type}`).join(',')}` : a.type === 'build' ? `build ${a.tower}@${a.slot}` : a.type === 'upgrade' ? `upgrade @${a.slot}` : `target @${a.slot}→${a.targeting}`).join('; ') : 'save');
  if (e.type === 'round_resolved') return `P1: ${desc(p.bundles.P1)} | P2: ${desc(p.bundles.P2)} | kills ${p.summary.kills.P1}/${p.summary.kills.P2} | base ${p.end.P1.base}–${p.end.P2.base}`;
  if (e.type === 'bundle_submitted') return `${e.actor?.name ?? p.seat} submitted`;
  if (e.type === 'round_published') return 'round open';
  return `${e.type.replaceAll('_', ' ')}${e.actor ? ` · ${e.actor.name}` : ''}`;
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderSide() {
  document.getElementById('series-title').textContent = view?.names.P1 || view?.names.P2 ? `${names.P1} vs ${names.P2}` : 'Tower duel';
  const start = document.getElementById('start-btn');
  start.disabled = view?.phase !== 'waiting_for_start';
  start.style.display = ['waiting_for_players', 'waiting_for_start'].includes(view?.phase) ? '' : 'none';
  document.getElementById('series-id').textContent = seriesId;
}

// ── controls ──────────────────────────────────────────────────────────────────
for (const b of document.querySelectorAll('[data-speed]')) {
  b.onclick = () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('on', x === b));
  };
}
document.getElementById('live').onclick = () => {
  // Jump to the newest round: resolve everything queued instantly, finish the current one.
  while (queue.filter((x) => x.type === 'round_resolved').length > 1) finishInstantly(queue.shift());
  if (playing) playing.t = Infinity;
};

let recorder = null;
document.getElementById('record').onclick = (ev) => {
  const btn = ev.currentTarget;
  if (recorder) { recorder.stop(); return; }
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const chunks = [];
  recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: type });
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tower-duel-${seriesId}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    a.click();
    recorder = null;
    btn.textContent = '● Record';
    btn.classList.remove('rec');
  };
  recorder.start(1000);
  btn.textContent = '■ Stop & save';
  btn.classList.add('rec');
};

// host controls (need the host key printed in the server terminal)
async function host(action, seat, question) {
  const key = localStorage.getItem('mmp-host-key') || prompt('Host key (printed in the server terminal):');
  if (!key) return;
  if (question !== null && !confirm(question ?? `${action.replace('_', ' ')}${seat ? ` for ${names[seat]} (${seat})` : ''}?`)) return;
  const res = await fetch(`/api/series/${seriesId}/host`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': key }, body: JSON.stringify({ action, seat }) });
  const body = await res.json();
  if (res.status === 403) localStorage.removeItem('mmp-host-key');
  else localStorage.setItem('mmp-host-key', key);
  if (!body.ok) alert(body.error);
}
document.getElementById('forfeit-p1').onclick = () => host('forfeit', 'P1');
document.getElementById('forfeit-p2').onclick = () => host('forfeit', 'P2');
document.getElementById('cancel-match').onclick = () => host('cancel_match');
document.getElementById('cancel-series').onclick = () => host('cancel_series');
document.getElementById('start-btn').onclick = () => host('start', undefined, null);
document.getElementById('restart-btn').onclick = () => host('restart', undefined,
  'Restart this series? Seats, score and matches are cleared and you return to the start screen; the agents must join again. (Logs keep everything.)');
document.getElementById('manual-link').href = `/series/${seriesId}/manual`;

start();
