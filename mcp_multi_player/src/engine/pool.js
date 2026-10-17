// Reusable, bounded CPU workers for simulation/validation/replay hashes (SPEC.md §2, §7).
// A series has worker affinity so live timelines need not be cloned every 50 ms.
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { buildBoard } from './board.js';
import { newMatchState } from './state.js';

export class EnginePool {
  constructor({ size = Math.min(4, Math.max(1, availableParallelism() - 1)), maxPending = 256 } = {}) {
    this.size = size;
    this.maxPending = maxPending;
    this.workers = [];
    this.nextJob = 0;
    this.nextEngine = 0;
    this.closed = false;
  }

  acquire() {
    if (this.closed) throw new Error('engine pool is closed');
    const live = this.workers.filter((slot) => !slot.failed);
    if (live.length < this.size) {
      const worker = new Worker(new URL('./worker.js', import.meta.url));
      const slot = { worker, jobs: new Map(), engines: 0, failed: null };
      const fail = () => {
        slot.failed ??= new Error('simulation worker exited; series recovery required');
        for (const { reject } of slot.jobs.values()) reject(slot.failed);
        slot.jobs.clear();
      };
      worker.on('error', fail);
      worker.on('exit', fail);
      worker.on('message', ({ job, value, error }) => {
        const pending = slot.jobs.get(job);
        if (!pending) return;
        slot.jobs.delete(job);
        if (error) pending.reject(new Error(error)); else pending.resolve(value);
      });
      this.workers.push(slot);
      return slot;
    }
    return live.sort((a, b) => a.engines - b.engines || a.jobs.size - b.jobs.size)[0];
  }

  call(slot, engineId, method, ...args) {
    if (this.closed || slot.failed) return Promise.reject(slot.failed ?? new Error('engine pool is closed'));
    if (slot.jobs.size >= this.maxPending) return Promise.reject(new Error('simulation worker queue is full'));
    const job = ++this.nextJob;
    return new Promise((resolve, reject) => {
      slot.jobs.set(job, { resolve, reject });
      try { slot.worker.postMessage({ job, engineId, method, args }); }
      catch (err) { slot.jobs.delete(job); reject(err); }
    });
  }

  parseLines(text) {
    const slot = this.workers.filter((w) => !w.failed).sort((a, b) => a.jobs.size - b.jobs.size)[0] ?? this.acquire();
    return this.call(slot, null, 'parseLines', text);
  }

  async open(cfg) {
    const slot = this.acquire();
    slot.engines++;
    const id = ++this.nextEngine;
    try { await this.call(slot, id, 'open', cfg); }
    catch (err) { slot.engines--; throw err; }
    const call = (method, ...args) => this.call(slot, id, method, ...args);
    return {
      cfg, board: buildBoard(cfg.board),
      newMatch: (number) => newMatchState(cfg, number),
      validate: (...args) => call('validate', ...args),
      fingerprint: (payload) => call('fingerprint', payload),
      discardLive: () => call('discardLive'),
      resolve: (...args) => call('resolve', ...args),
      beginLive: (state) => call('beginLive', state),
      advanceLive: (_live, ticks) => call('advanceLive', ticks),
      finishLive: (_live, bundles) => call('finishLive', bundles),
      close: async () => { try { await call('close'); } finally { slot.engines--; } },
    };
  }

  async close() {
    this.closed = true;
    await Promise.all(this.workers.map(({ worker }) => worker.terminate()));
  }
}
