#!/usr/bin/env node
// Bot-vs-bot statistics for tuning a level (spec §2.4): many matches in-process (no server),
// every pairing of the scripted strategies, both seat orders. Reports when bases fall, win
// rates, draws and a seat check. Try other numbers with --set path=value.
//
//   npm run balance -- [--level normal] [--matches 6] [--set waves.hpGrowth=0.05 --set rules.income=50]

import { readFileSync } from 'node:fs';
import { prepareLevel } from '../src/config/load.js';
import * as engine from '../src/engine/index.js';
import { STRATEGIES } from './strategies.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));

export function levelWith(id, overrides = []) {
  const raw = JSON.parse(readFileSync(new URL(`../levels/${id}.json`, import.meta.url), 'utf8'));
  for (const s of overrides) {
    const [path, value] = s.split('=');
    const keys = path.split('.');
    let o = raw;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = JSON.parse(value);
  }
  return prepareLevel(raw);
}

export function playMatch(level, seed, s1, s2) {
  let state = engine.setup(level, seed);
  for (;;) {
    const actions = { P1: STRATEGIES[s1](engine.view(state, 'P1', level), level), P2: STRATEGIES[s2](engine.view(state, 'P2', level), level) };
    state = engine.apply(state, actions, level).state;
    const res = engine.outcome(state, level);
    if (res.over) return { ...res, wave: state.turn, health: [state.boards.P1.health, state.boards.P2.health] };
  }
}

const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

function main() {
  const level = levelWith(opt('level', 'normal'), sets);
  const n = Number(opt('matches', 6));
  const names = Object.keys(STRATEGIES);
  const wins = Object.fromEntries(names.map((a) => [a, Object.fromEntries(names.map((b) => [b, 0]))]));
  const ends = [];
  let draws = 0, seat = { P1: 0, P2: 0 }, games = 0;
  const t0 = performance.now();
  for (const a of names) for (const b of names) for (let i = 0; i < n; i++) {
    const r = playMatch(level, 1000 + i, a, b);
    games++; ends.push(r.wave);
    if (!r.winner) draws++;
    else { seat[r.winner]++; if (r.winner === 'P1') wins[a][b]++; }
  }
  console.log(`Level ${level.id}${sets.length ? ` with ${sets.join(', ')}` : ''}: ${games} matches in ${Math.round(performance.now() - t0)} ms`);
  console.log(`Match ends at wave: min ${Math.min(...ends)} · 25% ${q(ends, 0.25)} · median ${q(ends, 0.5)} · 75% ${q(ends, 0.75)} · max ${Math.max(...ends)} (of ${level.waves.count})`);
  console.log(`Draws ${draws} · reached the last wave ${ends.filter((w) => w >= level.waves.count).length} · seat check P1 ${seat.P1} / P2 ${seat.P2}`);
  console.log('\nP1 win rate (row = P1 strategy, column = P2 strategy):');
  console.log('              ' + names.map((x) => x.padStart(12)).join(''));
  for (const a of names) console.log(a.padEnd(14) + names.map((b) => `${Math.round((100 * wins[a][b]) / n)}%`.padStart(12)).join(''));
}

if (process.argv[1]?.endsWith('balance.js')) main();
