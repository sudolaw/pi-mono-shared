# mcp_multi_player v2 spec: split-screen defense race

Status: **v2.1** (play-test fixes from the first Claude Code vs Codex series: 30 s real-time waves,
stat upgrades, towers that soak leaks, one endpoint and one prompt for every agent, every number sent to the agents). This
is the source of truth. If code and spec disagree, fix one of them in
the same change. Numbers marked *starting value* are tuned by the balance ticket; changing them
needs no spec discussion, only an updated level file and balance notes.

v2 replaces the v1 tower defense & offense duel (issues #16–#30, removed in `e854724`). Section 15
lists what changed.

Contents: [1 Scope](#1-scope) · [2 Game](#2-game) · [3 Information rules](#3-information-rules) ·
[4 Architecture](#4-architecture) · [5 Engine](#5-engine) · [6 Match](#6-match) ·
[7 Series](#7-series) · [8 Lobby](#8-lobby) · [9 Store](#9-store) · [10 MCP door](#10-mcp-door) ·
[11 Web door](#11-web-door) · [12 Transactions](#12-transactions) · [13 Fair play](#13-fair-play) ·
[14 Verification](#14-verification) · [15 Changes from v1](#15-changes-from-v1)

---

## 1. Scope

**In v2:**
- Two AI agents (any MCP app: Claude Code, Codex, another account…) on one laptop, both through the
  same endpoint `/mcp`; `join` hands out the seats.
- Each agent defends **its own copy of the same board**. A seeded wave generator sends **identical
  waves** to both boards. Whoever defends better wins.
- Turn-based: agents decide between waves; the server simulates each wave.
- Best-of-N series (default best of 3). One series is open at a time.
- A browser dashboard and a split-screen spectator page, live for the host, public after each match.

**Out of v2:**
- Sending attackers to the opponent, seeing any of the opponent's progress during a match, selling
  towers, repairing towers or bases, healing.
- More tower or attacker types than listed here, attacker abilities.
- Previewing waves, seeing the opponent during a match.
- Real-time play, play across machines, table talk between agents.
- Binding a token to the app that joined (v1 did this; v2 drops it).

**Reference:** [boxops/tower_defense_js](https://github.com/boxops/tower_defense_js) (Apache-2.0),
a single-player wave defense game. Tower numbers, path-following maths and drawing style are adapted
from it. Any file adapted from it keeps the Apache-2.0 notice (`LICENSE-reference` plus a header line
naming the source file). The simulation is new code.

**Stack:** plain JavaScript (ES modules) on Node 22+, tests with `node:test`, MCP TypeScript SDK v2.

---

## 2. Game

### 2.1 Board

A level draws its board as ASCII rows. Both players get the same board.

```
      1 2 3 4 5 6 7 8 9 10 11
  A   S # # # # # # # # #  .
  B   . o . o . . o . o #  .
  C   . # # # # # # # # #  .
  D   . # o . o . . o . .  .
  E   . # # # # # # # # #  .
  F   . . o . . o . . o #  .
  G   . # # # # # # # # #  .
  H   . # . o . . o . . .  .
  I   . # # # # # # # # #  B
```

- `S` spawn, `B` base, `#` path, `o` tower slot, `.` empty.
- Tile ids are row letter plus column number (`D5`). Tiles are 64 units; this board is 704 × 576.
- **The path** is derived at load: start at `S`, follow `#` tiles to `B`. Each step must have exactly
  one unvisited path neighbour, otherwise the level is rejected with the tile that broke it. The
  path is a polyline through tile centres; an attacker's position is its distance along it.
- **Slots** are fixed. A slot holds at most one tower. There is no free placement.
- **Slot info** is computed at load: for each slot and tower type, which stretches of path (as path
  tile numbers, 1 = spawn) and how many tiles lie within range, at base range and at the range cap.
  Agents receive it, so they don't need geometry.
- **Leak order** is computed at load: slots sorted by straight-line distance to the base (ties by
  id). Leaks hit towers in this order (§2.5).
- This board (the `normal` level) has 12 slots and a path of 50 tiles (3,200 units).

### 2.2 Towers

Towers shoot only attackers on their own board. *Starting values.*

| Tower | Build | Damage | Range | Shots/s | Hit |
|---|---:|---:|---:|---:|---|
| Laser | 200 | 15 | 160 | 3.0 | Instant |
| Cannon | 250 | 60 | 180 | 0.7 | Shell, speed 320, splash |
| Cryo | 180 | 8 | 155 | 2.5 | Shell, speed 480, slow |

Damage is the wave-1 value: towers lose 10 % of their damage every wave (§2.4).

- **Upgrades:** an upgrade names one stat, `damage`, `rate` or `range`, and adds **20 % of the
  type's base value** to it. Upgrades add up and never compound (3 damage upgrades = base × 1.6).
  Each costs **the tower's build cost** (`rules.upgrade.costShare` = 1). Damage and rate have no
  limit; range stops after `maxRangeUps` = 5 upgrades (double). Live numbers are rounded: damage to
  0.1, rate to 0.01, range to whole units.
- **Tower health:** every tower has `rules.towerHealth` = 7 (about a third of the base's 20). A
  tower at 0 is destroyed: removed with its upgrades, its slot free to build on again. Shells
  already in flight still land.
- **Damage:** every hit does `max(1, damage − armour)`. Damage dealt (without overkill) is credited
  to the tower; the last tower to hit an attacker gets the kill.
- **Splash (cannon):** radius 48 around the impact; every other attacker inside takes 50 % of the
  damage, armour applied separately.
- **Slow (cryo):** speed × 0.45 for 2.5 s (25 ticks). A new slow replaces the current one.
- **Shells** home on the target's current position. If the target is gone first, the shell
  vanishes.
- **Targeting** per tower, default `first`: `first` (furthest along), `strongest` (most health),
  `weakest` (least health), `fastest` (highest current speed). Ties go to the one furthest along,
  then the lowest id.
- Tower behaviour is composed in the level file: a delivery (`instant` or `projectile`) and a list of
  on-hit effects (`damage`, `splash`, `slow`). New towers from existing pieces need no code.

### 2.3 Attackers

| Attacker | Health | Speed | Armour | Reward | Wave cost | Drawn as |
|---|---:|---:|---:|---:|---:|---|
| Crawler | 160 | 110 | 0 | 8 | 10 | Green circle |
| Runner | 90 | 200 | 0 | 12 | 14 | Yellow triangle pointing its way |
| Scarab | 440 | 80 | 12 | 18 | 32 | Purple armoured square |

*Starting values.* Speed is units per second. Health is multiplied by the wave's health scale.
Reaching the end of the path does **exactly 1 damage** (§2.5) and pays no reward. On `normal`
(3,200 units of path) a crawler takes 29 s to cross, a runner 16 s and a scarab 40 s.

### 2.4 Waves

- **All waves are generated once, at match setup, from the match seed alone.** They are stored in
  the state. Player actions never touch the wave generator, so both boards always get the same
  waves: same types, same spawn ticks, same health. Seeds differ between matches.
- A match has **25 waves** on `normal` and `hard` (10 on `tutorial`), one per turn.
- **Escalation** (`rules.escalation`): every wave the attackers get **20 % more health** than the wave
  before, and every tower deals **10 % less damage** than the wave before; both compound (wave `w`:
  health × 1.2^(w−1), tower damage × 0.9^(w−1)). Health is used rather than more units, so busy
  waves stay cheap to simulate and draw.
- Wave `w` (1-based), *starting values* on `normal`:
  - budget `20 + 8w + 0.1w²` (each level sets its own);
  - available types: crawler from wave 1, runner from wave 2, scarab from wave 4;
  - the generator buys units in order with the seeded random generator, at most 40 per wave,
    preferring types whose cost is at least 60 % of the remaining budget per remaining place;
  - spawns are spread over the whole wave, `clamp(floor(300 / count), 4, 30)` ticks apart from tick
    0, so attackers keep coming instead of arriving in a clump;
  - health scale: the escalation above (no extra linear growth on the shipped levels).
- **Balance target:** with the reference bots, the median match on `normal` ends around wave 12–16
  (see `docs/balance.md`).

### 2.5 Economy, health and leaks

- Starting gold **250**, income **60** per turn, kill rewards as listed. *Starting values.*
- Gold is spent only on building and upgrading. Each board has its own wallet.
- Base health **20**; tower health **7**.
- **Leaks:** each attacker reaching the end of the path does 1 damage to the standing tower first
  in the leak order (closest to the base). A tower at 0 is destroyed. Only with no tower standing
  does the base lose 1 health. Every leak counts in `leaked`, whatever it hit.

### 2.6 Turns and ticks

A turn is: agents decide → the server resolves one wave.

1. **Decide.** Both agents submit an action list (or nothing) for the coming turn. Moves are hidden
   until the turn resolves.
2. **Resolve.** For each board independently: apply its actions (in list order), queue this turn's
   wave, run **300 ticks of 0.1 s** (30 s of game time), then pay the turn income.
3. **Pace.** The next turn cannot resolve until `paceS` (default: the wave's length, 30 s) after
   this one did, so every wave plays in real time on the spectator page and a fast player gains
   nothing by hurrying. Agents get the result at once and decide during the playback.

Every tick, on each board, in this order, always iterating in id order:

1. spawn queued attackers whose tick has come;
2. move attackers (speed × slow × 0.1 s);
3. towers (in slot order): cooldown down by 0.1 s; if ready, pick a target in range, fire, reset the
   cooldown to `1 / rate`;
4. move projectiles; hits apply their effects;
5. remove attackers at 0 health and pay the reward;
6. remove attackers that reached the end of the path; each does 1 damage per §2.5.

Attackers still on the board at the end of a turn stay for the next one.

**Actions:**

| Action | Fields | Rules |
|---|---|---|
| `build` | `slot`, `tower` | Slot exists and is free; enough gold |
| `upgrade` | `slot`, `stat` | Slot has a tower; `stat` is `damage`, `rate` or `range` (range below its cap); enough gold |
| `target` | `slot`, `rule` | Slot has a tower; rule is one of the four |

An action list is checked in order against the gold left after the earlier actions; if any action
fails, the whole list is rejected with the reason and the legal moves. An empty list saves gold.

### 2.7 Time slot, warm-up and misses

- Each decision has a **time slot**, counted from when the previous wave resolved. Before match 1,
  `warmupWaves` (default 3) **warm-up waves** run as match 0: not scored, a 180 s slot, no
  forfeits. They record how long each player takes per decision; the slot for the real matches is
  `clamp(1.5 × slowest + 5 s, 20 s, 300 s)`, the same for both. Without a warm-up the slot is the
  series setting (default 60 s).
- The next wave runs when both have moved (or the slot ran out) **and** the current wave has had its
  time on screen (`paceS`, default 5 s). A slow player makes the screen wait, up to the slot.
- A seat that misses the slot plays an empty list for that turn. The miss is logged publicly.
- **3 misses in one match is a forfeit** of that match.

### 2.8 Outcome

Judged once per turn, after resolve:
- one base at 0 health → the other player wins;
- both at 0 in the same turn, or both alive after the last wave → compare **base health**, then
  **fewer leaks**, then **more kills**; if all equal, a **draw**.

### 2.9 Series

- Best of N, default **best of 3** (first to 2 wins). Draws score nothing. After `2 × target + 1`
  matches without a winner, the series is drawn.
- Each match's seed is derived from the series id and match number, so the whole series replays.
- **The host starts the series** with Start once both players have joined; nothing runs before that,
  so agents can read the rules. The warm-up (§2.7) comes first, then match 1.
- Players are shown by the model they are (`join` asks for it, e.g. "Claude Opus 5.5"); P1/P2 are
  only the left and right boards.
- Between matches both agents call `ready`; a seat that doesn't within **120 s** is marked ready.
  The next match starts when both are ready, but never sooner than **45 s** after the last one
  ended, so the last wave finishes on screen and the agents can read the report.

### 2.10 Host tuning (temporary, for finding the right difficulty)

- **Intensity** 0–10 (5 = waves as generated, 0 = none, 10 = twice the attackers): scales the count
  of each coming wave, same types in the same order.
- **Seconds per wave on screen** (`paceS`, 1–60 on the page): how long each wave plays on the
  spectator page; also the shortest time between two waves. Live, the page stretches a wave to the
  time turns are really taking (agents think between waves), so the screen keeps moving instead of
  freezing until the slower agent moves.
- **Random wave:** a burst of random attackers (more with higher intensity) joins the next wave.
- All three apply to both boards alike and are logged with the turn they shape (`turn.tuning`), so
  restarts and replays stay exact. They will be removed or fixed once the levels are tuned.

---

## 3. Information rules

| Who | Sees during a match | Sees after a match |
|---|---|---|
| Agent | Its own board only: health, gold, kills, leaked, towers (health, live numbers, upgrades, damage and kills last wave and in total), attackers on its board, last turn's summary, leak order, legal moves, the ASCII map and slot info. **No opponent data, no future waves.** | The match report: both boards' final numbers, every tower's damage and kills, and the result |
| Host (with host key) | Everything, live, on the split-screen page | Everything |
| Anyone else on the web | Seat names, phase, wave number, series score | The full replay of finished matches |

- Pending moves are never shown to anyone until the turn resolves (only `submitted: true/false`).
- The live split screen and its stream require the host key, because agents run on the same machine
  and could open the page.

---

## 4. Architecture

One Node process on `127.0.0.1` (default port 8787) serves the MCP endpoint, the web pages and the
stream. Layers call only downwards; results come back through callbacks and subscriptions.

```
main.js ─► MCP door ─┐
        ─► Web door ─┼─► Lobby ─► Series ─► Match ─► Engine ─► (Level)
                     │      │        │         │
                     │      └────────┴─────────┴──► Store ─► disk
                     └──────────────────────────────► shared/clock
```

| Part | Job |
|---|---|
| MCP door | Agents' entrance: tools → series/match calls (the seat is an argument), replies an agent can act on |
| Web door | People's entrance: dashboard, spectator page, stream, replays, host actions |
| Lobby | Creates and finds the one open series; checks the host key |
| Series | Best-of-N: seats, score, starts matches, readiness, end |
| Match | One game: owns state and version, hidden moves, deadline, calls the engine, commits, notifies |
| Engine | Pure rules: setup, validate, apply, view, render, outcome |
| Store | Files on disk: append-only logs, snapshots, index |

### 4.1 File tree

```
mcp_multi_player/
├─ package.json · README.md · AGENTS.md · .gitignore · LICENSE-reference
├─ levels/            tutorial.json · normal.json · hard.json
├─ docs/              spec.md · manual.md · lifecycle.md · balance.md
├─ src/
│  ├─ main.js         `npm start`: prints addresses and the host key
│  ├─ app.js          composition root: store, lobby, /mcp and the web routes on one app
│  ├─ types/          game.js · records.js            (JSDoc typedefs only)
│  ├─ shared/         clock.js · ids.js · queue.js · hash.js · timer.js
│  ├─ config/         schema.js · layout.js · load.js
│  ├─ engine/         index · state · board · waves · moves · stats · tick · attackers · towers ·
│  │                  projectiles · targeting · effects · geometry · rng · views · render ·
│  │                  outcome · events
│  ├─ match/          index (submit, resolve, end) · phases · pending · idempotency ·
│  │                  subscribers · cache · persist
│  ├─ series/         index · phases · seats · score · matches · persist
│  ├─ lobby/          index · tokens · restore
│  ├─ store/          index · log · audit · snapshots · paths
│  ├─ mcp/            server · auth · schemas · format · rules · setup
│  └─ web/            routes · sse · host · public/ (index.html · dashboard.js · series.html ·
│                     series.js · draw.js · play.js · scoreboard.js · setup.js · style.css)
├─ test/              a few files: engine rules, match lifecycle, series, a bot series over MCP,
│                     the playback contract
└─ scripts/           bots.js · strategies.js · balance.js · replay.js
```

The browsable version of this tree, with every file's operations, data and interface, is the
"Wave Duel File Tree" prototype page; this section wins where they differ.

### 4.2 Core data

```
Level      { id, hash, layout {tile, rows[], slots[], path, leakOrder}, towers{ cost, base
             {damage, range, rate}, delivery, onHit }, attackers{}, waves {recipe},
             rules {startGold, income, startHealth, towerHealth, ticksPerTurn, dt, missLimit,
             maxActions, upgrade {step, costShare, maxRangeUps}} }
State      { turn, waves: Wave[], boards: { P1: Board, P2: Board } }
Board      { health, gold, kills, leaked, spent, towersLost, towers: {slotId: Tower},
             attackers: Attacker[], projectiles: Projectile[], queue: Spawn[], nextId, lastTurn }
Tower      { slot, type, ups {damage, rate, range}, health, cooldown, targeting,
             totals {damage, kills, shots} }
Attacker   { id, type, hp, maxHp, dist, slowUntil, slowFactor, lastHit }
Projectile { id, x, y, targetId, speed, tower, slot, damage }
Wave       Spawn[]   with Spawn { atTick, type }
Action     { type: build|upgrade|target, slot, tower?, stat?, rule? }
Event      { board, tick, type: spawn|build|upgrade|target|shot|splash|death|leak|tower_lost, ... }
View       per-seat agent view (§10.3)
Render     per-board drawing data: towers, units {id,type,x,y,hpPct}, projectiles, base health
Result     { winner: P1|P2|null, reason }
```

Config is plain frozen data; state is plain JSON (round-trips unchanged); there are no classes.
Instances refer to their type by name and look numbers up in the level.

---

## 5. Engine

**Pure.** No I/O, no clock, no `Math.random`, no globals; never mutates its inputs.

| Function | Input | Output |
|---|---|---|
| `setup(level, seed)` | | State at turn 0 with all waves generated |
| `validate(state, seat, actions, level)` | | ok, or `{code, message}` |
| `legalMoves(state, seat, level)` | | free slots, upgrades with costs, tower costs, gold |
| `apply(state, {P1, P2}, level)` | action lists | `{state, events}` for the next turn |
| `view(state, seat, level)` | | the agent's View (own board only) |
| `render(state, level)` | | Render for both boards |
| `outcome(state, level)` | | `{over:false}` or `{over:true, winner, reason}` |
| `hash(state)` | | stable fingerprint |

- `apply` copies the state once, then mutates the copy freely through a shared turn context
  `{state, level, events, tick, dt}`.
- Registries: `targeting` (rule → picker), `effects` (name → on-hit function), delivery
  (`instant` | `projectile`).
- Error codes: `unknown_slot`, `slot_taken`, `empty_slot`, `unknown_stat`, `max_range`,
  `insufficient_gold`, `unknown_tower`, `unknown_rule`.
- **Invariant:** if `validate` passes, `apply` does not throw on those actions.

---

## 6. Match

[lifecycle.md](lifecycle.md) walks through a move from `submit` to the next match: who owns each
change, which queue runs it, when it is durable and what awaiting each method guarantees.

`createMatch({engine, store, clock}, {id, seriesId, matchNo, level, seed, deadlineS, paceS, missLimit, onEnd})`,
`restoreMatch(deps, opts)`.

| Method | Returns |
|---|---|
| `start()` | — |
| `submit({seat, forVersion, requestId, actions})` | `{ok, status: accepted|duplicate, version}` or `{ok:false, code, message, currentVersion, legal}` |
| `getView({seat, since, waitMs})` | `{changed:true, version, view}` or `{changed:false, version}` |
| `getRender()` | `{version, render, events}` |
| `subscribe(listener)` | unsubscribe function |
| `status()` | `{phase, version, turn, submitted:{P1,P2}, deadlineAt, nextWaveIn, misses}` |
| `cancel(reason)` | — |

- **Phases:** `created → collecting ⇄ resolving → over`; `cancelled` from any phase.
- **Version** is 1 at start and increases by exactly 1 per resolved turn.
- **Persisted:** id, seed, level hash, phase, version, state (via snapshots + log), pending moves
  (audit), deadline, misses, result. **In memory only:** view cache, waiters, subscribers, timers,
  the pace (after a restart the next wave may run at once).
- **Submit codes:** `stale_version`, `already_submitted` (moves lock once in), `invalid_action`,
  `match_over`, `request_id_reused` (same id, different arguments).
- **Invariants:** only resolve changes state; log commit → memory swap → notify, in that order;
  every mutation runs through the match's queue; pending moves never leak.
- **Failures:** a store write failing leaves state unchanged and returns an error; an engine throw
  cancels the match (`onEnd({error})`); a deadline and a move arriving together are ordered by the
  queue; restart rebuilds state and pending moves and re-arms the deadline.

---

## 7. Series

`createSeries({store, clock, matchFactory}, {id, level, target, deadlineS, paceS, readyS, gapS})`, `restoreSeries`.

| Method | Purpose |
|---|---|
| `join({seat, name, requestId})` | Take a seat with a display name (1–32 chars); rejoin allowed |
| `ready({seat, forMatch, requestId})` | Ready for the next match |
| `status()` | phase, match number, score, seats, target, winner |
| `rules()` | manual + level summary + slot info |
| `currentMatch()` | the live match or null |
| `replay(matchNo)` | render frames for a finished match (re-simulated) |
| `cancel(reason)` | host only |

- **Phases:** `waiting → in_match ⇄ between → done`; `cancelled` from any phase.
- **Data:** `SeriesRec {id, levelHash, target, phase, matchNo, seats, score {P1, P2, draws}, ready,
  history [{matchNo, seed, result}], winner}`.
- **Invariants:** at most one live match; score changes once per match end; seats never change once
  both joined; after `done`/`cancelled` everything is refused.

---

## 8. Lobby

`createLobby({store, clock, config, seriesFactory, hostKey, readyS, gapS})`.

| Method | Purpose |
|---|---|
| `createSeries(hostKey, {levelId, target, deadlineS, paceS})` | returns `{seriesId}`; refused while another series is open |
| `openSeries()` · `latestSeries()` | the one open series; the newest of all |
| `get(id)` · `list()` · `delete(hostKey, id)` · `levels()` · `restore()` · `subscribe(fn)` | |

- **One open series at a time.** Both seat addresses always play in the open series; with none open, the
  agent's tools still work and tell it to wait (or, right after a series, how it ended).
- The host key comes from `MMP_HOST_KEY` if set, otherwise it is random per start; it is printed once
  and never stored. Comparison is constant-time.

---

## 9. Store

Files only, outside the repo (default `~/.local/share/mcp_multi_player/`, `--data` / `MMP_DATA_DIR`).

```
<data>/
  lobby.json                    series ids and level ids                 (atomic write)
  series/<id>/
    series.jsonl                joined · match_started · match_ended · ready · series_ended
    match-01/
      events.jsonl              public: turn {actions P1/P2, stateHash}, miss, phase
      audit.jsonl               private: pending moves before reveal, rejects
      snapshots/turn-010.json   full state every 10 turns
      match.log                 readable text, one block per wave
```

- `openSeries(id)` → `{append, audit, snapshot, load}`; `listSeries`, `deleteSeries`,
  `readIndex`, `writeIndex`.
- `append` resolves only once the line is on disk (writes batched per file). **This is the commit
  point** of every transaction.
- Load drops a half-written last line; a bad snapshot falls back to the previous one or a full
  replay.
- **Invariants:** append-only; the host key is never written; the audit log is never
  served.

---

## 10. MCP door

### 10.1 Endpoint and auth

- `/mcp`, MCP TypeScript SDK v2 `createMcpHandler`, **stateless** (nothing kept per connection),
  bound to `127.0.0.1` with localhost Host/Origin checks.
- One endpoint, `/mcp`, for every agent. There is no token: both agents run as the same OS user and
  can read each other's configs anyway, and tokens only made setup break whenever they changed.
- `join` gives the caller the first free seat (P1, then P2) and a **player id** (e.g. `P1-7f3a`, not a
  secret); every later reply carries it in `next.args`, and `state`, `act` and `ready` take it.
  `join` with the id is a rejoin after an interruption. The join reply doesn't repeat the rules
  (`understood: true` means the agent has read them). A third agent is turned away
  (`series_full`); a player the host removed is told to stop.
- **Statuses** in every reply: `your_move`, `waiting_for_opponent`, `waiting_for_wave_on_screen`,
  `waiting_for_host_start`, `waiting_for_players`, `between_matches`, `series_over`, `removed`.
- The connect instructions are short (what the game is, call `rules`, `join`, follow `next`):
  clients cut long instructions off. Every number is in `rules`.
- `rules` and the first `join` reply carry the full rules brief with this series' numbers.
- Grounded in the `research/mcp-client-limits` branch (#17): the strictest client limit is ~60 s to
  the first response byte, and progress notifications can't be relied on to extend a call.

### 10.2 Tools

| Tool | Input | Does |
|---|---|---|
| `rules` | — | manual, rules brief with this series' numbers, ASCII map, slot reach and leak order |
| `join` | `name` (the model), `understood: true`, `player?`, `request_id` | take a free place; returns your player id (or rejoin with it) |
| `state` | `player?`, `since?` (the `cursor` from the last reply), `wait_s` (0–25) | your view; waits up to `wait_s` until something changes and is released early if the client cancels |
| `act` | `player`, `for_version`, `request_id`, `actions[]` | submit this turn's actions |
| `ready` | `player`, `for_match`, `request_id` | ready for the next match |

`rules` and `state` are marked read-only. Errors are returned as tool results (not protocol errors)
with `code`, `message` and `legal`, so the model can read them and recover.

### 10.3 Replies

Every reply has a short **text** block (what the model reads) and the same facts as
`structuredContent` with a declared output schema. Every reply has a `next` field naming the exact
call to make. A `state` reply during a match (shortened):

```
mcp_multi_player · series s_1a2b3c4d (normal) · you are P1 (Claude) · match 1 · score P1 0 - P2 0 (first to 2)
Wave 7 of 25 done. Decision before wave 8, deadline in 58 s.
You: base health 20 · gold 245 · kills 52 · leaked 2 · towers lost 0 · spent 640
Last wave (7): 21 spawned, 20 killed, 1 leaked (1 hit towers, 0 hit the base), +268 gold
Your towers:
  F9 cannon · health 6/7 · damage 72, rate 0.7/s, range 180 (+1 damage) · last wave 811 damage, 6 kills · upgrade 125
Leaks hit: F9 → H7 → base
Next: act {"for_version":8}. Choose your actions for wave 8 ...
```

`structuredContent`: `version, status, cursor, series, match {wave, of, deadline_in_s,
next_wave_in_s, misses}, me {health, gold, kills, leaked, towers_lost, towers[], leak_order},
last_wave, threats {on_board, closest[≤5]}, legal {gold, build, upgrades, retarget}, next`. After
a match: `report` (both boards, every tower's damage and kills). Replies stay well under 10k tokens.

### 10.4 Agent setup (on the dashboard and the series page)

- **Register once per app:** Claude Code: `claude mcp add -s user --transport http mmp
  http://127.0.0.1:8787/mcp` (after removing any older `mmp`); Codex: `codex mcp add mmp --url
  http://127.0.0.1:8787/mcp`; any other MCP app: an HTTP server named `mmp` at that address. It
  never changes, so this survives every series and every restart.
- **Every series after that:** paste the same prompt into a new session of each of the two agents
  (apps load MCP servers only at startup). The prompt: read `rules`, `join` (which gives a seat),
  then loop `state` → `act` following `next` and its args until the series is over; think about
  each move, never script the game; if the tools are missing, stop and say so; after an
  interruption `join` again with the same name and seat.

---

## 11. Web door

Same process and port as the MCP door.

| Route | Access | Returns |
|---|---|---|
| `GET /` | public | dashboard: series list; host can create, cancel, delete |
| `GET /series/:id` | public | split-screen page (boards only with host key while live) |
| `GET /manual` | public | the manual |
| `GET /api/series` | public | list: id, level, phase, wave, score, seat names |
| `GET /api/series/:id` | public | status (no board data while live) |
| `GET /api/series/:id/state` | host while live | render + scoreboard at the current version |
| `GET /api/series/:id/stream` | host while live | SSE |
| `GET /api/series/:id/matches/:n/replay` | public once that match is over | render frames, re-simulated from the log |
| `GET /api/setup` | public | the two seat setup blocks (nothing secret in them) |
| `POST /api/series` | host | create (`level`, `best_of`, `deadline_s`, `pace_s`); 409 while another is open |
| `POST /api/series/:id/cancel` · `DELETE /api/series/:id` | host | Stop (cancel); delete when not live |
| `POST /api/series/:id/start` | host | Start once both have joined (warm-up, then match 1) |
| `POST /api/series/:id/seats/:seat/leave` | host | remove a player: frees the seat before the start, forfeits the series after |
| `POST /api/series/:id/tuning` | host | `intensity`, `pace_s`, `random_wave` (§2.10) |
| `POST /api/close` | host | cancel the open series (agents are told to stop), exit after 30 s |

- The host key travels in the `X-Host-Key` header (the page keeps it in memory after you type it).
  Wrong key → the same generic error every time.
- **SSE messages:** `hello {matchNo, version, render}`, `phase {phase, submitted, deadlineAt}`,
  `turn {version, events, frames, render}`, `match_end {result, report}`, `series_end`. Message id
  `matchNo:version`; a reconnecting browser gets a fresh snapshot (`hello`), which is all the page
  needs to catch up; heartbeat every 15 s; a browser that falls far behind is dropped and reconnects.
- **Page:** scoreboard across the top (names, health bars, gold, kills, leaked, towers lost, wave
  n/25, phase, series score), P1 board left, P2 board right, wave feed below, and (for the host) the
  two seat setup blocks with copy buttons. Each wave plays in real time by default (1×; 2×, 4×, 8×
  to choose): units glide along the path between one frame per second, shots, splashes, kills,
  tower hits and destroyed towers appear at their tick, then the board snaps to the final render.
  If turns pile up, queued ones play at 4× rather than being skipped. Towers show their health and
  upgrade counts.
- Closing or refreshing a browser never affects a game.

---

## 12. Transactions

Each runs through the owning match's or series' queue. Order: **validate → append to log (commit)
→ change memory → reply / notify.** If the log write fails, nothing changes.

| # | Transaction | Steps |
|---|---|---|
| T1 | Create series | host key → no other series open → load level → series log → index entry → reply |
| T2 | Join | asked seat taken → rejoin; else first free seat (none → `series_full`) → log `joined` → set seat → if both: start match 1 |
| T3 | Submit | saved reply for this `request_id`? return it · phase/version ok · `validate` → audit `pending` → store pending + reply → ack · if both in: T4 |
| T4 | Resolve | `apply` + `outcome` → log `turn` {actions, stateHash} → swap state, version + 1 → rebuild cache → notify → T5 check |
| T5 | Match end | log `match_ended` → series score → log → phase `between` or `done` → notify |
| T6 | Ready / next match | log `ready` → if both (or timeout): new match with derived seed → log `match_started` → start |
| T7 | Restore | lobby index → each series → each live match: snapshot + replay the log tail through the engine → **check hashes** → re-arm deadlines |

---

## 13. Fair play

- The server checks every action; agents can only act on their own board.
- Moves are hidden until resolve; agents never see the opponent or future waves during a match.
- Each turn waits for both decisions (or the deadline) and for the last wave's time on screen, so
  a fast script gets no extra turns.
- The host key is never stored or given to agents; the live view and the host actions need it.
- A seat is an argument, not a secret: an agent could pass the other seat, just as agents on the same
  OS user could read each other's files; the server can't prevent that (see Limits).
- **Limits:** the server cannot stop an agent reading files its OS user can read (including the data
  folder). For strong isolation, run each agent as its own OS user or in a container.

---

## 14. Verification

**Mainly by playing.** Automated tests stay few and cheap; they guard only what is hard to see by
watching.

- **A small test set (`npm test`, seconds):**
  - same seed + same actions → same state hash;
  - both boards receive identical waves;
  - layout parsing rejects a broken path;
  - one smoke run where two scripted bots play a short series over the real `/mcp`.
- **Play-testing (the real check):**
  - watch bots play (`npm run bots`) on the split screen;
  - then Claude Code vs Codex play a best-of-3 without the host stepping in;
  - kill and restart the server mid-match and confirm it carries on.
- **Replay check:** `npm run replay` re-runs a finished series and compares every state hash.

Add a test only when a play-test finds a bug that is easy to reintroduce.

---

## 15. Changes from v1

| v1 (#16–#30) | v2 |
|---|---|
| One shared 1600 × 800 board, two pipes | Two identical ASCII tile boards, split screen |
| Players send attackers at each other | A seeded generator sends identical waves to both |
| Gold split between defense and attack | Gold is for defense only |
| Income rises to break stalemates | Wave escalation; 100 waves, tiebreak after (40 since v2.1) |
| Both sides fully visible | Agents see only their own board; live view needs the host key |
| Live combat slots and worker pools | Strictly turn-based; one wave simulated per turn |
| Tokens bound to the joining app, new each start | Hashed tokens, valid across restarts, no app binding |
| Best of 7 | Best of 3 by default |
| Warm-up rounds set the deadline | Fixed default deadline (60 s since v2.1), host-settable |

### v2.1 (after the first Claude Code vs Codex series)

| Problem seen | Change |
|---|---|
| Rules on connect had no numbers; deadline said 100 s in text, 30 s in data | One rules brief with every number, sent on connect, on join and by `rules`; the deadline lives only on the series |
| Gold piled up after every slot was maxed (~wave 31) | Stat upgrades, +20 % of base each for the build cost, no cap on damage and rate |
| No late-game decisions | Leaks destroy towers (closest to the base first), so defenses must be rebuilt and re-upgraded |
| 5 s waves rendered too fast, and skipped when turns queued | 30 s waves played in real time; the server waits for each wave's time on screen; queued turns speed up instead of being skipped |
| Matches all ended on wave 58 of 100; too many small decisions | 40 bigger waves; median end ~31 on `normal` |
| The pause between matches did nothing | At least 45 s between matches |
| Gold-spent tiebreak meaningless | Base health, then fewer leaks, then more kills |
| No per-tower feedback; slot coverage was a bare total | Damage, kills and shots per tower; slot reach as path tile stretches at base and capped range |
| A new token per series; stale entries blocked new ones; tokens changed on every restart; seats tied to apps | No tokens: one endpoint and one prompt for every agent, registered once per app; `join` hands out the seats |

