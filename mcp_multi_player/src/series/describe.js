// Short human-readable descriptions of bundles and rounds, used by the plain-text match
// log, match reports and the spectator commentary.

const TOWER = { laser: 'Laser', plasma: 'Plasma', cryo: 'Cryo' };
const UNIT = { crawler: 'Crawler', runner: 'Runner', scarab: 'Scarab' };

export function describeAction(a) {
  switch (a.type) {
    case 'build': return `built ${TOWER[a.tower] ?? a.tower} @${a.slot}${a.targeting && a.targeting !== 'first' ? ` (${a.targeting})` : ''}`;
    case 'upgrade': return `upgraded @${a.slot}`;
    case 'target': return `set @${a.slot} to ${a.targeting}`;
    case 'send': return `sent ${a.units.map((u) => `${u.count}× ${UNIT[u.type] ?? u.type}`).join(', ')}`;
    default: return a.type;
  }
}

export function describeBundle(actions) {
  if (!actions || actions.length === 0) return 'saved gold';
  return actions.map(describeAction).join(', ');
}

/** One line for match-NN.log, e.g. "R042 · P1 Claude Code: … · P2 Codex: … · combat: 9 kills, 1 base hit on P2 (14/20)". */
export function roundLine({ round, warmup, names, bundles, summary, end, autoFilled = {} }) {
  const who = (seat) => `${seat} ${names[seat] ?? ''}`.trim();
  const part = (seat) => `${who(seat)}: ${describeBundle(bundles[seat])}${autoFilled[seat] ? ' (missed deadline)' : ''}`;
  const kills = summary.kills.P1 + summary.kills.P2;
  const hits = ['P1', 'P2'].filter((s) => summary.baseHits[s] > 0).map((s) => `${summary.baseHits[s]} base hit${summary.baseHits[s] > 1 ? 's' : ''} on ${s} (${end[s].base} left)`);
  const tag = warmup ? `W${round}` : `R${String(round).padStart(3, '0')}`;
  return `${tag} · ${part('P1')} · ${part('P2')} · combat: ${kills} kill${kills === 1 ? '' : 's'}${hits.length ? ', ' + hits.join(', ') : ''}`;
}

/** One line for the end of a match, e.g. "match 2 won by P1 Claude Code (base_destroyed)". */
export function describeOutcome(o, names) {
  if (o.result === 'void') return `match ${o.match} cancelled by the host`;
  if (o.result === 'draw') return `match ${o.match} drawn (${o.reason})`;
  return `match ${o.match} won by ${o.winner} ${names[o.winner] ?? ''} (${o.decidedBy})`;
}
