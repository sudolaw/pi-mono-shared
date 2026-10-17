#!/usr/bin/env node
// Balance check (build ticket #29): many bot-vs-bot matches in-process with randomised
// strategy parameters, then a table of what happened. Uses the real series code with a
// fake clock and a throwaway data folder.
//
//   npm run balance -- [--matches 12] [--seed 1] [--set key=value ...]
// --set overrides a setting for a what-if run, e.g. --set attackers.runner.speed=140

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store/files.js';
import { Series } from '../src/series/series.js';
import { playerView } from '../src/series/views.js';
import { makeStrategy } from '../src/bots/strategies.js';
import { attackerStats } from '../src/config.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const perPair = Number(opt('matches', 12));
let seed = Number(opt('seed', 1));
const overrides = { 'series.warmupRounds': 0, 'series.winsNeeded': 1, 'series.deadline.mode': 'off' };
args.forEach((a, i) => { if (a === '--set') { const [k, v] = args[i + 1].split('='); overrides[k] = Number(v); } });

// small deterministic PRNG (mulberry32)
const rngFrom = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmp-balance-'));
const store = new Store(dir);
// Run the real slot scheduler on virtual time rather than waiting for wall-clock combat.
let now = 0;
const timers = new Set();
const clock = {
  now: () => now,
  setTimeout: (fn, ms) => { const h = { fn, at: now + ms }; timers.add(h); return h; },
  clearTimeout: (h) => timers.delete(h),
  advance: async (ms) => {
    const end = now + ms;
    for (;;) {
      const h = [...timers].sort((a, b) => a.at - b.at)[0];
      if (!h || h.at > end) break;
      now = h.at; timers.delete(h); await h.fn();
    }
    now = end;
  },
};
const styles = ['turtle', 'rusher', 'balanced'];
const results = [];

for (const a of styles) for (const b of styles) for (let k = 0; k < perPair; k++) {
  const s = await Series.create(store, { overrides, clock });
  await s.join('p1', a); await s.join('p2', b); await s.hostStart();
  const strat = { P1: makeStrategy(a, rngFrom(seed++)), P2: makeStrategy(b, rngFrom(seed++)) };
  const ids = { P1: 'p1', P2: 'p2' };
  while (s.phase === 'awaiting_actions') {
    for (const seat of ['P1', 'P2']) {
      if (s.phase !== 'awaiting_actions' || s.record.round.pending[seat]) continue;
      const obs = playerView(s, seat);
      const r = await s.submit(ids[seat], { match: s.state.match, round: s.state.round, actions: strat[seat](obs, s.record.settings) });
      if (!r.ok) throw new Error(JSON.stringify(r));
    }
    if (s.isLiveRound()) await clock.advance(s.record.round.openedAt + s.record.settings.match.roundSeconds * 1000 - clock.now());
  }
  const h = s.record.history[0];
  const attackerGold = {};
  for (const event of await store.readEvents(s.id)) {
    if (event.type !== 'round_resolved') continue;
    for (const bundle of Object.values(event.payload.bundles)) for (const action of bundle ?? []) {
      if (action.type !== 'send') continue;
      for (const unit of action.units) attackerGold[unit.type] = (attackerGold[unit.type] ?? 0) + attackerStats(s.record.settings, unit.type, event.round).price * unit.count;
    }
  }
  results.push({ a, b, h, state: s.state, attackerGold });
}
fs.rmSync(dir, { recursive: true, force: true });

// ── report ──
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const lens = results.map((r) => r.h.rounds).sort((x, y) => x - y);
const q = (p) => lens[Math.floor(p * (lens.length - 1))];
const draws = results.filter((r) => r.h.result === 'draw').length;
const limit = results.filter((r) => r.h.reason === 'round_limit').length;
console.log(`\n${results.length} matches (${perPair} per pairing, randomised parameters)\n`);
console.log(`Match length (rounds): min ${lens[0]} · 25% ${q(0.25)} · median ${q(0.5)} · 75% ${q(0.75)} · max ${lens.at(-1)}`);
console.log(`Draws ${pct(draws, results.length)} · decided at the round limit ${pct(limit, results.length)}\n`);

console.log('Win rate by pairing (row style as P1 vs column style as P2):');
console.log(['', ...styles].map((x) => x.padEnd(10)).join(''));
for (const a of styles) {
  console.log([a, ...styles.map((b) => {
    const rs = results.filter((r) => r.a === a && r.b === b);
    return pct(rs.filter((r) => r.h.winner === 'P1').length, rs.length);
  })].map((x) => x.padEnd(10)).join(''));
}
const seatWins = { P1: results.filter((r) => r.h.winner === 'P1').length, P2: results.filter((r) => r.h.winner === 'P2').length };
console.log(`\nSeat check: P1 won ${seatWins.P1}, P2 won ${seatWins.P2} (should be close; mirror pairings in particular)\n`);

// towers: damage and kills per gold invested, by type; and per slot number
const tower = {}; const slot = {};
for (const { state, h } of results) {
  for (const t of Object.values(state.towers)) {
    const cfgT = h && t; // final towers of the match
    const lv = [0, 1, 2].slice(0, t.level);
    const def = { laser: [100, 75, 150], plasma: [125, 90, 175], cryo: [90, 65, 130] }[t.type];
    const gold = lv.reduce((s, i) => s + def[i], 0);
    const x = (tower[t.type] ??= { n: 0, gold: 0, dmg: 0, kills: 0 });
    x.n++; x.gold += gold; x.dmg += t.damage; x.kills += t.kills;
    const n = t.slot.split('-')[1];
    const y = (slot[n] ??= { n: 0, dmg: 0 });
    y.n++; y.dmg += t.damage;
  }
}
console.log('Towers (final towers of every match):');
for (const [type, x] of Object.entries(tower)) console.log(`  ${type.padEnd(7)} built ${String(x.n).padStart(4)} · damage per gold ${(x.dmg / x.gold).toFixed(1).padStart(5)} · kills per 100 gold ${((100 * x.kills) / x.gold).toFixed(1)}`);
console.log('Slots (average damage of a tower there; 1–5 own third, 6–9 middle):');
console.log('  ' + Object.keys(slot).sort().map((n) => `#${n} ${Math.round(slot[n].dmg / slot[n].n)}`).join(' · '));

// attackers: what share reached the base, and base damage per 100 gold
const att = {};
for (const { state } of results) for (const seat of ['P1', 'P2']) for (const [type, o] of Object.entries(state.players[seat].sent)) {
  const x = (att[type] ??= { sent: 0, reached: 0, killed: 0, gold: 0 });
  x.sent += o.sent; x.reached += o.reached; x.killed += o.killed;
}
for (const { attackerGold } of results) for (const [type, gold] of Object.entries(attackerGold)) att[type].gold += gold;
console.log('\nAttackers:');
for (const [type, x] of Object.entries(att)) console.log(`  ${type.padEnd(8)} sent ${String(x.sent).padStart(6)} · reached base ${pct(x.reached, x.sent).padStart(4)} · base damage per 100 gold ${(x.gold ? (100 * x.reached) / x.gold : 0).toFixed(2)}`);
console.log('');
