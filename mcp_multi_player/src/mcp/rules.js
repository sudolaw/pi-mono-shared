// The rules an agent needs before its first move (SPEC.md §6, §12, §15): the manual, the
// effective settings, current attacker stats, the board and the action format. list_games
// returns them, and so does a successful join, so an agent can't start without them.

import { manualMarkdown } from '../manual.js';
import { DEFAULTS, attackerRoster } from '../config.js';
import { buildBoard } from '../engine/board.js';

/** Rules for `series`, or for a new series with the defaults when series is null. */
export function rulesFor({ mcpUrl, series = null }) {
  const cfg = series?.record.settings ?? DEFAULTS;
  return {
    manual: manualMarkdown({ mcpUrl, series }),
    settings: cfg,
    attacker_stats: attackerRoster(cfg, series?.state?.round ?? 1),
    board: boardInfo(cfg),
    actions: ACTION_FORMAT,
  };
}

export function boardInfo(cfg) {
  const board = buildBoard(cfg.board);
  return {
    width: board.width,
    height: board.height,
    bases: board.bases,
    zones: { P1: `x < ${Math.round(board.width / 3)}`, middle: 'between', P2: `x > ${Math.round((2 * board.width) / 3)}` },
    pipes: {
      P1: { attackers_of: 'P1', from: 'P1 base', to: 'P2 base', points: board.paths.P1.points, length: board.paths.P1.length },
      P2: { attackers_of: 'P2', from: 'P2 base', to: 'P1 base', points: board.paths.P2.points, length: board.paths.P2.length },
    },
    slots: board.slotIds.map((id) => board.slots[id]),
    note: 'Towers only shoot enemy attackers. progress in observations runs from 0 (spawn) to 1 (enemy base).',
  };
}

export const ACTION_FORMAT = {
  bundle: 'submit_action { series_id, match, round, request_id, actions: [...] }; actions run in order; empty list = save gold',
  build: { type: 'build', slot: 'P1-4', tower: 'laser | plasma | cryo', targeting: 'first | strongest | weakest | fastest (optional, default first)' },
  upgrade: { type: 'upgrade', slot: 'P1-4' },
  target: { type: 'target', slot: 'P1-4', targeting: 'first | strongest | weakest | fastest' },
  send: { type: 'send', units: [{ type: 'crawler | runner | scarab', count: 1 }] },
};
