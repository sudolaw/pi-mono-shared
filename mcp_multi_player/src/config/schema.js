// Checks a level file's shape and ranges before anything uses it (spec §2). Collects every
// problem as a readable line instead of stopping at the first.

const EFFECTS = ['damage', 'splash', 'slow'];
const DELIVERY = ['instant', 'projectile'];

export function checkLevel(lv) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  need(typeof lv?.id === 'string' && /^[a-z0-9_-]+$/.test(lv.id), 'id must be lower-case letters, digits, _ or -');
  need(Array.isArray(lv?.layout?.rows) && lv.layout.rows.length > 1 && num(lv.layout.tile), 'layout needs tile and rows');
  const towers = Object.entries(lv?.towers ?? {});
  need(towers.length > 0, 'at least one tower type');
  for (const [k, t] of towers) {
    need(num(t.cost) && t.cost > 0, `${k}: cost must be > 0`);
    need(typeof t.code === 'string' && t.code.length === 1, `${k}: code must be one character`);
    const b = t.base ?? {};
    need(num(b.damage) && num(b.range) && num(b.rate) && b.rate > 0 && b.range > 0, `${k}: base needs damage, range and rate > 0`);
    need(DELIVERY.includes(t.delivery?.kind), `${k}: delivery must be ${DELIVERY.join(' or ')}`);
    if (t.delivery?.kind === 'projectile') need(num(t.delivery.speed) && t.delivery.speed > 0, `${k}: projectile speed`);
    need(Array.isArray(t.onHit) && t.onHit.every((e) => EFFECTS.includes(e.effect)), `${k}: onHit effects must be ${EFFECTS.join(', ')}`);
  }
  const attackers = Object.entries(lv?.attackers ?? {});
  need(attackers.length > 0, 'at least one attacker type');
  for (const [k, a] of attackers) {
    for (const f of ['hp', 'speed', 'armor', 'reward', 'waveCost', 'fromWave']) need(num(a[f]) && a[f] >= 0, `${k}: ${f} must be a number >= 0`);
    need(a.waveCost > 0 && a.hp > 0 && a.speed > 0, `${k}: hp, speed and waveCost must be > 0`);
  }
  const w = lv?.waves ?? {};
  need(Number.isInteger(w.count) && w.count >= 1, 'waves.count must be a whole number >= 1');
  need(Array.isArray(w.budget) && w.budget.length === 3 && w.budget.every(num), 'waves.budget is [base, perWave, perWaveSquared]');
  need(Number.isInteger(w.maxUnits) && w.maxUnits >= 1, 'waves.maxUnits >= 1');
  need(num(w.hpGrowth) && w.hpGrowth >= 0, 'waves.hpGrowth >= 0');
  need(num(w.spacing?.span) && num(w.spacing?.min) && num(w.spacing?.max), 'waves.spacing needs span, min, max');
  const r = lv?.rules ?? {};
  for (const f of ['startGold', 'income', 'startHealth', 'towerHealth', 'ticksPerTurn', 'dt', 'missLimit', 'maxActions']) need(num(r[f]) && r[f] >= 0, `rules.${f} must be a number >= 0`);
  need(num(r.towerHealth) && r.towerHealth >= 1, 'rules.towerHealth must be >= 1');
  const esc = r.escalation ?? {};
  need(num(esc.strengthPerWave) && esc.strengthPerWave >= 0 && num(esc.towerDecayPerWave) && esc.towerDecayPerWave >= 0 && esc.towerDecayPerWave < 1, 'rules.escalation needs strengthPerWave >= 0 and towerDecayPerWave in [0, 1)');
  const u = r.upgrade ?? {};
  need(num(u.step) && u.step > 0 && num(u.costShare) && u.costShare > 0 && Number.isInteger(u.maxRangeUps) && u.maxRangeUps >= 0, 'rules.upgrade needs step > 0, costShare > 0 and a whole maxRangeUps >= 0');
  return errors;
}
