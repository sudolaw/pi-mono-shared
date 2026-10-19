// @ts-check
// Shapes for the game itself (spec §4.2). Type comments only; no runtime code. Modules import
// them with JSDoc (`@typedef {import('../types/game.js').Level} Level`) and `npm run typecheck`
// checks the files that opt in with `// @ts-check`.

/**
 * @typedef {'P1'|'P2'} Seat
 * @typedef {'damage'|'rate'|'range'} Stat
 * @typedef {'first'|'strongest'|'weakest'|'fastest'} TargetRule
 *
 * @typedef {[number, number]} PathStretch  first and last path tile number covered (1 = spawn tile)
 * @typedef {{ base: PathStretch[], max: PathStretch[], max_tiles: number }} SlotReach
 * @typedef {{ id: string, r: number, c: number, x: number, y: number,
 *   cover: Record<string, number>, reach: Record<string, SlotReach>, toBase: number }} Slot
 *   cover: path tiles in range at base range, per tower type; toBase: distance to the base in tiles
 * @typedef {{ points: {x: number, y: number}[], cum: number[], length: number, tiles: string[] }} Path
 * @typedef {{ tile: number, rows: string[], width: number, height: number, slots: Slot[], path: Path,
 *   leakOrder: string[], spawn: string, base: string }} Layout
 *
 * @typedef {{ damage: number, range: number, rate: number }} TowerNumbers  damage per hit, range in units, shots per second
 * @typedef {{ effect: 'damage' } | { effect: 'splash', radius: number, share: number } | { effect: 'slow', factor: number, ticks: number }} OnHit
 * @typedef {{ name: string, code: string, cost: number, base: TowerNumbers,
 *   delivery: { kind: 'instant'|'projectile', speed?: number }, onHit: OnHit[] }} TowerType
 * @typedef {{ name: string, hp: number, speed: number, armor: number, reward: number, waveCost: number, fromWave: number }} AttackerType
 *   speed in units per second
 * @typedef {{ count: number, budget: [number, number, number], maxUnits: number, preferShare: number,
 *   spacing: { span: number, min: number, max: number }, hpGrowth: number }} WaveRecipe  spacing in ticks
 * @typedef {{ step: number, costShare: number, maxRangeUps: number }} UpgradeRules
 *   step: share of the base value one upgrade adds; costShare: share of the build cost one upgrade costs
 * @typedef {{ startGold: number, income: number, startHealth: number, towerHealth: number,
 *   ticksPerTurn: number, dt: number, missLimit: number, maxActions: number, upgrade: UpgradeRules,
 *   escalation: { strengthPerWave: number, towerDecayPerWave: number } }} LevelRules
 *   escalation: every wave's attackers get this much stronger than the last (compounding, as health),
 *   and towers deal this much less damage than in the wave before
 *   dt: seconds of game time per tick
 * @typedef {{ id: string, name: string, description?: string, hash: string, layout: Layout,
 *   towers: Record<string, TowerType>, attackers: Record<string, AttackerType>, waves: WaveRecipe, rules: LevelRules }} Level
 *
 * @typedef {{ atTick: number, type: string }} Spawn
 * @typedef {{ wave: number, hpScale: number, spawns: Spawn[] }} Wave
 * @typedef {{ damage: number, kills: number, shots: number }} TowerWork
 * @typedef {{ slot: string, type: string, ups: Record<Stat, number>, health: number, cooldown: number,
 *   targeting: TargetRule, totals: TowerWork }} Tower
 *   ups: upgrades bought per stat; cooldown in seconds
 * @typedef {{ id: number, type: string, hp: number, maxHp: number, dist: number, slowUntil: number,
 *   slowFactor: number, lastHit: string|null }} Attacker
 *   dist: units along the path; slowUntil: board tick the slow ends; lastHit: slot of the last tower to hit it
 * @typedef {{ id: number, x: number, y: number, targetId: number, speed: number, tower: string, slot: string,
 *   damage: number, done?: boolean }} Projectile
 * @typedef {{ wave: number|null, spent: number, spawned: number, killed: number, leaked: number, tower_hits: number,
 *   base_hits: number, towers_lost: string[], earned: number, towers: Record<string, TowerWork> }} LastTurn
 * @typedef {{ health: number, gold: number, kills: number, leaked: number, spent: number, earned: number,
 *   towersLost: number, towers: Record<string, Tower>, attackers: Attacker[], projectiles: Projectile[],
 *   queue: (Spawn & { hpScale: number })[], nextId: number, nextShot: number, tick: number, lastTurn: LastTurn }} Board
 * @typedef {{ seed: number, turn: number, waves: Wave[], boards: Record<Seat, Board> }} State
 *
 * @typedef {{ type: 'build', slot: string, tower: string }
 *   | { type: 'upgrade', slot: string, stat: Stat }
 *   | { type: 'target', slot: string, rule: TargetRule }} Action
 * @typedef {{ board: Seat, tick: number, type: string, [k: string]: any }} Event
 * @typedef {{ over: false } | { over: true, winner: Seat|null, reason: string }} Outcome
 */
export {};
