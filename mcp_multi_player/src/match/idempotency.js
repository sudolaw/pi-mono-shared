// Safe retries (spec §6): the reply to each accepted request id is kept with a hash of its
// arguments. The same id and arguments get the same reply; the same id with different
// arguments is refused.

export function createReplies() {
  const seen = new Map();
  return {
    check(seat, requestId, argsHash) {
      const r = seen.get(seat + ':' + requestId);
      if (!r) return null;
      return r.argsHash === argsHash ? { duplicate: r.reply } : { conflict: true };
    },
    remember(seat, requestId, argsHash, reply) { seen.set(seat + ':' + requestId, { argsHash, reply }); },
  };
}
