# Lifecycle: from a submitted move to the next match

This is the path one move takes through the server, who owns each change, which queue runs it, when
it becomes durable and when others can see it. [spec.md](spec.md) §6, §7 and §12 define the
pieces; this page shows how they fit together in time.

## Owners and queues

| Owner | Holds | Changes run on | Durable when |
|---|---|---|---|
| Match (`src/match/index.js`) | board state, version, pending moves, deadline, wave pace | the match's queue | the line is in `match-NN/events.jsonl` (moves: `audit.jsonl`) |
| Series (`src/series/index.js`) | seats, score, ready flags, the gap between matches | the series' queue | the line is in `series.jsonl` |
| Lobby (`src/lobby/index.js`) | which series is open | no queue; it only creates and looks up | `lobby.json` is rewritten |

Every change follows the same order: **validate → append to the log (the commit point) → change
memory → notify**. Nothing outside the owner changes its record. Notifications go to waiting agents
(`state` long-polls) and spectators (SSE); a broken listener is ignored.

## Starting

Agents call `rules`, then `join` (name of the model, `understood: true`); each gets a player id.
Nothing runs until the host presses **Start** (`series.start`, on the series queue): it commits
`host_started` and starts match 0, the **warm-up** (a few unscored waves). When the warm-up ends,
`onMatchEnd` sets the time slot from the measured decision times (`warmup_ended`) and starts match
1 straight away, without a gap or `ready`.

## One wave, step by step

```
agent A: act ──► match.submit ──► audit "pending" ──► reply {accepted, version v}
agent B: act ──► match.submit ──► audit "pending" ──► tryResolve
                                                        │ waits until the last wave has had
                                                        │ its time on screen (pace timer)
                                                        ▼
                                  resolveWave: engine.apply → outcome → log "turn" (commit)
                                  → state, version v+1 → notify "turn" (events, frames)
                                  → next deadline armed │ or, if over: endMatch
                                                        ▼
                                  endMatch: log "match_ended" → phase over → notify "match_end"
                                  → setImmediate(onEnd)
                                                        ▼ (later, on the series queue)
                                  series.onMatchEnd: log "match_ended" + score
                                  → "series_ended" and done │ or between + gap + ready timeout
```

1. **First move in.** `submit` validates the actions, writes them to the audit log and keeps them
   hidden. Once that line is on disk the move is locked, even across a restart. The agent's reply
   says `accepted` for version `v`.
2. **Second move in.** The same, then `tryResolve`. If the wave now on screen started less than
   `paceS` ago (30 s by default), a pace timer resolves the turn later and `submit` returns
   straight away. **Both moves can be in while the match still waits**; `state` says "waiting for
   the current wave to finish on screen".
3. **The wave resolves** (`resolveWave`, on the match queue). The engine plays both boards, the
   result is judged, and the `turn` line (actions and state hash) is appended: **that is the commit
   point**. Only then does the state change, the version go up, and the `turn` notification go out.
   If the append fails, nothing changes and the turn stays open.
4. **Agents see the result at once; spectators see it over 30 s.** Waiting `state` calls return as
   soon as the version moves, so an agent decides the next wave while the page is still playing
   this one. The next wave can't resolve before that playback ends (step 2).
5. **Deadlines.** When a turn opens, the deadline timer starts. If it fires, each missing seat gets
   a `miss` line and an empty move; at the miss limit the match ends as a forfeit. Otherwise the
   turn goes through `tryResolve` like any other.
6. **The match ends** (`endMatch`, still on the match queue): `match_ended` with the report is
   committed, the phase becomes `over`, timers stop and `match_end` is sent. The series callback
   is scheduled with `setImmediate`, so **match completion and series progression are two separate
   steps**. Between them the match is over but the series still says `in_match`.
7. **The series moves on** (`onMatchEnd`, on the series queue): it commits `match_ended` with the
   new score, then either `series_ended` (phase `done`) or phase `between`. In `between`, the next
   match starts when both seats call `ready` (or the ready timeout marks them), and never sooner
   than the gap (45 s) after the end.

## What awaiting a public method guarantees

| Call | When its promise resolves |
|---|---|
| `match.start()` | `match_started` is committed, the first turn is open and its deadline armed |
| `match.submit(move)` | the move is committed to the audit log (or refused). If it completed the turn and the pace allowed, the wave is committed too; otherwise a timer resolves it later |
| `match.getView({since, waitMs})` | the version moved past `since`, or `waitMs` passed, or the request was aborted |
| `match.cancel(reason)` | `match_ended` (cancelled) is committed; the series hears about it afterwards |
| `series.join({name, playerId})` | `joined` is committed (or a rejoin is recognised); nothing starts |
| `series.start()` | `host_started` and the warm-up's `match_started` are committed |
| `series.leave(seat)` | `left` is committed; after the start also `series_ended` (the other player wins) |
| `series.tune(change)` | intensity and pace are committed (`tuning`); the live match uses them from the next wave |
| `series.ready(seat)` | `ready` is committed; if both are ready and the gap has passed, the next match has started; otherwise a timer starts it |
| `series.cancel(reason)` | `cancelled` and the live match's end are committed |
| `lobby.createSeries(...)` | `series_created` and the lobby index are written; the series is the open one |

## When background work fails

Timers (deadline, pace, ready timeout, the gap) and the match-end callback have no caller to
report to. If one fails (in practice, a write to disk), the owner records `error` in its status, logs
the cause on the server console (never the host key), and stops there. Agents are told
in `next` that the server is stuck; a restart picks the game up from the last committed line. The
readable `match.log`, snapshots and the audit line for a rejected move are **best effort**: their
failures are ignored because nothing depends on them.

## After a restart

The lobby reloads each series from `series.jsonl`, and a live match replays its `turn` lines
through the engine, checking every state hash. Pending moves come back from the audit log. Timers
are re-armed, but the pace and the gap are kept only in memory, so the next wave or match may start
at once.
