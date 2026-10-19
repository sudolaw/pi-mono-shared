// The scoreline (spec §2.9): wins per seat and draws. The series ends when a seat reaches
// the target, or is drawn after 2 x target + 1 matches without a winner.

export function addResult(record, result) {
  if (result.cancelled) return;
  if (result.winner) record.score[result.winner]++;
  else record.score.draws++;
}

/** @returns {{ winner: 'P1'|'P2'|null, reason: string } | null} */
export function seriesWinner(record) {
  for (const s of /** @type {const} */ (['P1', 'P2'])) if (record.score[s] >= record.target) return { winner: s, reason: `${s} reached ${record.target} wins` };
  const played = record.history.filter((h) => !h.result.cancelled).length;
  if (played >= 2 * record.target + 1) return { winner: null, reason: `no winner after ${played} matches` };
  return null;
}
