// Where files live (spec §9). Everything is under one data folder outside the repo.

import { join } from 'node:path';
import { homedir } from 'node:os';

export const defaultDataDir = () => process.env.MMP_DATA_DIR || join(homedir(), '.local', 'share', 'mcp_multi_player');

export function pathsFor(dataDir) {
  const seriesDir = (id) => join(dataDir, 'series', id);
  const matchDir = (id, n) => join(seriesDir(id), 'match-' + String(n).padStart(2, '0'));
  return {
    lobbyIndex: join(dataDir, 'lobby.json'),
    seriesRoot: join(dataDir, 'series'),
    seriesDir,
    seriesLog: (id) => join(seriesDir(id), 'series.jsonl'),
    matchDir,
    events: (id, n) => join(matchDir(id, n), 'events.jsonl'),
    audit: (id, n) => join(matchDir(id, n), 'audit.jsonl'),
    snapshots: (id, n) => join(matchDir(id, n), 'snapshots'),
    text: (id, n) => join(matchDir(id, n), 'match.log'),
  };
}
