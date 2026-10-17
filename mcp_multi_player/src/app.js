// Puts the pieces together (SPEC.md §2): one Express app on 127.0.0.1 serving the MCP
// endpoint at /mcp and the browser side everywhere else. createMcpExpressApp adds the
// Host/Origin checks (DNS-rebinding protection) for localhost.

import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { Store } from './store/files.js';
import { EnginePool } from './engine/pool.js';
import { SeriesManager } from './series/manager.js';
import { Players, bearerAuth, newHostKey } from './mcp/auth.js';
import { createMcpEndpoint } from './mcp/server.js';
import { webRoutes } from './web/routes.js';

/**
 * Builds the app. Returns { app, manager, players, hostKey, listen }.
 * listen() resolves with the http.Server once it is accepting connections.
 */
export function createApp({ dataDir, host = '127.0.0.1', port = 8787, hostKey = newHostKey(), clock } = {}) {
  const enginePool = new EnginePool();
  const store = new Store(dataDir, { parser: (text) => enginePool.parseLines(text) });
  const manager = new SeriesManager(store, { clock, enginePool, engineFactory: (cfg) => enginePool.open(cfg) });
  manager.on('fault', (id) => console.error(`Series ${id} stopped after a runtime failure; restart recovery required.`));
  const ready = manager.recoverAll().catch(async (err) => { await manager.close(); throw err; });
  ready.catch(() => {}); // listen() reports startup errors to its caller
  const players = new Players(store.dataDir);

  const app = createMcpExpressApp({ host, jsonLimit: '1mb' });
  const ctx = { mcpUrl: `http://${host}:${port}/mcp` };
  const mcp = toNodeHandler(createMcpEndpoint({ manager, mcpUrl: () => ctx.mcpUrl }), {
    onerror: (err) => console.error('mcp error:', err.message),
  });
  app.all('/mcp', bearerAuth(players), (req, res) => void mcp(req, res, req.body));
  app.use(webRoutes({ manager, hostKey, mcpUrl: () => ctx.mcpUrl }));

  const listen = async () => {
    await ready;
    return new Promise((resolve, reject) => {
      const server = app.listen(port, host, () => {
        ctx.mcpUrl = `http://${host}:${server.address().port}/mcp`; // real port when port = 0 (tests)
        resolve(server);
      });
      server.on('error', reject);
    });
  };

  return { app, manager, players, hostKey, store, listen, get mcpUrl() { return ctx.mcpUrl; } };
}
