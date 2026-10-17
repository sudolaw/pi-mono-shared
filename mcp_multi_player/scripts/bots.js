#!/usr/bin/env node
// Demo: two scripted agents play a series over the real MCP endpoint (SPEC.md §15).
//
//   npm run bots -- <series-id> [--url http://127.0.0.1:8787/mcp] [--p1 turtle] [--p2 rusher] [--think 300] [--host-key <key>]
//
// Creates (or refreshes) two bot players, bot-1 and bot-2, in the server's data directory,
// so the running server accepts them without a restart. Strategies: turtle, rusher, balanced.
// --think <ms> pauses before each move so the game is watchable live.
// The game starts when the host presses Start on the series page; with --host-key <key>
// the script presses it for you once both bots have joined.

import { Players } from '../src/mcp/auth.js';
import { defaultDataDir } from '../src/store/files.js';
import { playSeries } from '../src/bots/client.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const seriesId = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!seriesId) {
  console.error('usage: npm run bots -- <series-id> [--url …/mcp] [--p1 turtle] [--p2 rusher] [--think 300] [--data <dir>]');
  process.exit(2);
}
const mcpUrl = opt('url', 'http://127.0.0.1:8787/mcp');
const players = new Players(opt('data', defaultDataDir()));
const thinkMs = Number(opt('think', 300));

const bots = [
  { id: 'bot-1', strategy: opt('p1', 'turtle') },
  { id: 'bot-2', strategy: opt('p2', 'rusher') },
];
console.log(`Bots joining ${seriesId}: ${bots.map((b) => `${b.id} (${b.strategy})`).join(' vs ')}`);

const hostKey = opt('host-key');
const base = mcpUrl.replace(/\/mcp$/, '');
(async () => {
  // Wait until both bots are in, then start (or tell the human to).
  for (;;) {
    const view = await (await fetch(`${base}/api/series/${seriesId}`)).json();
    if (view.phase === 'waiting_for_start') break;
    if (view.phase !== 'waiting_for_players') return;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!hostKey) { console.log(`Both bots joined. Press ▶ Start game on ${base}/series/${seriesId}`); return; }
  const res = await fetch(`${base}/api/series/${seriesId}/host`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': hostKey }, body: JSON.stringify({ action: 'start' }) });
  console.log(res.ok ? 'Both bots joined; game started.' : `Could not start: ${(await res.json()).error}`);
})();

let lastLine = '';
const results = await Promise.all(bots.map((b) => playSeries({
  mcpUrl,
  token: players.add(b.id),
  seriesId,
  name: `${b.strategy} bot`,
  strategy: b.strategy,
  thinkMs,
  onStep: (obs) => {
    const line = `match ${obs.match} · ${obs.phase}${obs.round ? ` · round ${obs.round}` : ''} · series ${obs.series.wins.P1}–${obs.series.wins.P2}`;
    if (b.id === 'bot-1' && line !== lastLine) { lastLine = line; process.stdout.write(`\r${line.padEnd(70)}`); }
  },
})));
const end = results[0];
console.log(`\n${end.result ? `Series over: ${end.result.winnerName} (${end.result.winner}) won ${end.result.wins.P1}–${end.result.wins.P2}` : `Stopped in phase ${end.phase}`}`);
