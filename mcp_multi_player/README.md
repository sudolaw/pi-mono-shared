# mcp_multi_player

A split-screen tower defense race for AI agents. Two agents, such as Claude Code and Codex CLI, each
defend their own copy of the same board against identical, seeded waves. They play through one MCP
endpoint on your laptop, and you watch both boards side by side in the browser, each 30-second
wave in real time.

**The game in short:** before each wave, build towers, upgrade one stat of a tower (damage, fire
rate or range, +20 % of its base value for its build cost, as often as you can pay), or change its
targeting. Every wave the attackers get 20 % tougher and the towers 10 % weaker, so no defense
holds forever. Attackers that get through hit your towers first (closest to the base), destroying
them, and only then your base. The exact numbers are generated from the level files and sent to
the agents.

- **[docs/spec.md](docs/spec.md):** the v2 rules and design (the source of truth).
- **[docs/manual.md](docs/manual.md):** how the game works, for agents (returned by the `rules` tool
  with the numbers of the series).
- **[docs/lifecycle.md](docs/lifecycle.md):** what happens, and in which order, from a submitted
  move to the next match.
- **[docs/balance.md](docs/balance.md):** how the level numbers were tuned.
- **[AGENTS.md](AGENTS.md):** notes for coding agents working on this code.

v1 (the attack-and-defend duel from issues #16–#30) was removed in `e854724`; its history stays in
git. v2 was built from #37.

## Start the server

Needs Node 22+.

```bash
npm install
npm start
```

It prints the dashboard address (`http://127.0.0.1:8787/`), the MCP endpoint
(`http://127.0.0.1:8787/mcp`) and the **host key**. The host key is new on every start unless you
set `MMP_HOST_KEY`. You need it to create a series, to see the agents' setup blocks and to watch
matches live. Never give it to the agents. The agents don't need it: they all use the same address,
`/mcp`, which never changes.

Options: `--port <n>` (or `MMP_PORT`), `--data <dir>` (or `MMP_DATA_DIR`).

## Watch two bots play first

With the server running, in another terminal:

```bash
npm run bots -- --host-key <host key>
```

The command creates a best-of-3 series, prints its address, and plays both seats over the real MCP
endpoint. Open the address, type the host key, and watch. Only one series is open at a time, so
cancel any open one first.

Options:
- `--p1` / `--p2` pick a style: `laser_wall`, `cannon_cryo`, `balanced` or `saver`.
- `--think 300` adds a pause (ms) before each move.
- `--pace 0` plays waves as fast as the bots move instead of 30 s each on screen.
- `--level` picks `tutorial`, `normal` or `hard`.
- `--best-of` sets the series length.

## Let two real agents play

1. **Once per app:** register the server from the **Agent setup** card on the dashboard (Copy
   buttons; the series page has it too). Claude Code:
   `claude mcp add -s user --transport http mmp http://127.0.0.1:8787/mcp`; Codex:
   `codex mcp add mmp --url http://127.0.0.1:8787/mcp`; any other MCP app: an HTTP server named
   `mmp` at that address. It never changes.
2. Type the host key on the dashboard, choose a level and press **Create series**. Only one series
   is open at a time.
3. **Every series:** paste the same prompt into a **new** session of each of the two agents (any
   mix: Claude and Codex, two Claudes, two accounts…). Each joins under the name of its model. (A
   new session because apps load MCP servers only at startup.)
4. On the series page, press **Start** once both have joined. A few unscored warm-up waves measure
   how fast each agent decides and set the time slot; then match 1 starts.

**Host controls on the series page:** Start, Stop, Remove a
player, ← Back to lobby, and (for tuning, temporary) wave intensity 0–10, seconds per wave on screen
and a Random wave button. **Close server** on the dashboard tells the agents to stop, then shuts the
server down after 30 s.
5. **Approve the tools** when asked, so polling never stops to ask you:
   - **Claude Code:** allow the server's tools.
   - **Codex:** approve the `mmp` tools when asked.
6. **Watch:** on the series page (type the host key to see the boards live and the host controls).

**What the agents do:** read `rules`, `join`, then follow the `next` field of every reply:
- `state` to wait;
- `act` to build and upgrade towers before each wave;
- `ready` between matches;
- stop when the series is over.

If an agent's session is interrupted, tell it to `join` again with its name and player id and carry on.
Its seat and any move it already submitted are kept. For the next series, an agent that is already
set up only needs the prompt again.

## Other commands

| Command | What it does |
|---|---|
| `npm test` | a few quick checks (determinism, identical waves, restart, a bot series over MCP), about 10 s |
| `npm run balance -- --matches 4` | bot-vs-bot statistics for a level; `--set path=value` to try other numbers |
| `npm run replay -- <series-id>` | re-runs a series from its logs and checks every state hash |

## Where things are kept

Everything lives in `~/.local/share/mcp_multi_player/`, outside the repo.

```
lobby.json                    the list of series
series/<id>/series.jsonl      joins, match starts and ends, readiness
series/<id>/match-NN/
  events.jsonl                every turn's actions and state hash
  audit.jsonl                 moves before they were revealed, rejects (never served)
  snapshots/                  full state every 10 waves
  match.log                   readable text, one block per wave
```

Restarting the server picks every series up where it left off, including a half-submitted turn.
Agents stay registered across restarts: the address never changes. A series whose level file has
changed since it was created can't be replayed and is skipped with a warning.

## Fair play

- **Rules are enforced:** the server checks every action, and agents can act only on their own board.
- **Hidden information:** moves stay hidden until the wave runs. An agent never sees the other board
  or future waves during a match.
- **Equal turns:** each wave waits for both decisions (60 s deadline by default) and for the last
  wave's 30 s on screen, so a fast script gets no extra turns. Three missed deadlines forfeit a
  match.
- **Secrets:** the host key is never stored. The live boards and the host actions need it. Seats
  have no secret: both agents run as your user and could read each other's files anyway.
- **What it can't do:** stop an agent from reading files its OS user can read, including the data
  folder. For strong isolation, run each agent as its own OS user or in a container.

## Credits

Tower numbers, path-following and drawing style are adapted from
[boxops/tower_defense_js](https://github.com/boxops/tower_defense_js) (Apache-2.0, see
[LICENSE-reference](LICENSE-reference)). The simulation, multiplayer rules, MCP server and web pages
are new.
