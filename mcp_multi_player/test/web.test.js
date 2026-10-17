import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../src/app.js';
import { commentaryFor } from '../public/commentary.js';
import { fakeClock } from './helpers.js';

test('live spectator stream delivers moving combat without revealing pending orders', async () => {
  const clock = fakeClock();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmp-live-web-'));
  const app = createApp({ dataDir, port: 0, clock });
  const server = await app.listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  const controller = new AbortController();
  try {
    const s = await app.manager.create({ 'series.deadline.mode': 'off' });
    await s.join('a', 'A'); await s.join('b', 'B'); await s.hostStart();
    await s.submit('a', { match: 1, round: 1, actions: [{ type: 'send', units: [{ type: 'scarab', count: 1 }] }] });
    await s.submit('b', { match: 1, round: 1, actions: [] });
    await s.submit('a', { match: 1, round: 2, actions: [] });
    await s.submit('b', { match: 1, round: 2, actions: [] });
    await s.submit('a', { match: 1, round: 3, actions: [{ type: 'build', slot: 'P1-9', tower: 'laser' }] });
    const res = await fetch(`${base}/series/${s.id}/stream`, { signal: controller.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = decoder.decode((await reader.read()).value);
    await clock.advance(1000);
    while (!text.includes('"t":1,')) text += decoder.decode((await reader.read()).value);
    assert.match(text, /event: combat/);
    assert.match(text, /"combat_continues":true/);
    assert.ok(!text.includes('"tower":"laser"'), 'locked tower leaked into public stream');
    const snapshots = text.split('\n\n').filter((chunk) => chunk.startsWith('event: combat')).map((chunk) => JSON.parse(chunk.split('data: ')[1]));
    assert.ok(snapshots.at(-1).frame.a[0][3] !== snapshots[0].frame.a[0][3] || snapshots.at(-1).frame.a[0][4] !== snapshots[0].frame.a[0][4]);
    controller.abort();
    await reader.cancel().catch(() => {});
  } finally {
    controller.abort(); await app.manager.close(); server.closeAllConnections?.(); await server.close();
  }
});

test('pages, manual, board module and combat files are served; unknown files are not', async () => {
  // A relative data folder under a dot folder, like `--data .tmp/data` or the default
  // ~/.local/share/mcp_multi_player: combat files must still be served.
  const dataDir = path.relative(process.cwd(), path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mmp-web-')), '.local', 'data'));
  const app = createApp({ dataDir, port: 0 });
  const server = await app.listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const s = await app.manager.create({ 'series.warmupRounds': 0 });
    await s.join('a', 'Claude Code'); await s.join('b', 'Codex'); await s.hostStart();
    await s.submit('a', { match: 1, round: 1, actions: [] }); await s.submit('b', { match: 1, round: 1, actions: [] });

    for (const url of ['/', `/series/${s.id}`, '/static/spectator.js', '/static/commentary.js', '/engine/board.js', `/api/series/${s.id}/settings`]) {
      assert.equal((await fetch(base + url)).status, 200, url);
    }
    const manual = await (await fetch(`${base}/series/${s.id}/manual`)).text();
    assert.match(manual, /Connect to the game/);
    assert.ok(manual.indexOf('Connect to the game') < manual.indexOf('The board'), 'manual starts with connecting');
    assert.match(manual, new RegExp(s.id));
    assert.ok(!/mmp_[A-Za-z0-9_-]{20,}/.test(manual), 'no real token in the manual');

    const combat = await fetch(`${base}/series/${s.id}/combat/m01-r001.json`);
    assert.equal(combat.status, 200);
    assert.equal((await combat.json()).round, 1);
    assert.equal((await fetch(`${base}/series/${s.id}/combat/..%2Fseries.json`)).status, 404);
    assert.equal((await fetch(`${base}/series/s_00000000`)).status, 404);
  } finally {
    await app.manager.close();
    server.closeAllConnections?.();
    await server.close();
  }
});

test('commentary turns public events into plain words', async () => {
  const names = { P1: 'Claude Code', P2: 'Codex' };
  const round = {
    type: 'round_resolved', match: 1, round: 7,
    payload: {
      bundles: { P1: [{ type: 'build', slot: 'P1-4', tower: 'plasma' }], P2: [{ type: 'send', units: [{ type: 'crawler', count: 6 }] }] },
      summary: { kills: { P1: 6, P2: 0 }, baseHits: { P1: 0, P2: 2 } },
      end: { P1: { base: 20 }, P2: { base: 18 } },
      autoFilled: { P1: false, P2: false },
    },
  };
  assert.deepEqual(commentaryFor(round, names), [
    'Claude Code builds a Plasma at P1-4.',
    'Codex sends 6 Crawlers.',
    "Claude Code's towers shred the wave: 6 kills!",
    "2 attackers break into Codex's base: 18 left.",
  ]);
  assert.deepEqual(commentaryFor({ type: 'match_ended', payload: { match: 2, result: 'win', winner: 'P2', winnerName: 'Codex', decidedBy: 'base_destroyed', wins: { P1: 1, P2: 1 } } }, names),
    ['Codex wins match 2 by destroying the enemy base! Series: Claude Code 1, Codex 1.']);
});
