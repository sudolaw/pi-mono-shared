// The dashboard (spec §11): the host key, the two seat setup blocks (host only), creating a
// series, and the list of series with cancel and delete for the host.

import { phaseText } from './scoreboard.js';
import { showSetup } from './setup.js';

const $ = (id) => document.getElementById(id);
const storage = { get() { try { return sessionStorage.getItem('mmp-host-key') ?? ''; } catch { return ''; } }, set(v) { try { sessionStorage.setItem('mmp-host-key', v); } catch { /* fine */ } } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let key = storage.get();

async function checkKey() {
  if (!key) { $('key-state').textContent = 'no key yet'; return; }
  const ok = (await fetch('/api/host/check', { headers: { 'x-host-key': key } })).ok;
  $('key-state').textContent = ok ? 'key accepted' : 'that key is not right';
  $('close-server').hidden = !ok;
}

async function loadLevels() {
  const { levels } = await (await fetch('/api/levels')).json();
  $('level').innerHTML = levels.map((l) => `<option value="${esc(l.id)}" ${l.id === 'normal' ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
}

async function loadList() {
  const { series } = await (await fetch('/api/series')).json();
  const tbody = $('list');
  if (!series.length) { tbody.innerHTML = '<tr><td colspan="6" class="muted">No series yet. Create one above.</td></tr>'; return; }
  tbody.innerHTML = series.map((s) => `<tr>
    <td><a href="/series/${esc(s.id)}">${esc(s.id)}</a></td>
    <td>${esc(s.level.name)}, best of ${s.target * 2 - 1}</td>
    <td>${esc(s.seats.P1 ?? '–')} vs ${esc(s.seats.P2 ?? '–')}</td>
    <td class="mono">${s.score.P1} - ${s.score.P2}${s.score.draws ? ` (${s.score.draws} drawn)` : ''}</td>
    <td>${esc(phaseText(s))}${s.phase === 'in_match' ? ` · match ${s.match}, wave ${s.wave}/${s.of}` : ''}</td>
    <td class="row">${['in_match', 'between', 'waiting'].includes(s.phase) ? `<button class="danger" data-act="cancel" data-id="${esc(s.id)}">Cancel</button>` : ''}${['done', 'cancelled', 'waiting'].includes(s.phase) ? `<button data-act="delete" data-id="${esc(s.id)}">Delete</button>` : ''}</td>
  </tr>`).join('');
}

$('list').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  if (b.dataset.confirm !== 'yes') { b.dataset.confirm = 'yes'; b.textContent = b.dataset.act === 'cancel' ? 'Click again to cancel' : 'Click again to delete'; return; }
  const res = await fetch(`/api/series/${b.dataset.id}${b.dataset.act === 'cancel' ? '/cancel' : ''}`, { method: b.dataset.act === 'cancel' ? 'POST' : 'DELETE', headers: { 'x-host-key': key } });
  if (!res.ok) { const out = await res.json().catch(() => ({})); b.textContent = out.message ?? 'Failed'; return; }
  loadList();
});

// Close server: the open series is cancelled, the agents are told to stop, and the server exits
// after a grace period. Two clicks, because the app's browser pane blocks confirm().
$('close-server').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  if (b.dataset.armed !== 'yes') { b.dataset.armed = 'yes'; b.textContent = 'Click again to close the server'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Close server'; }, 4000); return; }
  const out = await (await fetch('/api/close', { method: 'POST', headers: { 'x-host-key': key } })).json().catch(() => ({}));
  b.textContent = out.ok ? `Closing: agents told to stop, server exits in ${out.closes_in_s} s` : out.message ?? 'Failed';
  b.disabled = Boolean(out.ok);
});

$('key-form').addEventListener('submit', (e) => { e.preventDefault(); key = $('key').value.trim(); storage.set(key); checkKey(); });
$('create').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('create-state').textContent = 'creating…';
  const res = await fetch('/api/series', { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': key }, body: JSON.stringify({ level: $('level').value, best_of: Number($('best-of').value), deadline_s: Number($('deadline').value), pace_s: Number($('pace').value) }) });
  const out = await res.json();
  if (!out.ok) { $('create-state').textContent = res.status === 403 ? 'Type the host key first (the server prints it when it starts).' : out.message; return; }
  $('create-state').textContent = '';
  const p = $('created'); p.hidden = false;
  p.innerHTML = `Series <b>${esc(out.series_id)}</b> is open. <a href="${esc(out.watch)}">Watch it</a>. Agents already set up just need the prompt in a new session (or "call state and carry on" if they are waiting).`;
  loadList();
});

$('key').value = key;
await Promise.all([checkKey(), loadLevels(), loadList(), showSetup($('setup')).then((ok) => { $('setup-card').hidden = !ok; })]);
setInterval(loadList, 5000);
