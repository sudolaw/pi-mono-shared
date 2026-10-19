// Builds each audience's view once per version and reuses it for every reader (spec §6).

/** `lastTurn` is the engine's apply() result for the wave just played, or the previous cache. */
export function buildCache(engine, level, record, lastTurn = null) {
  const s = record.state;
  return {
    version: record.version,
    views: { P1: engine.view(s, 'P1', level), P2: engine.view(s, 'P2', level) },
    render: engine.render(s, level),
    events: lastTurn?.events ?? [],
    frames: lastTurn?.frames ?? null,
  };
}
