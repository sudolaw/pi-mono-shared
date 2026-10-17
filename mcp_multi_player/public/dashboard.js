// Dashboard: list of series, and Create series with advanced settings (host key).
// After creating, it shows connection instructions with a placeholder token only:
// real tokens come from `npm run add-player` in the host's terminal.

const $ = (id) => document.getElementById(id);
const keyInput = $('host-key');
keyInput.value = localStorage.getItem('mmp-host-key') ?? '';

const PHASE = {
  waiting_for_players: 'waiting for players', waiting_for_start: 'ready to start', warmup: 'warm-up',
  awaiting_actions: 'playing', strategy_review: 'strategy review', series_finished: 'finished', cancelled: 'cancelled',
};

async function refresh() {
  const list = await (await fetch('/api/series')).json();
  $('empty').style.display = list.length ? 'none' : '';
  $('series').innerHTML = list.map((s) => `
    <tr>
      <td>${s.id}</td>
      <td>${esc(s.names.P1 ?? '—')} <span class="muted">vs</span> ${esc(s.names.P2 ?? '—')}</td>
      <td>${s.wins.P1} – ${s.wins.P2}${s.draws ? ` <span class="muted">(${s.draws} drawn)</span>` : ''}</td>
      <td><span class="phase">${PHASE[s.phase] ?? s.phase}${s.match ? ` · match ${s.match}` : ''}</span></td>
      <td><a class="btn" href="${s.url}">Watch</a></td>
    </tr>`).join('');
}

// Advanced settings: every tunable value with its default; only changed ones are sent.
let defaults = {};
async function loadSettings() {
  const { defaults: d, tunable } = await (await fetch('/api/settings')).json();
  const get = (path) => path.split('.').reduce((o, k) => o?.[k], d);
  $('settings').innerHTML = Object.keys(tunable)
    .filter((p) => !p.startsWith('series.deadline'))
    .map((p) => {
      defaults[p] = get(p);
      const [lo, hi] = tunable[p];
      return `<label>${p.replace(/^(\w+)\./, '<span class="muted">$1.</span>')}<input data-path="${p}" type="number" step="any" min="${lo}" max="${hi}" value="${defaults[p]}"></label>`;
    }).join('');
  for (const input of $('settings').querySelectorAll('input')) {
    input.oninput = () => input.classList.toggle('changed', Number(input.value) !== defaults[input.dataset.path]);
  }
}

$('deadline-mode').onchange = () => { $('deadline-fixed').style.display = $('deadline-mode').value === 'fixed' ? '' : 'none'; };

$('create').onclick = async () => {
  const overrides = {};
  for (const input of $('settings').querySelectorAll('input')) {
    if (Number(input.value) !== defaults[input.dataset.path]) overrides[input.dataset.path] = Number(input.value);
  }
  const mode = $('deadline-mode').value;
  if (mode !== 'auto') overrides['series.deadline.mode'] = mode;
  if (mode === 'fixed') overrides['series.deadline.fixedSeconds'] = Number($('deadline-fixed').value);
  const res = await fetch('/api/series', { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': keyInput.value }, body: JSON.stringify({ overrides }) });
  const body = await res.json();
  if (!res.ok) { $('created').innerHTML = `<p style="color:#ff6688">${esc(body.error)}</p>`; return; }
  localStorage.setItem('mmp-host-key', keyInput.value);
  const mcp = `${location.origin}/mcp`;
  $('created').innerHTML = `
    <h2 style="margin-top:16px">Series ${body.id} created</h2>
    <p><a class="btn primary" href="${body.url}">Watch it</a> &nbsp; <a href="/series/${body.id}/manual" target="_blank">Manual for this series</a></p>
    <p>Give each agent its own token (run once per agent in your terminal: <code>npm run add-player -- claude</code>, <code>npm run add-player -- codex</code>), set it as <code>MMP_TOKEN</code> in that agent's environment, then connect:</p>
    <pre>claude mcp add -t http mcp-multi-player ${mcp} -H "Authorization: Bearer $MMP_TOKEN"</pre>
    <pre>codex mcp add mcp-multi-player --url ${mcp} --bearer-token-env-var MMP_TOKEN</pre>
    <p>Then tell each agent: <em>Join series <code>${body.id}</code> as "&lt;its name&gt;" and play it to completion. Follow the next field of every response.</em></p>
    <p class="muted">Or watch two scripted bots: <code>npm run bots -- ${body.id}</code></p>`;
  refresh();
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

loadSettings();
refresh();
setInterval(refresh, 3000);
