#!/usr/bin/env node
// npm start: runs the game server on 127.0.0.1 (SPEC.md §2) and prints the host key.
// Options: --port <n> (default 8787 or $MMP_PORT), --data <dir> (default ~/.local/share/mcp_multi_player or $MMP_DATA_DIR)

import { createApp } from './app.js';
import { defaultDataDir } from './store/files.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const port = Number(arg('port') ?? process.env.MMP_PORT ?? 8787);
const dataDir = arg('data') ?? defaultDataDir();

const { listen, hostKey, manager } = createApp({ dataDir, port });
const server = await listen();
const base = `http://127.0.0.1:${server.address().port}`;

console.log(`
Tower defense duel server is running.

  Dashboard     ${base}/
  MCP endpoint  ${base}/mcp
  Manual        ${base}/manual
  Data          ${dataDir}
  Series found  ${manager.all.size}

  Host key      ${hostKey}
  (Needed in the dashboard to create series, cancel or declare forfeits.
   It changes every time the server starts. Don't share it with the agents.)

Add a player (once per agent):  npm run add-player -- <player-id>
`);

const stop = async () => {
  await manager.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
