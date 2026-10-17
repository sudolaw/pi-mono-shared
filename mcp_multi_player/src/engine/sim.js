// Fixed-step combat simulation (SPEC.md §7). No randomness and no wall-clock time:
// the same state and config always produce the same result.
//
// Order inside one tick:
//   1 spawns · 2 movement (with slow) · 3 base hits · 4–5 targeting + firing (slot order)
//   6 projectiles move and hit (damage → splash → slow) · 7 deaths and rewards · 8 win check
// Lists are always processed in id order (attackers/projectiles are appended as created).

import { SEATS, other } from './board.js';
import { attackerStats } from '../config.js';

const EPS = 1e-9;

/**
 * Runs one round (roundSeconds of simulated time) on `state`, mutating it.
 * Stops early if the match ends. If `rec` is given, combat events and 10 Hz frames are
 * pushed into it for the spectator timeline.
 */
export function simulateRound(state, cfg, board, rec) {
  const tps = cfg.match.ticksPerSecond;
  const ticks = Math.round(cfg.match.roundSeconds * tps);
  for (let i = 0; i < ticks && !state.over; i++) {
    simulateTick(state, cfg, board, i, rec);
  }
}

/** One deterministic tick, also used by the server's live clock (SPEC.md §6–§7). */
export function simulateTick(state, cfg, board, index, rec) {
  const tps = cfg.match.ticksPerSecond;
  const t = (index + 1) / tps;
  if (rec && index === 0) recordFrame(state, board, rec, 0);
  step(state, cfg, board, 1 / tps, Math.max(1, Math.round(cfg.economy.spawnInterval * tps)),
    rec ? (e) => rec.events.push({ t: round2(t), ...e }) : null);
  state.tick += 1;
  if (rec && ((index + 1) % Math.max(1, Math.round(tps / 10)) === 0 || state.over)) recordFrame(state, board, rec, t);
}

function step(state, cfg, board, dt, spawnTicks, emit) {
  const { players } = state;

  // 1. Spawns: one attacker per player whenever their spawn wait has run out.
  for (const seat of SEATS) {
    const p = players[seat];
    if (p.spawnWait > 0) p.spawnWait -= 1;
    if (p.spawnWait === 0 && p.queue.length > 0) {
      const type = p.queue.shift();
      const def = attackerStats(cfg, type, state.round);
      const a = { id: state.nextId++, owner: seat, type, dist: 0, hp: def.health, maxHp: def.health, slow: 1, slowLeft: 0, lastHit: null };
      state.attackers.push(a);
      p.spawnWait = spawnTicks;
      emit?.({ type: 'spawn', id: a.id, owner: seat, unit: type });
    }
  }

  // 2. Movement. A slow affects this tick's movement, then its timer runs down.
  for (const a of state.attackers) {
    a.dist += cfg.attackers[a.type].speed * a.slow * dt;
    if (a.slowLeft > 0) {
      a.slowLeft -= dt;
      if (a.slowLeft <= EPS) { a.slow = 1; a.slowLeft = 0; }
    }
  }

  // 3. Base hits: exactly 1 damage each, no reward, attacker removed.
  state.attackers = state.attackers.filter((a) => {
    if (a.dist < board.paths[a.owner].length) return true;
    const target = other(a.owner);
    players[target].base -= 1;
    players[a.owner].sent[a.type].reached += 1;
    emit?.({ type: 'base_hit', id: a.id, owner: a.owner, unit: a.type, base: target, remaining: players[target].base });
    return false;
  });

  // Positions after movement, used by targeting, projectiles and splash this tick.
  const pos = new Map(state.attackers.map((a) => [a.id, board.positionAt(a.owner, a.dist)]));
  const byId = new Map(state.attackers.map((a) => [a.id, a]));

  const hit = (a, raw, slotId, splash) => {
    const tower = state.towers[slotId];
    const effective = Math.max(1, raw - cfg.attackers[a.type].armor); // armor per hit, minimum 1
    const actual = Math.min(effective, a.hp);
    a.hp -= effective;
    a.lastHit = slotId;
    tower.damage += actual;
    players[tower.owner].towerDamage += actual;
    emit?.({ type: 'hit', id: a.id, slot: slotId, damage: round2(effective), splash: !!splash });
  };

  // 4–5. Targeting and firing, tower by tower in slot order.
  for (const slotId of board.slotIds) {
    const tower = state.towers[slotId];
    if (!tower) continue;
    const def = cfg.towers[tower.type];
    const lvl = def.levels[tower.level - 1];
    const slot = board.slots[slotId];
    tower.cooldown -= dt;

    const target = pickTarget(tower, slot, lvl.range, state.attackers, pos, cfg);
    if (!target) {
      // An idle tower is ready to fire at once but cannot bank shots.
      if (tower.cooldown < 0) tower.cooldown = 0;
      continue;
    }
    if (tower.cooldown > EPS) continue;

    // Keep the sub-tick remainder so the average fire rate matches `rate` exactly.
    tower.cooldown += 1 / lvl.rate;
    emit?.({ type: 'shot', slot: slotId, target: target.id, tower: tower.type });
    if (!def.projectileSpeed) {
      hit(target, lvl.damage, slotId); // laser: instant
    } else {
      state.projectiles.push({ id: state.nextId++, slot: slotId, owner: tower.owner, type: tower.type, x: slot.x, y: slot.y, targetId: target.id, damage: lvl.damage });
    }
  }

  // 6. Projectiles home in on their target; on arrival: damage, then splash, then slow.
  state.projectiles = state.projectiles.filter((p) => {
    const target = byId.get(p.targetId);
    if (!target || target.hp <= 0) return false; // target gone: the shot fizzles
    const [tx, ty] = pos.get(target.id);
    const def = cfg.towers[p.type];
    const travel = def.projectileSpeed * dt;
    const d = Math.hypot(tx - p.x, ty - p.y);
    if (d > travel) {
      p.x += ((tx - p.x) / d) * travel;
      p.y += ((ty - p.y) / d) * travel;
      return true;
    }
    hit(target, p.damage, p.slot);
    if (def.splashRadius) {
      for (const a of state.attackers) {
        if (a.id === target.id || a.owner === p.owner || a.hp <= 0) continue;
        const [ax, ay] = pos.get(a.id);
        if (Math.hypot(ax - tx, ay - ty) <= def.splashRadius) hit(a, p.damage * def.splashFactor, p.slot, true);
      }
    }
    if (def.slowFactor) {
      // Slows don't stack: a stronger slow replaces the current one, an equal one refreshes it.
      if (def.slowFactor < target.slow - EPS) { target.slow = def.slowFactor; target.slowLeft = def.slowDuration; }
      else if (Math.abs(def.slowFactor - target.slow) <= EPS) target.slowLeft = def.slowDuration;
      emit?.({ type: 'slow', id: target.id, slot: p.slot });
    }
    return false;
  });

  // 7. Deaths: kill reward to the defender (the other seat), credited to the tower that hit last.
  state.attackers = state.attackers.filter((a) => {
    if (a.hp > 0) return true;
    const defender = other(a.owner);
    const reward = cfg.attackers[a.type].reward;
    players[defender].gold += reward;
    players[defender].rewards += reward;
    players[defender].kills += 1;
    players[a.owner].sent[a.type].killed += 1;
    if (state.towers[a.lastHit]) state.towers[a.lastHit].kills += 1;
    emit?.({ type: 'kill', id: a.id, owner: a.owner, unit: a.type, by: a.lastHit, reward });
    return false;
  });

  // 8. Win check, after both directions are resolved for this tick.
  const down1 = players.P1.base <= 0;
  const down2 = players.P2.base <= 0;
  if (down1 && down2) state.over = { result: 'draw', winner: null, reason: 'both_bases', round: state.round };
  else if (down1) state.over = { result: 'win', winner: 'P2', reason: 'base_destroyed', round: state.round };
  else if (down2) state.over = { result: 'win', winner: 'P1', reason: 'base_destroyed', round: state.round };
}

/**
 * Chooses the tower's target among living enemy attackers in range, by its priority.
 * Ties: furthest along the path, then the lowest id (spawn order).
 */
export function pickTarget(tower, slot, range, attackers, pos, cfg) {
  let best = null;
  let bestKey = null;
  for (const a of attackers) {
    if (a.owner === tower.owner || a.hp <= 0) continue;
    const [x, y] = pos.get(a.id);
    if (Math.hypot(x - slot.x, y - slot.y) > range) continue;
    const key = [priorityValue(tower.targeting, a, cfg), a.dist, -a.id];
    if (!best || compareKeys(key, bestKey) > 0) { best = a; bestKey = key; }
  }
  return best;
}

// Higher is better for every priority, so `weakest` uses negative health.
function priorityValue(targeting, a, cfg) {
  switch (targeting) {
    case 'strongest': return a.hp;
    case 'weakest': return -a.hp;
    case 'fastest': return cfg.attackers[a.type].speed * a.slow;
    default: return a.dist; // 'first'
  }
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > EPS) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

// 10 Hz snapshot for the spectator: compact arrays keep combat files small.
//   attackers: [id, owner 0|1, type, x, y, hp, maxHp, slowed 0|1]
//   projectiles: [id, type, x, y]
function recordFrame(state, board, rec, t) {
  rec.frames.push({
    t: round2(t),
    a: state.attackers.map((a) => {
      const [x, y] = board.positionAt(a.owner, a.dist);
      return [a.id, a.owner === 'P1' ? 0 : 1, a.type, round1(x), round1(y), round1(Math.max(0, a.hp)), a.maxHp, a.slow < 1 ? 1 : 0];
    }),
    p: state.projectiles.map((p) => [p.id, p.type, round1(p.x), round1(p.y)]),
  });
}

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
