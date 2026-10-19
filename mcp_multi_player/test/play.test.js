// The spectator playback contract (src/web/public/play.js): waves play in real time, turns
// that pile up speed up instead of being skipped, and clear() (used when switching between
// live and replay) drops queued turns and stops the running one without drawing it again.
// Runs in Node with a fake frame scheduler; the page itself is checked by watching.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../src/web/public/play.js';

const layout = { path: [{ x: 0, y: 0 }, { x: 100, y: 0 }], towers: { laser: { instant: true } } };

/** A player whose frames run only when the test steps the fake clock. */
function harness() {
  let now = 0, pending = [];
  const drawn = [];
  const player = createPlayer({
    layout, ctxs: { P1: 'c1', P2: 'c2' }, ticksPerTurn: 300, waveSeconds: 30,
    drawBoard: (ctx, lay, board, seat) => drawn.push({ seat, label: board?.label }),
    frame: (fn) => pending.push(fn), now: () => now,
  });
  const step = async (ms) => {
    now += ms;
    const due = pending; pending = [];
    for (const fn of due) fn(now);
    await new Promise((r) => setImmediate(r));
  };
  return { player, drawn, step };
}

const turn = (label) => ({ events: [], frames: { P1: [{ units: [], label }], P2: [{ units: [], label }] }, render: { boards: { P1: { label, units: [] }, P2: { label, units: [] } } } });

test('a wave plays in real time: its play() resolves after the wave length, not before', async () => {
  const { player, step } = harness();
  let done = false;
  player.play(turn('w1')).then(() => { done = true; });
  await step(0);
  await step(29_000);
  assert.equal(done, false);
  await step(1_000);
  await step(0);
  assert.equal(done, true);
});

test('clear() drops queued turns and stops the running one without drawing it again', async () => {
  const { player, drawn, step } = harness();
  const results = [];
  for (const label of ['w1', 'w2']) player.play(turn(label)).then(() => results.push(label));
  await step(0);
  await step(1_000);
  player.clear();
  const before = drawn.length;
  await step(1_000);
  await step(1_000);
  assert.deepEqual(results.sort(), ['w1', 'w2'], 'both play() promises resolve');
  assert.equal(drawn.length, before, 'nothing from before clear() is drawn after it');
  assert.ok(!drawn.some((d) => d.label === 'w2'), 'the queued turn never played');
});

test('turns that pile up play faster instead of being skipped', async () => {
  const { player, drawn, step } = harness();
  const results = [];
  for (const label of ['w1', 'w2', 'w3']) player.play(turn(label)).then(() => results.push(label));
  await step(0);
  // w1 runs at 2x while two turns wait behind it (half again per waiting turn): 15 s, not 30 s.
  await step(14_000); await step(0);
  assert.deepEqual(results, [], 'not skipped or rushed');
  await step(1_000); await step(0);
  assert.deepEqual(results, ['w1']);
  assert.ok(drawn.some((d) => d.label === 'w2'), 'the next turn is animating, not skipped');
});

test('live, a wave stretches to the time turns really take, so the screen does not freeze between them', async () => {
  const { player, step } = harness();
  // Turns arrive every 50 s while the pace is 30 s: the player learns the gap.
  player.noteArrival(); await step(50_000); player.noteArrival();
  let done = false;
  player.play(turn('w2')).then(() => { done = true; });
  await step(0);
  await step(40_000); await step(0);
  assert.equal(done, false, 'still playing after the 30 s pace: it is stretched to the turn gap');
  await step(20_000); await step(0);
  assert.equal(done, true);
});
