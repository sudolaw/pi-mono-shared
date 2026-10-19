#!/usr/bin/env node
// Two scripted agents that play through the real MCP endpoint, exactly as Claude Code or
// Codex would: rules -> join -> follow `next` (state / act / ready) until it says stop.
// No model calls. Used by `npm run bots`, the smoke test and demos.
//
//   npm run bots -- --host-key <key> [--level normal] [--best-of 3] [--pace 30] [--p1 laser_wall] [--p2 cannon_cryo] [--think 300] [--url http://127.0.0.1:8787]
//
// --pace is how many seconds each wave plays on screen (default: the wave's real length, 30 s;
// 0 plays as fast as the bots move). Only one series is open at a time.

import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { STRATEGIES } from './strategies.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Plays one place to the end of the series; returns the last reply. Like any agent it joins
 * through the shared endpoint and then passes its player id (from next.args) in every call.
 */
export async function playSeat({ mcpUrl, name, strategy = 'balanced', thinkMs = 0, onReply }) {
  const decide = STRATEGIES[strategy];
  if (!decide) throw new Error(`unknown strategy ${strategy}; pick one of ${Object.keys(STRATEGIES).join(', ')}`);
  const client = new Client({ name: 'mmp-bot', version: '2.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
  const call = async (tool, args = {}) => (await client.callTool({ name: tool, arguments: args })).structuredContent;
  try {
    const { level } = await call('rules');
    let r = await call('state');
    const me = () => (r?.player ? { player: r.player } : {});
    for (let guard = 0; guard < 100000; guard++) {
      onReply?.(r);
      const next = r.next;
      if (!next || next.tool === 'stop') return r;
      if (next.tool === 'join') r = await call('join', { name, understood: true });
      else if (next.tool === 'ready') r = await call('ready', { ...next.args, request_id: randomUUID() });
      else if (next.tool === 'act' && !r.me) r = await call('state', me());
      else if (next.tool === 'act') {
        if (thinkMs) await sleep(thinkMs);
        r = await call('act', { ...next.args, request_id: randomUUID(), actions: decide(r, level) });
        if (!r.ok) r = await call('state', me()); // e.g. the deadline passed while thinking
      } else r = await call('state', next.args ?? {});
    }
    throw new Error('bot gave up after too many steps');
  } finally {
    await client.close();
  }
}

/** Plays the host: presses Start once both bots have joined. */
export async function startWhenSeated(url, hostKey, seriesId) {
  for (let i = 0; i < 600; i++) {
    const { series } = await (await fetch(`${url}/api/series/${seriesId}`)).json();
    if (series?.can_start) {
      await fetch(`${url}/api/series/${seriesId}/start`, { method: 'POST', headers: { 'x-host-key': hostKey } });
      return;
    }
    if (series?.phase !== 'waiting') return;
    await sleep(100);
  }
}

async function main() {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
  const url = arg('url', `http://127.0.0.1:${process.env.MMP_PORT ?? 8787}`);
  const strat = { P1: arg('p1', 'laser_wall'), P2: arg('p2', 'cannon_cryo') };
  const hostKey = arg('host-key', process.env.MMP_HOST_KEY);
  if (!hostKey) throw new Error('give --host-key (or set MMP_HOST_KEY)');
  const headers = { 'content-type': 'application/json', 'x-host-key': hostKey };
  const res = await fetch(`${url}/api/series`, {
    method: 'POST', headers,
    body: JSON.stringify({ level: arg('level', 'normal'), best_of: Number(arg('best-of', 3)), deadline_s: arg('deadline') && Number(arg('deadline')), pace_s: arg('pace') && Number(arg('pace')) }),
  });
  const out = await res.json();
  if (!out.ok) throw new Error(`could not create a series: ${out.message}`);
  console.log(`Series ${out.series_id} created. Watch it at ${out.watch}`);
  const thinkMs = Number(arg('think', 0));
  void startWhenSeated(url, hostKey, out.series_id);
  const last = await Promise.all(['P1', 'P2'].map((seat) => playSeat({
    mcpUrl: `${url}/mcp`, name: `${strat[seat]} bot`, strategy: strat[seat], thinkMs,
    onReply: (r) => { if (r.report && r.next?.tool === 'ready') console.log(`${seat}: match ${r.series.match} over: ${r.report.result.reason}`); },
  })));
  const s = last[0].series;
  console.log(`Series over. Score P1 ${s.score.P1} - P2 ${s.score.P2}${s.score.draws ? `, draws ${s.score.draws}` : ''}. ${last[0].next.why}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((err) => { console.error(err.message); process.exit(1); });
