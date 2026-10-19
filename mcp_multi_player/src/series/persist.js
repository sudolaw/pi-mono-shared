// The series' link to the disk (spec §9): it logs joins and leaves, the warm-up, match starts
// and ends, readiness, the host's tuning and the end, and rebuilds the series record from that
// log after a restart.

export function rebuildRecord(record, entries) {
  for (const e of entries) {
    const d = e.data;
    switch (e.kind) {
      case 'joined': record.seats[d.seat] = { name: d.name, playerId: d.playerId ?? null, joinedAt: e.at }; break;
      case 'left': record.removed.push(record.seats[d.seat]?.playerId); record.seats[d.seat] = null; break;
      case 'warmup_ended': record.deadlineS = d.deadlineS; record.warmup = d; break;
      case 'tuning': Object.assign(record, d.intensity !== undefined ? { intensity: d.intensity } : {}, d.paceS !== undefined ? { paceS: d.paceS } : {}); break;
      case 'match_started': record.matchNo = d.matchNo; record.phase = 'in_match'; record.ready = { P1: false, P2: false }; break;
      case 'match_ended':
        if (d.matchNo === 0) break;
        record.history.push({ matchNo: d.matchNo, seed: d.seed, result: d.result });
        record.score = d.score; record.phase = 'between'; record.ready = { P1: false, P2: false };
        break;
      case 'ready': record.ready[d.seat] = true; break;
      case 'series_ended': record.phase = 'done'; record.winner = d.winner; record.endReason = d.reason; break;
      case 'cancelled': record.phase = 'cancelled'; record.endReason = d.reason; break;
    }
  }
  return record;
}
