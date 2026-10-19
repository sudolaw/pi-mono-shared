// Launches each match (spec §2.9, T6). The seed comes from the series id and match number,
// so a whole series can be replayed from its logs.

import { hashValue } from '../shared/hash.js';

export const seedFor = (seriesId, matchNo) => parseInt(hashValue(`${seriesId}:${matchNo}`, 8), 16);

/** Match 0 is the warm-up: a few unscored waves with a long deadline and no forfeits. */
export const WARMUP_DEADLINE_S = 180;

export function matchOpts(record, level, matchNo, onEnd) {
  const warmup = matchNo === 0;
  return {
    id: `${record.id}-${matchNo}`, seriesId: record.id, matchNo, level, seed: seedFor(record.id, matchNo),
    deadlineS: warmup ? WARMUP_DEADLINE_S : record.deadlineS, paceS: record.paceS, intensity: record.intensity,
    missLimit: warmup ? Number.MAX_SAFE_INTEGER : level.rules.missLimit,
    warmup, maxWaves: warmup ? record.warmupWaves : undefined, onEnd,
  };
}
