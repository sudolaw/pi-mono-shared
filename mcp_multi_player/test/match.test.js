// Match checks worth automating (spec §14): a restart mid-turn carries on with the same
// hashes and keeps the submitted move, missed deadlines play empty turns then forfeit, and a
// wave never runs before the last one has had its time on screen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLevel } from '../src/config/load.js';
import * as engine from '../src/engine/index.js';
import { createStore } from '../src/store/index.js';
import { createFakeClock } from '../src/shared/clock.js';
import { createMatch, restoreMatch, DEFAULT_DEADLINE_S } from '../src/match/index.js';
import { STRATEGIES } from '../scripts/strategies.js';

const level = loadLevel('normal');
const plays = { P1: STRATEGIES.laser_wall, P2: STRATEGIES.cannon_cryo };

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'mmp-match-'));
  const store = createStore({ dataDir: dir, sync: false });
  const opts = { id: 's_test-1', seriesId: 's_test', matchNo: 1, level, seed: 4242 };
  return { dir, handle: store.openSeries('s_test').match(1), opts, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

async function move(match, seat, n) {
  const { view, version } = await match.getView({ seat });
  return match.submit({ seat, forVersion: version, requestId: `${seat}-${n}`, actions: plays[seat](view, level) });
}

test('a restart mid-turn keeps the pending move and ends with the same hashes', async () => {
  const a = setup(), b = setup();
  try {
    const clock = createFakeClock();
    const straight = createMatch({ engine, store: a.handle, clock }, a.opts);
    await straight.start();
    for (let n = 0; straight.status().phase === 'collecting'; n++) { await move(straight, 'P1', n); await move(straight, 'P2', n); }

    const first = createMatch({ engine, store: b.handle, clock: createFakeClock() }, b.opts);
    await first.start();
    let n = 0;
    for (; n < 6; n++) { await move(first, 'P1', n); await move(first, 'P2', n); }
    const p1 = await move(first, 'P1', n);
    assert.equal(p1.status, 'accepted');

    const again = await restoreMatch({ engine, store: b.handle, clock: createFakeClock() }, b.opts);
    assert.deepEqual(again.status().submitted, { P1: true, P2: false });
    assert.equal((await move(again, 'P1', n)).status, 'duplicate');
    await move(again, 'P2', n);
    for (n++; again.status().phase === 'collecting'; n++) { await move(again, 'P1', n); await move(again, 'P2', n); }

    assert.deepEqual(again.status().result, straight.status().result);
    assert.equal(engine.hash(again.state()), engine.hash(straight.state()));
  } finally { a.cleanup(); b.cleanup(); }
});

test('missed deadlines play an empty turn, and three misses forfeit', async () => {
  const s = setup();
  try {
    const clock = createFakeClock();
    let ended = null;
    const match = createMatch({ engine, store: s.handle, clock }, { ...s.opts, onEnd: (r) => { ended = r; } });
    await match.start();
    for (let i = 0; i < 3; i++) {
      await move(match, 'P1', i);
      await clock.advance(DEFAULT_DEADLINE_S * 1000);
    }
    assert.equal(match.status().phase, 'over');
    assert.equal(match.status().result.winner, 'P1');
    await new Promise((r) => setImmediate(r));
    assert.match(ended.reason, /P2 missed 3 deadlines/);
  } finally { s.cleanup(); }
});

test('the next wave waits until the last one has had its time on screen', async () => {
  const s = setup();
  try {
    const clock = createFakeClock();
    const match = createMatch({ engine, store: s.handle, clock }, { ...s.opts, paceS: 30 });
    await match.start();
    await move(match, 'P1', 0); await move(match, 'P2', 0);
    assert.equal(match.status().version, 2, 'the first wave runs at once');
    await move(match, 'P1', 1); await move(match, 'P2', 1);
    assert.equal(match.status().version, 2, 'both moves are in, but the last wave is still on screen');
    assert.equal(match.status().next_wave_in_s, 30);
    await clock.advance(29_000);
    assert.equal(match.status().version, 2);
    await clock.advance(1_000);
    assert.equal(match.status().version, 3);
  } finally { s.cleanup(); }
});

test('a failed write in background work stops the match visibly, not silently', async () => {
  const s = setup();
  try {
    const clock = createFakeClock();
    const logged = [];
    const store = { ...s.handle, append: async (kind, ...rest) => { if (kind === 'miss') throw new Error('disk full'); return s.handle.append(kind, ...rest); } };
    const match = createMatch({ engine, store, clock, log: { error: (m) => logged.push(m) } }, s.opts);
    await match.start();
    await clock.advance(DEFAULT_DEADLINE_S * 1000); // the deadline handler fails writing the miss
    assert.match(match.status().error, /deadline processing failed: disk full/);
    assert.equal(match.status().version, 1, 'nothing changed without its commit');
    assert.match(logged[0], /match s_test-1: deadline processing failed: disk full\. Restart the server/);
  } finally { s.cleanup(); }
});

test('host tuning (intensity and a random burst) is logged with the turn, so a restart rebuilds the same state', async () => {
  const s = setup();
  try {
    const match = createMatch({ engine, store: s.handle, clock: createFakeClock() }, s.opts);
    await match.start();
    await move(match, 'P1', 0); await move(match, 'P2', 0);
    await match.tune({ intensity: 9, burst: engine.randomBurst(level, 2, 9, Math.random) });
    await move(match, 'P1', 1); await move(match, 'P2', 1);
    await match.tune({ intensity: 0 });
    await move(match, 'P1', 2); await move(match, 'P2', 2);
    const again = await restoreMatch({ engine, store: s.handle, clock: createFakeClock() }, s.opts);
    assert.equal(engine.hash(again.state()), engine.hash(match.state()));
  } finally { s.cleanup(); }
});
