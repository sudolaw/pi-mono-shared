// @ts-check
// One player's side of the screen (spec §4.2): wallet, base health, towers, attackers,
// projectiles, the spawn queue and a summary of the last turn.

export function makeBoard(level) {
  return {
    health: level.rules.startHealth, gold: level.rules.startGold,
    kills: 0, leaked: 0, spent: 0, earned: 0, towersLost: 0,
    towers: {}, attackers: [], projectiles: [], queue: [],
    nextId: 1, nextShot: 1, tick: 0,
    lastTurn: emptyLastTurn(null),
  };
}

/** The last turn in numbers, including what each tower did (by slot). */
export const emptyLastTurn = (wave) => ({
  wave, spent: 0, spawned: 0, killed: 0, leaked: 0, tower_hits: 0, base_hits: 0, towers_lost: [], earned: 0, towers: {},
});

/** Resets the last-turn summary and queues this turn's wave (null after the last wave). */
export function startTurn(board, wave) {
  board.lastTurn = emptyLastTurn(wave ? wave.wave : null);
  for (const slot of Object.keys(board.towers)) board.lastTurn.towers[slot] = { damage: 0, kills: 0, shots: 0 };
  board.queue = wave ? wave.spawns.map((s) => ({ atTick: s.atTick, type: s.type, hpScale: wave.hpScale })) : [];
}

export function payIncome(board, level) {
  const income = level.rules.income;
  board.gold += income; board.earned += income; board.lastTurn.earned += income;
}

/** Credits a tower with damage, a kill or a shot, for this turn and in total. */
export function credit(board, slot, field, amount = 1) {
  const t = board.towers[slot];
  if (!t) return; // destroyed while its shell was in flight
  t.totals[field] += amount;
  const lt = (board.lastTurn.towers[slot] ??= { damage: 0, kills: 0, shots: 0 });
  lt[field] += amount;
}
