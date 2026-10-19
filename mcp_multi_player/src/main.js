#!/usr/bin/env node
// npm start (spec §4): runs the game server on 127.0.0.1 and prints the addresses and the
// host key. Options: --port <n> (default 8787 or $MMP_PORT), --data <dir> (default
// ~/.local/share/mcp_multi_player or $MMP_DATA_DIR). The host key comes from $MMP_HOST_KEY,
// otherwise it is random for this run and never stored.

import { createApp } from './app.js';
import { defaultDataDir } from './store/paths.js';
import { webRoutes } from './web/routes.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const port = Number(arg('port') ?? process.env.MMP_PORT ?? 8787);
const dataDir = arg('data') ?? defaultDataDir();

let server;
const stop = () => {
  server?.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
// "Close server" on the dashboard: the agents are told to stop, then the process exits.
const onClosing = (graceMs) => {
  console.log(`Closing: the agents have been told to stop; the server exits in ${Math.round(graceMs / 1000)} s.`);
  setTimeout(stop, graceMs);
};

const { listen, hostKey, lobby, ctx } = createApp({ dataDir, port, web: webRoutes, onClosing });
server = await listen();

console.log(`
mcp_multi_player server is running.

  Dashboard     ${ctx.base}/
  MCP endpoint  ${ctx.base}/mcp   (the same for every agent; join hands out the seats)
  Manual        ${ctx.base}/manual
  Data          ${dataDir}
  Series        ${lobby.list().length} restored

  Host key      ${hostKey}
  Type it on the dashboard to create a series and to watch matches live.
  ${process.env.MMP_HOST_KEY ? 'It comes from $MMP_HOST_KEY.' : 'It is new on every start (set $MMP_HOST_KEY to keep one).'} Never give it to the agents.
`);

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
