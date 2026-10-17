// Scripted strategies (SPEC.md §15): simple, deterministic players that decide from the
// same observation an agent gets. Used by tests, the demo bots and balance checks, so a
// whole series can run with no paid model calls.
//
// Each strategy is (obs, cfg) → actions, where obs is a get_match observation for the
// bot's own seat and cfg is the series settings from list_games.

import { attackerRoster } from '../config.js';

// Defensive slot preference: own-third slots right beside the incoming road first, then
// the middle slots, then the weak corner slot.
const SLOT_ORDER = [5, 4, 3, 2, 8, 6, 7, 9, 1];

// Parameters of the three styles. makeStrategy() can jitter them so balance runs see
// many different players instead of the same deterministic match over and over.
const STYLES = {
  turtle: { towerMix: ['plasma', 'laser', 'cryo'], defenseShare: 0.75, units: ['crawler', 'scarab'], reserve: 40 },
  rusher: { towerMix: ['laser', 'cryo'], defenseShare: 0.35, units: ['runner', 'crawler'], reserve: 0 },
  balanced: { towerMix: ['laser', 'plasma', 'cryo', 'plasma'], defenseShare: 0.5, units: ['crawler', 'runner', 'scarab'], reserve: 20 },
};

/**
 * A strategy with randomised parameters: rng() → [0, 1). Same rng sequence, same player.
 * The defense share moves ±0.2, and the tower/unit orders are shuffled.
 */
export function makeStrategy(style, rng) {
  const base = STYLES[style];
  const shuffle = (xs) => xs.map((x) => [rng(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const params = {
    towerMix: shuffle(base.towerMix),
    defenseShare: Math.min(0.95, Math.max(0.15, base.defenseShare + (rng() - 0.5) * 0.4)),
    units: shuffle(base.units),
    reserve: base.reserve,
  };
  return (obs, cfg) => plan(obs, cfg, params);
}

export const STRATEGIES = {
  // Builds a solid defense first, upgrades it, and sends a mix of Crawlers and Scarabs
  // with whatever is left above a small reserve.
  turtle(obs, cfg) {
    return plan(obs, cfg, STYLES.turtle);
  },
  // Light defense, heavy and fast offense: Runners and Crawlers every round.
  rusher(obs, cfg) {
    return plan(obs, cfg, STYLES.rusher);
  },
  // Balanced: towers and upgrades with about half the gold, the rest on mixed attackers.
  balanced(obs, cfg) {
    return plan(obs, cfg, STYLES.balanced);
  },
};

function plan(obs, cfg, { towerMix, defenseShare, units, reserve }) {
  const seat = obs.you.seat;
  const enemy = seat === 'P1' ? 'P2' : 'P1';
  let gold = obs.players[seat].gold;
  const actions = [];
  const mine = (obs.towers ?? []).filter((t) => t.owner === seat);

  // Defense budget for this round.
  let defense = Math.floor(gold * defenseShare);
  const free = new Set(obs.free_slots?.[seat] ?? []);
  for (const n of SLOT_ORDER) {
    const slot = `${seat}-${n}`;
    if (!free.has(slot)) continue;
    const type = towerMix[(mine.length + actions.length) % towerMix.length];
    const cost = cfg.towers[type].cost;
    if (cost > defense) break;
    actions.push({ type: 'build', slot, tower: type, targeting: type === 'cryo' ? 'fastest' : type === 'plasma' ? 'strongest' : 'first' });
    defense -= cost;
    gold -= cost;
  }
  // Upgrades, lowest level first, once there are towers to upgrade.
  for (const t of [...mine].sort((a, b) => a.level - b.level || a.slot.localeCompare(b.slot))) {
    const lv = cfg.towers[t.type].levels;
    if (t.level >= lv.length) continue;
    const cost = lv[t.level].upgradeCost;
    if (cost > defense) continue;
    actions.push({ type: 'upgrade', slot: t.slot });
    defense -= cost;
    gold -= cost;
  }

  // Offense with the rest, within the per-round and on-board limits.
  const own = obs.attackers?.[`toward_${enemy}`] ?? { alive: {}, queued: {} };
  const onBoard = sum(own.alive) + sum(own.queued);
  let room = Math.min(cfg.economy.maxSendPerRound, cfg.economy.maxOnBoard - onBoard);
  let budget = gold - reserve;
  const counts = {};
  const attackers = obs.attacker_stats ?? attackerRoster(cfg, obs.round ?? 1);
  for (let i = 0; room > 0; i++) {
    const type = units[i % units.length];
    const price = attackers[type].price;
    if (price > budget) {
      if (units.every((u) => attackers[u].price > budget)) break;
      continue;
    }
    counts[type] = (counts[type] ?? 0) + 1;
    budget -= price;
    room -= 1;
  }
  const sendUnits = Object.entries(counts).map(([type, count]) => ({ type, count }));
  if (sendUnits.length) actions.push({ type: 'send', units: sendUnits });
  return actions;
}

const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
