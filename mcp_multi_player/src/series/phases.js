// Which step a series is in (spec §7): waiting for players, in a match, between matches,
// done or cancelled.

const NEXT = {
  waiting: ['in_match', 'cancelled'],
  in_match: ['between', 'done', 'cancelled'],
  between: ['in_match', 'done', 'cancelled'],
  done: [],
  cancelled: [],
};

export function moveTo(rec, to) {
  if (!NEXT[rec.phase].includes(to)) throw new Error(`series ${rec.id}: cannot go from ${rec.phase} to ${to}`);
  rec.phase = to;
}

export const isClosed = (phase) => phase === 'done' || phase === 'cancelled';
