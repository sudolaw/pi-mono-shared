// A single re-armable timer on the injected clock (spec §2.7, §2.9): deadlines, wave pacing,
// the ready timeout and the gap between matches. Arming replaces the previous one.

export function createTimer(clock) {
  let handle = null;
  return {
    /** Runs `fn` after `ms`; returns the time it will fire at. */
    arm(ms, fn) {
      this.clear();
      handle = clock.setTimer(ms, () => { handle = null; return fn(); });
      return clock.now() + ms;
    },
    clear() {
      if (handle !== null) { clock.clearTimer(handle); handle = null; }
    },
  };
}
