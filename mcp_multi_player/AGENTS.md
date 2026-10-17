# mcp_multi_player: notes for agents working on this project

A two-player tower defense & offense game that AI agents play over MCP, with a browser spectator view. **[SPEC.md](SPEC.md) is the source of truth.** If code and spec disagree, fix one of them in the same change.

This file is the only agent-instructions file for the project; there is deliberately no CLAUDE.md. Repo-wide rules are in the root [AGENTS.md](../AGENTS.md).

## Commands (run from this directory)

| Command | What it does |
|---|---|
| `npm install` | install dependencies (Node 22+) |
| `npm test` | all tests (`node:test`), about 10 s; includes an end-to-end series over `/mcp` |
| `npm start` | server on 127.0.0.1:8787 (`--port`, `--data`); prints the host key |
| `npm run add-player -- <id>` | create or replace a player token (printed once) |
| `npm run bots -- <series-id>` | two scripted agents play a series over MCP (`--think 300`, `--p1/--p2 turtle\|rusher\|balanced`) |
| `npm run replay -- <series-id>` | re-run a series from its log and check every state hash |
| `npm run balance` | many bot-vs-bot matches in-process, with a stats table |

For experiments, use `--data .tmp/data` (`.tmp/` is git-ignored). Real data lives in `~/.local/share/mcp_multi_player/`.

## Layout and rules

```
src/config.js      every game number and the board; nothing else hard-codes balance values
src/engine/        pure, deterministic rules: no I/O, no clocks, no randomness
src/series/        when things happen: phases, warm-up, deadline, draws, reports, views
src/store/         the series folder on disk (events, audit, state, combat, reports, text log)
src/mcp/           the 4 tools, schemas, bearer auth, host key
src/web/           dashboard / spectator routes, SSE stream, host API
src/bots/          scripted strategies + an MCP client that plays like an agent
public/            browser code; reuses src/engine/board.js via /engine/board.js
docs/manual.md     the one manual (served to humans and returned by list_games)
```

- **Determinism:**
  - The engine must stay pure.
  - Lists are processed in id order, and the tick order is fixed (SPEC §7).
  - Any change to simulation behaviour changes state hashes, so old series won't replay. Say so in the commit.
- **Secrets:**
  - Tokens and the host key must never reach a log, a file under `series/`, an observation, the spectator stream or an error message.
  - `test/mcp.test.js` scans disk and responses for tokens; keep that test passing.
- **Hidden decisions:**
  - A pending bundle appears only in `audit.jsonl` and, after both bundles are locked, in `round_resolved`.
  - Spectator and player views show only `submitted: true/false`.
- **Write before reply:** await public series mutations. Their per-series queue commits async disk writes and idempotency records before replies or public notifications. HTTP observations use `series.read()` to avoid partial mutations.
- **Runtime work:** the server uses the reusable engine worker pool; live timelines stay in their worker. Keep the synchronous pure engine usable for replay and balance scripts. See `docs/performance.md` for runtime boundaries and the stress comparison.
- **Comments:** explain why, the way the existing code does. Every module starts with a short header saying what it is for and which SPEC section it implements.
- **Tests:** add or adjust `node:test` cases next to the area you touch (`test/engine`, `test/series`, `test/mcp`, `test/web`). Run `npm test` before committing.
- **Commits:** prefix the message with `mcp_multi_player:` and keep each commit to this project (root rules).
