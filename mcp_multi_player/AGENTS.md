# mcp_multi_player: notes for agents working on this project

A split-screen tower defense race that AI agents play over MCP, with a browser spectator view.
**[docs/spec.md](docs/spec.md) is the source of truth.** If code and spec disagree, fix one of them
in the same change. [docs/lifecycle.md](docs/lifecycle.md) explains the order of events from a
move to the next match; read it before touching `src/match/` or `src/series/`. Repo-wide rules are in the root [AGENTS.md](../AGENTS.md).

## Commands (run from this directory)

| Command | What it does |
|---|---|
| `npm install` | install dependencies (Node 22+) |
| `npm test` | the few automated checks, about 10 s |
| `npm run typecheck` | checks the JSDoc types of the files marked `// @ts-check` |
| `npm start` | server on 127.0.0.1:8787 (`--port`, `--data`); prints the host key |
| `npm run bots -- --host-key <key>` | creates a series and plays it with two scripted agents over MCP |
| `npm run balance` | bot-vs-bot statistics in-process |
| `npm run replay -- <series-id>` | re-runs a series from its logs and checks every hash |

For experiments, use `--data .tmp/data` (`.tmp/` is git-ignored).

## Layout and rules

```
levels/          level files: plain JSON, the board drawn as ASCII rows
src/types/       JSDoc types (game.js, records.js), imported with @typedef {import(...)}
src/engine/      pure rules and simulation: no I/O, no clock, no unseeded randomness
src/config/      loads, checks and freezes a level; derives the path and slot coverage
src/match/       one game: hidden moves, deadline, resolve, commit, notify
src/series/      best of N: seats, score, ready, replay
src/lobby/       creates and finds the open series; host key check
src/store/       files on disk: append-only logs, audit, snapshots
src/mcp/         the five tools, auth, reply formatting
src/web/         dashboard, series page, live stream, host API
scripts/         bots, strategies, balance, replay
```

- **Layers call downwards only.** Results come back up through callbacks (`onEnd`) and
  subscriptions. The engine imports nothing outside `engine/`, `geometry` and `shared/hash`.
- **Determinism:**
  - The engine must stay pure: lists are processed in id order, and the tick order is fixed (spec
    §2.6).
  - Any change to simulation behaviour changes state hashes, so older series won't replay. Say so in
    the commit.
  - Changing a level file has the same effect on series that use it.
- **Order of every change:** validate → append to the log (the commit point) → swap in memory →
  reply and notify, through the owner's queue.
- **Information rules (spec §3):**
  - Agents see only their own board.
  - The live boards on the web need the host key.
  - Moves are hidden until resolve.
  - The audit log is never served.
- **Secrets:**
  - The host key must never reach a log, a file, a reply or an error.
  - `test/mcp.test.js` scans replies and files for them.
- **Numbers live in the level files.** Docs and replies describe rules in words and generate the
  numbers from the level (`src/mcp/rules.js`), so tuning a level never makes a document wrong.
- **Time units are in the names:** game time in ticks of `rules.dt` seconds, wall-clock times in
  `…Ms`, settings in `…S` (seconds).
- **Types:** keep `src/types/` in step with the code. New or reworked modules start with
  `// @ts-check` and `npm run typecheck` must pass.
- **Failures:** work started by a timer or callback reports through the owner's `error` status and
  the server log (never a secret). Only readable logs, snapshots and audit lines for rejected moves
  are best effort.
- **Tests are light on purpose (spec §14).** We test by playing. Add a test only for something that
  is hard to see by watching, or for a bug a play-test found that is easy to reintroduce.
- **Comments:** explain why, the way the existing code does. Every module starts with a short
  header saying what it is for and which spec section it implements.
- **Commits:** prefix the message with `mcp_multi_player:` and keep each commit to this project.
