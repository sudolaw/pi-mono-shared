// End-to-end smoke run (spec §14): two scripted bots play a short series over the real /mcp
// endpoint; the live boards need the host key, the replay is public afterwards, bad tokens get
// a clear refusal, and the host key never appears in a reply or a file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { webRoutes } from '../src/web/routes.js';
import { playSeat, startWhenSeated } from '../scripts/bots.js';

const filesUnder = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? filesUnder(join(dir, n)) : [join(dir, n)]));

test('two bots play a series over /mcp; secrets never reach replies or files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mmp-e2e-'));
  const { listen, ctx } = createApp({ dataDir: dir, port: 0, hostKey: 'host-secret', gapS: 0, web: webRoutes, sync: false });
  const server = await listen();
  const mcpUrl = ctx.base + '/mcp';
  try {
    const host = { 'content-type': 'application/json', 'x-host-key': 'host-secret' };
    const res = await fetch(`${ctx.base}/api/series`, { method: 'POST', headers: host, body: JSON.stringify({ level: 'tutorial', best_of: 1, pace_s: 0 }) });
    const { series_id } = await res.json();
    const { setup } = await (await fetch(`${ctx.base}/api/setup`)).json();
    assert.match(setup[0].claude, /add -s user --transport http mmp http:\/\/127\.0\.0\.1:\d+\/mcp$/, 'one server entry for every agent');
    const replies = [];
    void startWhenSeated(ctx.base, 'host-secret', series_id);
    const [a, b] = await Promise.all(['P1', 'P2'].map((seat) => playSeat({ mcpUrl, name: `bot ${seat}`, strategy: seat === 'P1' ? 'balanced' : 'cannon_cryo', onReply: (r) => replies.push(JSON.stringify(r)) })));
    assert.equal(a.next.tool, 'stop');
    assert.equal(b.series.phase, 'done');
    assert.equal(a.series.id, series_id);
    assert.equal((await fetch(`${ctx.base}/api/series/${series_id}/state`)).status, 403, 'live boards need the host key');
    assert.equal((await fetch(`${ctx.base}/api/series/${series_id}/state`, { headers: { 'x-host-key': 'host-secret' } })).status, 200);
    const replay = await (await fetch(`${ctx.base}/api/series/${series_id}/matches/1/replay?count=2`)).json();
    assert.equal(replay.turns.length, 2, 'a finished match can be replayed by anyone');
    const secrets = ['host-secret'];
    assert.ok(replies.some((r) => r.includes('"tower_health"') || r.includes('tower_hits')), 'replies carry the new rules');
    for (const text of [...replies, ...filesUnder(dir).map((f) => readFileSync(f, 'utf8'))]) {
      for (const s of secrets) assert.ok(!text.includes(s), 'a secret leaked');
    }
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
