// Runtime guarantees beyond game rules: workers, async commits, caches and slow clients.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { EnginePool } from '../src/engine/pool.js';
import { createEngine } from '../src/engine/index.js';
import { applyOverrides } from '../src/config.js';
import { Series } from '../src/series/series.js';
import { Store } from '../src/store/files.js';
import { spectatorHub } from '../src/web/stream.js';
import { fakeClock, tempStore, seatedSeries } from './helpers.js';

test('worker pool preserves opening/live hashes and owns the full live timeline', async () => {
  const pool = new EnginePool({ size: 1 });
  try {
    const cfg = applyOverrides({});
    const local = createEngine(cfg);
    const remote = await pool.open(cfg);
    let state = local.newMatch(1);
    for (let round = 1; round <= 8; round++) {
      const bundles = { P1: [{ type: 'send', units: [{ type: 'crawler', count: 2 }] }], P2: [] };
      if (round === 1) bundles.P2 = [{ type: 'build', slot: 'P2-7', tower: 'plasma' }];
      const expected = round <= 2 ? local.resolve(state, bundles) : local.replayLive(state, bundles);
      let result;
      if (round <= 2) result = await remote.resolve(state, bundles);
      else {
        let live = await remote.beginLive(state);
        for (const ticks of [20, 40, 100]) {
          live = await remote.advanceLive(live, ticks);
          assert.ok(live.timeline.frames.length <= 1, 'full timeline crossed to main thread');
        }
        result = await remote.finishLive(live, bundles);
      }
      assert.equal(result.hash, expected.hash, `round ${round}`);
      assert.deepEqual(result.timeline, expected.timeline);
      assert.deepEqual(JSON.parse(result.timelineJson), expected.timeline);
      state = result.state;
    }
    const another = await pool.open(cfg);
    assert.equal(pool.workers.length, 1);
    await another.close(); await remote.close();
  } finally { await pool.close(); }
});

test('worker failure rejects pending work; bounded pool replaces the dead worker', async () => {
  const pool = new EnginePool({ size: 1, maxPending: 1 });
  try {
    const engine = await pool.open(applyOverrides({}));
    const first = engine.fingerprint({ value: 'x'.repeat(10000) });
    await assert.rejects(engine.fingerprint({ second: true }), /queue is full/);
    await first;
    const pending = engine.fingerprint({ value: 'x'.repeat(1000000) });
    const rejected = assert.rejects(pending, /worker exited/);
    await pool.workers[0].worker.terminate();
    await rejected;
    const replacement = await pool.open(applyOverrides({}));
    assert.equal(await replacement.fingerprint({ ok: true }), '{"ok":true}');
    await replacement.close();
  } finally { await pool.close(); }
});

test('async mutations serialize duplicate requests, commit once, and publish after persistence', async () => {
  const { store } = tempStore();
  const s = await Series.create(store, { clock: fakeClock() });
  const other = await Series.create(store, { clock: fakeClock() });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let entered;
  const waiting = new Promise((resolve) => { entered = resolve; });
  const original = store.saveSeries.bind(store);
  let committed = false;
  let writes = 0;
  store.saveSeries = async (record) => {
    if (record.id === s.id) { entered(); await gate; writes++; }
    await original(record);
    if (record.id === s.id) committed = true;
  };
  const seen = [];
  s.on('event', (event) => { assert.ok(committed); seen.push(event); });
  const payload = { operation: 'join', name: 'A' };
  const call = () => s.request('alice', 'same-id', payload, () => s.join('alice', 'A'));
  const first = call();
  await waiting;
  const duplicate = call();
  assert.equal(seen.length, 0);
  assert.equal((await other.join('bob', 'B')).ok, true, 'independent series was blocked');
  release();
  assert.deepEqual(await duplicate, await first);
  assert.equal(writes, 1);
  assert.equal(seen.filter((e) => e.type === 'player_joined').length, 1);
  assert.equal((await store.loadSeries(s.id)).seats.P1.name, 'A');
  const journal = await fs.readFile(path.join(store.dir(s.id), 'requests.jsonl'), 'utf8');
  assert.equal(journal.trim().split('\n').length, 1);
  await s.close(); await other.close();
});

test('storage failure rejects the mutation and publishes no success events', async () => {
  const { store } = tempStore();
  const s = await Series.create(store, { clock: fakeClock() });
  let seen = 0;
  s.on('event', () => seen++);
  store.saveSeries = async () => { throw new Error('injected disk failure'); };
  await assert.rejects(s.join('alice', 'A'), /injected disk failure/);
  assert.equal(seen, 0);
  await assert.rejects(s.idle(), /injected disk failure/);
  await assert.rejects(s.join('bob', 'B'), /injected disk failure/);
  await s.close();
});

test('a failed read leaves the series running; only a failed mutation stops it', async () => {
  const { series: s } = await seatedSeries();
  await assert.rejects(s.read(() => { throw new Error('view bug'); }), /view bug/);
  await s.idle();
  assert.equal((await s.hostStart()).ok, true);
  await s.close();
});

test('history cache is bounded, survives recovery, and separates restart epochs', async () => {
  const { store, dir } = tempStore();
  await store.createSeriesDir('history');
  for (let seq = 1; seq <= 410; seq++) await store.appendEvent('history', {
    seq, match: 1, round: seq, type: 'round_resolved', payload: { warmup: false } });
  assert.equal((await store.recentEvents('history')).length, 400);
  assert.equal((await store.matchRounds('history', 1)).length, 410);
  assert.equal((await store.readEvents('history')).length, 410);
  assert.equal((await store.readEvents('history', { after: 405 })).length, 5);
  await store.appendEvent('history', { seq: 411, type: 'series_restarted' });
  await store.appendEvent('history', { seq: 412, match: 1, round: 1, type: 'round_resolved', payload: { warmup: false } });
  const recovered = new Store(dir);
  const [a, b] = await Promise.all([recovered.recentEvents('history'), recovered.recentEvents('history')]);
  assert.deepEqual(a, b);
  assert.equal(a.length, 400);
  assert.equal((await recovered.matchRounds('history', 1)).length, 1);
});

test('request journal loads legacy snapshots and newer append records together', async () => {
  const { store } = tempStore();
  await store.createSeriesDir('requests');
  await store.saveRequests('requests', { old: { response: { ok: true } } });
  await store.appendRequest('requests', 'new', { response: { ok: false } });
  assert.deepEqual(await store.loadRequests('requests'), {
    old: { response: { ok: true } }, new: { response: { ok: false } } });
});

class Response extends EventEmitter {
  constructor(block = false) { super(); this.block = block; this.writableLength = 0; this.messages = []; this.destroyed = false; }
  writeHead() {}
  write(message) { this.messages.push(message); return !this.block; }
  destroy() { this.destroyed = true; }
}

test('spectators share one view serialization; slow clients are bounded and removed', async () => {
  const { series: s } = await seatedSeries();
  await s.hostStart();
  let reads = 0;
  Object.defineProperty(s.state.players.P1, 'gold', { get: () => { reads++; return 400; } });
  const hub = spectatorHub(s);
  const requests = [new EventEmitter(), new EventEmitter(), new EventEmitter()];
  const responses = [new Response(), new Response(), new Response(true)];
  for (let i = 0; i < 3; i++) await hub.connect(requests[i], responses[i]);
  assert.equal(reads, 1);
  s.record.version++;
  s.emit('changed', s.record.version);
  assert.equal(reads, 2);
  for (let i = 0; i < 5; i++) s.emit('combat', { padding: 'x'.repeat(100000) });
  assert.equal(responses[2].destroyed, true);
  assert.equal(responses[0].destroyed, false);
  for (const req of requests) req.emit('close');
  assert.equal(s.listenerCount('combat'), 0);
  await s.close();
});

test('a spectator connecting during a mutation gets each event once: in history or live', async () => {
  const { store } = tempStore();
  const s = await Series.create(store, { clock: fakeClock() });
  let release, entered;
  const gate = new Promise((resolve) => { release = resolve; });
  const committing = new Promise((resolve) => { entered = resolve; });
  const original = store.saveSeries.bind(store);
  store.saveSeries = async (record) => { entered(); await gate; return original(record); };
  const joining = s.join('alice', 'A');
  await committing; // the join's event is on disk, but its notification waits for the commit
  const req = new EventEmitter();
  const res = new Response();
  const connecting = spectatorHub(s).connect(req, res);
  release();
  try {
    await joining; await connecting;
    const seqs = [];
    for (const message of res.messages) {
      const [head, data] = message.split('\ndata: ');
      if (head === 'event: history') seqs.push(...JSON.parse(data).map((e) => e.seq));
      if (head === 'event: event') seqs.push(JSON.parse(data).seq);
    }
    assert.deepEqual(seqs, [...new Set(seqs)].sort((a, b) => a - b));
    assert.ok(seqs.includes(s.record.seq));
  } finally {
    req.emit('close');
    await s.close();
  }
});
