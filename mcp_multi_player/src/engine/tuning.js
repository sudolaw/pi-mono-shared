// @ts-check
// Host tuning while looking for the right difficulty (spec §2.10): an intensity from 0 to 10
// that scales how many attackers the coming wave sends (5 = as generated, 0 = none, 10 =
// double), and extra attackers the host throws in with the random-wave button. Both boards get
// exactly the same, and the match log records it with the turn, so replays stay exact.

/** @typedef {import('../types/game.js').Level} Level */
/** @typedef {import('../types/game.js').Wave} Wave */
/** @typedef {import('../types/game.js').Spawn} Spawn */
/** @typedef {{ intensity?: number, extra?: Spawn[] }} Tuning */

export const NORMAL_INTENSITY = 5;

/**
 * The wave as it will actually run. Scaling repeats or drops units from the generated list in
 * order and spreads them over the same span, so the mix of types stays the same.
 * @param {Wave|null} wave @param {Level} level @param {Tuning} [tuning] @returns {Wave|null}
 */
export function tuneWave(wave, level, tuning = {}) {
  const intensity = tuning.intensity ?? NORMAL_INTENSITY, extra = tuning.extra ?? [];
  if (!wave || (intensity === NORMAL_INTENSITY && !extra.length)) return wave;
  const base = wave.spawns, count = Math.round((base.length * intensity) / NORMAL_INTENSITY);
  const sp = level.waves.spacing;
  const gap = count ? Math.max(sp.min, Math.min(sp.max, Math.floor(sp.span / count))) : 0;
  const spawns = Array.from({ length: count }, (_, i) => ({ atTick: i * gap, type: base[i % base.length].type }));
  for (const s of extra) spawns.push({ atTick: s.atTick, type: s.type });
  spawns.sort((a, b) => a.atTick - b.atTick);
  return { ...wave, spawns };
}

/**
 * A random burst for the random-wave button: more attackers the higher the intensity, of the
 * types this wave may use, over the first ten seconds. `random` is passed in (Math.random on
 * the server); the result is logged, so the engine never needs to repeat it.
 * @param {Level} level @param {number} waveNo the 1-based wave it joins @param {number} intensity
 * @param {() => number} random @returns {Spawn[]}
 */
export function randomBurst(level, waveNo, intensity, random) {
  const types = Object.entries(level.attackers).filter(([, a]) => a.fromWave <= waveNo).map(([k]) => k);
  const count = 3 + Math.round(intensity * 2 * random());
  const span = Math.round(10 / level.rules.dt);
  return Array.from({ length: count }, () => ({ atTick: Math.floor(random() * span), type: types[Math.floor(random() * types.length)] }))
    .sort((a, b) => a.atTick - b.atTick);
}
