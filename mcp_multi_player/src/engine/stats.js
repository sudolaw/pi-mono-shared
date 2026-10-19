// @ts-check
// A tower's live numbers (spec §2.2): its type's base values, each raised by one step (20 %
// of the base) per upgrade of that stat. Upgrades add, they don't compound, and range stops at
// the level's cap. Damage also wears down every wave (escalation, spec §2.4): wave w deals
// (1 - decay)^(w - 1) of it. Rounded so every reader sees the same numbers.

export const STATS = ['damage', 'rate', 'range'];

/** How much of its damage a tower still deals in wave `wave` (1-based). */
export const damageShare = (level, wave) => (1 - level.rules.escalation.towerDecayPerWave) ** Math.max(0, wave - 1);

/** A tower's numbers during wave `wave` (1-based; the coming wave when planning). */
export function towerStats(level, tower, wave = 1) {
  const base = level.towers[tower.type].base, step = level.rules.upgrade.step;
  const at = (stat) => base[stat] * (1 + step * tower.ups[stat]);
  return { damage: Math.round(at('damage') * damageShare(level, wave) * 10) / 10, rate: Math.round(at('rate') * 100) / 100, range: Math.round(at('range')) };
}

/** What one upgrade costs: the tower's build cost times the level's cost share. */
export const upgradeCost = (level, type) => Math.round(level.towers[type].cost * level.rules.upgrade.costShare);
