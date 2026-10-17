import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, applyOverrides, incomeAfterRound, attackerStats } from '../src/config.js';
import { createEngine } from '../src/engine/index.js';
import { simulateRound, pickTarget } from '../src/engine/sim.js';

const cfg = () => structuredClone(DEFAULTS);
const engineWith = (overrides) => createEngine(applyOverrides(overrides));

// Places an attacker owned by `owner` at distance `dist` along its pipe.
function addAttacker(state, owner, type, dist, extra = {}) {
  const def = DEFAULTS.attackers[type];
  const a = { id: state.nextId++, owner, type, dist, hp: def.health, maxHp: def.health, slow: 1, slowLeft: 0, lastHit: null, ...extra };
  state.attackers.push(a);
  return a;
}

test('board: path length, reflection, slot zones and owners', () => {
  const { board } = createEngine(cfg());
  assert.equal(board.paths.P1.length, 3880);
  assert.equal(board.paths.P2.length, 3880);
  assert.deepEqual(board.paths.P2.points[0], [1500, 400]); // P2's attackers start at P2's base
  assert.deepEqual(board.slots['P2-7'], { id: 'P2-7', owner: 'P2', x: 630, y: 470, zone: 'middle' });
  assert.equal(board.slots['P1-1'].zone, 'P1');
  assert.equal(board.slots['P2-1'].zone, 'P2');
  assert.equal(board.slotIds.length, 18);
  // the shared middle road: both pipes pass through the board centre
  const onRoad = (seat) => board.paths[seat].points.some(([x, y]) => x === 700 && y === 400);
  assert.ok(onRoad('P1') && onRoad('P2'));
});

test('board: every slot but the corner slot 1 guards enemy road; pipes leave each base on opposite sides', () => {
  const { board } = createEngine(cfg());
  // Units of the enemy's pipe within a level-1 laser's range (160) of each slot.
  const covered = (id) => {
    const slot = board.slots[id];
    const enemy = slot.owner === 'P1' ? 'P2' : 'P1';
    let n = 0;
    for (let d = 0; d <= board.paths[enemy].length; d += 2) {
      const [x, y] = board.positionAt(enemy, d);
      if (Math.hypot(x - slot.x, y - slot.y) <= 160) n += 2;
    }
    return n;
  };
  for (const id of board.slotIds.filter((id) => !id.endsWith('-1'))) assert.ok(covered(id) >= 250, `${id} covers ${covered(id)}`);
  // Own attackers leave P1's base upward; the enemy's arrive from below.
  const [, firstOut] = board.paths.P1.points;
  const lastIn = board.paths.P2.points.at(-2);
  assert.ok(firstOut[1] < 400 && lastIn[1] > 400, `out ${firstOut} in ${lastIn}`);
});

test('config: overrides are validated and income rises every 10 rounds', () => {
  const c = applyOverrides({ 'attackers.runner.speed': 140, 'series.deadline.mode': 'off' });
  assert.equal(c.attackers.runner.speed, 140);
  assert.equal(DEFAULTS.attackers.runner.speed, 155); // defaults untouched
  assert.throws(() => applyOverrides({ 'board.width': 10 }), /Unknown or fixed/);
  assert.throws(() => applyOverrides({ 'economy.startingGold': -5 }), /between/);
  assert.equal(incomeAfterRound(c, 1), 100);
  assert.equal(incomeAfterRound(c, 10), 100);
  assert.equal(incomeAfterRound(c, 11), 110);
  assert.equal(incomeAfterRound(c, 100), 190);
});

test('attacker escalation: five-round boundaries, compounding, rounding, floor and legacy settings', () => {
  const c = cfg();
  for (const round of [1, 5]) {
    assert.equal(attackerStats(c, 'scarab', round).price, 50);
    assert.equal(attackerStats(c, 'scarab', round).health, 220);
  }
  for (const round of [6, 10]) {
    assert.equal(attackerStats(c, 'scarab', round).price, 40);
    assert.equal(attackerStats(c, 'scarab', round).health, 242);
  }
  assert.equal(attackerStats(c, 'scarab', 11).price, 32);
  assert.equal(attackerStats(c, 'scarab', 11).health, 267);
  assert.equal(attackerStats(c, 'runner', 11).price, 20);
  assert.equal(attackerStats(c, 'runner', 11).health, 55);
  assert.equal(attackerStats(c, 'crawler', 100).price, 1);
  assert.equal(attackerStats(c, 'scarab', 1).health, 220, 'new match resets scaling');
  const free = applyOverrides({ 'attackers.crawler.price': 0, 'attackers.crawler.health': 100 });
  assert.equal(attackerStats(free, 'crawler', 6).price, 0);
  assert.equal(attackerStats(free, 'crawler', 6).health, 110);
  delete c.economy.attackerScaling;
  assert.equal(attackerStats(c, 'scarab', 100).price, 50);
  assert.equal(attackerStats(c, 'scarab', 100).health, 220);
});

test('attacker escalation: validation and charging agree for both players at discounted prices', () => {
  const e = createEngine(cfg());
  const state = e.newMatch(1);
  state.round = 6;
  state.players.P1.gold = 24;
  state.players.P2.gold = 24;
  const send = [{ type: 'send', units: [{ type: 'runner', count: 1 }] }];
  assert.equal(e.validate(state, 'P1', send).cost, 24);
  assert.equal(e.validate(state, 'P2', send).cost, 24);
  state.players.P1.gold = 23;
  assert.equal(e.validate(state, 'P1', send).ok, false);
  state.players.P1.gold = 24;
  const result = e.resolve(state, { P1: send, P2: send });
  assert.equal(result.state.players.P1.gold, 100);
  assert.equal(result.state.players.P2.gold, 100);
  assert.equal(result.state.players.P1.spent.attackers, 24);
  assert.ok(result.state.attackers.every((a) => a.hp === 50 && a.maxHp === 50));
});

test('attacker escalation: queued spawns get new health but living attackers do not heal', () => {
  const e = createEngine(cfg());
  const state = e.newMatch(1);
  state.round = 5;
  const fifth = e.resolve(state, { P1: [{ type: 'send', units: [{ type: 'crawler', count: 18 }] }], P2: [] });
  assert.equal(fifth.state.players.P1.spent.attackers, 360);
  assert.equal(fifth.state.players.P1.queue.length, 5);
  const older = fifth.state.attackers.map((a) => a.id);
  fifth.state.attackers[0].hp = 50;
  const sixth = e.resolve(fifth.state, { P1: [], P2: [] });
  assert.ok(sixth.state.attackers.filter((a) => !older.includes(a.id)).every((a) => a.hp === 88 && a.maxHp === 88));
  assert.ok(sixth.state.attackers.filter((a) => older.includes(a.id)).every((a) => a.maxHp === 80));
  assert.equal(sixth.state.attackers.find((a) => a.id === older[0]).hp, 50);
});

test('validation: whole bundle rejected, nothing changes, reasons per action', () => {
  const e = createEngine(cfg());
  const s = e.newMatch(1);
  const before = JSON.stringify(s);
  const r = e.validate(s, 'P1', [
    { type: 'build', slot: 'P1-1', tower: 'laser' },
    { type: 'build', slot: 'P2-1', tower: 'laser' }, // not P1's slot
    { type: 'build', slot: 'P1-2', tower: 'plasma' },
    { type: 'build', slot: 'P1-3', tower: 'plasma' }, // 100 + 125 + 125 > 400? no: 350, fine
    { type: 'build', slot: 'P1-4', tower: 'plasma' }, // 475 > 400: overspend
  ]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((x) => x.index), [1, 4]);
  assert.match(r.errors[0].reason, /belongs to P2/);
  assert.match(r.errors[1].reason, /not enough gold/);
  assert.equal(JSON.stringify(s), before);
});

test('validation: build then upgrade in one bundle; level cap; targeting; ownership', () => {
  const e = createEngine(applyOverrides({ 'economy.startingGold': 5000 }));
  const s = e.newMatch(1);
  assert.equal(e.validate(s, 'P1', [
    { type: 'build', slot: 'P1-6', tower: 'cryo', targeting: 'fastest' },
    { type: 'upgrade', slot: 'P1-6' },
    { type: 'upgrade', slot: 'P1-6' },
  ]).cost, 90 + 65 + 130);
  const r = e.validate(s, 'P1', [
    { type: 'build', slot: 'P1-6', tower: 'cryo' },
    { type: 'upgrade', slot: 'P1-6' }, { type: 'upgrade', slot: 'P1-6' }, { type: 'upgrade', slot: 'P1-6' },
  ]);
  assert.deepEqual(r.errors.map((x) => x.index), [3]);
  assert.match(r.errors[0].reason, /already level 3/);
  s.towers['P2-1'] = { slot: 'P2-1', owner: 'P2', type: 'laser', level: 1, targeting: 'first', cooldown: 0, damage: 0, kills: 0 };
  assert.match(e.validate(s, 'P1', [{ type: 'target', slot: 'P2-1', targeting: 'weakest' }]).errors[0].reason, /belongs to P2/);
  assert.match(e.validate(s, 'P2', [{ type: 'target', slot: 'P2-1', targeting: 'loudest' }]).errors[0].reason, /unknown targeting/);
  assert.match(e.validate(s, 'P2', [{ type: 'build', slot: 'P2-1', tower: 'laser' }]).errors[0].reason, /already has a tower/);
});

test('validation: send limits per round and on board', () => {
  const e = createEngine(applyOverrides({ 'economy.startingGold': 100000 }));
  const s = e.newMatch(1);
  assert.equal(e.validate(s, 'P1', [{ type: 'send', units: [{ type: 'crawler', count: 30 }] }]).ok, true);
  assert.match(e.validate(s, 'P1', [{ type: 'send', units: [{ type: 'crawler', count: 20 }] }, { type: 'send', units: [{ type: 'runner', count: 11 }] }]).errors[0].reason, /at most 30/);
  s.players.P1.queue = Array(45).fill('crawler');
  assert.match(e.validate(s, 'P1', [{ type: 'send', units: [{ type: 'crawler', count: 16 }] }]).errors[0].reason, /at most 60/);
  assert.match(e.validate(s, 'P1', [{ type: 'send', units: [{ type: 'crawler', count: 0 }] }]).errors[0].reason, /at least 1/);
  assert.equal(e.validate(s, 'P1', []).ok, true); // empty bundle = save gold
});

test('spawns: submitted order, 0.4 s spacing, queue carries into the next round', () => {
  const e = createEngine(cfg());
  const s0 = e.newMatch(1);
  const sendOrder = [{ type: 'send', units: [{ type: 'scarab', count: 2 }, { type: 'crawler', count: 6 }] }];
  const r1 = e.resolve(s0, { P1: sendOrder, P2: [] });
  const spawns = r1.timeline.events.filter((x) => x.type === 'spawn');
  assert.deepEqual(spawns.map((x) => x.unit), ['scarab', 'scarab', 'crawler', 'crawler', 'crawler', 'crawler', 'crawler', 'crawler']);
  assert.deepEqual(spawns.slice(0, 3).map((x) => x.t), [0.05, 0.45, 0.85]);
  assert.equal(r1.state.players.P1.queue.length, 0);

  // 18 attackers at 0.4 s need 7.2 s: 13 spawn this round (ticks 1, 9, …, 97), 5 wait.
  const rich = engineWith({ 'economy.startingGold': 1000 });
  const big = rich.resolve(rich.newMatch(1), { P1: [{ type: 'send', units: [{ type: 'crawler', count: 18 }] }], P2: [] });
  assert.equal(big.timeline.events.filter((x) => x.type === 'spawn').length, 13);
  assert.equal(big.state.players.P1.queue.length, 5);
  const next = rich.resolve(big.state, { P1: [], P2: [] });
  assert.equal(next.timeline.events.filter((x) => x.type === 'spawn').length, 5);
});

test('gold: costs, kill rewards to the defender, income after the round', () => {
  const e = createEngine(cfg());
  const s = e.newMatch(1);
  s.towers['P2-5'] = { slot: 'P2-5', owner: 'P2', type: 'plasma', level: 3, targeting: 'first', cooldown: 0, damage: 0, kills: 0 };
  addAttacker(s, 'P1', 'runner', 2870, { hp: 10 }); // a weak runner near P2-5 (1090,330)
  const r = e.resolve(s, { P1: [], P2: [] });
  assert.equal(r.state.players.P2.kills, 1);
  assert.equal(r.state.players.P2.gold, 400 + 12 + 100); // reward + income
  assert.equal(r.state.players.P1.sent.runner.killed, 1);
  assert.equal(r.state.towers['P2-5'].kills, 1);
  assert.equal(r.state.round, 2);
});

test('damage: armor per hit with a minimum of 1', () => {
  const e = createEngine(cfg());
  const s = e.newMatch(1);
  s.towers['P2-5'] = { slot: 'P2-5', owner: 'P2', type: 'cryo', level: 1, targeting: 'first', cooldown: 0, damage: 0, kills: 0 };
  // Scarab (armor 12) on the straight just below P2-5 (1090,330).
  const a = addAttacker(s, 'P1', 'scarab', 2870);
  const hp0 = a.hp;
  const rec = { events: [], frames: [] };
  simulateRound(s, e.cfg, e.board, rec);
  const hits = rec.events.filter((x) => x.type === 'hit');
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => h.damage === 1)); // cryo 8 − armor 12 → 1
  const after = s.attackers.find((x) => x.id === a.id);
  assert.equal(hp0 - after.hp, hits.length);
});

test('splash: 50% to other enemies within 48, armor applied to each hit', () => {
  const e = createEngine(cfg());
  const s = e.newMatch(1);
  s.towers['P2-5'] = { slot: 'P2-5', owner: 'P2', type: 'plasma', level: 1, targeting: 'first', cooldown: 0, damage: 0, kills: 0 };
  const lead = addAttacker(s, 'P1', 'crawler', 2870);
  const near = addAttacker(s, 'P1', 'scarab', 2860);
  const far = addAttacker(s, 'P1', 'crawler', 2690);
  const rec = { events: [], frames: [] };
  simulateRound(s, e.cfg, e.board, rec);
  const firstImpact = rec.events.filter((x) => x.type === 'hit').slice(0, 2);
  assert.deepEqual(firstImpact.map((h) => [h.id, h.damage, h.splash]), [[lead.id, 60, false], [near.id, 18, true]]); // 30 − 12
  assert.ok(!rec.events.some((x) => x.type === 'hit' && x.id === far.id && x.splash && x.t === firstImpact[0].t));
});

test('slow: speed × 0.45 for 2.5 s, refreshes but never stacks', () => {
  const e = createEngine(cfg());
  const s = e.newMatch(1);
  s.towers['P2-5'] = { slot: 'P2-5', owner: 'P2', type: 'cryo', level: 1, targeting: 'first', cooldown: 0, damage: 0, kills: 0 };
  const a = addAttacker(s, 'P1', 'scarab', 2870);
  simulateRound(s, e.cfg, e.board, { events: [], frames: [] });
  const after = s.attackers.find((x) => x.id === a.id) ?? null;
  assert.ok(after, 'scarab should still be alive');
  assert.equal(after.slow, 0.45);
  assert.ok(after.slowLeft > 0 && after.slowLeft <= 2.5);
});

test('targeting: priorities and tie-breaks', () => {
  const e = createEngine(cfg());
  const s = e.newMatch(1);
  const slot = e.board.slots['P2-1'];
  const a1 = addAttacker(s, 'P1', 'crawler', 2650, { hp: 50 });
  const a2 = addAttacker(s, 'P1', 'scarab', 2600, { hp: 200, slow: 0.45 });
  const a3 = addAttacker(s, 'P1', 'runner', 2620, { hp: 50 });
  addAttacker(s, 'P2', 'runner', 300); // own attacker: never a target
  const pos = new Map(s.attackers.map((a) => [a.id, e.board.positionAt(a.owner, a.dist)]));
  const pick = (targeting) => pickTarget({ owner: 'P2', targeting }, slot, 400, s.attackers, pos, e.cfg).id;
  assert.equal(pick('first'), a1.id);
  assert.equal(pick('strongest'), a2.id);
  assert.equal(pick('weakest'), a1.id); // a1 and a3 tie on hp 50 → further along wins
  assert.equal(pick('fastest'), a3.id);
});

test('base hits: 1 damage, no reward; both bases in one tick is a draw', () => {
  const e = createEngine(cfg());
  const s = e.newMatch(1);
  s.players.P1.base = 1;
  s.players.P2.base = 1;
  addAttacker(s, 'P1', 'scarab', e.board.paths.P1.length - 0.5);
  addAttacker(s, 'P2', 'crawler', e.board.paths.P1.length - 0.5);
  const r = e.resolve(s, { P1: [], P2: [] });
  assert.deepEqual(r.state.over, { result: 'draw', winner: null, reason: 'both_bases', round: 1 });
  assert.equal(r.state.players.P1.gold, 400); // no reward for reaching the base, no income once over
  assert.equal(r.state.players.P1.sent.scarab.reached, 1);
});

test('round limit: more base health wins, equal is a draw', () => {
  const e = engineWith({ 'match.maxRounds': 2 });
  let s = e.newMatch(1);
  s = e.resolve(s, { P1: [], P2: [] }).state;
  s.players.P2.base = 19;
  const r = e.resolve(s, { P1: [], P2: [] });
  assert.deepEqual(r.state.over, { result: 'win', winner: 'P1', reason: 'round_limit', round: 2 });
  let d = e.newMatch(1);
  d = e.resolve(d, { P1: [], P2: [] }).state;
  assert.equal(e.resolve(d, { P1: [], P2: [] }).state.over.result, 'draw');
});

test('determinism: the same bundles give the same hashes', () => {
  const play = () => {
    const e = createEngine(cfg());
    let s = e.newMatch(1);
    const hashes = [];
    const bundles = [
      { P1: [{ type: 'build', slot: 'P1-5', tower: 'plasma' }, { type: 'send', units: [{ type: 'runner', count: 4 }] }], P2: [{ type: 'build', slot: 'P2-7', tower: 'laser', targeting: 'weakest' }, { type: 'send', units: [{ type: 'crawler', count: 6 }] }] },
      { P1: [{ type: 'build', slot: 'P1-8', tower: 'cryo' }], P2: [{ type: 'send', units: [{ type: 'scarab', count: 3 }] }] },
    ];
    for (let i = 0; i < 12; i++) {
      const r = e.resolve(s, bundles[i] ?? { P1: [], P2: [] });
      hashes.push(r.hash);
      s = r.state;
    }
    return hashes;
  };
  assert.deepEqual(play(), play());
});

test('resolve rejects an invalid bundle instead of applying it', () => {
  const e = createEngine(cfg());
  assert.throws(() => e.resolve(e.newMatch(1), { P1: [{ type: 'build', slot: 'P2-1', tower: 'laser' }], P2: [] }), /invalid/);
});
