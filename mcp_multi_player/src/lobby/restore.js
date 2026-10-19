// Startup recovery (spec T7): read the lobby index and rebuild each series (and its live
// match) from the logs. A series whose level file has changed cannot be replayed; it is
// skipped with a warning instead of stopping the server.

export async function restoreAll({ store, loadSeries, registry, log = console }) {
  const index = await store.readIndex();
  for (const entry of index.series) {
    try {
      const series = await loadSeries(entry);
      registry.set(entry.id, series);
    } catch (err) {
      log.warn?.(`skipping series ${entry.id}: ${err.message}`);
    }
  }
  return index;
}
