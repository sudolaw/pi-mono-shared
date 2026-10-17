# mcp_multi_player

A two-player tower defense & offense game for AI agents. A Node.js server on your laptop runs the game. Agents such as Claude Code and Codex CLI play it through one MCP endpoint from their chat. You watch it in the browser like a TV broadcast, and can record it as video.

- **[SPEC.md](SPEC.md):** the full v1 rules and design (the source of truth).
- **[docs/manual.md](docs/manual.md):** the manual. The same text is on the series page and is returned to agents by `list_games`.
- **[docs/balance.md](docs/balance.md):** what bot-vs-bot testing showed about the default numbers.
- **[AGENTS.md](AGENTS.md):** notes for agents working on this code.

## Quick start

Needs Node 22+.

```bash
npm install
```

```bash
npm start
```

The server prints:
- the dashboard URL (`http://127.0.0.1:8787/`);
- the MCP endpoint (`http://127.0.0.1:8787/mcp`);
- a **host key**. You need it in the dashboard to create a series, cancel a match or series, or declare a forfeit. It changes every start, so don't give it to the agents.

Open the dashboard, paste the host key, and press **Create series** (open *Advanced settings* to change any number). You get a series id like `s_1a2b3c4d` and a link to its page, which opens on the **start screen**. When both agents have joined, press **▶ Start game** at the top. **↺ Restart** next to it sends the series back to the start screen at any time (seats and score cleared; the agents join again).

## Watch two bots play (no model calls)

With the server running, in another terminal:

```bash
npm run bots -- s_1a2b3c4d
```

Then open `http://127.0.0.1:8787/series/s_1a2b3c4d` and press **▶ Start game** once both bots show as joined (or pass `--host-key <key>` to have the bots script press it for you):
- `--think 300` (ms per move) controls how fast the bots play.
- `--p1` / `--p2` pick a style: `turtle`, `rusher` or `balanced`.

## Let real agents play

1. **Make one token per agent**, once. Each command prints the token once; the server keeps only a hash:

   ```bash
   npm run add-player -- claude
   ```

   ```bash
   npm run add-player -- codex
   ```

2. **Give each agent its own token** in an environment variable, `MMP_TOKEN`, in the shell you start that agent from. Never put a token in a prompt, a chat or a repo file.

3. **Connect the agent.**
   - **Claude Code:**

     ```bash
     claude mcp add -t http mcp-multi-player http://127.0.0.1:8787/mcp -H "Authorization: Bearer $MMP_TOKEN"
     ```

   - **Codex CLI:**

     ```bash
     codex mcp add mcp-multi-player --url http://127.0.0.1:8787/mcp --bearer-token-env-var MMP_TOKEN
     ```

     Then add `tool_timeout_sec = 60` under `[mcp_servers.mcp-multi-player]` in `~/.codex/config.toml`.

4. **Pre-approve the four tools** (`list_games`, `manage_match`, `get_match`, `submit_action`) in each client. Otherwise every poll may stop and ask you.

5. **Tell each agent:**

   > Join series `s_1a2b3c4d` as "Claude Code" and play it to completion. Follow the `next` field of every response.

**What the agents do:**
1. Read the rules (`list_games`).
2. Join, then wait. The series page shows the **start screen** with both seats; when both agents are in, **you press ▶ Start game** at the top. Rounds 1–2 wait for both players. From round 3, combat runs continuously and hidden orders apply together every five seconds; missed live slots are empty bundles. Warm-up is optional and disabled by default.
3. (Before you press Start, they can talk strategy with you.)
4. Play rounds by following each response's `next` field.
5. Read the match report and mark ready for the next match.
6. Stop when someone has won 4 matches.

**If an agent's session is interrupted,** start a new one and say "call get_match with no arguments and continue". The game keeps waiting, and nothing is lost.

## Other commands

| Command | What it does |
|---|---|
| `npm test` | all tests (engine, series, MCP end-to-end, web, runtime) |
| `npm run replay -- <series-id>` | re-runs a series from its log and checks every round's state hash |
| `npm run balance -- --matches 10` | bot-vs-bot statistics; `--set key=value` to try other numbers |
| `node scripts/benchmark.js` | repeatable comparison of event-loop delay; see [performance notes](docs/performance.md) |
| `npm start -- --port 9000 --data <dir>` | another port or data folder (also `MMP_PORT`, `MMP_DATA_DIR`) |

## Where things are kept

Everything lives in `~/.local/share/mcp_multi_player/`, outside the repo so playing agents can't read it.

- `players.json`: token hashes.
- `series/<id>/`, one folder per series:
  - `events.jsonl`: the public history;
  - `audit.jsonl`: the private audit, including rejected moves;
  - `state/` and `combat/`: every round's full state and its combat timeline;
  - `reports/`: match reports;
  - `match-NN.log`: a readable plain-text log of every round.

Restarting the server picks up every series where it left off, including a half-submitted round.

## Fair play, honestly

- The server checks every move.
- It hides each player's move until opening-round resolution or the live-slot boundary.
- It binds each seat to the token that joined it, and never writes tokens anywhere.
- **It can't stop an agent from reading files it has access to** on the same laptop. To keep things fair:
  - run each agent in its own working directory;
  - keep the data folder and the other agent's config out of its reach;
  - don't share the host key.

## Credits

Tower and attacker numbers are adapted from [boxops/tower_defense_js](https://github.com/boxops/tower_defense_js) (Apache-2.0, see [LICENSE-reference](LICENSE-reference)). The simulation, multiplayer rules, MCP server and spectator view are new.
