# Balance notes (#43, retuned for v2.1 and for escalation)

## Escalation (2026-10-19): 20 % stronger waves, 10 % weaker towers, towers twice the price

In the first real game (Claude Opus 5.5 vs GPT-6, old rules, intensity 10) both agents survived all
40 waves with full health: about 270 upgrades each, 1,300 gold unspent. The host asked for every
wave to be 20 % stronger than the last, towers to lose 10 % of their damage every wave, and towers
(and so upgrades) to cost twice as much. Together that is about a third more pressure per wave, so
the wave budget, income and length were retuned around it:

| Level | Waves | Budget | Income | Median end (bots) | Range |
|---|---:|---|---:|---|---|
| normal | 25 | [20, 8, 0.1] | 60 | **wave 13** | 12–16 |
| hard | 25 | [25, 10, 0.2] | 50 | wave 10 | 9–11 |
| tutorial | 10 | [10, 4, 0] | 80 | survives to the end | tiebreak |

Other `normal` curves tried: [15, 6, 0] → 18; [15, 5, 0] with income 80 → 22; [12, 4, 0] with
income 80 → 27. The escalation itself (`rules.escalation`) and the prices are the host's numbers
and were not tuned.

## Before escalation

How the level numbers were checked. Rerun with `npm run balance -- --matches 4`, and try a change
with `--set path=value` (for example `--set waves.hpGrowth=0.04 --set rules.income=50`).

**Method:** four scripted strategies (`scripts/strategies.js`) play every pairing in both seat
orders, in-process, with fixed seeds. Mirror matches are always draws: same strategy, same board,
same waves gives the same result, which is a useful check that the two boards really are identical.

**Target (spec §2.4):** with these bots, the median match on `normal` ends between wave 25 and 35
of 40. (Before v2.1 the target was wave 40–70 of 100 five-second waves; the history is kept below.)

## v2.1: 30 s waves, stat upgrades, towers that soak leaks

Waves now last 30 s of game time (300 ticks) and spawn over ~15 s, so one wave carries far less
pressure per second than before, and every tower soaks 7 leaks before the base takes any. With the
old wave curve every pairing survived all 100 waves. The bots now rebuild destroyed towers and
spread stat upgrades (damage and rate; cryo range and rate) over their towers.

| Level | Waves | Budget `[base, per wave, per wave²]` | Health growth | Income | Median end | Range |
|---|---:|---|---:|---:|---|---|
| normal | 40 | [25, 20, 0.5] | 0.05 | 60 | **wave 31** | 26–40 |
| hard | 40 | [30, 26, 0.7] | 0.06 | 50 | wave 21 | 21–25 |
| tutorial | 10 | [15, 15, 0.5] | 0.05 | 60 | survives to the end | tiebreak decides |

Other curves tried on `normal` (40 waves, income 60): `[30, 25, 0.6]` / 0.05 → median 27;
`[30, 30, 1.0]` / 0.06 → 22; `[40, 40, 1.2]` / 0.06 → 19; `[30, 22, 0.5]` / 0.045 → 30.

## Before v2.1 (5 s waves, levels 1–3)

### Starting values (spec): too short

`waves.budget [20, 10, 0.4]`, `hpGrowth 0.06`: median end at **wave 18** (16–27). Waves outgrew any
affordable defense by wave 20.

### Chosen values

| Level | Wave budget `[base, per wave, per wave²]` | Health growth per wave | Median end | Range |
|---|---|---|---|---|
| normal | [20, 6, 0.1] | 0.03 | **wave 46** | 23–62 |
| hard | [24, 8, 0.14] | 0.04 | wave 22 | 16–37 |
| tutorial | [15, 6, 0.2] (10 waves) | 0.06 | survives to the end | tiebreak decides |

Everything else stays at the spec's starting values (gold 250, income 40, towers and attackers as
listed). Other curves tried on `normal`:

| Curve | Median end |
|---|---|
| [20, 5, 0.08], hpGrowth 0.035, income 50 | 50 |
| [18, 4, 0.06], hpGrowth 0.03, income 50 | 57 |

### What the bots showed on `normal` (P1 win rate, row vs column)

```
                laser_wall cannon_cryo    balanced       saver
laser_wall              0%          0%          0%         25%
cannon_cryo           100%          0%          0%         25%
balanced              100%        100%          0%         25%
saver                  75%         75%         75%          0%
```

- A single tower type loses to mixed builds, and armoured scarabs punish laser-only defenses.
- Keeping a reserve and building when leaks start (`saver`) beats spending everything at once.
- The seats are fair: P1 and P2 win equally often.

These bots don't adapt. Real agents will, so treat this as a smoke test, and retune after watching
Claude Code vs Codex play (#44).
