// The agents' entrance (spec §10): five tools on a stateless MCP endpoint. The SDK builds a
// fresh McpServer for every HTTP request, so nothing lives here between calls. Every agent uses
// the same address and the same prompt: `join` hands out a free seat and a player id, and every
// reply carries that id in next.args, so an agent following `next` always calls as itself. The
// series is always the one open series (or, when none is open, the last one, to report its end).

import { readFileSync } from 'node:fs';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { rulesInput, joinInput, stateInput, actInput, readyInput, replyOutput } from './schemas.js';
import { seatReply, rulesReply, cursorOf } from './format.js';
import { loadLevel } from '../config/load.js';

const MAX_WAIT_S = 25; // stays under the ~60 s first-byte limits of Claude Code, Codex and SDK clients
const MANUAL = readFileSync(new URL('../../docs/manual.md', import.meta.url), 'utf8');

// Sent to the client when it connects. Kept short on purpose: clients cut long instructions
// off, so the numbers live in the `rules` tool, which is never cut.
const INSTRUCTIONS = [
  'mcp_multi_player: a tower defense race against another AI agent. You defend your own copy of the board; the other agent gets identical waves on its copy.',
  '1. Call `rules` first and read all of it: the map, how health and leaks work, how damage is worked out, every number. Take your time; nothing starts until the host presses Start.',
  '2. Call `join` with the name of the model you are (e.g. "Claude Opus 5.5") and understood: true. It gives you a player id.',
  '3. From then on do exactly what the `next` field of each reply says, with its args (they include your player id): `state` to wait, `act` before each wave, `ready` between matches, until it says stop.',
  'Think about every move yourself; never script the game. Do not stop to ask your user between turns.',
].join('\n');

let fallbackLevel = null;
const defaultLevel = () => (fallbackLevel ??= loadLevel('normal'));

export function createMcpEndpoint({ lobby }) {
  return createMcpHandler(() => buildServer(lobby));
}

function buildServer(lobby) {
  const series = () => lobby.openSeries() ?? lobby.latestSeries();
  const levelNow = () => series()?.level ?? defaultLevel();
  const server = new McpServer({ name: 'mcp-multi-player', version: '2.1.0' }, { instructions: INSTRUCTIONS });
  /** The caller, from the player id it passes; null before it has joined. */
  const whoIs = (playerId) => {
    if (!playerId) return null;
    return { seat: series()?.seatOf(playerId) ?? null, playerId };
  };

  server.registerTool('rules', {
    title: 'Rules, numbers and the board',
    description: 'The manual (how a turn works, every tool, how to win), this series\' tower and attacker numbers, and the board with how much path each slot covers. Read this first.',
    inputSchema: rulesInput, outputSchema: replyOutput, annotations: { readOnlyHint: true },
  }, async () => reply(rulesReply(series(), null, MANUAL, levelNow())));

  server.registerTool('join', {
    title: 'Join the game',
    description: 'Joins the open series as the model you are (e.g. "Claude Opus 5.5"), after you have read `rules` (understood: true). Gives you a player id: pass it in every later call (it is in next.args of every reply). After an interruption, join again with your player id to get your place back. The game starts when the host presses Start.',
    inputSchema: joinInput, outputSchema: replyOutput,
  }, async ({ name, player }) => {
    if (!series()) return failure(null, null, { code: 'no_series', message: 'no series is open yet; the host creates one on the dashboard' });
    const res = await series().join({ name, playerId: player ?? null });
    if (!res.ok) return failure(series(), whoIs(player), res);
    const you = `Your player id is ${res.playerId}. Pass "player": "${res.playerId}" in every call from now on (next.args always has it).`;
    // The rules are not repeated here: join requires understood: true, so the agent has read them.
    const message = res.status === 'rejoined' ? `Welcome back, ${res.name}. ${you}` : `Joined as ${res.name}. ${you} The rules you read in \`rules\` apply; call it again any time.`;
    return reply(await seatReply(series(), { seat: res.seat, playerId: res.playerId }, { message }));
  });

  server.registerTool('state', {
    title: 'Your board and the next step',
    description: 'Your board, last wave, enemies on your board, what you can build, and the next step. With since (the cursor from your last reply) and wait_s (max 25) it waits until something changes; if nothing did, call it again. You never see the other player\'s board during a match.',
    inputSchema: stateInput, outputSchema: replyOutput, annotations: { readOnlyHint: true },
  }, async ({ player, since, wait_s }, ctx) => {
    if (since && wait_s) await waitForChange(lobby, series, since, Math.min(wait_s, MAX_WAIT_S) * 1000, ctx?.mcpReq?.signal);
    return reply(await seatReply(series(), whoIs(player), { changed: !since || cursorOf(series()) !== since }));
  });

  server.registerTool('act', {
    title: 'Submit your actions for the coming wave',
    description: 'Your actions for the coming wave, in order: build {slot, tower}, upgrade {slot, stat: damage|rate|range}, target {slot, rule}. An empty list saves gold. for_version comes from next.args; use a new request_id each time. Moves lock once accepted. If rejected, the reply says why and what is legal.',
    inputSchema: actInput, outputSchema: replyOutput,
  }, async ({ player, for_version, request_id, actions }) => {
    const who = whoIs(player), match = series()?.currentMatch();
    if (!who?.seat) return failure(series(), who, { code: 'unknown_player', message: 'that player id is not in this series; follow next' });
    if (!match) return failure(series(), who, { code: 'no_match', message: 'no match is running; follow next' });
    const res = await match.submit({ seat: who.seat, forVersion: for_version, requestId: request_id, actions });
    if (!res.ok) return failure(series(), who, res);
    return reply(await seatReply(series(), who, { message: res.status === 'duplicate' ? 'Already accepted (same request_id).' : 'Your actions are locked in for the coming wave.' }));
  });

  server.registerTool('ready', {
    title: 'Ready for the next match',
    description: 'Between matches: confirms you are ready for match for_match (from next.args). The next match starts when both players are ready, or automatically after a while.',
    inputSchema: readyInput, outputSchema: replyOutput,
  }, async ({ player, for_match }) => {
    const who = whoIs(player);
    if (!series()) return failure(null, null, { code: 'no_series', message: 'no series is open' });
    if (!who?.seat) return failure(series(), who, { code: 'unknown_player', message: 'that player id is not in this series; follow next' });
    const res = await series().ready({ seat: who.seat, forMatch: for_match });
    return res.ok ? reply(await seatReply(series(), who, { message: `Ready for match ${for_match}.` })) : failure(series(), who, res);
  });

  return server;
}

/** Waits until the cursor moves away from `since` (a new series counts), for at most `ms`. */
function waitForChange(lobby, current, since, ms, signal) {
  return new Promise((resolve) => {
    if (cursorOf(current()) !== since || signal?.aborted) return resolve();
    let seriesOff = null, matchOff = null;
    const watch = () => {
      seriesOff?.(); matchOff?.();
      seriesOff = current()?.subscribe(check) ?? null;
      matchOff = current()?.currentMatch()?.subscribe(check) ?? null;
    };
    const finish = () => {
      clearTimeout(timer); lobbyOff(); seriesOff?.(); matchOff?.();
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    function check(msg) {
      if (msg?.type === 'match_start' || msg?.type === 'series_created') watch();
      if (cursorOf(current()) !== since) finish();
    }
    const lobbyOff = lobby.subscribe(check);
    watch();
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

function reply({ data, text }) {
  return { content: [{ type: 'text', text }], structuredContent: data };
}

async function failure(series, who, res) {
  const { data } = await seatReply(series ?? null, who ?? null);
  const body = { ok: false, code: res.code, message: res.message, ...(res.legal ? { legal: res.legal } : {}), current_version: res.current_version ?? data.version, cursor: data.cursor, next: data.next };
  const text = `Not done: ${res.message} (${res.code}).${res.legal ? ` You have ${res.legal.gold} gold; free slots: ${res.legal.build.slots.join(' ') || 'none'}.` : ''}\nNext: ${data.next.tool}${data.next.args ? ' ' + JSON.stringify(data.next.args) : ''}. ${data.next.why}`;
  return { content: [{ type: 'text', text }], structuredContent: body, isError: true };
}
