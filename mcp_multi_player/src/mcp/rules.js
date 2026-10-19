// @ts-check
// The rules an agent plays by, in words and numbers (spec §2, §10.3). One generator feeds the
// server instructions sent on connect, the first join reply and the `rules` tool, so every
// copy says the same thing and the numbers always come from this series' level.

import { DEFAULT_DEADLINE_S } from '../match/index.js';
import { DEFAULT_GAP_S, DEFAULT_PACE_S } from '../series/index.js';

/** The numbers an agent needs that come from the series rather than the level. */
export function seriesTerms(level, status) {
  return {
    deadline_s: status?.deadline_s ?? DEFAULT_DEADLINE_S,
    pace_s: status?.pace_s ?? DEFAULT_PACE_S,
    gap_s: status?.gap_s ?? DEFAULT_GAP_S,
    best_of: status ? status.target * 2 - 1 : null,
  };
}

const pct = (x) => `${Math.round(x * 100)}%`;
const secs = (x) => `${Math.round(x * 10) / 10} s`;

/** A tower type's extra on-hit effects in words. `tickSeconds` is the level's rules.dt. */
export function onHitText(towerType, tickSeconds) {
  return towerType.onHit.filter((e) => e.effect !== 'damage').map((e) => (e.effect === 'splash'
    ? `splash: ${pct(e.share)} of the damage to every other attacker within ${e.radius} units of the impact`
    : `slows the target to ${pct(e.factor)} speed for ${secs(e.ticks * tickSeconds)}; a new slow replaces the old one (slows don't stack)`)).join('; ');
}

/** The full rules brief, with this series' numbers. */
export function rulesBrief(level, status) {
  const r = level.rules, u = r.upgrade, w = level.waves, terms = seriesTerms(level, status);
  const tickSeconds = r.dt, waveSeconds = r.ticksPerTurn * tickSeconds;
  const pathLen = level.layout.path.length, tile = level.layout.tile;
  const L = [];
  L.push(`RULES for level "${level.name}" (these numbers are exact for this series).`);
  L.push(`Goal: outlast the other agent. You each defend your own copy of the same board against identical waves (same attackers, order, timing and health). You never see their board during a match.`);
  L.push(`Turn: before each wave you submit actions with act (build, upgrade, target; an empty list saves gold). Then the wave runs: ${secs(waveSeconds)} of game time, played live on the spectator screen. You get the result as soon as it is computed, so you plan the next wave while this one plays. The next wave starts when both players have moved (or the deadline passed) and at least ${secs(terms.pace_s)} after the previous one started.`);
  L.push(`Before the game: nothing starts until the host presses Start, so take your time reading this. Then ${status?.warmup_waves ?? 3} warm-up waves run first. They are not scored; they measure how long each of you takes per decision, and the time slot for the real matches is set from the slower of you (1.5 times the slowest decision plus 5 s, between 20 and 300 s). The same slot applies to both players.`);
  L.push(`Time slot: you have ${terms.deadline_s} s per decision (the replies show the seconds left), counted from when the previous wave's result arrives. The next wave starts when both of you have moved and the current wave has finished on screen (${terms.pace_s} s per wave). If one player is slow, the screen waits for them, up to the slot. A missed slot plays an empty move; ${r.missLimit} misses in one match forfeit it. Accepted moves are locked.`);
  L.push(`Economy: start with ${r.startGold} gold; +${r.income} gold after every wave, plus each kill's reward. Gold is spent only on building and upgrading.`);
  L.push(`Health: your base has ${r.startHealth}. Every tower has ${r.towerHealth} (about a third of the base). Attackers do not shoot; the only way to lose health is a leak.`);
  L.push(`Leaks: an attacker that reaches the end of the path does 1 damage, first to your standing tower closest to the base (the order is in the board table: "leak order"). A tower at 0 is destroyed: its upgrades are gone and the slot is free to build on again. Only when no tower is standing does the base take the damage. A base at 0 loses the match.`);
  L.push(`Towers (base numbers; damage per hit, range in units with one tile = ${tile} units, rate in shots per second):`);
  for (const [k, t] of Object.entries(level.towers)) {
    const b = t.base, extra = onHitText(t, tickSeconds);
    L.push(`  ${k} (${t.code}): cost ${t.cost} · damage ${b.damage} · range ${b.range} · rate ${b.rate}/s · ${t.delivery.kind === 'instant' ? 'instant hit' : `shell at ${t.delivery.speed} units/s that homes on its target (lost if the target dies first)`}${extra ? ' · ' + extra : ''}`);
  }
  L.push(`Upgrades: upgrade {slot, stat} with stat "damage", "rate" or "range". Each one adds ${pct(u.step)} of the tower's BASE value (they add up, they don't compound: 3 damage upgrades = +${pct(3 * u.step)} damage) and costs ${u.costShare === 1 ? "the tower's build cost" : `${pct(u.costShare)} of its build cost`} every time. Damage and rate have no limit; range stops after ${u.maxRangeUps} upgrades (+${pct(u.maxRangeUps * u.step)}). Actions take effect at the start of the wave you submit them for.`);
  L.push(`Targeting: each tower picks one attacker in range by its rule: first (furthest along the path, the default), strongest (most health), weakest (least health) or fastest (highest current speed). Ties go to the one furthest along. Cryo picks its target the same way.`);
  L.push(`Damage: every hit does max(1, damage − armour), so weak hits barely scratch armoured attackers. The last tower to hit an attacker gets the kill.`);
  const types = Object.entries(level.towers), foes = Object.entries(level.attackers);
  const toughest = foes.reduce((a, b) => (b[1].armor > a[1].armor ? b : a)), softest = foes.reduce((a, b) => (b[1].armor < a[1].armor ? b : a));
  const hit = (dmg, armor) => Math.max(1, Math.round((dmg - armor) * 10) / 10);
  L.push(`  Examples: ${types.map(([k, t]) => `a ${k} hit does ${hit(t.base.damage, softest[1].armor)} to a ${softest[0]} (armour ${softest[1].armor}) and ${hit(t.base.damage, toughest[1].armor)} to a ${toughest[0]} (armour ${toughest[1].armor})`).join('; ')}. Damage per second = damage per hit after armour × shots per second.`);
  const [ex, exT] = types[0];
  L.push(`  Upgrade example: a ${ex} with 2 damage upgrades does ${exT.base.damage} × ${1 + 2 * u.step} = ${Math.round(exT.base.damage * (1 + 2 * u.step) * 10) / 10} per hit; a third would cost another ${Math.round(exT.cost * u.costShare)} gold.`);
  const esc = r.escalation, growth = (n) => Math.round(((1 + w.hpGrowth * (n - 1)) * (1 + esc.strengthPerWave) ** (n - 1)) * 100) / 100;
  const share = (n) => Math.round((1 - esc.towerDecayPerWave) ** (n - 1) * 100);
  L.push(`Escalation: every wave the attackers get ${pct(esc.strengthPerWave)} more health than in the wave before${w.hpGrowth ? ` (plus ${pct(w.hpGrowth)} of the base value per wave)` : ''}, and every tower deals ${pct(esc.towerDecayPerWave)} less damage than in the wave before. Both compound: in wave 5 attackers have ${growth(5)}x their listed health and towers deal ${share(5)}% of their damage; in wave 10, ${growth(10)}x and ${share(10)}%. Upgrades are counted before this. The tower numbers in your replies already include it for the coming wave. Waves also bring more attackers as they go. So the pressure rises fast: a defense that holds easily now will not hold for long.`);
  L.push(`Attackers (listed at wave 1; the path is ${level.layout.path.tiles.length} tiles, ${pathLen} units):`);
  for (const [k, a] of Object.entries(level.attackers)) {
    L.push(`  ${k}: health ${a.hp} · speed ${a.speed} units/s (crosses the path in ${secs(pathLen / a.speed)}, ${Math.round((pathLen / a.speed / waveSeconds) * 10) / 10} waves) · armour ${a.armor} · reward ${a.reward} gold · from wave ${a.fromWave}`);
  }
  L.push(`Waves: ${w.count} per match. Each is bigger than the last (up to ${w.maxUnits} attackers, spawned over the first ~${secs(w.spacing.span * tickSeconds)} of the wave). Attackers still alive when a wave ends stay on the board into the next. Waves come from a seed per match: the same for both players, different in every match, so the same build can do better or worse from match to match.`);
  L.push(`End of a match: a base at 0 loses. If both fall in the same wave, or both survive all ${w.count} waves: more base health wins, then fewer leaks, then more kills; otherwise a draw.`);
  L.push(`Series: ${terms.best_of ? `best of ${terms.best_of} (first to ${(terms.best_of + 1) / 2} wins)` : 'best of N'}; draws score nothing. Between matches you get both boards' report; call ready when you have a plan. The next match starts when both are ready, and never sooner than ${terms.gap_s} s after the last one ended.`);
  L.push(`Reading the map: every reply ends with your board as a grid. Rows are letters (A at the top), columns are numbers, so a tile is called like D5. S is where attackers enter, B is your base, # is the path they walk (in one line from S to B), o is a free tower slot, ${types.map(([, t]) => t.code).join("/")} are your towers (${types.map(([k, t]) => `${t.code} ${k}`).join(", ")}), and a digit on a path tile is how many attackers stand there now. The rules tool lists, for every slot, which stretch of the path (by path tile number, 1 = the S tile) each tower type reaches.`);
  L.push(`Always do what the next field of the latest reply says (state to wait, act to move, ready between matches, stop at the end). Play through the tools yourself; never script the game or call the server some other way.`);
  return L.join('\n');
}
