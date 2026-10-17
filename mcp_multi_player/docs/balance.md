# Balance check (build ticket #29)

How the default numbers play out between scripted bots, and what changing them does. Rerun with `npm run balance -- --matches 10`, and try a change with `--set key=value`.

**Method:**
- Three bot styles play each other: `turtle` (defense first), `rusher` (light defense, fast attackers) and `balanced`.
- Each bot's parameters are randomised per match: the defense share moves ±0.2, and its tower and attacker mixes are shuffled.
- There are 10 matches per pairing, 90 in all, using the real series code (no warm-up, no deadline).

**Caveat:** these bots are simple and don't adapt. Real agents will read the match reports and change their split between defense and offense, so treat these results as a smoke test, not the final balance.

## Defaults (as in SPEC.md)

```
Match length (rounds): min 12 · 25% 19 · median 30 · 75% 56 · max 100
Draws 23% · decided at the round limit 26%

Win rate (row style as P1 vs column style as P2):
          turtle    rusher    balanced
turtle    0%        100%      70%
rusher    0%        30%       30%
balanced  0%        60%       40%

Seat check: P1 won 33, P2 won 36

Towers:   laser  damage per gold 18.4 · kills per 100 gold 16.7
          cryo   damage per gold  8.5 · kills per 100 gold  9.4  (its value is the slow)
          plasma damage per gold 17.1 · kills per 100 gold 13.7
Slots (average damage of a tower there; 1–5 own third, 6–9 middle):
          #1 8 · #2 9 · #3 72 · #4 2582 · #5 1988 · #6 1245 · #7 26511 · #8 8945 · #9 170
Attackers: crawler / runner / scarab all reach the base about 4% of the time
```

## Findings

1. **The seats are fair.** P1 and P2 win about equally often, as the point-symmetric board should guarantee.
2. **Most matches end well before round 100** (median 30). Matches don't grind on endlessly.
3. **No tower dominates.** Laser and Plasma deal about the same damage per gold. Cryo deals about half as much, which is expected because its value is the slow.
4. **Defense-first wins against these bots,** and the result is the same whatever numbers we change. Variants tried (6 matches per pairing):

   | Variant | Draws | Turtle vs rusher | Reached base |
   |---|---|---|---|
   | defaults | 22% | 100% | 4–6% |
   | spawn spacing 0.25 s | 19% | 100% | 6–8% |
   | spawn 0.25 s + half kill rewards | 15% | 100% | 4–12% |
   | spawn 0.25 s + attackers ×1.5 health | 19% | 100% | 4–5% |
   | spawn 0.25 s + attackers 40% cheaper | 19% | 100% | 2–7% |
   | spawn 0.25 s + no kill rewards | 13% | 100% | 7–9% |
   | spawn 0.25 s + towers −33% damage | 13% | 100% | 6–14% |

   A 10-match rerun of the 0.25 s spawn spacing gave 24% draws, no better than the defaults, so **the defaults are unchanged**.
5. **Two cautious players stalemate.** Every turtle-vs-turtle game was a 20–20 draw at round 100. A fully upgraded defense (9 towers at level 3) out-kills the most offense the gold can buy, and kill rewards repay the defender. The tiebreak after 3 draws (SPEC §8) still ends every series, but those games are dull to watch.
6. **Rear slots rarely fire.** Slots #1, #2, #3 and #9 sit late on the enemy's path, and attackers die before they get there. Slot #7, the first P1 slot on the enemy's path, does most of the killing. That's a natural "front line vs last line" difference, not a fairness issue, because both players have the same slots.

## Open decision for the user

The turtle stalemate (finding 5) can't be fixed by adjusting numbers. It needs a rule that makes offense outgrow a maxed defense late in a match. For example:
- attackers gain +10% health every 10 rounds;
- or the per-round purchase limit and spawn rate rise with the round number.

Either would be a spec change, so it's left for the user to decide after watching real agents play.
