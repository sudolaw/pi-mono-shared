// Scripted playing styles for bots and balance runs. Each one sees exactly what an agent
// sees (its own view, plus the level's slot info from `rules`) and returns an action list.
// They rebuild destroyed towers (the build order finds the slot free again), then spend the
// rest on stat upgrades, spreading them over the towers with the fewest so far.

// Works with the engine's level and with the level as the `rules` tool sends it.
const upgradeCost = (level, type) => level.towers[type].upgrade_cost ?? Math.round(level.towers[type].cost * level.rules.upgrade.costShare);

const bySlotCover = (level, type) => [...level.layout.slots].sort((a, b) => b.cover[type] - a.cover[type] || a.id.localeCompare(b.id)).map((s) => s.id);

/** Greedy planner: keeps building from `buildOrder` up to `maxTowers`, then upgrades. */
function planner({ buildOrder, maxTowers, upgradeFirst = () => 0, statFor = () => ['damage', 'rate'], reserve = () => 0 }) {
  return (view, level) => {
    const actions = [];
    let gold = view.me.gold - reserve(view);
    const towers = Object.fromEntries(view.me.towers.map((t) => [t.slot, { slot: t.slot, type: t.type, ups: { ...t.ups } }]));
    const total = (t) => t.ups.damage + t.ups.rate + t.ups.range;
    for (let guard = 0; guard < 25; guard++) {
      const built = Object.keys(towers).length;
      const next = buildOrder(level, built).find(([slot]) => !towers[slot]);
      if (next && built < maxTowers) {
        const [slot, tower] = next, cost = level.towers[tower].cost;
        if (gold < cost) break;
        actions.push({ type: 'build', slot, tower }); gold -= cost;
        towers[slot] = { slot, type: tower, ups: { damage: 0, rate: 0, range: 0 } };
        continue;
      }
      const up = Object.values(towers).sort((a, b) => upgradeFirst(a) - upgradeFirst(b) || total(a) - total(b) || a.slot.localeCompare(b.slot))[0];
      if (!up) break;
      const cost = upgradeCost(level, up.type);
      if (gold < cost) break;
      const order = statFor(up);
      const stat = order[total(up) % order.length];
      actions.push({ type: 'upgrade', slot: up.slot, stat }); gold -= cost; up.ups[stat]++;
    }
    return actions;
  };
}

const pattern = (types, order) => (level) => order(level).map((slot, i) => [slot, types[i % types.length]]);

export const STRATEGIES = {
  laser_wall: planner({ buildOrder: pattern(['laser'], (lv) => bySlotCover(lv, 'laser')), maxTowers: 8 }),
  cannon_cryo: planner({
    buildOrder: pattern(['cannon', 'cryo', 'cannon'], (lv) => bySlotCover(lv, 'cannon')), maxTowers: 7,
    upgradeFirst: (t) => (t.type === 'cannon' ? 0 : 1),
    statFor: (t) => (t.type === 'cryo' ? ['range', 'rate'] : ['damage', 'rate', 'damage']),
  }),
  balanced: planner({ buildOrder: pattern(['laser', 'cannon', 'laser', 'cryo'], (lv) => bySlotCover(lv, 'laser')), maxTowers: 10 }),
  saver: planner({
    buildOrder: pattern(['laser', 'cannon'], (lv) => bySlotCover(lv, 'cannon')), maxTowers: 12,
    reserve: (view) => (view.last_wave.leaked > 0 ? 0 : 150),
  }),
};
