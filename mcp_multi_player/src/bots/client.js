// A scripted agent that plays over the real MCP endpoint, exactly like Claude Code or Codex
// would: list_games → join → ready → loop on get_match following `next`. Used by
// `npm run bots`, the end-to-end test and demos. No model calls.

import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { STRATEGIES } from './strategies.js';

export async function connect(mcpUrl, token) {
  const client = new Client({ name: 'mmp-bot', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  await client.connect(transport);
  const call = async (name, args = {}) => {
    const res = await client.callTool({ name, arguments: args });
    return res.structuredContent ?? JSON.parse(res.content[0].text);
  };
  return { client, call, close: () => client.close() };
}

/**
 * Plays a series to the end. Returns the final get_match observation.
 * onStep(obs) is called after every observation (for logging); thinkMs delays each decision.
 */
export async function playSeries({ mcpUrl, token, seriesId, name, strategy = 'balanced', thinkMs = 0, onStep, signal }) {
  const { call, close } = await connect(mcpUrl, token);
  try {
    const rules = await call('list_games', { series_id: seriesId });
    const decide = STRATEGIES[strategy];
    if (!decide) throw new Error(`unknown strategy ${strategy}`);
    let obs = await call('get_match', { series_id: seriesId });
    for (;;) {
      if (signal?.aborted) return obs;
      onStep?.(obs);
      const next = obs.next;
      let res;
      if (next.do === 'join') {
        res = await call('manage_match', { operation: 'join', series_id: seriesId, name, request_id: randomUUID() });
      } else if (next.do === 'ready') {
        res = await call('manage_match', { operation: 'ready', series_id: seriesId, for_match: next.args.for_match, request_id: randomUUID() });
      } else if (next.do === 'submit') {
        if (thinkMs) await new Promise((r) => setTimeout(r, thinkMs));
        const actions = decide(obs, rules.settings);
        res = await call('submit_action', { series_id: seriesId, match: next.args.match, round: next.args.round, request_id: randomUUID(), actions });
      } else if (next.do === 'wait') {
        obs = await call('get_match', next.args);
        continue;
      } else {
        return obs; // stop (or nothing we can do)
      }
      const slotExpired = res.error?.startsWith('stale bundle:') ||
        (res.error?.startsWith('no round is open') && ['strategy_review', 'series_finished', 'cancelled'].includes(res.phase));
      if (res.ok === false && !slotExpired) throw new Error(`${name}: ${res.error} ${JSON.stringify(res.rejected ?? '')}`);
      obs = await call('get_match', { series_id: seriesId });
    }
  } finally {
    await close();
  }
}
