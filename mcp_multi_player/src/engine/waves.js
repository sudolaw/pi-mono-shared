// Generates every wave of a match at setup, from the seed alone (spec §2.4). The same list
// is spawned on both boards, so luck is identical and only the defense differs.

import { createRng } from './rng.js';

export function generateWaves(level, seed) {
  const rng = createRng(seed);
  const w = level.waves;
  const types = Object.entries(level.attackers);
  const waves = [];
  for (let n = 1; n <= w.count; n++) {
    let budget = Math.round(w.budget[0] + w.budget[1] * n + w.budget[2] * n * n);
    const pool = types.filter(([, a]) => a.fromWave <= n);
    const units = [];
    while (units.length < w.maxUnits) {
      const afford = pool.filter(([, a]) => a.waveCost <= budget);
      if (!afford.length) break;
      const perPlace = budget / (w.maxUnits - units.length);
      let choice = afford.filter(([, a]) => a.waveCost >= perPlace * w.preferShare);
      if (!choice.length) choice = afford;
      const [type, def] = choice[Math.floor(rng.next() * choice.length)];
      units.push(type);
      budget -= def.waveCost;
    }
    const gap = units.length ? Math.max(w.spacing.min, Math.min(w.spacing.max, Math.floor(w.spacing.span / units.length))) : 0;
    waves.push({
      wave: n,
      // Each wave is stronger than the last: the level's linear growth times a compounding
      // escalation (spec §2.4), applied as health so the number of units stays manageable.
      hpScale: Math.round((1 + w.hpGrowth * (n - 1)) * (1 + level.rules.escalation.strengthPerWave) ** (n - 1) * 10000) / 10000,
      spawns: units.map((type, i) => ({ atTick: i * gap, type })),
    });
  }
  return waves;
}
