# mcp_multi_player v1 spec

A two-player tower defense & offense game played by AI agents. A Node.js server on one laptop runs the game. Agents (e.g. Claude Code and Codex CLI) play it through one MCP endpoint from their chat. People watch it in a browser.

Status: **locked for v1**. This file is the original brief plus every decision from the planning map ([Wayfinder: mcp_multi_player v1 spec](https://github.com/sudolaw/pi_mono/issues/16)). Where they disagree, this file wins. Balance numbers are starting values, to be tuned with scripted-bot matches.

Contents: [1 Scope](#1-scope) · [2 Architecture](#2-architecture) · [3 Board](#3-board) · [4 Units](#4-units) · [5 Economy](#5-economy) · [6 Rounds](#6-rounds) · [7 Combat](#7-combat) · [8 Matches and series](#8-matches-and-series) · [9 Pre-game stage](#9-pre-game-stage) · [10 Waiting and stalling](#10-waiting-and-stalling) · [11 Identity and fair play](#11-identity-and-fair-play) · [12 MCP tools](#12-mcp-tools) · [13 Logs and persistence](#13-logs-and-persistence) · [14 Spectator page](#14-spectator-page) · [15 Manual and agent setup](#15-manual-and-agent-setup) · [16 Code layout](#16-code-layout) · [17 Verification](#17-verification) · [18 Changes to the brief](#18-changes-to-the-brief)

---

## 1. Scope

**In v1:**
- Two competing agents on one machine, using one MCP endpoint with a separate credential per agent.
- Defense (towers) and offense (sending attackers) from one gold wallet.
- Best-of-seven series, first to 4 match wins.
- A browser spectator page and dashboard.

**Out of v1:**
- Selling towers, repairing bases or healing attackers.
- Tower types or attacker types beyond the three each listed here, and any attacker abilities.
- Towers taking damage.
- Play across more than one machine.

**Reference:** [boxops/tower_defense_js](https://github.com/boxops/tower_defense_js) (Apache-2.0). Use its tower numbers, path-following math and drawing style. Any file adapted from it keeps the Apache-2.0 notice (`LICENSE-reference` plus a header line naming the source file). The simulation itself is new code, because the reference's game logic is tied to its rendering and its step size depends on frame time.

## 2. Architecture

- **Language and runtime:** plain JavaScript (ES modules) on Node 22+. Tests use the built-in `node:test`.
- **One process**, bound to `127.0.0.1` by default (port `8787`, configurable). It serves:
  - `/mcp`: the Streamable HTTP MCP endpoint (SDK v2: `@modelcontextprotocol/server` with its express integration; stateless mode, so all game state lives in our own store);
  - `/`: the dashboard (series list, create button);
  - `/series/<id>`: the spectator page;
  - `/series/<id>/manual`: the manual;
  - `/series/<id>/stream`: a live event stream for spectators (SSE);
  - `/series/<id>/combat/<file>`: per-round combat timelines.
- **Layers, each unaware of the ones above it:**

  | Layer | Job |
  |---|---|
  | `engine` | Pure, deterministic rules and simulation. Knows nothing about I/O. |
  | `series` | The state machine for series, matches and rounds, plus deadlines. Calls the engine. |
  | `store` | Logs and persistence on disk. |
  | `mcp` | Tools and auth. Calls `series`. |
  | `web` | Dashboard, spectator page, stream. Reads public data only. |

- **Headless play:** no browser is needed to play. Closing or refreshing a browser never affects a game. The browser only animates results the server has already computed.

## 3. Board

One shared board of **1600 × 800 simulation units**, point-symmetric through its centre (800, 400). All ranges and distances use these units, never screen pixels.

- **Bases:** P1 at (100, 400), P2 at (1500, 400). Each base starts with 20 health.
- **Two pipes, one per direction:**
  - **P1's attackers** walk from P1's base to P2's base along:
    `(100,400) → (100,100) → (450,100) → (450,400) → (560,400) → (560,80) → (700,80) → (700,400) → (900,400) → (900,720) → (1040,720) → (1040,400) → (1150,400) → (1150,100) → (1500,100) → (1500,400)`
  - The path is **3,880** long.
  - **P2's attackers** walk the point reflection of that path, (x, y) → (1600 − x, 800 − y), from P2's base to P1's base.
  - The pipes leave each base on opposite sides. Between x = 450 and x = 1150 they share **one two-way road** that makes an up-hump on the left and a down-hump on the right. The road is 44 wide, for display only, because attackers don't collide.
- **Build zones** are thirds of the board by x: x < 533.33 is P1's third, x > 1066.67 is P2's third, and the rest is the shared middle.
- **18 fixed tower slots, 9 per player.** Each has a fixed owner, so no slot is ever contested. In the middle third, ownership alternates P1/P2.

  | Slot | Position | Zone | Slot | Position | Zone |
  |---|---|---|---|---|---|
  | P1-1 | (275, 400) | P1 | P2-1 | (1325, 400) | P2 |
  | P1-2 | (200, 620) | P1 | P2-2 | (1400, 180) | P2 |
  | P1-3 | (375, 620) | P1 | P2-3 | (1225, 180) | P2 |
  | P1-4 | (510, 330) | P1 | P2-4 | (1090, 470) | P2 |
  | P1-5 | (510, 470) | P1 | P2-5 | (1090, 330) | P2 |
  | P1-6 | (630, 300) | middle | P2-6 | (970, 500) | middle |
  | P1-7 | (970, 330) | middle | P2-7 | (630, 470) | middle |
  | P1-8 | (800, 470) | middle | P2-8 | (800, 330) | middle |
  | P1-9 | (630, 110) | middle | P2-9 | (970, 690) | middle |

  P2-k is always the point reflection of P1-k. P1-1 covers little path (none at range 160, about 90 units at 180 and 220 at 200), so its position may be nudged during balance testing; every reflection rule still applies. Slots 2 and 3 guard the enemy's arrival road along the bottom of P1's third.
- Board geometry lives in the config module and is returned by `list_games`.

## 4. Units

### Towers

Towers **shoot only enemy attackers**, on any pipe in range. They have no health. Level 1 is built; levels 2 and 3 are upgrades.

| Tower | Build | Upgrade → L2 / → L3 | Damage L1/L2/L3 | Range L1/L2/L3 | Shots/s L1/L2/L3 | Hit |
|---|---:|---|---|---|---|---|
| Pulse Laser | 100 | 75 / 150 | 15 / 25 / 42 | 160 / 180 / 200 | 3.0 / 3.8 / 5.0 | Instant |
| Plasma Cannon | 125 | 90 / 175 | 60 / 95 / 150 | 180 / 200 / 220 | 0.7 / 0.9 / 1.2 | Projectile, speed 320, splash |
| Cryo Emitter | 90 | 65 / 130 | 8 / 14 / 22 | 155 / 175 / 195 | 2.5 / 3.0 / 3.8 | Projectile, speed 480, slows |

- **Plasma splash:** radius 48 around the impact point. The target takes full damage; every other enemy attacker within the radius takes 50% of the tower's damage. Armor is applied separately to each hit.
- **Cryo slow:** on hit, the target's speed is multiplied by 0.45 for 2.5 s, at every level. Slows don't stack: a new slow replaces the current one only if it is stronger, and a hit by an equal slow resets the timer.
- **Homing projectiles:** they track the target's current position. If the target is gone before impact, the projectile disappears with no effect.
- **Targeting priorities** are set per tower; the default on build is `first`:

  | Name | Picks |
  |---|---|
  | `first` | Furthest along its path |
  | `strongest` | Highest current health |
  | `weakest` | Lowest current health |
  | `fastest` | Highest current speed (after slow) |

  Ties go to the attacker furthest along its path, then to the lowest attacker id (spawn order). The target is chosen fresh every tick, from enemy attackers within range of the slot's centre.

### Attackers

| Attacker | Health | Speed | Armor | Price | Defender's kill reward | Look (spectator) |
|---|---:|---:|---:|---:|---:|---|
| Void Crawler | 80 | 62 | 0 | 20 | 8 | Green circle |
| Phase Runner | 45 | 155 | 0 | 30 | 12 | Yellow triangle pointing its way |
| Iron Scarab | 220 | 45 | 12 | 50 | 18 | Purple armoured square |

- Speed is simulation units per second. At 5 s per round, an attacker takes about 9.3 rounds (Crawler), 3.7 (Runner) or 12.8 (Scarab) to cross.
- Attackers don't attack towers and have no abilities. Every hit does `Math.max(1, damage − armor)`.
- Reaching the enemy base does **exactly 1 base damage**, whatever health is left. The attacker is then removed, and no kill reward is paid.

## 5. Economy

### Attacker escalation

- After every five completed rounds, prices multiply by 0.8 and spawn health by 1.1, compounding per match. For round `r`, `k = floor((r - 1) / 5)`; derive price and health from the series' base attacker stats using these powers, then round up to whole gold/HP after removing floating-point noise. Nonzero prices have a 1-gold floor; deliberately free attackers remain free.
- Rounds 1–5 use base stats, 6–10 use one escalation, and 11–15 use two. Both players use identical values, reset at each match. `economy.attackerScaling` stores `{ everyRounds: 5, priceFactor: 0.8, healthFactor: 1.1 }`; saved settings without it retain fixed prices/health and replay unchanged.
- Submission validation and application use that round's price, including bundles applied at the end of a live slot. Health is assigned at spawn, including purchases queued in earlier rounds. Living attackers keep their HP/maxHP across escalation boundaries; no retroactive healing. Armor, speed, base damage and kill rewards do not scale.
- `attacker_stats` in player/spectator views, `list_games`, and join rules gives current effective values; `settings.attackers` remains the base stats. The manual includes the complete scaling contract and current stats.

One gold wallet pays for both defense and offense. Defaults are sized so that income is about twice what steady defense growth needs, which leaves half of it free for attacking.

| Setting | Default |
|---|---|
| Starting gold (each match) | 400 |
| Income after round *r*, if the match continues | `100 + 10 × floor((r − 1) / 10)`: 100 for rounds 1–10, then +10 every 10 rounds, up to 190 for rounds 91–100 |
| Kill reward | Paid to the defender (the tower's owner) when the kill happens. It shows in the next round's gold. |
| Spawn spacing | 0.4 s per player queue. A queue left unfinished carries into the next round. |
| Purchase limit | 30 attackers per player per bundle |
| Board limit | 60 per player, counting their alive and queued attackers |

- Gold never goes negative.
- Unspent gold carries over to the next round.
- A full defense (9 towers at L3) costs about 3,000 gold, which is affordable by about round 30. After that, extra gold can only go to offense.
- All balance values live in one config module (`src/config.js`). The host can override them per series (see [§9](#9-pre-game-stage)), and agents see the effective values through `list_games`.

## 6. Rounds

A match has at most **100 rounds**. Each round covers **5 simulated seconds**. Rounds 1–2 of each match and optional warm-up wait for both bundles, using the following opening-round flow. From round 3, the live-slot rules below apply:

1. **Publish.** The server publishes round *r* to both players, with state `S_r` (gold already includes income).
2. **Wait for both players' bundles.** The game waits for as long as it takes, or until the deadline ([§10](#10-waiting-and-stalling)). While it waits, nothing moves, nothing fires and no gold is paid.
3. **Validate each bundle independently**, against `S_r` and that player's own resources:
   - Actions are checked in order, against a scratch copy, so a bundle may build a tower and then upgrade it.
   - An invalid bundle is **rejected whole**, with no change to the game and a reason for each failing action. The player can correct it and resend.
   - An **accepted** bundle is locked until the round resolves.
   - An **empty** bundle is an accepted "save gold".
   - A missing bundle is not a pass.
4. **Resolve** once both bundles are accepted. This is one atomic step, so the order requests arrive in gives no advantage:
   1. apply P1's then P2's build / upgrade / target actions (they can't conflict, because slots and gold are separate per player);
   2. charge for `send` actions and append those attackers, in their listed order, to the end of the sender's spawn queue;
   3. simulate 5 s of combat ([§7](#7-combat)), stopping early if the match ends;
   4. if the match continues, add income and publish round *r + 1*.
- Between rounds the game keeps attacker positions, health, slows, tower cooldowns, projectiles in flight, spawn queues and spawn timers.
- One player's submission never invalidates the other's. Bundles are matched to the round by `match` + `round`, not by `state_version`.

### Live decision slots (round 3 onward)

- New series use `match.openingRounds = 2`. Combat advances at 20 ticks per real second, regardless of submissions. A slot lasts `match.roundSeconds = 5` real seconds; submitting both bundles early never advances it.
- Both players submit one hidden, locked bundle addressed to the current `(match, round)` during the slot. They see live public state. Validate against current state at submission; spending happens only at the boundary. Existing combat can only add gold and reduce alive-plus-queued counts, so accepted orders stay affordable and within capacity.
- At the end of the slot, apply both bundles together in deterministic P1/P2 order, then pay income and open the next slot. New towers and purchases participate starting on the next tick. Missing orders become empty bundles without counting toward forfeits. Opening deadlines (including deadline off) never suspend live combat.
- If a base falls mid-slot, stop after that tick, discard pending orders without charge, and end the match. `round_resolved.ordersDiscarded` records this; revealed bundles describe only applied orders. Round-limit results are checked at the slot boundary.
- `get_match.decision_slot` carries mode, closing time, remaining seconds, application timing and missing-order policy. `next` tells the agent to submit or wait. Stale submissions require observing and replanning for the current slot.
- Successful MCP joins return the entire manual, actual settings, board geometry, and action format in `rules`, including the timing contract.
- Public combat snapshots stream at 10 Hz without pending orders. Closing or slowing the browser does not affect ticks or slots. Combat frames do not change `state_version`: a long-poll wakes on a submission, a new slot or another real change, not ten times a second, and any `get_match` shows the current live positions.
- Checkpoint each slot's opening state. On server recovery, restart the unfinished slot from that checkpoint, retaining pending bundles. Offline time does not advance combat. Host restart/cancel/forfeit clears the combat timer.
- Round records distinguish `mode: "live"` (combat then orders) from `mode: "waiting"` (orders then combat), allowing deterministic replay of both. Series saved without `match.openingRounds` retain legacy waiting behavior and their saved map.

## 7. Combat

- **Fixed time step:** 20 ticks per simulated second, so 100 ticks per round. All math is plain JS numbers with no randomness, so the same inputs always give the same outputs.
- **Order within each tick:**
  1. **Spawns:** each player's spawn timer counts down. When it reaches 0, the next queued attacker appears at the start of that player's pipe and the timer resets to 0.4 s. A player with an empty queue has a timer of 0, so the first new attacker spawns on the next tick.
  2. **Movement:** each attacker moves `speed × slow × dt` along its pipe. Slow timers tick down.
  3. **Base hits:** any attacker at or past the end of its pipe does 1 damage to that base and is removed.
  4. **Targeting** and 5. **firing,** tower by tower in slot order (`P1-1` … `P2-9`):
     - Each tower's cooldown ticks down, then it picks a target among living enemy attackers ([§4](#4-units)).
     - If it has a target and its cooldown is ≤ 0, it fires and adds `1 / shotsPerSecond` to its cooldown. Keeping the leftover fraction of a tick makes the average fire rate exact.
     - A tower with no target can't bank shots: its cooldown stops at 0.
     - A newly built tower starts at 0, and an upgrade keeps the current cooldown.
     - A laser hits instantly; plasma and cryo launch a projectile.
  6. **Projectiles** move. Any that reach their target hit it now: damage, then splash, then slow.
  7. **Deaths:** attackers at ≤ 0 health are removed, and their kill reward goes to the defender.
  8. **Win check,** after both directions are fully resolved for the tick:
     - one base at ≤ 0: its owner loses;
     - both bases at ≤ 0: the match is a draw.
- **After round 100:** the player with more base health wins, and equal base health is a draw. Gold and kills never decide a normal match.
- **Entity ids** (attackers, projectiles) are integers handed out in creation order within a match. Every list is processed in id order.

## 8. Matches and series

- **Series:** first to **4 match wins**.
- **Draws:**
  - The first 3 drawn matches in a series count for nobody and are replayed.
  - After the series has had 3 draws, every later match is a **tiebreak match**. It is played normally; if it ends drawn, the player with **more kills that match** wins. If kills are equal, **more total tower damage** wins. If that is also equal, the match is replayed (still as a tiebreak match).
  - Scoreboard and report say when a match is a tiebreak match and when a tiebreak decided it.
- **Between matches:**
  - All match resources and units reset.
  - Player identities, names, series wins and past reports carry over.
  - The spectator view swaps which player is drawn on the left (display only; the board is symmetric).
- **Strategy review:** after every match, unless the series is over:
  1. Phase `strategy_review` begins and a **match report** is published to both agents. It contains the result and how it was decided, base health, purchases, what happened to each attacker (killed or reached the base), damage dealt per tower, kills, spending, the public action history, and instructions to rethink strategy (and talk to their user if they want to).
  2. Each agent marks itself ready **for that specific next match** (`ready` with `for_match: N`). A stale ready for an earlier match is rejected.
  3. The next match starts only when both are ready. There is no deadline in this phase.
- **Host controls** (series page, host key required, see [§11](#11-identity-and-fair-play)):
  - **▶ Start game:** on the start screen, once both agents have joined; begins the warm-up and match 1 ([§9](#9-pre-game-stage)).
  - **↺ Restart:** at any time, sends the same series back to the start screen. Seats, score, matches and the deadline are cleared; the agents must join again and the host must press Start again. The logs keep everything, with a `series_restarted` event marking the cut (replay handles it).
  - **Declare forfeit:** a chosen player loses the current match.
  - **Cancel match:** the match is voided with no result and no draw counted, and is replayed after a strategy review.
  - **Cancel series.**
- **Agent controls:** `resign` forfeits the current match. `leave` is only allowed before the host starts the game and frees the seat.
- **Phases:** `waiting_for_players` → `waiting_for_start` → `warmup` → `awaiting_actions` ⇄ `resolving` → `strategy_review` → … → `series_finished` (or `cancelled`).

## 9. Pre-game stage

1. **Create (host).** The dashboard's **Create series** button opens an **advanced settings** panel pre-filled from the config module.
   - Any value can be overridden: attacker stats and prices, tower stats, gold and income, limits, and the deadline (automatic, a fixed number, or off).
   - The series stores its effective settings, logs any overrides publicly, and **locks them when match 1 starts**.
   - The new series gets an id and a spectator URL.
2. **Join (agents).** Each agent calls `manage_match` `join` with the series id and a display name. Seats go P1, then P2, in join order. A third join is rejected, and so is the same identity taking both seats.
3. **Start screen.** The series page shows a start screen: both seats (joined or waiting), how agents connect, and what happens next. Meanwhile the agents read the manual and config from `list_games` and may discuss strategy with their user; their `next` says to wait for the host.
4. **Start (host).** Once both agents have joined, the host presses **▶ Start game** at the top of the series page. Agents do not mark ready for match 1.
5. **Optional warm-up (disabled by default).** Configured unscored warm-up rounds run on the real board with match-1 settings and no deadline.
   - The server measures each agent's time from "round published" to "bundle accepted".
   - The warm-up is then discarded completely, and match 1 starts.
6. **Deadline.** If the deadline is automatic, it is set to **2 × the slower agent's average warm-up time, with a minimum of 60 s**. It is shared by both players, published to both, and logged.

## 10. Waiting and stalling

- Only rounds 1–2 and optional warm-up wait for both bundles. From round 3, combat and five-second decision slots continue without either player replying.
- **Deadline (on by default, automatic from the warm-up; the host can set a number or turn it off):**
  - It applies only to opening rounds 1–2, not live slots, joining, readiness or strategy review.
  - The deadline clock starts when the round is published.
  - A player who misses it gets an **empty bundle** (save gold) and the round resolves.
  - **3 misses in one match is a forfeit** of that match.
  - Every miss is a public event, and both observations show the deadline, the time left and each player's misses.
  - After a server restart, the open round's deadline starts again in full.
- **Disconnects:** an agent keeps its seat. Opening rounds can wait indefinitely when their deadline is off; live combat continues from round 3 with empty bundles for missed slots.
- The dashboard always shows who is being waited on and for how long. It shows "Waiting for P2's actions (4m 12s)", never "thinking".

## 11. Identity and fair play

- **Player credentials:**
  - Each agent has a long-lived player credential, generated once with `npm run add-player -- <player-id>`.
  - The token is printed **once** to the host's terminal. The server stores only its SHA-256 hash, in the data directory.
  - An agent's MCP config holds its own token, read from an environment variable, so the same config works for every series.
- **Seats:** on `join`, the seat is bound to the authenticated player id. Every request after that is checked against that binding. A player id or seat in tool arguments is never trusted for ownership.
- **Display names:** given on `join`, 1–32 characters (letters, digits, spaces and `. _ - ( )`). A name is fixed for the series; rejoining keeps it. It is a label only.
- **Host key:**
  - Generated at server start and printed to the host's terminal.
  - Required for create, start, restart, cancel and forfeit; the page asks for it once and keeps it in the browser.
  - Agents can't act as host, because they never see the server's terminal.
- **Visibility:** everything is public **except an opponent's pending bundle**, which is hidden until the round resolves or the live slot closes. Rejected bundles are private to their sender and the audit log.
- **Credentials never appear** in observations, the manual, the spectator page, logs or error messages.
- **Validation:** the server checks ownership, cost, slot, level, limits and legality for every action.
- **Isolation:**
  - The data directory defaults to `~/.local/share/mcp_multi_player/`, outside the repo.
  - Agents should run in a working directory that holds neither the data directory nor the other agent's config.
  - The docs say plainly that MCP checks can't stop an agent from reading files it has filesystem access to.
- **Localhost safety:** the server binds to `127.0.0.1`, and Host/Origin checks (DNS-rebinding protection) are on.

## 12. MCP tools

There are exactly four tools. Every input is validated with a schema (zod). Every response is structured JSON containing `series_id`, `match`, `phase`, `round`, `state_version`, and a `next` object (`do`, `why`, and the ids needed for the next call).

| Tool | Input | Returns |
|---|---|---|
| `list_games` | `{ series_id? }` | The manual (Markdown), the effective config, board geometry and slot list, and the action schemas. With `series_id`: that series' settings and deadline. |
| `manage_match` | `{ operation: "join" \| "ready" \| "leave" \| "resign", series_id, name? (join), for_match? (ready), request_id }` | The seat and phase, or a rejection reason. |
| `get_match` | `{ series_id?, since_version?, wait_s? (0–25), detail?: "summary" \| "full" }` | The observation. Without `series_id`: the caller's series. |
| `submit_action` | `{ series_id, match, round, request_id, actions: [...] }` | `accepted`, or `rejected` with a reason per action. |

- **Long-poll:** `get_match` with `since_version` waits up to `wait_s` seconds (at most 25, because Claude Code drops a silent request after 60 s and Codex ignores progress notifications). It returns as soon as the version changes, otherwise `poll.changed: false`. The server never tries to wake an agent itself.
- **Observation contents:**
  - `you` (seat, name), `waiting_on`, `deadline` (null, or the time left plus each player's misses and whether a round was auto-filled), and `series` (wins, draws, first_to, tiebreak_match);
  - `players` (name, base, gold, income_next, submitted), `towers` (slot, owner, type, level, targeting) and `free_slots`;
  - `attackers`: per direction, counts by type (alive and queued) plus **the 5 closest to the base** (type, progress 0–1, health). `detail: "full"` lists every attacker;
  - `last_round` (both revealed bundles, kills, base hits), `report` (in `strategy_review` and at series end) and `poll`.
- **Actions** run in list order:
  - `{ type: "build", slot, tower, targeting? }`
  - `{ type: "upgrade", slot }`
  - `{ type: "target", slot, targeting }`
  - `{ type: "send", units: [{ type, count }, ...] }` (spawns in list order)

  An empty list means "save gold".
- **Idempotency:**
  - Every mutation (`manage_match`, `submit_action`) needs a unique `request_id`.
  - Repeating a `request_id` with the same payload returns the original response.
  - The same `request_id` with a different payload is rejected.
  - Records are appended per series in `requests.jsonl`; legacy `requests.json` snapshots are merged on recovery. Duplicate request ids return the stored response without repeating the mutation.
- **Example payloads:** [`prototype/agent-schema` branch](https://github.com/sudolaw/pi_mono/blob/prototype/agent-schema/mcp_multi_player/prototype/agent-schema.md).

## 13. Logs and persistence

Each series has a folder: `<data>/series/<series-id>/`.

| File | Contents | Visibility |
|---|---|---|
| `events.jsonl` | Public history, append-only. Every event carries `seq`, `ts`, `seriesId`, `matchId`, `round`, `type`, `actor` (seat + name) and `payload`. Types: `series_created`, `settings`, `player_joined`, `player_ready`, `warmup_round`, `deadline_set`, `match_started`, `round_published`, `bundle_submitted` (the fact only), `round_resolved` (both bundles revealed, a combat summary and the state hash), `deadline_missed`, `match_ended`, `strategy_review_started`, `host_action`, `series_ended` | Public |
| `audit.jsonl` | Everything above plus rejected bundles with reasons, request ids, idempotent replays, id-reuse rejections, connects and disconnects, and host actions | Private |
| `state/m<NN>-r<NNN>.json` | The full simulation state at the start of each round | Private during the match; public afterwards |
| `combat/m<NN>-r<NNN>.json` | The round's timeline: spawns, shots, hits, splashes, slows, kills and base hits with their sim time, plus attacker positions at 10 Hz | Public (after resolution) |
| `match-<NN>.log` | A plain-text log for humans, written live, e.g. `R042 · P1 Claude Code: built Plasma @P1-4, sent 6× Crawler · P2 Codex: upgraded Laser @P2-3 → L2 · combat: 9 kills, 1 base hit on P2 (14/20)` | Public content only |
| `series.json`, `requests.jsonl` | Current series record (seats, phase, readiness, the accepted pending bundles, the deadline) and append-only idempotency records; old `requests.json` snapshots are supported | Private |

- **Write order:** asynchronous writes and all mutations are serialized per series. Events, state, request records, and the final series record finish writing before the response or public notifications go out. Independent series can proceed concurrently. A write/worker failure stops that series and rejects the operation; recovery requires restarting the server.
- **CPU isolation:** server simulation, validation, request fingerprints, live timelines and state hashes run in a reusable pool of at most four worker threads. Each series keeps worker affinity; tick replies carry current state and at most one frame rather than accumulated timelines. Pure engine APIs remain synchronous for offline replay and balance checks. Gameplay math and hashes are unchanged by this runtime refactor.
- **History:** keep the latest 400 public events and the current match's resolved rounds in memory. Startup rebuilds these once using streamed, bounded parsing batches; production JSONL parsing runs in the worker pool. Historical event queries and replay can still stream the full log. Idempotency lookup stays in memory, but mutations append one record instead of rewriting its full history.
- **Spectators:** build and serialize a public view once per version and a combat message once per update for all viewers. Buffer messages across initial async history loading. Recent connection history is also capped at 96 KiB, and each slow-client backlog is capped at 256 KiB; disconnect over-limit clients so they can reconnect. Combat files use asynchronous file serving. Cache the manual template and bounded rendered variants.
- **Restart recovery:** the server rebuilds each series from `series.json`, the latest state file and `events.jsonl`. Pending bundles, readiness and "waiting on" survive a restart. No database is used.
- **Replay:** `npm run replay -- <series-id>` re-runs the series from the logged settings and bundles and checks every round's state hash (SHA-256 of canonical JSON).
- **Tokens are never logged.** Nothing is deleted automatically.

## 14. Spectator page

Designed to look like a TV broadcast. Everything is drawn **inside one canvas**, so that recording captures it.

- **Top of the page:** **▶ Start game** (shown on the start screen, enabled once both agents have joined) and **↺ Restart** (always), both needing the host key.
- **Start screen** (before the game starts, drawn in the canvas): the title, the series format, a card per seat showing the agent's name and "✓ joined" or "Waiting for an agent…", and a line saying whether we are waiting for agents or for the host to press Start, plus how agents connect.

- **Scoreboard across the top:**
  - each player's name with seat colour (P1 cyan, P2 pink), a base-health bar and number, gold, kills, and series-win pips out of 4;
  - in the centre: "Match N · Best of 7", the series score and "Round r / 100".
- **Phase banner:** "Waiting for players", "Waiting for both to be ready", "Warm-up round 2 / 3", "Waiting for P2's actions (4m 12s)", "Resolving combat", "Strategy review: waiting for P1 to be ready for match 4", "Series won by …". It shows how long each player has been waited on, never "thinking". Tiebreak matches are labelled.
- **Board:**
  - zones tinted by third, both pipes drawn, and both bases;
  - towers drawn with a shape per type (Laser diamond, Plasma circle, Cryo hexagon), an outline in the owner's colour, the level number inside, and a short label below showing type, level and targeting priority;
  - attackers **carry no text labels**: they are told apart by shape and colour, with a health bar above each;
  - projectiles and slowed attackers are visible (e.g. a frost tint).
- **Key strip** along the bottom edge explains every shape and colour.
- **Logs panel:** the public action and combat log from `events.jsonl`.
- **Results:** the match and series result screens.
- **Playback:**
  - the page animates each round from its `combat/` timeline;
  - speed can be 1×, 4×, 10× or skip to the latest round; speed and skipping never change results;
  - the page follows its series' active match automatically. Two tabs on the same URL show the same series, and different series are independent.
- **Record button:** saves the canvas as `.webm` via the browser's `MediaRecorder` (`canvas.captureStream()`), at whatever playback speed is selected.
- **Dashboard (`/`):** a list of series with their status and spectator links, plus **Create series** (host key required) with the advanced settings.
- **Visual reference:** [`shared-pipes.html?variant=G` on `prototype/lane-layout`](https://github.com/sudolaw/pi_mono/blob/prototype/lane-layout/mcp_multi_player/prototype/shared-pipes.html).

## 15. Manual and agent setup

**One manual** (`docs/manual.md`) serves both humans and agents. The spectator site renders it, and `list_games` returns the same text. It shows the series' real settings and never a real token.

Its order:
1. **Connect to the MCP server:**
   - the server URL (`http://127.0.0.1:8787/mcp`);
   - Claude Code: `claude mcp add -t http mcp-multi-player http://127.0.0.1:8787/mcp -H "Authorization: Bearer $MMP_TOKEN"`;
   - Codex: `codex mcp add mcp-multi-player --url http://127.0.0.1:8787/mcp --bearer-token-env-var MMP_TOKEN`, then set `tool_timeout_sec = 60` for it in `config.toml`;
   - pre-approve the four tools in both clients, so polling never stops to ask the user.
2. **Example prompt:** "Join series `<id>` as `<name>` and play it to completion."
3. **The play loop:**
   - `list_games` → `join` → (discuss with the user if wanted) → `ready`;
   - then loop on `get_match` and follow `next`: submit a bundle, or wait (long-poll), or read the report and mark ready, or stop when the series has finished.
4. **Recovery after an interrupted session:** start again with `get_match` and no `series_id`. It returns your series, seat and the `next` step; nothing is lost.
5. **Rules:** the board and zones, units and shapes, economy, rounds, combat, scoring, draws and tiebreaks, deadline, series.

**Repo docs (`README.md`):**
- install;
- `npm run add-player`;
- `npm start` (prints the host key and URL);
- opening the dashboard and creating a series;
- configuring both agents;
- running a demo with the scripted agents;
- replay.

**Scripted agents (`npm run bots -- <series-id>`):** two simple strategies that connect over the real MCP endpoint and play a whole series with no paid model calls. They are used for tests, demos and balance checks.

## 16. Code layout

```
mcp_multi_player/
  package.json          Node 22+, ES modules; deps: MCP SDK v2 (server + express), express, zod
  src/config.js         all balance values + board geometry (the only place numbers live)
  src/engine/           board.js · state.js · actions.js (validate/apply bundles) · sim.js (ticks) · hash.js
                        · index.js (resolve, live slots) · pool.js + worker.js (reusable simulation workers)
  src/series/           series.js (state machine, phases, readiness, warm-up, tiebreak) · record.js (series.json shape)
                        · queue.js (per-series serial queue) · live.js (live slot clock) · deadline.js
                        · views.js (observations) · report.js · describe.js (text log lines) · manager.js · replay.js
  src/bots/             strategies.js (scripted styles) · client.js (plays over MCP like an agent)
  src/store/            files.js (series folder, ordered async writes, event history, recovery)
  src/mcp/              server.js (4 tools) · rules.js (manual, settings, board, action format) · auth.js (bearer → player id, host key) · schemas.js
  src/web/              routes.js (dashboard, spectator, manual, combat files, host API) · stream.js (SSE)
  public/               dashboard + spectator (canvas renderer, playback, recorder)
  docs/manual.md        the one manual
  scripts/              add-player.js · replay.js · bots.js · balance.js · benchmark.js
  test/                 node:test suites
  LICENSE-reference     Apache-2.0 notice for adapted reference code
```

## 17. Verification

Automated tests (`npm test`) cover:
- **Engine:**
  - spending, overspend and negative gold;
  - build, upgrade and target, including ownership and slot rules;
  - spawn order, spacing and carry-over;
  - targeting priorities and tie-breaks;
  - damage and armor, splash, slow stacking;
  - base damage;
  - both bases falling in the same tick;
  - the round-100 decision;
  - determinism (same inputs give the same hashes).
- **Series:**
  - join, seats and the third-join rejection;
  - readiness per match (a stale ready is rejected);
  - warm-up and the deadline calculation;
  - waiting indefinitely without the simulation advancing;
  - deadline misses and the forfeit after 3;
  - draws, replays, tiebreak matches, forfeits and resets;
  - best-of-seven progression;
  - strategy review;
  - host cancel and forfeit.
- **Fair play:**
  - hidden bundles never leak through any tool or the spectator stream;
  - a player can't act for the other seat;
  - tokens appear in no file or response.
- **Reliability:**
  - duplicate, stale and concurrent submissions;
  - reusing a request id with the same payload versus a different one;
  - restart recovery mid-round, with one bundle pending;
  - replay.
- **Multiple series:** independent state, logs and permissions.
- **End to end:** the scripted agents play a full series through the real `/mcp` endpoint.

**Demo:** `npm start`, create a series, then `npm run bots -- <id>` and watch it at `/series/<id>`.

## 18. Changes to the brief

| Brief | v1 spec | Decided in |
|---|---|---|
| A separate defensive lane per player | One shared board, two pipes, a shared middle road, owned slots in thirds | [#18](https://github.com/sudolaw/pi_mono/issues/18) |
| Fixed income per round | Income rises +10 every 10 rounds | [#20](https://github.com/sudolaw/pi_mono/issues/20) |
| Draws always replayed | After 3 draws: tiebreak matches (kills, then tower damage) | [#20](https://github.com/sudolaw/pi_mono/issues/20) |
| No automatic deadlines by default | Deadline on by default, from warm-up: 2× the slower agent, at least 60 s; the host can turn it off | [#24](https://github.com/sudolaw/pi_mono/issues/24) |
| (not in the brief) | Warm-up rounds, advanced settings, one manual for humans and agents that starts with connecting, recording, a TV-style spectator view, agent display names | [#24](https://github.com/sudolaw/pi_mono/issues/24), map Notes |
| Credentials shown at series creation ([#24](https://github.com/sudolaw/pi_mono/issues/24)) | Long-lived per-player credentials made with `add-player`, so agent configs don't change per series; still shown only in the host's terminal | This spec |
