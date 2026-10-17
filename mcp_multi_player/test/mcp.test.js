import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../src/app.js';
import { connect, playSeries } from '../src/bots/client.js';
import { fakeClock } from './helpers.js';

async function startServer({ clock } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmp-e2e-'));
  const app = createApp({ dataDir, port: 0, clock });
  const server = await app.listen();
  const base = `http://127.0.0.1:${server.address().port}`;
  return { ...app, server, base, mcpUrl: `${base}/mcp`, dataDir, stop: async () => { await app.manager.close(); server.closeAllConnections?.(); await server.close(); } };
}

// Every file under dir, recursively, as one string (to look for leaked secrets).
function allFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).map((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? allFiles(p) : fs.readFileSync(p, 'utf8');
  }).join('\n');
}

test('MCP auth: no token or a wrong token is refused', async () => {
  const s = await startServer();
  try {
    const res = await fetch(s.mcpUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401);
    await assert.rejects(connect(s.mcpUrl, 'mmp_not_a_real_token'));
  } finally { await s.stop(); }
});

test('MCP join automatically delivers all rules, live timing, and actual series settings', async () => {
  const s = await startServer();
  let c;
  try {
    const token = s.players.add('learner');
    const series = await s.manager.create({ 'match.baseHealth': 37, 'economy.startingGold': 777, 'towers.cryo.slowFactor': 0.3 });
    c = await connect(s.mcpUrl, token);
    const joined = await c.call('manage_match', { operation: 'join', series_id: series.id, name: 'Learner', request_id: 'learn-1' });
    assert.equal(joined.ok, true);
    const { manual, settings, board, actions } = joined.rules;
    for (const topic of ['Rounds 1 and 2', 'From round 3', 'Live decision slots', 'Health and scoring', 'Armor', 'Winning', 'Series', 'Targeting', 'spawn', 'missed live slot']) assert.ok(manual.includes(topic), topic);
    assert.match(manual, /\| Base health \| 37 \|/);
    assert.match(manual, /\| Starting gold \| 777 \|/);
    assert.match(manual, /slow factor 0.3/);
    assert.equal(settings.match.openingRounds, 2);
    assert.equal(board.pipes.P1.length, 3880);
    assert.ok(actions.build && actions.send && actions.upgrade && actions.target);
    assert.ok(!JSON.stringify(joined).includes(token));
    assert.ok(!JSON.stringify(joined).includes(s.hostKey));
  } finally { await c?.close(); await s.stop(); }
});

test('end to end: two bots play a whole series through /mcp; no token leaks', async () => {
  const clock = fakeClock();
  const s = await startServer({ clock });
  let pumping = false;
  const ticker = setInterval(async () => { if (pumping) return; pumping = true; try { await clock.advance(1000); } finally { pumping = false; } }, 10);
  try {
    const t1 = s.players.add('alpha');
    const t2 = s.players.add('beta');
    const series = await s.manager.create({ 'series.warmupRounds': 1, 'match.maxRounds': 40, 'series.winsNeeded': 2 });

    const seen = [];
    // The host presses Start once both bots have joined (like the start screen's button).
    series.on('changed', async () => { if (series.phase === 'waiting_for_start') await series.hostStart(); });
    const [a, b] = await Promise.all([
      playSeries({ mcpUrl: s.mcpUrl, token: t1, seriesId: series.id, name: 'Alpha', strategy: 'turtle', onStep: (o) => seen.push(JSON.stringify(o)) }),
      playSeries({ mcpUrl: s.mcpUrl, token: t2, seriesId: series.id, name: 'Beta', strategy: 'rusher', onStep: (o) => seen.push(JSON.stringify(o)) }),
    ]);
    assert.equal(a.phase, 'series_finished');
    assert.equal(b.next.do, 'stop');
    assert.equal(Math.max(a.result.wins.P1, a.result.wins.P2), 2);
    assert.deepEqual(Object.values(series.names()).sort(), ['Alpha', 'Beta']); // seats go by join order

    // a third player can't join, and can't act for a seat
    const t3 = s.players.add('gamma');
    const c = await connect(s.mcpUrl, t3);
    const joined = await c.call('manage_match', { operation: 'join', series_id: series.id, name: 'Gamma', request_id: 'x1' });
    assert.equal(joined.ok, false);
    const sub = await c.call('submit_action', { series_id: series.id, match: 1, round: 1, request_id: 'x2', actions: [] });
    assert.equal(sub.ok, false);
    // schema validation happens before our code
    const bad = await c.client.callTool({ name: 'submit_action', arguments: { series_id: series.id, match: 1, round: 1, request_id: 'x3', actions: [{ type: 'nuke' }] } });
    assert.equal(bad.isError, true);
    await c.close();

    // no token anywhere on disk (players.json holds only hashes) or in any response
    const disk = allFiles(s.dataDir);
    for (const t of [t1, t2, t3]) {
      assert.ok(!disk.includes(t), 'token found on disk');
      assert.ok(!seen.some((o) => o.includes(t)), 'token found in a response');
    }
  } finally { clearInterval(ticker); await s.stop(); }
});

test('get_match long-polls and returns early when the version changes', async () => {
  const s = await startServer();
  try {
    const t1 = s.players.add('alpha');
    const series = await s.manager.create({});
    const c = await connect(s.mcpUrl, t1);
    await c.call('manage_match', { operation: 'join', series_id: series.id, name: 'Alpha', request_id: 'j1' });
    const v = (await c.call('get_match', { series_id: series.id })).state_version;
    const started = Date.now();
    const quiet = await c.call('get_match', { series_id: series.id, since_version: v, wait_s: 1 });
    assert.equal(quiet.poll.changed, false);
    assert.ok(Date.now() - started >= 900);
    setTimeout(async () => await series.join('beta', 'Beta'), 200);
    const woke = await c.call('get_match', { series_id: series.id, since_version: v, wait_s: 10 });
    assert.equal(woke.poll.changed, true);
    assert.equal(woke.phase, 'waiting_for_start');
    // get_match without a series id finds the caller's series
    assert.equal((await c.call('get_match', {})).series_id, series.id);
    await c.close();
  } finally { await s.stop(); }
});

test('host API needs the host key; spectator API never shows pending bundles', async () => {
  const s = await startServer();
  try {
    const denied = await fetch(`${s.base}/api/series`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(denied.status, 403);
    const made = await (await fetch(`${s.base}/api/series`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': s.hostKey }, body: JSON.stringify({ overrides: { 'series.warmupRounds': 0 } }) })).json();
    assert.equal(made.ok, true);
    const series = s.manager.get(made.id);
    await series.join('a', 'A'); await series.join('b', 'B'); await series.hostStart();
    await series.submit('a', { match: 1, round: 1, actions: [{ type: 'send', units: [{ type: 'scarab', count: 3 }] }] });
    const view = await (await fetch(`${s.base}/api/series/${made.id}`)).text();
    const events = await (await fetch(`${s.base}/api/series/${made.id}/events`)).text();
    assert.ok(!view.includes('"units"') && !events.includes('"units"'), 'pending bundle leaked');
    const forfeit = await fetch(`${s.base}/api/series/${made.id}/host`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': s.hostKey }, body: JSON.stringify({ action: 'forfeit', seat: 'P2' }) });
    assert.equal(forfeit.status, 200);
    assert.equal(series.record.wins.P1, 1);
  } finally { await s.stop(); }
});
