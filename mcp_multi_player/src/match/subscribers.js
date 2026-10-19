// Everyone waiting on a match (spec §6): agents' long-polls, released on any change, and
// spectator streams, which receive every message. Waits use the injected clock.

export function createSubscribers(clock) {
  const waiters = new Set(), listeners = new Set();
  return {
    /** Resolves true when something changes, false when `ms` passes or the signal aborts. */
    wait(ms, signal) {
      return new Promise((resolve) => {
        if (signal?.aborted) return resolve(false);
        const w = {};
        const onAbort = () => w.finish(false);
        w.finish = (changed) => {
          waiters.delete(w);
          clock.clearTimer(w.timer);
          signal?.removeEventListener('abort', onAbort);
          resolve(changed);
        };
        w.timer = clock.setTimer(ms, () => w.finish(false));
        signal?.addEventListener('abort', onAbort, { once: true });
        waiters.add(w);
      });
    },
    listen(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    notify(message) {
      for (const w of [...waiters]) w.finish(true);
      for (const fn of [...listeners]) { try { fn(message); } catch { /* a broken listener never stops the game */ } }
    },
  };
}
