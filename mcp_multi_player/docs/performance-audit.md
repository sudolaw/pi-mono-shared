# MCP performance audit — 19 October 2026

> **Status:** all four ranked bets below were implemented in the same change that added this file
> (default pace 5 s, tower stats cached per wave, `join` without the rules brief, replay frames only
> for the requested page). Code locations refer to the code before that change.

The largest configured delay is the wave's **30-second minimum pace**, followed by the
**45-second minimum gap between matches**. Local MCP processing takes milliseconds.
Reducing server CPU will help bot runs and replay throughput, but will scarcely change the
duration of a paced game. Real agents' decision time is a separate factor that was not measured.

This audit covers the current working tree, including its existing uncommitted changes.
No application code, level, running game or saved series was changed. Experiments used isolated
data directories under `.tmp/`. This is an exploratory baseline, not a reproduced regression:
there was no supplied slow request, latency target or earlier performance baseline.

## Ranked bets

| Priority | Change | Expected benefit | Risk / limits |
|---|---|---|---|
| 1 | Use the existing host control to lower seconds per wave from 30 to 5 when faster play is wanted. Keep the normal default for real-time viewing. | Removes up to 25 seconds of pacing per subsequent wave when both agents decide within 5 seconds. The pacing floor becomes 6× shorter; this is not a promise of a 6× faster game. | Low technical risk; existing supported setting. Changes the viewing tempo. Agents' decision time and the separate 45-second match gap still apply. |
| 2 | Cache each tower's computed stats in the board's per-wave context. | Isolated prototype reduced simulation time about **11.5%** in two runs. This is roughly a tenth of a millisecond per typical wave, not 11.5% off the whole match. | Low implementation risk with exact-output comparisons. Stats depend on tower upgrades, level and wave, so the cache must be recreated for every board/wave after actions are applied. |
| 3 | Shorten a successful `join` response by omitting the rules brief already returned by mandatory `rules`; retain identity, status and `next`. | The measured join reply was about **14.1 KB**, after a **22.6 KB** rules reply. Removes repeated model input once per join; model-side time savings are unmeasured. | Low to moderate contract risk. Keep full `rules` available and align spec/manual wording. Check that agents still follow the rules and next-call guidance. This does not improve every wave. |
| 4 | During replay, record spectator frames only for the requested page, while continuing to simulate preceding waves. | The exact-output prototype reduced a later-page replay by **about 5–8%**, roughly **1 ms** locally. | Low risk: keep simulation/actions/tuning identical and omit only frames that the method discards. Small gain; do alongside other replay work rather than as a large project. |

If only one **code** change is wanted, pick tower-stat caching. If the goal is noticeably faster
live games, first try the existing pace control. If the game remains slow with a short pace,
measure agent decision time before pursuing more server optimization.

## Measurements

Node v25.7.0, local loopback HTTP, existing installed dependencies. Results are machine-specific.
The CPU benchmark used four existing strategies on tutorial, normal and hard, seed 1234,
one warm-up pass and four measured passes: 144 distinct pre-wave states and 576 measured applies.
Each apply simulated **both boards**, with normal spectator frame recording.

| Path | Median | p95 |
|---|---:|---:|
| Tutorial wave simulation | 1.178 ms | 2.924 ms |
| Normal wave simulation | 1.221 ms | 2.265 ms |
| Hard wave simulation | 0.908 ms | 1.393 ms |
| Immediate idle MCP `state`, two durable runs | 1.39–2.13 ms | 3.94–6.90 ms |
| Active MCP `state`, two durable runs | 3.94–4.02 ms | 7.74–9.43 ms |
| MCP `act`, two durable runs | 8.76–13.22 ms | 15.89–22.10 ms |

HTTP calls used the real SDK client, actual HTTP endpoint, normal level, both seats, disk-backed
logs and default durability (`sync: true`). State timing excludes deliberate long-poll waiting.
Two parallel agents' action calls include queueing and, for the resolving move, simulation and
persistence. These timings do not isolate the SDK, disk and queue costs individually.
Warm-up waves, wave pacing, model thinking and between-match gaps were disabled for this benchmark.

An additional `sync: false` diagnostic run exists in the raw results. Its different generated seed,
match length and warm-up conditions make it unsuitable for claiming a durability-related speedup.

In the durable HTTP runs, the first two replay waves took 3.9–7.2 ms median. Requesting the last
two took 21.0–23.1 ms because the method re-simulates from the beginning. Those requests differ in
simulation work and payload, so use the paired prototype below to estimate the proposed change.

The CPU profile's hottest named application function was `towersAct`. It repeatedly calculates
`towerStats` and searches all attackers, including on ticks where an idle tower finds no target.
The profile also includes deliberate standalone clone/hash measurements; its sample percentages
are **not** production request time percentages.

Normal-level cloning took 0.196 ms median and hashing 0.274 ms. Serializing one spectator turn
took 0.152 ms median with a roughly 51 KB median payload. These are small at the current scale.
The saved lobby index contained four series, so archive-growth optimizations are not a priority
for this installation.

## Prototype validation

Tower-stat caching was tried only in an ignored copy of the source. It matched complete apply
outputs — states, frames and events — across **278 waves in 24 seeded matches**, plus **208**
comparisons using intensity 0/10 and an extra attacker. The timing comparison alternated baseline
and candidate order over 104 sampled fixtures, discarding two warm-up rounds. In the second run,
median batch time was 108.2 ms baseline versus 94.1 ms candidate; the median paired saving was
11.5%. These assertions cover the sampled scenarios, not every possible future engine change.

The replay prototype exercised the real `series.replay` method through its injected engine
dependency, using one fixed finished-match log. For `from=11,count=2` of a 13-wave match, complete
replay responses were identical. Two runs found approximately 5% and 8% median paired savings.
No page cache, checkpoint restore or persisted state format change was required.

## Code locations

- Pacing and turn resolution: `src/match/index.js:166`, `src/match/index.js:214`.
- Default wave pace and match gap: `src/series/index.js:27`, `src/series/index.js:46`.
- Repeated tower stats: `src/engine/towers.js:20`.
- Repeated rules on join: `src/mcp/server.js:59`.
- Replay records frames even before the requested page: `src/series/index.js:341`.
- Best-effort snapshot/text writes are awaited before notification: `src/match/index.js:204`.
  Their separate contribution was not measured, so they are not a ranked bet yet.

## Work to defer

Keep durable append-before-notify ordering and stable state hashes. Disabling `datasync`, changing
hash formats, or broadly parallelizing the engine would introduce more risk than the measured
latencies justify. Browser canvas caching, archive lookup caching and bounded replay-page caching
may help other workloads, but were not profiled or validated here. The browser's intentional
animation and 25-second MCP long-poll timeout should not be mistaken for request processing time;
long-polls return early on a cursor change.

## Local reproduction

Run from `mcp_multi_player/`; the ignored harnesses and JSON results remain in `.tmp/`:

```bash
node .tmp/perf-audit.mjs
node .tmp/perf-http.mjs
node .tmp/perf-candidates.mjs
```

Results: `.tmp/perf-engine-results.json`, `.tmp/perf-http-results.json`, and
`.tmp/perf-candidate-results.json`. For a fresh CPU profile, run
`node --cpu-prof --cpu-prof-dir=.tmp .tmp/perf-audit.mjs`.
The existing test suite was not rerun: application code was unchanged, and the isolated candidate
comparisons above directly validate the proposed behavior-preserving optimizations.
