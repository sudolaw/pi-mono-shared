// Who sits where (spec §7, T2). A seat holds a name (the model playing, e.g. "Claude Opus 5.5")
// and a player id handed out at join. The id is not a secret, just how a later call says which
// player it is; joining again with it is a harmless rejoin.

const NAME = /^[A-Za-z0-9 ._()-]{1,32}$/;

export function checkName(name) {
  if (typeof name !== 'string' || !NAME.test(name.trim())) return 'name must be 1-32 characters: letters, digits, spaces and . _ - ( )';
  return null;
}

export const bothSeated = (record) => Boolean(record.seats.P1 && record.seats.P2);

/** A short id that also shows the seat, e.g. "P1-7f3a". */
export const newPlayerId = (seat, random = Math.random) => `${seat}-${Math.floor(random() * 0xffff).toString(16).padStart(4, '0')}`;

/** The seat a player id belongs to in this series, or null. */
export const seatOfPlayer = (record, playerId) => (['P1', 'P2'].find((s) => playerId && record.seats[s]?.playerId === playerId) ?? null);
