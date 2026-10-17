# Main-thread responsiveness

The server now uses asynchronous filesystem operations and a reusable pool of up to four CPU workers. This changes scheduling and storage, not game rules or deterministic state hashes.

- Public series mutations, deadline callbacks, live tick callbacks and HTTP observations share a per-series queue (`src/series/queue.js`). Independent series can progress concurrently. Live combat frames go to spectators only; they do not bump `state_version`, so waiting agents are not woken ten times a second.
- Required writes finish before replies and public notifications. Each transaction saves its final series record once. Request records append to `requests.jsonl`; recovery also loads legacy `requests.json` snapshots.
- Simulation, validation, fingerprints, timeline encoding and state hashes run in workers. A live slot remains in its worker between ticks; replies carry state and only the latest frame. Offline replay and balance scripts retain the synchronous pure engine.
- Recent history is bounded to 400 events, with a separate cache for the current match's resolved rounds. Full historical reads stream in batches; production parsing runs in the worker pool.
- Spectators share serialized views and combat messages. Connection history is bounded to 96 KiB and client backlogs to 256 KiB; slow clients reconnect rather than indefinitely accumulating messages.
- Combat downloads use asynchronous file serving. Manual templates load once, with cached Markdown and up to 64 rendered HTML variants. Authentication cache misses reload credentials asynchronously.
- A failed write or worker rejects the operation and stops that series; startup recovery is required. A failed read (building a view) is reported to its caller and stops nothing. Other series remain available. Shutdown stops timers, waits for in-flight mutations, and releases workers.

## Repeatable stress comparison

Run `node scripts/benchmark.js` from the project directory. It compares the former synchronous resolve/write pattern with worker resolution, asynchronous writes and append-only request records. Both paths resolve the same seeded state and compare identical hashes. Worker initialization is excluded.

One local run on Node v25.7.0, with eight dense rounds, 1,000 attackers, 18 towers and 10,000 existing idempotency records:

| Measure | Former synchronous pattern | Updated path |
|---|---:|---:|
| Main event-loop p99 delay | 273.2 ms | 21.3 ms |
| Main event-loop maximum delay | 273.2 ms | 26.1 ms |
| Main event-loop utilization | 97.7% | 12.4% |
| Total elapsed time | 1,060.8 ms | 1,207.1 ms |

In this run, maximum delay dropped about 90%, while elapsed time increased about 14%. Worker transfers and scheduling add overhead; their purpose is to keep HTTP handling and timers responsive, not to guarantee faster simulation. These are synthetic local stress results, not normal-gameplay latency guarantees. Remaining main-thread work includes HTTP handling, state transfers, view construction and smaller JSON encodings; responsiveness is improved, not perfectly non-blocking.

`test/runtime.test.js` covers worker/local replay equivalence, bounded worker queues and worker failure, simultaneous duplicate requests, write-before-notify ordering, storage failure, cache recovery, legacy request journals, shared serialization and slow-client cleanup. The MCP and web integration suites exercise the production worker-backed server.
