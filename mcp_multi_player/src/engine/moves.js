// @ts-check
// Player decisions (spec §2.6): build, upgrade one stat, and set targeting, on your own board
// only. A list is checked in order against the gold left after earlier actions; one bad
// action rejects the whole list, with the reason.

import { TARGETING } from './targeting.js';
import { STATS, towerStats, upgradeCost } from './stats.js';
import { emit } from './events.js';

/** @typedef {import('../types/game.js').Level} Level */
/** @typedef {import('../types/game.js').Board} Board */
/** @typedef {import('../types/game.js').Action} Action */
/** @typedef {{ ok: true, cost: number } | { ok: false, code: string, message: string, index?: number }} Check */

/** @returns {{ ok: false, code: string, message: string }} */
const fail = (code, message) => ({ ok: false, code, message });

/** @returns {Check} */
function checkOne(a, gold, towers, level) {
  if (!a || typeof a !== 'object') return fail('invalid_action', 'each action must be an object');
  const slot = level.layout.slots.find((s) => s.id === a.slot);
  if (!slot) return fail('unknown_slot', `${a.slot} is not a tower slot`);
  const tw = towers[a.slot];
  switch (a.type) {
    case 'build': {
      const def = level.towers[a.tower];
      if (!def) return fail('unknown_tower', `there is no tower called ${a.tower}`);
      if (tw) return fail('slot_taken', `${a.slot} already has a ${level.towers[tw.type].name}`);
      if (gold < def.cost) return fail('insufficient_gold', `${def.name} costs ${def.cost}, you have ${gold}`);
      return { ok: true, cost: def.cost };
    }
    case 'upgrade': {
      if (!tw) return fail('empty_slot', `${a.slot} has no tower to upgrade`);
      if (!STATS.includes(a.stat)) return fail('unknown_stat', `stat must be one of ${STATS.join(', ')}`);
      if (a.stat === 'range' && tw.ups.range >= level.rules.upgrade.maxRangeUps) return fail('max_range', `${a.slot}'s range is already at its cap (${level.rules.upgrade.maxRangeUps} upgrades)`);
      const cost = upgradeCost(level, tw.type);
      if (gold < cost) return fail('insufficient_gold', `upgrading ${a.slot} costs ${cost}, you have ${gold}`);
      return { ok: true, cost };
    }
    case 'target': {
      if (!tw) return fail('empty_slot', `${a.slot} has no tower`);
      if (!TARGETING[a.rule]) return fail('unknown_rule', `rule must be one of ${Object.keys(TARGETING).join(', ')}`);
      return { ok: true, cost: 0 };
    }
    default:
      return fail('invalid_action', `unknown action type ${a.type}; use build, upgrade or target`);
  }
}

/**
 * @param {Board} board @param {Action[]} actions @param {Level} level
 * @returns {Check}
 */
export function validateActions(board, actions, level) {
  if (!Array.isArray(actions)) return fail('invalid_action', 'actions must be a list');
  if (actions.length > level.rules.maxActions) return fail('invalid_action', `at most ${level.rules.maxActions} actions per turn`);
  let gold = board.gold;
  const towers = Object.fromEntries(Object.entries(board.towers).map(([k, t]) => [k, { type: t.type, ups: { ...t.ups } }]));
  for (const [i, a] of actions.entries()) {
    const r = checkOne(a, gold, towers, level);
    if (r.ok === false) return { ...r, index: i, message: `action ${i + 1}: ${r.message}` };
    gold -= r.cost;
    if (a.type === 'build') towers[a.slot] = { type: a.tower, ups: { damage: 0, rate: 0, range: 0 } };
    if (a.type === 'upgrade') towers[a.slot].ups[a.stat]++;
  }
  return { ok: true, cost: board.gold - gold };
}

export function newTower(level, slot, type) {
  return { slot, type, ups: { damage: 0, rate: 0, range: 0 }, health: level.rules.towerHealth, cooldown: 0, targeting: 'first', totals: { damage: 0, kills: 0, shots: 0 } };
}

/** Applies an already validated list to a board, recording events at tick 0. */
export function applyActions(ctx, board, actions, level) {
  ctx.turnTick = 0;
  for (const a of actions) {
    const check = checkOne(a, board.gold, board.towers, level);
    if (check.ok === false) throw new Error(`applyActions: ${check.message}`); // validated before; never happens
    const cost = check.cost;
    board.gold -= cost; board.spent += cost; board.lastTurn.spent += cost;
    if (a.type === 'build') {
      board.towers[a.slot] = newTower(level, a.slot, a.tower);
      board.lastTurn.towers[a.slot] = { damage: 0, kills: 0, shots: 0 };
    } else if (a.type === 'upgrade') board.towers[a.slot].ups[a.stat]++;
    else board.towers[a.slot].targeting = a.rule;
    emit(ctx, a.type, { slot: a.slot, tower: board.towers[a.slot].type, stat: a.stat, rule: a.rule });
  }
}

/** What a seat may do now (spec §5). */
export function legalFor(board, level) {
  const free = level.layout.slots.filter((s) => !board.towers[s.id]).map((s) => s.id);
  const upgrades = Object.values(board.towers).map((t) => {
    const cost = upgradeCost(level, t.type);
    return { slot: t.slot, cost, stats: t.ups.range >= level.rules.upgrade.maxRangeUps ? ['damage', 'rate'] : [...STATS], affordable: board.gold >= cost };
  });
  return {
    gold: board.gold,
    build: { slots: free, costs: Object.fromEntries(Object.entries(level.towers).map(([k, d]) => [k, d.cost])) },
    upgrades,
    retarget: Object.keys(board.towers),
    rules: Object.keys(TARGETING),
  };
}
