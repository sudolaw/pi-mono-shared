// Action bundles (SPEC.md §6, §12): ordered build / upgrade / target / send actions.
// A bundle is validated as a whole against the published state: one bad action rejects
// all of it, and nothing changes. Validation runs on a scratch copy so later actions see
// the effect of earlier ones (e.g. build then upgrade the same slot).

import { attackersOnBoard } from './state.js';
import { attackerStats } from '../config.js';

export const ACTION_TYPES = ['build', 'upgrade', 'target', 'send'];

/**
 * Checks a bundle for `seat` against `state`. Never mutates `state`.
 * Returns { ok, errors: [{ index, reason }], cost }.
 */
export function validateBundle(state, seat, actions, cfg, board) {
  const errors = [];
  if (!Array.isArray(actions)) return { ok: false, errors: [{ index: null, reason: 'actions must be a list' }], cost: 0 };

  const scratch = structuredClone({ round: state.round, towers: state.towers, players: state.players, attackers: state.attackers });
  const goldBefore = scratch.players[seat].gold;
  let sentThisBundle = 0;

  actions.forEach((action, index) => {
    const reason = checkAction(scratch, seat, action, cfg, board, sentThisBundle);
    if (reason) {
      errors.push({ index, reason });
      return;
    }
    if (action.type === 'send') sentThisBundle += action.units.reduce((n, u) => n + u.count, 0);
    applyAction(scratch, seat, action, cfg);
  });

  return { ok: errors.length === 0, errors, cost: goldBefore - scratch.players[seat].gold };
}

/** Applies an already-validated bundle to `state` (mutates). */
export function applyBundle(state, seat, actions, cfg) {
  for (const action of actions) applyAction(state, seat, action, cfg);
}

// Returns a reason string if the action is not allowed right now, else null.
function checkAction(s, seat, a, cfg, board, sentThisBundle) {
  if (!a || typeof a !== 'object') return 'action must be an object';
  const me = s.players[seat];

  if (a.type === 'build') {
    const slot = board.slots[a.slot];
    if (!slot) return `unknown slot ${a.slot}`;
    if (slot.owner !== seat) return `slot ${a.slot} belongs to ${slot.owner}`;
    if (s.towers[a.slot]) return `slot ${a.slot} already has a tower`;
    const def = cfg.towers[a.tower];
    if (!def) return `unknown tower ${a.tower}`;
    if (a.targeting !== undefined && !cfg.targeting.includes(a.targeting)) return `unknown targeting ${a.targeting}`;
    if (me.gold < def.cost) return `not enough gold for ${a.tower} (${def.cost}, have ${me.gold})`;
    return null;
  }

  if (a.type === 'upgrade') {
    const t = s.towers[a.slot];
    if (!t) return `no tower at ${a.slot}`;
    if (t.owner !== seat) return `tower at ${a.slot} belongs to ${t.owner}`;
    const levels = cfg.towers[t.type].levels;
    if (t.level >= levels.length) return `tower at ${a.slot} is already level ${t.level}`;
    const cost = levels[t.level].upgradeCost;
    if (me.gold < cost) return `not enough gold to upgrade ${a.slot} (${cost}, have ${me.gold})`;
    return null;
  }

  if (a.type === 'target') {
    const t = s.towers[a.slot];
    if (!t) return `no tower at ${a.slot}`;
    if (t.owner !== seat) return `tower at ${a.slot} belongs to ${t.owner}`;
    if (!cfg.targeting.includes(a.targeting)) return `unknown targeting ${a.targeting}`;
    return null;
  }

  if (a.type === 'send') {
    if (!Array.isArray(a.units) || a.units.length === 0) return 'send needs a non-empty units list';
    let count = 0;
    let cost = 0;
    for (const u of a.units) {
      const def = attackerStats(cfg, u?.type, s.round);
      if (!def) return `unknown attacker ${u?.type}`;
      if (!Number.isInteger(u.count) || u.count < 1) return `count for ${u.type} must be a whole number of at least 1`;
      count += u.count;
      cost += def.price * u.count;
    }
    if (sentThisBundle + count > cfg.economy.maxSendPerRound) return `at most ${cfg.economy.maxSendPerRound} attackers per round`;
    if (attackersOnBoard(s, seat) + count > cfg.economy.maxOnBoard) {
      return `at most ${cfg.economy.maxOnBoard} attackers alive or queued (you have ${attackersOnBoard(s, seat)})`;
    }
    if (me.gold < cost) return `not enough gold to send (${cost}, have ${me.gold})`;
    return null;
  }

  return `unknown action type ${a.type}`;
}

function applyAction(s, seat, a, cfg) {
  const me = s.players[seat];
  if (a.type === 'build') {
    const cost = cfg.towers[a.tower].cost;
    me.gold -= cost;
    me.spent.towers += cost;
    // A new tower may fire on its first tick (cooldown 0).
    s.towers[a.slot] = { slot: a.slot, owner: seat, type: a.tower, level: 1, targeting: a.targeting ?? 'first', cooldown: 0, damage: 0, kills: 0 };
  } else if (a.type === 'upgrade') {
    const t = s.towers[a.slot];
    const cost = cfg.towers[t.type].levels[t.level].upgradeCost;
    me.gold -= cost;
    me.spent.upgrades += cost;
    t.level += 1; // the current cooldown carries over
  } else if (a.type === 'target') {
    s.towers[a.slot].targeting = a.targeting;
  } else if (a.type === 'send') {
    for (const u of a.units) {
      const cost = attackerStats(cfg, u.type, s.round).price * u.count;
      me.gold -= cost;
      me.spent.attackers += cost;
      // `sent` counts purchases; queue order is the submitted order, after anything already waiting.
      if (me.sent) me.sent[u.type].sent += u.count;
      for (let i = 0; i < u.count; i++) me.queue.push(u.type);
    }
  }
}
