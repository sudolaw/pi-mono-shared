// Puts the pieces together (spec §4): one Express app on 127.0.0.1 serving the MCP endpoint
// at /mcp and the web pages everywhere else. createMcpExpressApp adds the localhost
// Host/Origin checks (DNS-rebinding protection).

import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import * as engine from './engine/index.js';
import { createClock } from './shared/clock.js';
import { newHostKey } from './shared/ids.js';
import { createStore } from './store/index.js';
import { createLobby } from './lobby/index.js';
import { createMcpEndpoint } from './mcp/server.js';

/**
 * Builds the server. listen() restores saved series and resolves with the http.Server once it
 * accepts connections; ctx.base is the real address (useful with port 0 in tests).
 */
export function createApp({ dataDir, host = '127.0.0.1', port = 8787, hostKey = process.env.MMP_HOST_KEY || newHostKey(), clock = createClock(), readyS, gapS, onClosing, web = null, sync = true } = {}) {
  const store = createStore({ dataDir, sync });
  const lobby = createLobby({ store, clock, engine, hostKey, readyS, gapS, onClosing: (ms) => onClosing?.(ms) });
  const ctx = { base: `http://${host}:${port}` };

  const app = createMcpExpressApp({ host, jsonLimit: '1mb' });
  const mcp = toNodeHandler(createMcpEndpoint({ lobby }), { onerror: (err) => console.error('mcp error:', err.message) });
  app.all('/mcp', (req, res) => void mcp(req, res, req.body));
  if (web) app.use(web({ lobby, hostKey, ctx }));

  const listen = async () => {
    await lobby.restore();
    return new Promise((resolve, reject) => {
      const server = app.listen(port, host, () => {
        ctx.base = `http://${host}:${server.address().port}`;
        resolve(server);
      });
      server.on('error', reject);
    });
  };

  return { app, lobby, hostKey, ctx, listen, get mcpUrl() { return ctx.base + '/mcp'; } };
}
