// The shared opening-round deadline (SPEC.md §9–§10). Pure: the series decides when to apply it.

/**
 * auto = factor × the slower agent's average warm-up decision time, at least minSeconds
 * (just minSeconds when there was no warm-up); fixed = the host's number; off = no deadline.
 * Returns { seconds, averages } where averages are the warm-up means in ms per seat.
 */
export function deadlineFor(settings, warmupTimes) {
  const d = settings.series.deadline;
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const averages = { P1: Math.round(avg(warmupTimes.P1)), P2: Math.round(avg(warmupTimes.P2)) };
  let seconds;
  if (d.mode === 'off') seconds = null;
  else if (d.mode === 'fixed') seconds = d.fixedSeconds;
  else seconds = Math.max(d.minSeconds, Math.ceil((d.factor * Math.max(averages.P1, averages.P2)) / 1000));
  return { seconds, averages };
}
