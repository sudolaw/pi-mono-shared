#!/usr/bin/env node
// Repeatable event-loop stress comparison for SPEC.md §2/§13, not a gameplay balance test.
// Compare the former synchronous resolve/write pattern with warmed workers + async I/O.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { setTimeout as delay, setImmediate as immediate } from 'node:timers/promises';
import { createEngine } from '../src/engine/index.js';
import { EnginePool } from '../src/engine/pool.js';
import { applyOverrides } from '../src/config.js';
import { Store } from '../src/store/files.js';

const cfg = applyOverrides({ 'economy.maxOnBoard': 500, 'economy.startingGold': 100000 });
const local = createEngine(cfg);
const state = local.newMatch(1);
for (const slot of local.board.slotIds) {
  state.towers[slot] = { slot, owner: local.board.slots[slot].owner, type: 'plasma', level: 3,
    targeting: 'first', cooldown: 0, damage: 0, kills: 0 };
}
for (let i = 0; i < 1000; i++) state.attackers.push({ id: state.nextId++, owner: i % 2 ? 'P1' : 'P2',
  type: 'scarab', dist: 900 + i % 1200, hp: 220, maxHp: 220, slow: 1, slowLeft: 0, lastHit: null });
const requests = Object.fromEntries(Array.from({ length: 10000 }, (_, i) => [`r${i}`, {
  fingerprint: 'x'.repeat(100), response: { ok: true } }]));
const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mmp-perf-'));
const store = new Store(dir);
const pool = new EnginePool({ size: 1 });

async function measure(name, run) {
  const lag = monitorEventLoopDelay({ resolution: 5 });
  lag.enable();
  await delay(25);
  const elu = performance.eventLoopUtilization();
  const start = performance.now();
  const operationsMs = [];
  for (let i = 0; i < 8; i++) {
    const before = performance.now();
    await run(i);
    operationsMs.push(performance.now() - before);
    await immediate();
  }
  await delay(25);
  const result = { name, durationMs: performance.now() - start,
    eventLoopP99Ms: lag.percentile(99) / 1e6, eventLoopMaxMs: lag.max / 1e6,
    eventLoopUtilization: performance.eventLoopUtilization(elu).utilization, operationsMs };
  lag.disable();
  return result;
}

try {
  await store.createSeriesDir('bench');
  await store.saveRequests('bench', requests);
  const remote = await pool.open(cfg);
  const expected = local.resolve(state, { P1: [], P2: [] });
  const warm = await remote.resolve(state, { P1: [], P2: [] });
  if (warm.hash !== expected.hash) throw new Error('worker changed simulation hash');
  const baseline = await measure('former synchronous pattern', () => {
    const result = local.resolve(state, { P1: [], P2: [] });
    for (const [name, value] of [['combat', result.timeline], ['requests', requests]]) {
      const file = path.join(dir, `${name}.json`);
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
      fs.renameSync(`${file}.tmp`, file);
    }
  });
  const updated = await measure('worker simulation + async writes + append requests', async (i) => {
    const result = await remote.resolve(state, { P1: [], P2: [] });
    if (result.hash !== expected.hash) throw new Error('state hash changed');
    await store.saveCombat('bench', result.timeline, result.timelineJson);
    await store.appendRequest('bench', `new${i}`, { fingerprint: 'x'.repeat(100), response: { ok: true } });
  });
  console.log(JSON.stringify({ node: process.version,
    scenario: '8 dense rounds, 1000 attackers, 18 towers, 10000 existing request records; worker startup excluded',
    baseline, updated }, null, 2));
  await remote.close();
} finally { await pool.close(); await fsp.rm(dir, { recursive: true, force: true }); }
