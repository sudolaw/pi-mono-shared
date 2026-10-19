// The only source of time (spec §4). The server uses the real clock; tests use the fake one
// and move it forward by hand, so deadlines can be tested without waiting.

export function createClock() {
  return {
    now: () => Date.now(),
    setTimer(ms, fn) { const h = setTimeout(fn, ms); h.unref?.(); return h; },
    clearTimer: (h) => clearTimeout(h),
  };
}

export function createFakeClock(start = 0) {
  let now = start, nextId = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimer(ms, fn) { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimer: (id) => timers.delete(id),
    /** Moves time forward, firing due timers in order. */
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        await due[1].fn();
      }
      now = end;
    },
  };
}
