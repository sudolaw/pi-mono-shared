# Tower defense duel: manual

Two players (usually two AI agents) fight on one board. Each one builds towers to stop the other's attackers and buys attackers to break through to the other's base. The first to win 4 matches wins the series.

This one manual is shown to people on the series page and returned to agents by the `list_games` tool, so everyone reads the same rules. **This series' actual numbers are in the "Settings for this series" section at the end.**

## 1. Connect to the game (agents)

The game is an MCP server on the host's laptop:

```
{{MCP_URL}}
```

Each player has its own secret token. The host makes one per player with `npm run add-player -- <player-id>` and gives it to that player only. Put it in an environment variable (here `MMP_TOKEN`); **never paste it into a chat, a file in the repo, or a prompt.**

**Claude Code**

```
claude mcp add -t http mcp-multi-player {{MCP_URL}} -H "Authorization: Bearer $MMP_TOKEN"
```

**Codex CLI**

```
codex mcp add mcp-multi-player --url {{MCP_URL}} --bearer-token-env-var MMP_TOKEN
```

Then add `tool_timeout_sec = 60` under `[mcp_servers.mcp-multi-player]` in `~/.codex/config.toml`.

**Pre-approve the four tools** (`list_games`, `manage_match`, `get_match`, `submit_action`) in your client. If you don't, every poll can stop and ask your user for permission:
- Codex: set `default_tools_approval_mode = "approve"` for this server.
- Claude Code: allow the `mcp-multi-player` tools when it asks, or add them to your permissions.

**Example prompt:**

> Join the tower defense duel series `{{SERIES_ID}}` as "{{NAME}}" and play it to completion. Follow the `next` field of every response.

## 2. How to play (agents)

Every response has a `next` field that says exactly what to do. The loop is:

1. `list_games` with the `series_id`: read this entire manual, the settings and the action format. A successful join also automatically returns them in `rules`; read them before your first move.
2. `manage_match` `{ operation: "join", series_id, name, request_id }`: you get a seat, P1 or P2.
3. Wait for the host: when both players have joined, the host presses **Start** on the start screen. Meanwhile, talk strategy over with your user if you like; `get_match` keeps telling you to wait until the game begins.
4. Loop on `get_match` `{ series_id, since_version, wait_s: 25 }` and do what `next` says:
   - `submit`: send `submit_action` for the open round. An empty `actions` list saves gold.
   - `wait`: call `get_match` again with the `since_version` it gives. It waits up to 25 s for something to change. In a live slot it wakes when the opponent submits or the next slot opens, not on every combat step.
   - `ready`: a match ended. Read `report`, rethink your strategy, then mark ready for the match number given.
   - `stop`: the series is over.

**Every call that changes something** (`manage_match`, `submit_action`) needs a new unique `request_id`. If a call fails because of the network, retry with the **same** `request_id` and the same arguments. You'll get the original answer, and the move is never applied twice.

**If your session was interrupted:** call `get_match` with no arguments. It finds your series and seat and tells you the next step. Nothing is lost while you're away.

**Opening deadline:** only rounds 1 and 2 wait for both players. By default their deadline is 60 s; the host can change it or turn it off. Optional unscored warm-up rounds (disabled by default) measure decision time for the automatic opening deadline. Opening deadline misses count toward the configured forfeit limit. From round 3, fixed live slots replace that deadline: a missed slot means an empty bundle and never a deadline forfeit.

## 3. The board

- The board is 1600 × 800 units. **P1's base is on the left, P2's on the right.**
- There are two pipes:
  - P1's attackers walk from P1's base to P2's base.
  - P2's attackers walk the mirror route back.
  - They leave each base on opposite sides, then share one two-way road through the middle, with an up-hump and a down-hump.
  - Each pipe is 3,880 units long, with deep outer bends and deeper middle bends.
- **Build zones** are the thirds of the board: you build in your own third and on your own slots in the middle third.
- **Each player has 9 fixed slots:**
  - `P1-1`…`P1-5` are in P1's third and `P1-6`…`P1-9` in the middle; P2's are mirrored.
  - Every slot has a fixed owner, so nobody can take yours.
  - `list_games` gives every slot's position.
- **Towers only shoot enemy attackers.** Your own attackers are safe in your own third, because the enemy can't build there.

## 4. Units

**Towers**

| Tower | Look | Build | Levels 1/2/3: damage · range · shots/s | Special |
|---|---|---|---|---|
| Pulse Laser | diamond | 100 | 15·160·3.0 / 25·180·3.8 / 42·200·5.0 | Instant hit |
| Plasma Cannon | circle | 125 | 60·180·0.7 / 95·200·0.9 / 150·220·1.2 | Splash: 50% damage to others within 48 |
| Cryo Emitter | hexagon | 90 | 8·155·2.5 / 14·175·3.0 / 22·195·3.8 | Slows the target to 45% speed for 2.5 s |

- Upgrades to level 2 / level 3 cost: Laser 75 / 150, Plasma 90 / 175, Cryo 65 / 130.
- Slows don't stack: a stronger slow replaces the current one, and an equal slow refreshes it.

**Targeting** (per tower; the default is `first`):

| Priority | Picks |
|---|---|
| `first` | furthest along its path |
| `strongest` | highest health |
| `weakest` | lowest health |
| `fastest` | highest current speed |

Ties go to the attacker furthest along, then to the earliest spawned.

**Attackers**

| Attacker | Look | Health | Speed | Armor | Price | Defender's reward |
|---|---|---|---|---|---|---|
| Void Crawler | green circle | 80 | 62 | 0 | 20 | 8 |
| Phase Runner | yellow triangle | 45 | 155 | 0 | 30 | 12 |
| Iron Scarab | purple square | 220 | 45 | 12 | 50 | 18 |

- Every hit does `max(1, damage − armor)`.
- An attacker that reaches the enemy base does exactly 1 damage and disappears. Killing one pays its reward to the player who killed it.
- **Escalation every 5 completed rounds:** rounds 1–5 use base stats; rounds 6–10 cost 20% less and spawn with 10% more health; rounds 11–15 use price × 0.8² and health × 1.1², and so on. This compounds and resets each match. “Harder to kill” means more health; armor, speed, kill rewards and base damage stay the same.
- **Rounding:** derive from base stats and round up to whole gold/HP. Paid attackers cost at least 1 gold; host-configured free attackers remain free. Read current values from `get_match.attacker_stats`, also returned by `list_games` and join rules; `settings.attackers` holds base values.
- **Price is fixed by the submitted round. Health is fixed when an attacker spawns.** Queued attackers receive the spawn round's health; attackers already on the board keep their current and maximum health, without healing when the escalation changes.

## 5. Gold

- **One wallet:** it pays for both towers and attackers.
- **Starting gold:** 400 each match.
- **Income:** paid after every round: 100 for rounds 1–10, then +10 every 10 rounds, up to 190.
- **Kill rewards:** credited immediately when a defender kills an attacker. In live slots they can fund a bundle submitted after that kill.
- **Unspent gold** carries over to the next round.
- **Limits:**
  - at most 30 attackers bought per round;
  - at most 60 of your attackers alive or queued at once;
  - attackers spawn 0.4 s apart, and anything still in the queue keeps spawning next round.

## 6. Rounds

- Each round, both players send one **bundle**: an ordered list of actions.
  - `{ "type": "build", "slot": "P1-4", "tower": "plasma", "targeting": "strongest" }`
  - `{ "type": "upgrade", "slot": "P1-4" }`
  - `{ "type": "target", "slot": "P1-4", "targeting": "first" }`
  - `{ "type": "send", "units": [ { "type": "scarab", "count": 2 }, { "type": "crawler", "count": 6 } ] }` (they spawn in this order)
- **Rounds 1 and 2 of every match wait for both players.** Their bundles apply together, followed by 5 simulated seconds of combat. Optional warm-up also waits.
- **From round 3, combat runs continuously at 20 ticks per second.** Existing attackers move and spawn, towers fire, projectiles hit, slows expire, and bases lose health while you think.
- **Live decision slots last 5 real seconds.** Submit one hidden bundle for the current match and slot (`round`). Both players' bundles apply together at the END of the slot, after its combat. New towers can fire and newly bought attackers can spawn starting with the next tick. Even if both players submit early, the slot does not end early.
- **A missed live slot is an empty bundle:** existing combat continues, no gold is spent on orders, and it does not count toward forfeits. After a stale-slot rejection, call `get_match` and plan for the current slot; do not retry old actions under a new slot number without checking the state.
- **Timing is explicit in `get_match.decision_slot`:** `mode`, `combat_continues`, `closes_at`, `left_s`, `orders_apply`, and `missing_order`. Follow `next` to submit or wait. Submitted bundles are locked and cannot be replaced. Every `get_match` shows the live positions at that moment; `state_version` changes only when something other than combat movement happens.
- **Affordability:** validation uses the state when you submit. Spending is charged when both bundles are applied; future income cannot fund an earlier submission. Combat rewards can increase available gold during the slot.
- **A base can fall during a live slot.** The match ends immediately after that tick; pending orders are discarded without being charged, and `round_resolved.ordersDiscarded` is true. At the round limit, the match ends after that slot.
- **Server restart:** the unfinished live slot restarts from its saved opening state with locked bundles retained. Offline time does not simulate combat.
- **Your bundle stays secret** until opening-round resolution or the live-slot boundary; submitting both early never reveals live orders early.
- **A bad bundle is rejected whole**, with a reason per action. Fix it and send again.
- **Income** is paid after each completed round/slot unless the match has ended. Live combat never waits for responses or spectator playback.
- **Resolution order per combat tick:** spawns → movement and slow timers → base hits → targeting and firing in slot order → homing projectile hits (damage, splash, slow) → deaths and rewards → win check. Only enemies can be targeted. If a projectile's target dies or reaches a base, that shot disappears. An idle tower cannot bank shots.
- **Health and scoring:** armor applies separately to each hit; kills reward the defender and are credited to the last tower to hit. Attackers reaching a base cause 1 damage regardless of their remaining health and give no kill reward. Base health decides normal match outcomes; kills and tower damage decide only a drawn tiebreak match.

## 7. Winning

- **Matches:**
  - Destroy the enemy base (20 health) to win.
  - Both bases falling at the same moment is a draw.
  - After round 100, more base health wins, and equal is a draw. Gold and kills don't count.
- **Series:** first to **4 match wins**.
- **Draws:**
  - The first 3 draws are simply replayed.
  - After that, every match is a **tiebreak match**: if it ends drawn, more kills wins, then more tower damage, otherwise it's replayed.
- **Between matches:** everything resets and you get a **match report**. Rethink your strategy, then mark ready for the next match.

## 8. Watching (people)

- **Series page:**
  - It shows the board like a TV broadcast: scoreboard on top, a banner saying what the game is waiting for, a key strip at the bottom, and a running commentary.
  - Attackers are recognised by shape and colour (see the key). Every tower shows its level and targeting.
  - Opening rounds have recorded playback at 1× / 4× / 10×. From round 3 the board shows live server snapshots; playback controls never change server time or decision-slot deadlines.
  - **Record** saves the board as a `.webm` video.
- **Start screen:** before the game, the series page shows both seats. When both agents have joined, the host presses **▶ Start game** at the top.
- **Host controls** need the host key printed in the server's terminal: create a series, start it, **↺ Restart** it (back to the start screen; the agents join again), declare a forfeit, cancel a match or the series.
