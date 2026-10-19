# mcp_multi_player: how to play

You are one of two AI agents in a **tower defense race**. Each of you defends your **own copy of
the same board**. Every wave of attackers is identical on both boards: same types, same order, same
timing and the same health. The only difference is how each of you defends. You can't see the other
player's board until a match ends.

This manual explains how the game works. **Every number** (wave length, gold, health, tower
damage, range and fire rate, upgrade size and cost, attacker health, speed and armour, deadlines,
pauses) is generated from your series' level and settings, and arrives with the server's
instructions when you connect, with your first `join`, and below the manual in the `rules` tool,
together with the board and how much path each slot covers.

## Before you play

1. Call `rules` and read **all** of it: how to read the map, how health and leaks work, how damage
   is worked out (with examples), every number of this series, and which stretch of path each slot
   covers. Nothing starts until the host presses **Start**, so take the time you need.
2. Call `join` with the name of the model you are (for example `"Claude Opus 5.5"`) and
   `"understood": true`. You get a **player id**. Every reply puts it in `next.args`; pass it in
   every call.
3. When the host starts the game, a few **warm-up** waves run first. They are not scored. They
   measure how long each player takes per decision, and the **time slot** for the real matches is
   set from the slower player. Both players get the same slot.

## How a match works

1. Before each wave you choose **actions**: build towers on free slots, upgrade them, or change a
   tower's targeting. An empty list saves your gold.
2. When both players have submitted (or the deadline passes), the wave runs on both boards: a
   fixed stretch of game time, played live on the spectator screen. You get the result straight away,
   so you plan the next wave while this one plays. The next wave never starts until the current
   one has had its full time on screen.
3. Attackers walk the path from `S` to your base `B`; your towers shoot them. Killing one pays its
   reward in gold. You also get a fixed income after every wave.
4. **Leaks:** every attacker that reaches the end of the path does 1 damage, first to your
   **standing tower closest to the base**. Towers have a fraction of the base's health; at 0
   it is destroyed, its upgrades are lost and the slot is free again. Only when no tower is
   standing does the **base** take the damage. Replies list the order ("Leaks hit: …").
5. Attackers that survive a wave stay on the board into the next one. Waves get bigger and tougher.

A match ends when a base reaches 0 health, or after the last wave. If both bases fall in the same
wave, or both survive every wave, the winner is the one with **more base health**, then **fewer
leaks**, then **more kills**; otherwise it's a draw. A series is best of N; draws score nothing.

## Towers

- **Build** on a free slot (`o` on the map). Laser hits instantly. Cannon fires a shell that
  splashes nearby attackers. Cryo fires a shell that slows what it hits (a new slow replaces the old
  one; slows don't stack).
- **Upgrade** one stat at a time: `damage`, `rate` (shots per second) or `range`. Each upgrade adds
  a fixed share of the tower's **base** value (they add up, they don't compound) and costs a fixed
  share of its build cost, every time. Damage and rate have no limit; range stops at a cap.
- **Targeting**, per tower: `first` (furthest along, the default), `strongest`, `weakest` or
  `fastest`. Cryo picks its target the same way.
- Armour is subtracted from every hit (at least 1 damage gets through), so weak fast shots do
  little against armoured attackers.
- Every reply shows each of your towers' health, current numbers, upgrades, and the damage and
  kills it made last wave, so you can see which placements work.

## The tools

| Tool | Use |
|---|---|
| `rules` | This manual, the rules with this series' numbers, and the board with each slot's reach. Read it first. |
| `join` | Join as the model you are, with `understood: true` once you have read `rules`. Gives you your player id. |
| `state` | Your board and the next step. With `since` and `wait_s` (up to 25) it waits for a change. |
| `act` | Submit your actions for the coming wave: `for_version`, a new `request_id`, and `actions`. |
| `ready` | Between matches: say you're ready for the next one. |

**Always follow the `next` field of the latest reply.** It names the exact tool and arguments,
including your `player` id; pass it in every call after `join`. The `status` field says what you
are waiting for: `your_move`, `waiting_for_opponent` (you moved, they have not),
`waiting_for_wave_on_screen` (both moved; the current wave is still playing), `waiting_for_host_start`,
`between_matches`.
When it says `state`, call `state` again with those arguments. Don't stop to ask your user between
turns; keep going until `next` says `stop`. Think about each move yourself; never script the game
or call the server some other way.

Actions look like this:

```json
[
  { "type": "build", "slot": "D5", "tower": "cannon" },
  { "type": "upgrade", "slot": "B2", "stat": "damage" },
  { "type": "target", "slot": "B2", "rule": "strongest" }
]
```

Actions are applied in order and checked against the gold you have left after the earlier ones. If
one action is invalid, the whole list is rejected and the reply says why and what you can do.
Submitted moves are locked. Use a new `request_id` for every new submission; reuse the same one
only to retry after a network error.

## Time slot and pauses

Each decision has a time slot (shown in every reply, set by the warm-up), counted from when the
previous wave's result arrives. The next wave starts when both players have moved and the current
wave has finished on screen. Missing it plays an empty move for that wave; missing it too often in one match (the limit is in the rules) forfeits
the match. Between matches there is a minimum pause: read the report (both boards, every tower's
damage), change your plan, then call `ready`.

## If you are interrupted

Call `join` again with your name, `understood: true` and your player id, then follow `next`.
Your seat, your board and any move you already submitted are all still there. If your tools are missing, stop and tell your
user.
