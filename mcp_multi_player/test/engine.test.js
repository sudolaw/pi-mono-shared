// The few engine checks worth automating (spec §14): determinism, identical waves on both
// boards, and layout rejection. Everything else is checked by playing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLevel, prepareLevel } from '../src/config/load.js';
import * as engine from '../src/engine/index.js';
import { STRATEGIES } from '../scripts/strategies.js';

const level = loadLevel('normal');

function play(seed, s1 = 'laser_wall', s2 = 'cannon_cryo') {
  let state = engine.setup(level, seed);
  const hashes = [];
  for (;;) {
    const actions = { P1: STRATEGIES[s1](engine.view(state, 'P1', level), level), P2: STRATEGIES[s2](engine.view(state, 'P2', level), level) };
    state = engine.apply(state, actions, level).state;
    hashes.push(engine.hash(state));
    const res = engine.outcome(state, level);
    if (res.over) return { state, hashes, res };
  }
}

test('same seed and same actions give the same state hash every turn', () => {
  const a = play(7), b = play(7);
  assert.deepEqual(a.hashes, b.hashes);
  assert.deepEqual(a.res, b.res);
  assert.notDeepEqual(play(8).hashes, a.hashes);
});

test('both boards receive identical waves, whatever the players do', () => {
  let state = engine.setup(level, 99);
  const spawns = { P1: [], P2: [] };
  for (let turn = 0; turn < 6; turn++) {
    const r = engine.apply(state, { P1: STRATEGIES.laser_wall(engine.view(state, 'P1', level), level), P2: [] }, level);
    for (const e of r.events) if (e.type === 'spawn') spawns[e.board].push([turn, e.tick, e.id, e.unit, e.hp]);
    state = r.state;
  }
  assert.ok(spawns.P1.length > 0);
  assert.deepEqual(spawns.P1, spawns.P2);
});

test('the engine never mutates the state it is given', () => {
  const state = engine.setup(level, 3);
  const before = engine.hash(state);
  engine.apply(state, { P1: [{ type: 'build', slot: 'D5', tower: 'laser' }], P2: [] }, level);
  assert.equal(engine.hash(state), before);
});

test('a layout with a broken or branching path is rejected, naming the tile', () => {
  const raw = structuredClone(JSON.parse(JSON.stringify(level)));
  delete raw.hash;
  const broken = { ...raw, layout: { tile: 64, rows: ['S##.', '...#', '...B'] } };
  assert.throws(() => prepareLevel(broken), /path stops at A3/);
  const branching = { ...raw, layout: { tile: 64, rows: ['S##', '.##', '..B'] } };
  assert.throws(() => prepareLevel(branching), /branches/);
});

test('leaks hit the tower closest to the base first, destroy it, and only then reach the base', () => {
  const [near, next] = level.layout.leakOrder;
  const start = engine.setup(level, 5);
  start.boards.P1.gold = 10_000;
  let s = engine.apply(start, { P1: [{ type: 'build', slot: next, tower: 'cryo' }, { type: 'build', slot: near, tower: 'cryo' }], P2: [] }, level).state;
  s = { ...s, waves: s.waves.map((w) => ({ ...w, spawns: [] })) };
  s.boards.P1.attackers = []; // only the attackers placed below reach the base
  const extra = 2;
  for (let i = 0; i < level.rules.towerHealth + extra; i++) {
    s.boards.P1.attackers.push({ id: 9000 + i, type: 'crawler', hp: 1e9, maxHp: 1e9, dist: level.layout.path.length - 1, slowUntil: 0, slowFactor: 1, lastHit: null });
  }
  const b = engine.apply(s, { P1: [], P2: [] }, level).state.boards.P1;
  assert.equal(b.towers[near], undefined, 'the closest tower took the first hits and fell');
  assert.equal(b.towers[next].health, level.rules.towerHealth - extra, 'then the next one');
  assert.equal(b.health, level.rules.startHealth, 'the base is untouched while towers stand');
});

test('an upgrade adds 20% of the base value of one stat, costs the build cost, and damage wears down each wave', () => {
  let state = engine.setup(level, 6);
  state.boards.P1.gold = 10_000;
  state = engine.apply(state, { P1: [{ type: 'build', slot: 'D5', tower: 'laser' }], P2: [] }, level).state;
  const spent = state.boards.P1.spent;
  const ups = [{ type: 'upgrade', slot: 'D5', stat: 'damage' }, { type: 'upgrade', slot: 'D5', stat: 'damage' }];
  state = engine.apply(state, { P1: ups, P2: [] }, level).state;
  const t = engine.view(state, 'P1', level).me.towers[0];
  const share = (1 - level.rules.escalation.towerDecayPerWave) ** state.turn; // the coming wave is turn + 1
  assert.equal(t.damage, Math.round(level.towers.laser.base.damage * 1.4 * share * 10) / 10);
  assert.equal(t.range, level.towers.laser.base.range);
  assert.equal(state.boards.P1.spent - spent, 2 * level.towers.laser.cost);
  assert.equal(engine.validate(state, 'P1', [{ type: 'upgrade', slot: 'D5', stat: 'speed' }], level).code, 'unknown_stat');
});
