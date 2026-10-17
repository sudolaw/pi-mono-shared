// Worker-owned engines and live timelines (SPEC.md §7, §13).
// A live slot stays here between ticks; only public state/frame snapshots cross threads.
import { parentPort } from 'node:worker_threads';
import { createEngine } from './index.js';
import { canonicalJson } from './hash.js';

const engines = new Map();
parentPort.on('message', ({ job, engineId, method, args }) => {
  try {
    let value;
    if (method === 'open') {
      engines.set(engineId, { engine: createEngine(args[0]), live: null });
      value = true;
    } else if (method === 'parseLines') {
      value = args[0].split('\n').filter(Boolean).map((line) => JSON.parse(line));
    } else {
      const entry = engines.get(engineId);
      if (!entry) throw new Error('engine is unavailable');
      const { engine } = entry;
      switch (method) {
        case 'validate': value = engine.validate(...args); break;
        case 'fingerprint': value = canonicalJson(args[0]); break;
        case 'discardLive': entry.live = null; value = true; break;
        case 'resolve': value = engine.resolve(...args); value.timelineJson = JSON.stringify(value.timeline); break;
        case 'beginLive': entry.live = engine.beginLive(args[0]); value = snapshot(entry.live); break;
        case 'advanceLive':
          if (!entry.live) throw new Error('no live slot');
          engine.advanceLive(entry.live, args[0]); value = snapshot(entry.live); break;
        case 'finishLive':
          if (!entry.live) throw new Error('no live slot');
          value = engine.finishLive(entry.live, args[0]);
          value.timelineJson = JSON.stringify(value.timeline);
          entry.live = null; break;
        case 'close': engines.delete(engineId); value = true; break;
        default: throw new Error('unknown engine operation');
      }
    }
    parentPort.postMessage({ job, value });
  } catch (err) { parentPort.postMessage({ job, error: err.message }); }
});

function snapshot(live) {
  return { state: live.state, ticks: live.ticks,
    timeline: { towers: live.timeline.towers, frames: live.timeline.frames.slice(-1) } };
}
