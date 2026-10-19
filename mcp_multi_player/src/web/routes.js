// The people's entrance (spec §11): the dashboard, the split-screen series page, the manual,
// a public API (names, phase, wave number, score; no boards while a match is live), the
// host-only live state and stream, public replays of finished matches, and host actions.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { Router, json } from 'express';
import { agentSetup } from '../mcp/setup.js';
import { requireHost } from './host.js';
import { streamSeries } from './sse.js';

const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const MANUAL = readFileSync(new URL('../../docs/manual.md', import.meta.url), 'utf8');
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** What anyone may see about a series: no board data while a match is live. */
export function publicStatus(series) {
  const st = series.status(), ms = series.currentMatch()?.status();
  return { ...st, wave: ms?.wave ?? 0, of: series.level.waves.count, match_phase: ms?.phase ?? null };
}

const layoutOf = (level) => ({
  tile: level.layout.tile, rows: level.layout.rows, width: level.layout.width, height: level.layout.height,
  slots: level.layout.slots.map((s) => ({ id: s.id, x: s.x, y: s.y })), path: level.layout.path.points,
  towers: Object.fromEntries(Object.entries(level.towers).map(([k, t]) => [k, { name: t.name, code: t.code, range: t.base.range, instant: t.delivery.kind === 'instant' }])),
  start_health: level.rules.startHealth, tower_health: level.rules.towerHealth,
  ticks_per_wave: level.rules.ticksPerTurn, wave_seconds: level.rules.ticksPerTurn * level.rules.dt,
});

export function webRoutes({ lobby, ctx }) {
  const r = Router();
  const host = requireHost(lobby);
  r.use(json({ limit: '64kb' }));
  r.use('/static', express.static(PUBLIC, { index: false }));

  r.get('/', (req, res) => res.sendFile(PUBLIC + 'index.html'));
  r.get('/series/:id', (req, res) => res.sendFile(PUBLIC + 'series.html'));
  r.get('/manual', (req, res) => res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>mcp_multi_player manual</title><link rel="stylesheet" href="/static/style.css"><main class="wrap"><pre class="manual">${escape(MANUAL)}</pre></main>`));

  r.get('/api/levels', (req, res) => res.json({ levels: lobby.levels() }));
  r.get('/api/host/check', host, (req, res) => res.json({ ok: true }));
  // The two seat setup blocks, on the dashboard and the series page. Nothing secret in them.
  r.get('/api/setup', (req, res) => {
    res.json({ ok: true, setup: [agentSetup({ base: ctx.base })] });
  });
  r.get('/api/series', (req, res) => res.json({ series: lobby.list().map((s) => publicStatus(lobby.get(s.id))) }));

  const find = (req, res, next) => {
    req.series = lobby.get(req.params.id);
    if (!req.series) return res.status(404).json({ ok: false, code: 'not_found', message: 'no such series' });
    next();
  };

  r.get('/api/series/:id', find, (req, res) => res.json({ ok: true, series: publicStatus(req.series), layout: layoutOf(req.series.level), mcp_url: ctx.base + '/mcp' }));

  r.get('/api/series/:id/state', find, host, (req, res) => {
    const m = req.series.currentMatch(), g = m?.getRender();
    res.json({ ok: true, series: publicStatus(req.series), match: g && g.render ? { number: m.matchNo, version: g.version, status: g.status, render: g.render, report: g.report } : null });
  });

  r.get('/api/series/:id/stream', find, host, (req, res) => streamSeries(req, res, req.series, publicStatus));

  r.get('/api/series/:id/matches/:n/replay', find, async (req, res) => {
    const out = await req.series.replay(Number(req.params.n), { from: Number(req.query.from ?? 0), count: Math.min(20, Number(req.query.count ?? 10)) });
    if (!out.ok) return res.status(409).json(out);
    const keep = (e) => e.type !== 'spawn';
    res.json({ ...out, layout: undefined, turns: out.turns.map((t) => ({ ...t, events: t.events.filter(keep) })) });
  });

  r.post('/api/series', async (req, res) => {
    const body = req.body ?? {};
    const bestOf = Number(body.best_of ?? 3);
    const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
    const out = await lobby.createSeries(req.get('x-host-key'), {
      levelId: body.level ?? 'normal', target: Math.ceil(bestOf / 2), deadlineS: num(body.deadline_s), paceS: num(body.pace_s),
    });
    if (!out.ok) return res.status(out.code === 'forbidden' ? 403 : out.code === 'series_open' ? 409 : 400).json(out);
    res.json({ ok: true, series_id: out.seriesId, watch: `${ctx.base}/series/${out.seriesId}` });
  });

  // Host controls on the series page (spec §11): start, remove a player, and tuning (intensity,
  // seconds per wave on screen, a random burst).
  r.post('/api/series/:id/start', find, host, async (req, res) => {
    const out = await req.series.start();
    res.status(out.ok ? 200 : 409).json(out);
  });
  r.post('/api/series/:id/seats/:seat/leave', find, host, async (req, res) => {
    const seat = { P1: 'P1', P2: 'P2' }[String(req.params.seat).toUpperCase()];
    if (!seat) return res.status(404).json({ ok: false, code: 'not_found', message: 'seat must be P1 or P2' });
    const out = await req.series.leave(seat);
    res.status(out.ok ? 200 : 409).json(out);
  });
  r.post('/api/series/:id/tuning', find, host, async (req, res) => {
    const body = req.body ?? {}, change = {};
    if (body.intensity !== undefined) {
      const n = Number(body.intensity);
      if (!Number.isInteger(n) || n < 0 || n > 10) return res.status(400).json({ ok: false, code: 'invalid_intensity', message: 'intensity must be a whole number 0-10' });
      change.intensity = n;
    }
    if (body.pace_s !== undefined) {
      const n = Number(body.pace_s);
      if (!Number.isFinite(n) || n < 0 || n > 120) return res.status(400).json({ ok: false, code: 'invalid_pace', message: 'seconds per wave must be 0-120' });
      change.paceS = n;
    }
    if (body.random_wave) change.randomWave = true;
    const out = await req.series.tune(change);
    res.status(out.ok ? 200 : 409).json(out);
  });
  // Closing the server: the agents are told to stop, then the process exits (spec §11).
  r.post('/api/close', host, async (req, res) => res.json(await lobby.close(req.get('x-host-key'))));

  r.post('/api/series/:id/cancel', find, host, async (req, res) => res.json(await lobby.cancel(req.get('x-host-key'), req.params.id, 'cancelled by the host')));
  r.delete('/api/series/:id', find, host, async (req, res) => {
    const out = await lobby.delete(req.get('x-host-key'), req.params.id);
    res.status(out.ok ? 200 : 409).json(out);
  });

  return r;
}
