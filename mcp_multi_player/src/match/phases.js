// Which step a match is in, and which steps may follow (spec §6). Anything out of order,
// such as a move after the end, is refused here.

const NEXT = {
  created: ['collecting', 'cancelled'],
  collecting: ['resolving', 'over', 'cancelled'],
  resolving: ['collecting', 'over', 'cancelled'],
  over: [],
  cancelled: [],
};

export function moveTo(rec, to) {
  if (!NEXT[rec.phase].includes(to)) throw new Error(`match ${rec.id}: cannot go from ${rec.phase} to ${to}`);
  rec.phase = to;
}

export const isFinished = (phase) => phase === 'over' || phase === 'cancelled';
