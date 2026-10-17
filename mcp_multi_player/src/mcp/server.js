// The MCP surface (SPEC.md §12): exactly four tools. The SDK builds a fresh McpServer for
// every HTTP request (stateless mode), so nothing lives here between calls: all game state
// is in the SeriesManager. The caller's identity comes only from the verified bearer token
// (authInfo.clientId), never from tool arguments.

import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { listGamesInput, manageMatchInput, getMatchInput, submitActionInput } from './schemas.js';
import { playerView } from '../series/views.js';
import { rulesFor } from './rules.js';

const MAX_WAIT_S = 25; // stays under the 60 s first-byte limits of Claude Code / Codex / SDK clients

/** mcpUrl is a function: the real URL is only known once the server is listening. */
export function createMcpEndpoint({ manager, mcpUrl }) {
  return createMcpHandler(({ authInfo }) => buildServer({ manager, mcpUrl, playerId: authInfo?.clientId ?? null }));
}

function buildServer({ manager, mcpUrl, playerId }) {
  const server = new McpServer({ name: 'mcp-multi-player', version: '0.1.0' });

  server.registerTool('list_games', {
    title: 'Rules, settings and action format',
    description: 'Returns the manual (how to connect, play loop, rules), the effective settings, the board (slots, pipes, zones) and the action format. Pass series_id to get that series\' settings. Read this before joining.',
    inputSchema: listGamesInput,
    annotations: { readOnlyHint: true },
  }, async ({ series_id }) => {
    const series = series_id ? manager.get(series_id) : null;
    if (series_id && !series) return fail(`no series ${series_id}`);
    return ok({
      game: 'Tower defense duel (mcp_multi_player)',
      series_id: series?.id ?? null,
      ...rulesFor({ mcpUrl: mcpUrl(), series }),
      next: series
        ? { do: 'join_or_continue', tool: 'get_match', args: { series_id: series.id }, why: 'Call get_match: its next field tells you whether to join, get ready or play.' }
        : { do: 'ask_user', why: 'Ask your user for the series id, then call list_games or get_match with it.' },
    });
  });

  server.registerTool('manage_match', {
    title: 'Join, get ready, leave or resign',
    description: 'operation "join" (with name) takes a free seat, then the host starts the game; "ready" (with for_match) marks you ready for the next match after a strategy review; "leave" frees your seat before the game starts; "resign" gives up the current match. Needs a new unique request_id.',
    inputSchema: manageMatchInput,
  }, async (args) => {
    const series = manager.get(args.series_id);
    if (!series) return fail(`no series ${args.series_id}`);
    const res = await series.request(playerId, args.request_id, args, async () => {
      switch (args.operation) {
        case 'join': {
          const joined = await series.join(playerId, args.name);
          if (joined.ok) joined.rules = rulesFor({ mcpUrl: mcpUrl(), series });
          return joined;
        }
        case 'ready': return args.for_match ? series.ready(playerId, args.for_match) : { ok: false, error: 'for_match is required for ready' };
        case 'leave': return series.leave(playerId);
        case 'resign': return series.resign(playerId);
        default: return { ok: false, error: 'unknown operation' };
      }
    });
    return withStatus(series, playerId, res);
  });

  server.registerTool('get_match', {
    title: 'Observe the series',
    description: 'Status, observation, last round, match report and the next step. With since_version and wait_s (≤ 25) it waits for a change, then returns; poll.changed=false means nothing happened yet: call again. Omit series_id to find your series.',
    inputSchema: getMatchInput,
    annotations: { readOnlyHint: true },
  }, async ({ series_id, since_version, wait_s, detail }, ctx) => {
    let series = series_id ? manager.get(series_id) : null;
    if (series_id && !series) return fail(`no series ${series_id}`);
    if (!series) {
      const mine = manager.forPlayer(playerId);
      const active = mine.filter((s) => !['series_finished', 'cancelled'].includes(s.phase));
      series = active[0] ?? mine[0] ?? null;
      if (!series) {
        return ok({ series: [], next: { do: 'ask_user', why: 'You are not in any series. Ask your user for the series id, then join it with manage_match.' } });
      }
    }
    await series.idle();
    let changed = true;
    if (since_version !== undefined && wait_s) {
      changed = await series.waitForChange(since_version, Math.min(wait_s, MAX_WAIT_S) * 1000, ctx?.mcpReq?.signal);
    }
    await series.idle();
    return ok(await series.read(() => playerView(series, series.seatOf(playerId), { detail, changed })));
  });

  server.registerTool('submit_action', {
    title: 'Submit your bundle for the open round',
    description: 'One hidden bundle for the current round/slot (match + round from next.args). Opening rounds wait for both players; from round 3 combat runs continuously, and orders apply together at each 5-second slot end. Missed live slots are empty, without forfeits. A stale slot requires get_match and replanning. Needs a new unique request_id.',
    inputSchema: submitActionInput,
  }, async (args) => {
    const series = manager.get(args.series_id);
    if (!series) return fail(`no series ${args.series_id}`);
    const res = await series.request(playerId, args.request_id, args, () => series.submit(playerId, { match: args.match, round: args.round, actions: args.actions }));
    return withStatus(series, playerId, res);
  });

  return server;
}

// Every mutation answer carries the status fields and the next step (SPEC.md §12).
async function withStatus(series, playerId, res) {
  const view = await series.read(() => playerView(series, series.seatOf(playerId)));
  const body = {
    ...res,
    series_id: series.id,
    match: view.match,
    phase: view.phase,
    round: view.round,
    state_version: view.state_version,
    next: view.next,
  };
  return res.ok ? ok(body) : fail(res.error, body);
}

function ok(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }], structuredContent: obj };
}

function fail(error, body = {}) {
  const obj = { ok: false, error, ...body };
  return { content: [{ type: 'text', text: JSON.stringify(obj) }], structuredContent: obj, isError: true };
}
