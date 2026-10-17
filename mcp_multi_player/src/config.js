// The one place every game number lives (SPEC.md §3–§5, §8–§10).
// Tower and attacker stats are adapted from constants.js of boxops/tower_defense_js
// (https://github.com/boxops/tower_defense_js), Apache-2.0; see LICENSE-reference.
// A series may override the tunable parts (see TUNABLE and applyOverrides); the board
// geometry is fixed because slot ids, zones and fairness all depend on it.

export const DEFAULTS = Object.freeze({
  board: {
    width: 1600,
    height: 800,
    roadWidth: 44, // display only: attackers never collide
    bases: { P1: [100, 400], P2: [1500, 400] },
    // P1's attackers walk this path from P1's base to P2's base. P2's path is its point
    // reflection through the board centre, so the board is fair by construction.
    // Both outer bends go up: P1's attackers leave P1's base along the top and reach P2's
    // base along the top, so in each third the enemy arrives on the side opposite your own
    // departures (the bottom), next to slots 2 and 3.
    p1Path: [
      [100, 400], [100, 100], [450, 100], [450, 400], [560, 400], [560, 80], [700, 80],
      [700, 400], [900, 400], [900, 720], [1040, 720], [1040, 400], [1150, 400], [1150, 100],
      [1500, 100], [1500, 400],
    ],
    // P1's slots; P2-k is the point reflection of P1-k. Slots 1–5 sit in P1's own third,
    // 6–9 in the shared middle third (ownership alternates there).
    p1Slots: [[275, 400], [200, 620], [375, 620], [510, 330], [510, 470], [630, 300], [970, 330], [800, 470], [630, 110]],
  },
  match: {
    maxRounds: 100,
    roundSeconds: 5,
    ticksPerSecond: 20,
    baseHealth: 20,
    openingRounds: 2, // after these rounds, combat runs on the server clock
  },
  economy: {
    startingGold: 400,
    incomeBase: 100, // income after round r = incomeBase + incomeStep * floor((r - 1) / incomeEvery)
    incomeStep: 10,
    incomeEvery: 10,
    spawnInterval: 0.4, // seconds between spawns from one player's queue
    maxSendPerRound: 30,
    maxOnBoard: 60, // alive + queued attackers per player
    attackerScaling: { everyRounds: 5, priceFactor: 0.8, healthFactor: 1.1 },
  },
  towers: {
    laser: {
      name: 'Pulse Laser', cost: 100, projectileSpeed: null, // null = instant hit
      levels: [
        { damage: 15, range: 160, rate: 3.0 },
        { damage: 25, range: 180, rate: 3.8, upgradeCost: 75 },
        { damage: 42, range: 200, rate: 5.0, upgradeCost: 150 },
      ],
    },
    plasma: {
      name: 'Plasma Cannon', cost: 125, projectileSpeed: 320, splashRadius: 48, splashFactor: 0.5,
      levels: [
        { damage: 60, range: 180, rate: 0.7 },
        { damage: 95, range: 200, rate: 0.9, upgradeCost: 90 },
        { damage: 150, range: 220, rate: 1.2, upgradeCost: 175 },
      ],
    },
    cryo: {
      name: 'Cryo Emitter', cost: 90, projectileSpeed: 480, slowFactor: 0.45, slowDuration: 2.5,
      levels: [
        { damage: 8, range: 155, rate: 2.5 },
        { damage: 14, range: 175, rate: 3.0, upgradeCost: 65 },
        { damage: 22, range: 195, rate: 3.8, upgradeCost: 130 },
      ],
    },
  },
  attackers: {
    crawler: { name: 'Void Crawler', health: 80, speed: 62, armor: 0, price: 20, reward: 8 },
    runner: { name: 'Phase Runner', health: 45, speed: 155, armor: 0, price: 30, reward: 12 },
    scarab: { name: 'Iron Scarab', health: 220, speed: 45, armor: 12, price: 50, reward: 18 },
  },
  targeting: ['first', 'strongest', 'weakest', 'fastest'],
  series: {
    winsNeeded: 4,
    freeDraws: 3, // draws replayed plainly; after this many, matches become tiebreak matches
    warmupRounds: 0, // optional practice; scored matches have two waiting opening rounds
    deadline: { mode: 'auto', factor: 2, minSeconds: 60, fixedSeconds: null }, // mode: auto | fixed | off
    maxMisses: 3, // missed deadlines in one match that count as a forfeit
  },
});

// Dotted paths the host may override per series, with the bounds we accept. Anything not
// listed here is fixed. Keeps "advanced settings" from producing a broken game.
export const TUNABLE = {
  'match.maxRounds': [1, 500],
  'match.baseHealth': [1, 1000],
  'economy.startingGold': [0, 100000],
  'economy.incomeBase': [0, 10000],
  'economy.incomeStep': [0, 1000],
  'economy.incomeEvery': [1, 100],
  'economy.spawnInterval': [0.05, 10],
  'economy.maxSendPerRound': [1, 200],
  'economy.maxOnBoard': [1, 500],
  'series.winsNeeded': [1, 10],
  'series.freeDraws': [0, 20],
  'series.warmupRounds': [0, 10],
  'series.deadline.factor': [1, 20],
  'series.deadline.minSeconds': [5, 3600],
  'series.deadline.fixedSeconds': [5, 86400],
  'series.maxMisses': [1, 100],
};
for (const [t, def] of Object.entries(DEFAULTS.towers)) {
  TUNABLE[`towers.${t}.cost`] = [0, 100000];
  if (def.projectileSpeed) TUNABLE[`towers.${t}.projectileSpeed`] = [10, 5000];
  def.levels.forEach((_, i) => {
    TUNABLE[`towers.${t}.levels.${i}.damage`] = [0, 100000];
    TUNABLE[`towers.${t}.levels.${i}.range`] = [10, 2000];
    TUNABLE[`towers.${t}.levels.${i}.rate`] = [0.05, 50];
    if (i > 0) TUNABLE[`towers.${t}.levels.${i}.upgradeCost`] = [0, 100000];
  });
}
TUNABLE['towers.plasma.splashRadius'] = [0, 500];
TUNABLE['towers.plasma.splashFactor'] = [0, 1];
TUNABLE['towers.cryo.slowFactor'] = [0.05, 1];
TUNABLE['towers.cryo.slowDuration'] = [0, 30];
for (const a of Object.keys(DEFAULTS.attackers)) {
  for (const [k, range] of Object.entries({ health: [1, 100000], speed: [1, 2000], armor: [0, 10000], price: [0, 100000], reward: [0, 100000] })) {
    TUNABLE[`attackers.${a}.${k}`] = range;
  }
}

/**
 * Returns a fresh config: DEFAULTS with the given overrides applied.
 * overrides is a flat map of dotted path → value, e.g. { 'attackers.runner.speed': 140 }.
 * series.deadline.mode accepts 'auto' | 'fixed' | 'off'. Throws on unknown keys or bad values.
 */
export function applyOverrides(overrides = {}) {
  const cfg = structuredClone(DEFAULTS);
  for (const [path, value] of Object.entries(overrides)) {
    if (path === 'series.deadline.mode') {
      if (!['auto', 'fixed', 'off'].includes(value)) throw new Error(`series.deadline.mode must be auto, fixed or off`);
      cfg.series.deadline.mode = value;
      continue;
    }
    const bounds = TUNABLE[path];
    if (!bounds) throw new Error(`Unknown or fixed setting: ${path}`);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds[0] || value > bounds[1]) {
      throw new Error(`${path} must be a number between ${bounds[0]} and ${bounds[1]}`);
    }
    const keys = path.split('.');
    let obj = cfg;
    for (const k of keys.slice(0, -1)) obj = obj[k];
    obj[keys.at(-1)] = value;
  }
  if (cfg.series.deadline.mode === 'fixed' && !cfg.series.deadline.fixedSeconds) {
    throw new Error('series.deadline.fixedSeconds is required when the deadline mode is fixed');
  }
  return cfg;
}

/** Income paid after round r (1-based) completes. */
export function incomeAfterRound(cfg, r) {
  const e = cfg.economy;
  return e.incomeBase + e.incomeStep * Math.floor((r - 1) / e.incomeEvery);
}

/** Attacker escalation (SPEC.md §4–§5): after each five completed rounds, per match.
 * Derive from base stats, never repeatedly round an already-rounded value. Older
 * saved settings without attackerScaling keep their original prices and health.
 */
export function attackerStats(cfg, type, round = 1) {
  const base = cfg.attackers[type];
  if (!base) return undefined;
  const scale = cfg.economy.attackerScaling;
  if (!scale) return base;
  const steps = Math.floor((round - 1) / scale.everyRounds);
  // Remove floating-point noise before rounding (220 × 1.1 should be 242, not 243).
  const whole = (value) => Math.ceil(Number(value.toPrecision(12)));
  return { ...base,
    price: base.price === 0 ? 0 : Math.max(1, whole(base.price * scale.priceFactor ** steps)),
    health: whole(base.health * scale.healthFactor ** steps),
  };
}

export function attackerRoster(cfg, round = 1) {
  return Object.fromEntries(Object.keys(cfg.attackers).map((type) => [type, attackerStats(cfg, type, round)]));
}
