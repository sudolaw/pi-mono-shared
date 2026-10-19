// The match's link to the disk (spec §9, T7): the readable text log, snapshot cadence, and
// rebuilding a match from its log after a restart (checking every state hash on the way).

export const SNAPSHOT_EVERY = 10;

const describe = (actions) => actions.length
  ? actions.map((a) => (a.type === 'build' ? `build ${a.slot} ${a.tower}` : a.type === 'upgrade' ? `upgrade ${a.slot}` : `target ${a.slot} ${a.rule}`)).join(', ')
  : '(no actions)';

export function turnText(state, actions, missed) {
  const side = (s) => {
    const b = state.boards[s], lt = b.lastTurn;
    return `${s}${missed[s] ? ' (missed deadline)' : ''}: ${describe(actions[s])} | health ${b.health} gold ${b.gold} kills ${b.kills} | wave: ${lt.spawned} in, ${lt.killed} killed, ${lt.leaked} leaked`;
  };
  return `Wave ${state.turn}\n  ${side('P1')}\n  ${side('P2')}`;
}

/** Replays a match's public log onto a fresh or snapshotted state. */
export function rebuild(engine, level, seed, { events, audit, snapshot }) {
  const turns = events.filter((e) => e.kind === 'turn');
  let state = engine.setup(level, seed), version = 1;
  if (snapshot && turns.some((t) => t.data.version === snapshot.version)) ({ state, version } = snapshot);
  for (const t of turns) {
    if (t.data.version <= version) continue;
    state = engine.apply(state, t.data.actions, level, { tuning: t.data.tuning }).state;
    if (engine.hash(state) !== t.stateHash) throw new Error(`replay mismatch at version ${t.data.version}`);
    version = t.data.version;
  }
  const misses = { P1: 0, P2: 0 };
  for (const e of events) if (e.kind === 'miss') misses[e.data.seat]++;
  const ended = events.find((e) => e.kind === 'match_ended');
  const pending = audit.filter((e) => e.kind === 'pending' && e.data.version === version && !ended);
  return { state, version, misses, ended, pending };
}
