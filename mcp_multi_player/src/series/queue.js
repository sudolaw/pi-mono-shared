// Per-series serial queue (SPEC.md §2, docs/performance.md). Storage and simulation are
// async, so without a queue a submission, a host action and a combat tick could interleave
// at every await. Each job runs alone, its writes are committed, and only then are the
// notifications it raised published, so nobody hears about a change that is not on disk.
//
// A failed mutation latches: the in-memory series may be half-changed, so every later job
// is refused until restart recovery reloads it from disk. A failed read changes nothing,
// so it does not latch.

import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage();

export class SerialQueue {
  /**
   * commit()   saves whatever the job left dirty; awaited before publishing
   * publish(n) receives the job's buffered notifications: [[event, args], …]
   * onFault(e) runs once a mutation has failed
   */
  constructor({ commit, publish, onFault }) {
    this.commit = commit;
    this.publish = publish;
    this.onFault = onFault;
    this.tail = Promise.resolve();
    this.buffer = null; // notifications raised by the running job
    this.failure = null;
    this.closed = false;
  }

  /** True inside a job of this queue: nested calls run directly instead of queueing. */
  get inside() { return context.getStore() === this; }

  /** True while a job runs: notifications wait for its commit. */
  get buffering() { return this.buffer !== null; }

  hold(event, args) { this.buffer.push([event, args]); }

  mutate(fn) { return this.run(fn, true); }

  read(fn) { return this.run(fn, false); }

  run(fn, mutating) {
    const result = this.tail.then(() => context.run(this, async () => {
      if (this.failure) throw this.failure;
      if (this.closed) throw new Error('series is closed');
      this.buffer = [];
      try {
        const value = await fn();
        await this.commit();
        const held = this.buffer;
        this.buffer = null;
        // Listeners may start new jobs; they belong in the queue, not inside this one.
        context.exit(() => this.publish(held));
        return value;
      } catch (err) {
        this.buffer = null;
        if (mutating) {
          this.failure = err;
          this.onFault(err);
        }
        throw err;
      }
    }));
    this.tail = result.catch(() => {});
    return result;
  }

  /** Resolves once every queued job has finished; rejects if the series has failed. */
  async idle() {
    await this.tail;
    if (this.failure) throw this.failure;
  }

  /** Refuses new jobs and resolves once the running ones are done. */
  close() {
    this.closed = true;
    return this.tail;
  }
}
