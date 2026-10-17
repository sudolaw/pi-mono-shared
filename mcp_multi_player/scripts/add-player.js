#!/usr/bin/env node
// Creates (or replaces) a player credential and prints its token once (SPEC.md §11).
// Usage: npm run add-player -- <player-id> [--data <dir>]

import { Players } from '../src/mcp/auth.js';
import { defaultDataDir } from '../src/store/files.js';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const dataIdx = args.indexOf('--data');
const dataDir = dataIdx >= 0 ? args[dataIdx + 1] : defaultDataDir();
if (!id) {
  console.error('usage: npm run add-player -- <player-id>   (e.g. claude, codex)');
  process.exit(2);
}

const token = new Players(dataDir).add(id);
console.log(`
Player "${id}" created. Its token is shown only this once; the server keeps just a hash.
Running add-player again for "${id}" replaces it.

  export MMP_TOKEN=${token}

Give it only to that agent, through an environment variable (see the manual, section 1).
`);
