import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Series } from '../src/series/series.js';
import { SeriesManager } from '../src/series/manager.js';
import { playerView, spectatorView } from '../src/series/views.js';
import { replaySeries } from '../src/series/replay.js';
import { Store } from '../src/store/files.js';
import { fakeClock, tempStore, seatedSeries, playOut } from './helpers.js';

// Match 1 starts from the host's Start button; later matches need both players ready.
const readyBoth = async (series, match) => { if (match === 1) return await series.hostStart(); await series.ready('alice', match); await series.ready('bob', match); };
const empty = async (series, who) => await series.submit(who, { match: series.state.match, round: series.state.round, actions: [] });

const liveGame = async (overrides = {}) => {
  const clock = fakeClock();
  const game = await seatedSeries({ clock, overrides: { 'series.deadline.mode': 'off', ...overrides } });
  await game.series.hostStart();
  await game.series.submit('alice', { match: 1, round: 1, actions: [{ type: 'send', units: [{ type: 'scarab', count: 1 }] }] });
  await empty(game.series, 'bob');
  await empty(game.series, 'alice'); await empty(game.series, 'bob');
  assert.equal(game.series.state.round, 3);
  return { ...game, clock };
};

test('live slots: movement continues without replies; both orders apply only at the boundary', async () => {
  const { series: s, clock, store } = await liveGame();
  const dist = s.state.attackers[0].dist;
  const tick = s.state.tick;
  const gold = s.state.players.P1.gold;
  const frames = [];
  s.on('combat', (frame) => frames.push(frame));
  await clock.advance(1000);
  assert.equal(s.state.tick, tick + 20);
  assert.ok(s.state.attackers[0].dist > dist);
  assert.ok(frames.length >= 10);
  assert.equal(frames.at(-1).frame.t, 1);
  for (const [player, slot] of [['alice', 'P1-7'], ['bob', 'P2-7']]) {
    assert.equal((await s.submit(player, { match: 1, round: 3, actions: [{ type: 'build', slot, tower: 'laser' }] })).ok, true);
  }
  assert.deepEqual(s.state.towers, {});
  assert.equal(s.state.players.P1.gold, gold);
  assert.ok(!JSON.stringify(frames).includes('laser'), 'pending tower leaked into live stream');
  assert.equal(playerView(s, 'P1').next.do, 'wait');
  assert.match(playerView(s, 'P1').next.why, /Combat continues/);
  await clock.advance(3999);
  assert.equal(s.state.round, 3);
  assert.deepEqual(s.state.towers, {});
  await clock.advance(1);
  assert.equal(s.state.round, 4);
  assert.equal(s.state.tick, tick + 100);
  assert.equal(s.state.towers['P1-7'].type, 'laser');
  assert.equal(s.state.towers['P2-7'].type, 'laser');
  assert.equal(s.state.players.P1.gold, gold - 100 + 100);
  assert.deepEqual(replaySeries(await store.readEvents(s.id)).mismatches, []);
  await s.close();
});

test('live slots: combat frames do not wake long-polls; a submission or the next slot does', async () => {
  const { series: s, clock } = await liveGame();
  const version = s.record.version;
  const dist = s.state.attackers[0].dist;
  let frames = 0;
  s.on('combat', () => frames++);
  let woke = false;
  const waiting = s.waitForChange(version, 60_000).then((changed) => { woke = true; return changed; });
  await clock.advance(2000);
  await new Promise(setImmediate);
  assert.ok(frames >= 20);
  assert.equal(woke, false, 'a combat frame woke a waiting agent');
  assert.equal(s.record.version, version);
  // An observation still shows where the attackers are now.
  assert.ok(s.state.attackers[0].dist > dist);
  assert.equal(playerView(s, 'P2').attackers.toward_P2.closest[0].progress, Math.round((s.state.attackers[0].dist / s.engine.board.paths.P1.length) * 100) / 100);
  await empty(s, 'bob');
  assert.equal(await waiting, true);
  const next = s.waitForChange(s.record.version, 60_000);
  await clock.advance(3000);
  assert.equal(await next, true);
  assert.equal(s.state.round, 4);
  await s.close();
});

test('live slots: missing orders do not pause combat or cause deadline forfeits', async () => {
  const { series: s, clock, store } = await liveGame({ 'series.maxMisses': 1 });
  await empty(s, 'alice');
  await clock.advance(15_000);
  assert.equal(s.state.round, 6);
  assert.equal(s.state.tick, 500);
  assert.deepEqual(s.record.misses, { P1: 0, P2: 0 });
  assert.equal(s.phase, 'awaiting_actions');
  const resolved = (await store.readEvents(s.id)).filter((e) => e.type === 'round_resolved');
  assert.deepEqual(resolved[2].payload.autoFilled, { P1: false, P2: true });
  assert.deepEqual(resolved[3].payload.bundles, { P1: [], P2: [] });
  assert.match((await s.submit('bob', { match: 1, round: 3, actions: [] })).error, /stale/);
  assert.deepEqual(replaySeries(await store.readEvents(s.id)).mismatches, []);
  await s.close();
});

test('live escalation: slot-end orders use submitted-round prices; views and replay stay current', async () => {
  const { series: s, clock, store } = await liveGame();
  await clock.advance(10_000);
  assert.equal(s.state.round, 5);
  assert.equal(playerView(s, 'P1').attacker_stats.runner.price, 30);
  const gold = s.state.players.P1.gold;
  const send = [{ type: 'send', units: [{ type: 'runner', count: 3 }] }];
  assert.equal((await s.submit('alice', { match: 1, round: 5, actions: send })).cost, 90);
  await clock.advance(5000);
  assert.equal(s.state.round, 6);
  assert.equal(s.state.players.P1.gold, gold - 90 + 100);
  assert.equal(s.state.players.P1.queue.length, 3);
  for (const view of [playerView(s, 'P1'), playerView(s, 'P2'), spectatorView(s)]) {
    assert.equal(view.attacker_stats.runner.price, 24);
    assert.equal(view.attacker_stats.runner.health, 50);
  }
  assert.equal((await s.submit('alice', { match: 1, round: 6, actions: send })).cost, 72);
  await clock.advance(5000);
  assert.equal(s.state.players.P1.spent.attackers, 50 + 90 + 72);
  assert.ok(s.state.attackers.filter((a) => a.type === 'runner').every((a) => a.maxHp === 50));
  assert.deepEqual(replaySeries(await store.readEvents(s.id)).mismatches, []);
  await s.close();
});

test('live slots: towers, projectiles and base damage advance while agents think', async () => {
  const { series: s, clock } = await liveGame();
  const a = s.state.attackers[0];
  const segment = s.engine.board.paths.P1.segments.find((seg) => seg.ax === 1040 && seg.ay === 400);
  a.dist = segment.start + 50;
  s.state.towers['P2-5'] = { slot: 'P2-5', owner: 'P2', type: 'cryo', level: 1, targeting: 'first', cooldown: 0, damage: 0, kills: 0 };
  await clock.advance(1000);
  assert.ok(a.hp < a.maxHp);
  assert.equal(a.slow, 0.45);
  a.dist = s.engine.board.paths.P1.length - 1;
  const base = s.state.players.P2.base;
  await clock.advance(100);
  assert.equal(s.state.players.P2.base, base - 1);
  await s.close();
});

test('live slots: a base falling mid-slot discards orders without charging', async () => {
  const { series: s, clock } = await liveGame();
  s.state.players.P2.base = 1;
  s.state.attackers[0].dist = s.engine.board.paths.P1.length - 1;
  const gold = s.state.players.P1.gold;
  await s.submit('alice', { match: 1, round: 3, actions: [{ type: 'build', slot: 'P1-7', tower: 'laser' }] });
  await clock.advance(50);
  assert.equal(s.phase, 'strategy_review');
  assert.equal(s.state.towers['P1-7'], undefined);
  assert.equal(s.state.players.P1.gold, gold);
  assert.equal(clock.pending(), 0);
});

test('live slots: recovery retains pending orders and restarts the unfinished slot', async () => {
  const { series: s, clock, store } = await liveGame();
  const openingTick = s.state.tick;
  await s.submit('alice', { match: 1, round: 3, actions: [{ type: 'build', slot: 'P1-7', tower: 'laser' }] });
  await clock.advance(1000);
  await s.close();
  assert.equal(clock.pending(), 0);
  const loaded = await Series.load(store, s.id, { clock });
  assert.equal(loaded.state.tick, openingTick);
  await clock.advance(5000);
  assert.equal(loaded.state.round, 4);
  assert.equal(loaded.state.towers['P1-7'].type, 'laser');
  assert.deepEqual(replaySeries(await store.readEvents(s.id)).mismatches, []);
  await loaded.close();
});

test('live slots: host restart and cancellation stop combat timers', async () => {
  for (const action of ['hostRestart', 'hostCancelSeries', 'hostCancelMatch', 'hostForfeit']) {
    const { series: s, clock } = await liveGame();
    await s[action]('P2');
    assert.equal(clock.pending(), 0, action);
    const state = JSON.stringify(s.state);
    await clock.advance(10_000);
    assert.equal(JSON.stringify(s.state), state);
  }
});

test('joining: seats in order, names checked, third player rejected, rejoin keeps the seat', async () => {
  const { store } = tempStore();
  const s = await Series.create(store, { clock: fakeClock() });
  assert.equal((await s.join('alice', 'bad/name')).ok, false);
  assert.deepEqual(await s.join('alice', 'Claude Code'), { ok: true, seat: 'P1', name: 'Claude Code' });
  assert.equal((await s.join('alice', 'Other Name')).seat, 'P1'); // same identity: same seat, name kept
  assert.equal(s.record.seats.P1.name, 'Claude Code');
  assert.equal((await s.join('bob', 'Codex')).seat, 'P2');
  assert.equal(s.phase, 'waiting_for_start');
  assert.match((await s.join('carol', 'Third')).error, /already has two players/);
});

test('start screen: agents only join; the host starts optional warm-up, then match 1', async () => {
  const { store } = tempStore();
  const s = await Series.create(store, { clock: fakeClock(), overrides: { 'series.warmupRounds': 3 } });
  await s.join('alice', 'A');
  assert.match((await s.hostStart()).error, /both players must join/);
  await s.join('bob', 'B');
  assert.equal(s.phase, 'waiting_for_start');
  assert.match((await s.ready('alice', 1)).error, /nothing to be ready for/);
  const view = playerView(s, 'P1');
  assert.equal(view.next.do, 'wait');
  assert.match(view.next.why, /host to press Start/);
  assert.equal((await s.hostStart()).ok, true);
  assert.equal(s.phase, 'warmup');
  assert.equal(s.state.match, 0);
  assert.match((await s.hostStart()).error, /already started/);
});

test('warm-up sets the shared deadline to 2× the slower agent, at least 60 s', async () => {
  const clock = fakeClock();
  const { series } = await seatedSeries({ clock, overrides: { 'series.warmupRounds': 3 } });
  await readyBoth(series, 1);
  for (let i = 0; i < 3; i++) {
    await clock.advance(10_000); await empty(series, 'alice'); // alice: 10 s per round
    await clock.advance(30_000); await empty(series, 'bob'); // bob: 40 s per round
  }
  assert.equal(series.phase, 'awaiting_actions');
  assert.equal(series.state.match, 1);
  assert.equal(series.record.deadlineSeconds, 80);
  const fast = await seatedSeries({ overrides: { 'series.warmupRounds': 3 } });
  await readyBoth(fast.series, 1);
  for (let i = 0; i < 3; i++) { await empty(fast.series, 'alice'); await empty(fast.series, 'bob'); }
  assert.equal(fast.series.record.deadlineSeconds, 60);
});

test('waits indefinitely when the deadline is off: nothing moves until both submit', async () => {
  const clock = fakeClock();
  const { series } = await seatedSeries({ clock, overrides: { 'series.deadline.mode': 'off', 'series.warmupRounds': 0 } });
  await readyBoth(series, 1);
  await empty(series, 'alice');
  const before = JSON.stringify(series.state);
  await clock.advance(7 * 24 * 3600 * 1000);
  assert.equal(JSON.stringify(series.state), before);
  assert.deepEqual(playerView(series, 'P1').waiting_on, ['P2']);
  await empty(series, 'bob');
  assert.equal(series.state.round, 2);
});

test('opening deadline: missing both opening rounds can forfeit with a two-miss limit', async () => {
  const clock = fakeClock();
  const { series } = await seatedSeries({ clock, overrides: { 'series.deadline.mode': 'fixed', 'series.deadline.fixedSeconds': 60, 'series.warmupRounds': 0, 'series.maxMisses': 2 } });
  await readyBoth(series, 1);
  assert.equal(series.record.deadlineSeconds, 60);
  for (let i = 1; i <= 1; i++) {
    await empty(series, 'alice');
    await clock.advance(60_000);
    assert.equal(series.record.misses.P2, i);
    assert.equal(series.state.round, i + 1);
  }
  await empty(series, 'alice');
  await clock.advance(60_000);
  assert.equal(series.phase, 'strategy_review');
  assert.deepEqual(series.record.history[0].reason, 'deadline_forfeit');
  assert.equal(series.record.wins.P1, 1);
});

test('submissions: locked once, stale rounds rejected, invalid bundles change nothing', async () => {
  const { series } = await seatedSeries({ overrides: { 'series.warmupRounds': 0 } });
  await readyBoth(series, 1);
  const r = { match: 1, round: 1 };
  const bad = await series.submit('alice', { ...r, actions: [{ type: 'build', slot: 'P2-1', tower: 'laser' }] });
  assert.equal(bad.ok, false);
  assert.equal(bad.rejected[0].index, 0);
  assert.equal(series.record.round.pending.P1, null);
  assert.equal((await series.submit('alice', { ...r, actions: [] })).ok, true);
  assert.match((await series.submit('alice', { ...r, actions: [] })).error, /already locked/);
  assert.match((await series.submit('bob', { match: 1, round: 2, actions: [] })).error, /stale/);
  assert.match((await series.submit('carol', { ...r, actions: [] })).error, /not in this series/);
});

test('hidden decisions: a locked bundle is invisible to the opponent and spectators', async () => {
  const { series } = await seatedSeries({ overrides: { 'series.warmupRounds': 0 } });
  await readyBoth(series, 1);
  await series.submit('alice', { match: 1, round: 1, actions: [{ type: 'send', units: [{ type: 'scarab', count: 7 }] }] });
  for (const view of [playerView(series, 'P2'), playerView(series, 'P1'), spectatorView(series)]) {
    const json = JSON.stringify(view);
    assert.ok(!json.includes('"units"'), 'pending bundle leaked');
    assert.ok(!JSON.stringify(view.attackers).includes('scarab'), 'pending purchase appeared as alive or queued');
    assert.equal(view.players.P1.submitted, true);
  }
  await series.submit('bob', { match: 1, round: 1, actions: [] });
  assert.deepEqual(playerView(series, 'P2').last_round.P1, [{ type: 'send', units: [{ type: 'scarab', count: 7 }] }]);
});

test('idempotency: same request id + payload returns the first answer; a different payload is rejected', async () => {
  const { series } = await seatedSeries({ overrides: { 'series.warmupRounds': 0 } });
  await readyBoth(series, 1);
  const payload = { match: 1, round: 1, actions: [{ type: 'send', units: [{ type: 'crawler', count: 2 }] }] };
  const first = await series.request('alice', 'req-1', payload, async () => await series.submit('alice', payload));
  const again = await series.request('alice', 'req-1', payload, async () => await series.submit('alice', payload));
  assert.deepEqual(again, first);
  await series.submit('bob', { match: 1, round: 1, actions: [] });
  assert.equal(series.state.players.P1.gold, 400 - 40 + 100); // charged once, then income
  const other = await series.request('alice', 'req-1', { ...payload, actions: [] }, () => assert.fail('must not run'));
  assert.match(other.error, /already used/);
  assert.equal((await series.request('alice', null, payload, () => assert.fail())).ok, false);
});

test('strategy review: report for both, ready per match, then the next match', async () => {
  const { series } = await seatedSeries({ overrides: { 'series.warmupRounds': 0, 'match.maxRounds': 2 } });
  await readyBoth(series, 1);
  for (let i = 0; i < 2; i++) { await empty(series, 'alice'); await empty(series, 'bob'); }
  assert.equal(series.phase, 'strategy_review');
  assert.equal(series.record.draws, 1); // 20–20 at the round limit
  const view = playerView(series, 'P1');
  assert.equal(view.report.result, 'draw');
  assert.equal(view.report.history.length, 2);
  assert.equal(view.next.do, 'ready');
  assert.equal(view.next.args.for_match, 2);
  assert.match((await series.ready('alice', 1)).error, /must be for match 2/);
  await readyBoth(series, 2);
  assert.equal(series.phase, 'awaiting_actions');
  assert.equal(series.state.match, 2);
  assert.equal(series.state.players.P1.gold, 400); // everything reset
});

test('draws: three plain draws, then tiebreak matches decided by kills', async () => {
  const { series } = await seatedSeries({ overrides: { 'series.warmupRounds': 0, 'match.maxRounds': 2 } });
  for (let m = 1; m <= 3; m++) {
    await readyBoth(series, m);
    for (let i = 0; i < 2; i++) { await empty(series, 'alice'); await empty(series, 'bob'); }
  }
  assert.equal(series.record.draws, 3);
  await readyBoth(series, 4);
  assert.equal(series.record.tiebreakMatch, true);
  // P2 sends a runner into P1's laser in the middle: P1 gets a kill, bases stay 20–20.
  await series.submit('alice', { match: 4, round: 1, actions: [{ type: 'build', slot: 'P1-7', tower: 'laser' }] });
  await series.submit('bob', { match: 4, round: 1, actions: [{ type: 'send', units: [{ type: 'runner', count: 1 }] }] });
  await empty(series, 'alice'); await empty(series, 'bob');
  const last = series.record.history.at(-1);
  assert.equal(last.result, 'win');
  assert.equal(last.winner, 'P1');
  assert.equal(last.decidedBy, 'tiebreak_kills');
  assert.equal(series.record.wins.P1, 1);
});

test('host controls: forfeit, cancel match (void), cancel series', async () => {
  const { series } = await seatedSeries({ overrides: { 'series.warmupRounds': 0 } });
  await readyBoth(series, 1);
  assert.equal((await series.hostForfeit('P2')).ok, true);
  assert.equal(series.record.wins.P1, 1);
  await readyBoth(series, 2);
  assert.equal((await series.hostCancelMatch()).ok, true);
  assert.equal(series.record.history.at(-1).result, 'void');
  assert.deepEqual(series.record.wins, { P1: 1, P2: 0 });
  assert.equal(series.record.draws, 0);
  assert.equal((await series.hostCancelSeries()).ok, true);
  assert.equal(series.phase, 'cancelled');
  assert.equal(playerView(series, 'P1').next.do, 'stop');
});

test('restart recovery mid-round keeps the pending bundle and the waiting status', async () => {
  const { store, dir } = tempStore();
  const clock = fakeClock();
  const { series } = await seatedSeries({ store, clock, overrides: { 'series.warmupRounds': 0 } });
  await readyBoth(series, 1);
  await series.submit('alice', { match: 1, round: 1, actions: [{ type: 'build', slot: 'P1-5', tower: 'plasma' }] });
  await series.close();

  const reloaded = await Series.load(new Store(dir), series.id, { clock });
  assert.equal(reloaded.phase, 'awaiting_actions');
  assert.deepEqual(reloaded.record.round.pending.P1, [{ type: 'build', slot: 'P1-5', tower: 'plasma' }]);
  assert.deepEqual(playerView(reloaded, 'P2').waiting_on, ['P2']);
  await reloaded.submit('bob', { match: 1, round: 1, actions: [] });
  assert.equal(reloaded.state.towers['P1-5'].type, 'plasma');
  assert.equal(reloaded.state.round, 2);
});

test('full best-of-seven with bots: finishes at 4 wins and replays hash-for-hash', async () => {
  const clock = fakeClock();
  const { series, store } = await seatedSeries({ clock });
  await playOut(series, { clock, P1: 'turtle', P2: 'rusher' });
  const r = series.record;
  assert.equal(r.phase, 'series_finished');
  assert.equal(Math.max(r.wins.P1, r.wins.P2), 4);
  assert.ok(r.history.length >= 4);
  const replay = replaySeries(await store.readEvents(series.id));
  assert.ok(replay.rounds > 0);
  assert.deepEqual(replay.mismatches, []);
  // nothing private in the public log
  assert.ok((await store.readEvents(series.id)).every((e) => !e.private));
});

test('several series on one server stay independent', async () => {
  const { store } = tempStore();
  const m = new SeriesManager(store, { clock: fakeClock() });
  const a = await m.create({});
  const b = await m.create({ 'economy.startingGold': 999 });
  await a.join('alice', 'A'); await b.join('alice', 'A2'); await b.join('bob', 'B');
  assert.equal(a.phase, 'waiting_for_players');
  assert.equal(b.phase, 'waiting_for_start');
  assert.deepEqual(m.forPlayer('bob').map((s) => s.id), [b.id]);
  assert.equal(b.record.settings.economy.startingGold, 999);
  assert.equal(a.record.settings.economy.startingGold, 400);
  const m2 = new SeriesManager(store, { clock: fakeClock() });
  assert.equal(await m2.recoverAll(), 2);
});

test('host restart: back to the start screen, agents join again, Start again; replay still checks out', async () => {
  const clock = fakeClock();
  const { series, store } = await seatedSeries({ clock, overrides: { 'series.warmupRounds': 0, 'match.maxRounds': 40 } });
  await series.hostStart();
  await series.submit('alice', { match: 1, round: 1, actions: [{ type: 'build', slot: 'P1-5', tower: 'laser' }] });
  await series.submit('bob', { match: 1, round: 1, actions: [] });
  assert.equal((await series.hostRestart()).ok, true);
  assert.equal(series.phase, 'waiting_for_players');
  assert.deepEqual(series.record.seats, { P1: null, P2: null });
  assert.deepEqual(series.record.wins, { P1: 0, P2: 0 });
  assert.equal(playerView(series, null).next.do, 'join');
  assert.equal(playerView(series, null).towers, undefined); // no board until the new game starts
  await series.join('bob', 'Bob again'); // seats go by join order again
  await series.join('alice', 'Alice again');
  assert.equal(series.record.seats.P1.name, 'Bob again');
  await series.hostStart();
  assert.equal(series.state.match, 1);
  assert.equal(series.state.round, 1);
  await playOut(series, { clock });
  assert.equal(series.phase, 'series_finished');
  assert.deepEqual(replaySeries(await store.readEvents(series.id)).mismatches, []);
});
