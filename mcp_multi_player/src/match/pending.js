// Each seat's moves for the current turn, hidden until both are in (spec §6). A seat's list
// is locked once submitted; only "submitted: yes/no" is ever reported.

export function createPending() {
  let box = { P1: null, P2: null };
  return {
    put(seat, entry) { box[seat] = entry; },
    has: (seat) => box[seat] !== null,
    both: () => box.P1 !== null && box.P2 !== null,
    submitted: () => ({ P1: box.P1 !== null, P2: box.P2 !== null }),
    actions: () => ({ P1: box.P1?.actions ?? [], P2: box.P2?.actions ?? [] }),
    clear() { box = { P1: null, P2: null }; },
  };
}
