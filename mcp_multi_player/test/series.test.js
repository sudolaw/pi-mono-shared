// Series and lobby check worth automating (spec §14): two scripted players play a series to
// a winner through the lobby, a restart between matches keeps the score, only one series is
// open at a time, and a new series can open once the last is done.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as engine from '../src/engine/index.js';
import { createStore } from '../src/store/index.js';
import { createFakeClock } from '../src/shared/clock.js';
import { createLobby } from '../src/lobby/index.js';
import { STRATEGIES } from '../scripts/strategies.js';

const settle = () => new Promise((r) => setTimeout(r, 5));
const plays = { P1: STRATEGIES.balanced, P2: STRATEGIES.cannon_cryo };

/** Plays until the series phase is in `stopAt` (or done). */
async function drive(lobby, stopAt = []) {
  for (let guard = 0; guard < 5000; guard++) {
    const series = lobby.openSeries();
    if (!series) return;
    const st = series.status();
    if (stopAt.includes(st.phase)) return;
    if (st.phase === 'between') {
      for (const seat of ['P1', 'P2']) await series.ready({ seat, forMatch: st.match + 1 });
    } else if (st.phase === 'in_match') {
      const match = series.currentMatch();
      for (const seat of ['P1', 'P2']) {
        const { view, version, status } = await match.getView({ seat });
        if (status.phase !== 'collecting' || status.submitted[seat]) continue;
        await match.submit({ seat, forVersion: version, requestId: `${seat}-${st.match}-${version}`, actions: plays[seat](view, series.level) });
      }
    }
    await settle();
  }
  throw new Error('series did not finish');
}

test('a series plays to a winner, survives a restart between matches, then makes way for the next', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mmp-series-'));
  try {
    const store = createStore({ dataDir: dir, sync: false });
    const lobby = createLobby({ store, clock: createFakeClock(), engine, hostKey: 'k', gapS: 0 });
    assert.equal((await lobby.createSeries('wrong', { levelId: 'tutorial' })).code, 'forbidden');
    const { seriesId } = await lobby.createSeries('k', { levelId: 'tutorial', target: 2, paceS: 0 });
    assert.equal((await lobby.createSeries('k', { levelId: 'tutorial' })).code, 'series_open', 'one open series at a time');
    for (const seat of ['P1', 'P2']) {
      assert.equal((await lobby.openSeries().join({ name: `bot ${seat}` })).seat, seat, 'seats are handed out in order');
    }
    assert.equal(lobby.openSeries().status().phase, 'waiting', 'nothing starts until the host presses Start');
    assert.equal((await lobby.openSeries().start()).ok, true);
    await drive(lobby, ['between']);
    const before = lobby.get(seriesId).status();
    assert.equal(before.phase, 'between');
    assert.ok(before.warmup?.deadlineS >= 20, 'the warm-up set the time slot before match 1');

    const lobby2 = createLobby({ store: createStore({ dataDir: dir, sync: false }), clock: createFakeClock(), engine, hostKey: 'k', gapS: 0 });
    await lobby2.restore();
    assert.deepEqual(lobby2.get(seriesId).status().score, before.score);
    await drive(lobby2);

    const end = lobby2.get(seriesId).status();
    assert.equal(end.phase, 'done');
    assert.ok(end.winner === null || end.score[end.winner] === 2);
    assert.equal(lobby2.openSeries(), null);
    assert.ok((await lobby2.createSeries('k', { levelId: 'tutorial' })).ok, 'a new series can open once the last is done');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('join hands out seats and player ids, rejoins by id, turns away a third agent, and the host can remove a player', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mmp-seats-'));
  try {
    const lobby = createLobby({ store: createStore({ dataDir: dir, sync: false }), clock: createFakeClock(), engine, hostKey: 'k' });
    await lobby.createSeries('k', { levelId: 'tutorial', paceS: 0 });
    const series = lobby.openSeries();
    const first = await series.join({ name: 'Claude Opus 5.5' });
    const second = await series.join({ name: 'Claude Opus 5.5' });
    assert.deepEqual([first.seat, second.seat], ['P1', 'P2'], 'two agents may be the same model; each gets its own place');
    assert.notEqual(first.playerId, second.playerId);
    assert.equal((await series.join({ name: 'Codex Sol 6.1' })).code, 'series_full');
    const again = await series.join({ name: 'anything', playerId: second.playerId });
    assert.deepEqual([again.status, again.seat], ['rejoined', 'P2']);
    assert.equal(series.status().can_start, true);
    await series.leave('P2');
    assert.equal(series.wasRemoved(second.playerId), true);
    assert.equal(series.status().can_start, false, 'a removed player frees the seat before the start');
    assert.equal((await series.join({ name: 'Codex Sol 6.1' })).seat, 'P2');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
