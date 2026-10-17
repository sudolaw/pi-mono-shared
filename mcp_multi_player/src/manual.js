// The one manual (SPEC.md §15): docs/manual.md plus a generated "Settings for this series"
// section, so humans (series page) and agents (list_games) always read the same rules and
// the series' real numbers. Never contains a token: only placeholders.

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, attackerRoster } from './config.js';
import { buildBoard } from './engine/board.js';

const MANUAL_PATH = fileURLToPath(new URL('../docs/manual.md', import.meta.url));
const MANUAL_TEMPLATE = await fs.readFile(MANUAL_PATH, 'utf8');
const rendered = new WeakMap();

export function manualMarkdown({ mcpUrl, series = null }) {
  const cfg = series?.record.settings ?? DEFAULTS;
  const key = `${mcpUrl}:${series?.id ?? ''}:${series?.state?.round ?? 1}:${series?.record.deadlineSeconds ?? ''}`;
  const cached = rendered.get(cfg);
  if (cached?.key === key) return cached.value;
  const text = MANUAL_TEMPLATE
    .replaceAll('{{MCP_URL}}', mcpUrl)
    .replaceAll('{{SERIES_ID}}', series?.id ?? '<series id>')
    .replaceAll('{{NAME}}', '<your display name>');
  const value = `${text}\n${settingsSection(cfg, series)}`;
  rendered.set(cfg, { key, value });
  return value;
}

function settingsSection(cfg, series) {
  const e = cfg.economy;
  const round = series?.state?.round ?? 1;
  const lines = [
    `## Settings for ${series ? `series ${series.id}` : 'new series (defaults)'}`,
    '',
    series && Object.keys(series.record.overrides ?? {}).length
      ? `The host changed: ${Object.entries(series.record.overrides).map(([k, v]) => `\`${k}\` = ${v}`).join(', ')}.`
      : 'All values are the defaults.',
    '',
    '| Setting | Value |',
    '|---|---|',
    `| Timing | ${cfg.match.openingRounds === undefined ? 'Legacy series: all rounds wait for both players; live-slot rules do not apply' : `Rounds 1–${cfg.match.openingRounds} wait; later combat runs continuously, with orders applied together every ${cfg.match.roundSeconds} s`} |`,
    `| Path length (each direction) | ${buildBoard(cfg.board).paths.P1.length} units |`,
    `| Combat ticks per second | ${cfg.match.ticksPerSecond} |`,
    `| Rounds per match (max) | ${cfg.match.maxRounds}, ${cfg.match.roundSeconds} s each |`,
    `| Base health | ${cfg.match.baseHealth} |`,
    `| Starting gold | ${e.startingGold} |`,
    `| Income per round | ${e.incomeBase}, +${e.incomeStep} every ${e.incomeEvery} rounds |`,
    `| Spawn spacing | ${e.spawnInterval} s |`,
    `| Attackers per round / alive+queued | ${e.maxSendPerRound} / ${e.maxOnBoard} |`,
    `| Series | first to ${cfg.series.winsNeeded} wins; ${cfg.series.freeDraws} plain draws, then tiebreak matches |`,
    `| Warm-up rounds | ${cfg.series.warmupRounds} |`,
    `| Opening-round deadline | ${deadlineText(cfg, series)} |`,
    `| Missed live slot | Empty bundle; no forfeit; combat continues |`,
    `| Attacker escalation | ${e.attackerScaling ? `Every ${e.attackerScaling.everyRounds} completed rounds: price × ${e.attackerScaling.priceFactor}, spawn health × ${e.attackerScaling.healthFactor}; compounds and resets each match` : 'Disabled for this saved series'} |`,
    '',
    `Attacker values below are current for round ${round}. Price is charged in the submitted round; health is set at spawn.`,
    '',
    '| Attacker | Health | Speed | Armor | Price | Reward |',
    '|---|---|---|---|---|---|',
    ...Object.entries(attackerRoster(cfg, round)).map(([k, a]) => `| ${a.name} (\`${k}\`) | ${a.health} | ${a.speed} | ${a.armor} | ${a.price} | ${a.reward} |`),
    '',
    '| Tower | Build | Level 1 / 2 / 3: damage · range · shots/s | Upgrade costs | Projectile / special |',
    '|---|---|---|---|---|',
    ...Object.entries(cfg.towers).map(([k, t]) => `| ${t.name} (\`${k}\`) | ${t.cost} | ${t.levels.map((l) => `${l.damage}·${l.range}·${l.rate}`).join(' / ')} | ${t.levels.slice(1).map((l) => l.upgradeCost).join(' / ')} | ${t.projectileSpeed ?? 'instant'}${t.splashRadius ? `; splash radius ${t.splashRadius}, factor ${t.splashFactor}` : ''}${t.slowFactor ? `; slow factor ${t.slowFactor}, duration ${t.slowDuration} s` : ''} |`),
    '',
  ];
  return lines.join('\n');
}

function deadlineText(cfg, series) {
  const d = cfg.series.deadline;
  if (series?.record.deadlineSeconds) return `${series.record.deadlineSeconds} s (${d.mode === 'auto' ? 'automatic' : 'fixed by the host'}); ${cfg.series.maxMisses} opening misses in a match lose it`;
  if (d.mode === 'off') return 'off';
  if (d.mode === 'fixed') return `${d.fixedSeconds} s per round`;
  return `set after the warm-up: ${d.factor}× the slower player's average, at least ${d.minSeconds} s`;
}
