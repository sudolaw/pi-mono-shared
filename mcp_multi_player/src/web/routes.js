// Browser side (SPEC.md §14): dashboard, spectator page, manual page, live event stream,
// combat timelines, and host controls. Spectators only ever get public data: the public
// events log, spectator views and combat files. Never the audit log, pending bundles,
// a live match's state files, or any token.

import express from 'express';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { spectatorHub } from './stream.js';
import { manualMarkdown } from '../manual.js';
import { hostKeyMatches } from '../mcp/auth.js';
import { DEFAULTS, TUNABLE } from '../config.js';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
// The browser builds the board with the same code as the engine (pure, no Node imports).
const BOARD_JS = fileURLToPath(new URL('../engine/board.js', import.meta.url));
const manualPages = new Map();

export function webRoutes({ manager, hostKey, mcpUrl }) {
  const r = express.Router();

  const requireHost = (req, res, next) => {
    if (hostKeyMatches(hostKey, req.get('x-host-key'))) return next();
    res.status(403).json({ error: 'host key required (printed in the server terminal)' });
  };
  const withSeries = async (req, res, next) => {
    req.series = manager.get(req.params.id);
    if (!req.series) return res.status(404).json({ error: 'no such series' });
    await req.series.idle();
    next();
  };

  // ── pages ──
  r.get('/', (req, res) => res.sendFile(PUBLIC_DIR + 'index.html'));
  r.get('/series/:id', withSeries, (req, res) => res.sendFile(PUBLIC_DIR + 'series.html'));
  r.get('/series/:id/manual', withSeries, (req, res) => res.type('html').send(manualPage(manualMarkdown({ mcpUrl: mcpUrl(), series: req.series }))));
  r.get('/manual', (req, res) => res.type('html').send(manualPage(manualMarkdown({ mcpUrl: mcpUrl() }))));
  r.use('/static', express.static(PUBLIC_DIR, { index: false }));
  r.get('/engine/board.js', (req, res) => res.type('text/javascript').sendFile(BOARD_JS));

  // ── read-only API ──
  r.get('/api/settings', (req, res) => res.json({ defaults: DEFAULTS, tunable: TUNABLE }));
  r.get('/api/series', (req, res) => res.json(manager.list().map((s) => summary(s))));
  r.get('/api/series/:id', withSeries, async (req, res) => res.type('json').send(await req.series.read(() => spectatorHub(req.series).viewJson())));
  r.get('/api/series/:id/settings', withSeries, (req, res) => res.json(req.series.record.settings));
  r.get('/api/series/:id/events', withSeries, async (req, res) => {
    const after = Number(req.query.after ?? 0);
    res.json(await manager.store.readEvents(req.series.id, { after }));
  });
  r.get('/series/:id/combat/:file', withSeries, (req, res) => {
    const file = manager.store.combatPath(req.series.id, req.params.file);
    if (!file) return res.status(404).json({ error: 'no such combat file' });
    // combatPath only accepts mNN-rNNN.json names; allow dot folders above it, such as
    // the default ~/.local/share/mcp_multi_player (send() refuses them otherwise).
    res.type('json').sendFile(file, { dotfiles: 'allow' }, (err) => {
      if (err && !res.headersSent) res.status(err.statusCode ?? 500).json({ error: 'combat file unavailable' });
    });
  });

  // Live stream: recent history, then every new public event and a fresh view on each change.
  r.get('/series/:id/stream', withSeries, (req, res) => spectatorHub(req.series).connect(req, res));

  // ── host controls ──
  r.post('/api/host/check', requireHost, (req, res) => res.json({ ok: true }));
  r.post('/api/series', requireHost, async (req, res) => {
    try {
      const series = await manager.create(req.body?.overrides ?? {});
      res.json({ ok: true, ...summary(series) });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });
  r.post('/api/series/:id/host', requireHost, withSeries, async (req, res) => {
    const s = req.series;
    const { action, seat } = req.body ?? {};
    const result = await (action === 'start' ? s.hostStart()
      : action === 'restart' ? s.hostRestart()
      : action === 'forfeit' ? s.hostForfeit(seat)
      : action === 'cancel_match' ? s.hostCancelMatch()
      : action === 'cancel_series' ? s.hostCancelSeries()
      : { ok: false, error: 'action must be start, restart, forfeit, cancel_match or cancel_series' });
    res.status(result.ok ? 200 : 400).json(result);
  });

  return r;
}

function summary(s) {
  const r = s.record;
  return { id: r.id, created_at: r.createdAt, phase: r.phase, names: s.names(), wins: r.wins, draws: r.draws, match: r.matchNo, url: `/series/${r.id}` };
}

function manualPage(markdown) {
  if (manualPages.has(markdown)) return manualPages.get(markdown);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tower defense duel: manual</title><link rel="stylesheet" href="/static/manual.css"></head>
<body><main class="manual">${marked.parse(markdown)}</main></body></html>`;
  manualPages.set(markdown, html);
  if (manualPages.size > 64) manualPages.delete(manualPages.keys().next().value);
  return html;
}
