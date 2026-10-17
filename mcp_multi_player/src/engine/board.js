// Board geometry (SPEC.md §3): two pipes, 18 owned slots, three build zones.
// Everything is in simulation units and derived from config.board, so the browser can
// build the exact same board from list_games / the series settings.

export const SEATS = ['P1', 'P2'];
export const other = (seat) => (seat === 'P1' ? 'P2' : 'P1');

/** Builds the board from config.board. Result is plain data plus a positionAt helper. */
export function buildBoard(boardCfg) {
  const { width, height } = boardCfg;
  const reflect = ([x, y]) => [width - x, height - y];

  const paths = {
    P1: pathOf(boardCfg.p1Path),
    P2: pathOf(boardCfg.p1Path.map(reflect)),
  };

  const slots = {};
  boardCfg.p1Slots.forEach((p, i) => {
    slots[`P1-${i + 1}`] = { id: `P1-${i + 1}`, owner: 'P1', x: p[0], y: p[1], zone: zoneOf(p[0], width) };
    const q = reflect(p);
    slots[`P2-${i + 1}`] = { id: `P2-${i + 1}`, owner: 'P2', x: q[0], y: q[1], zone: zoneOf(q[0], width) };
  });

  return {
    width,
    height,
    bases: boardCfg.bases,
    paths, // paths[seat] is the route of that seat's attackers (toward the other base)
    slots,
    slotIds: [...boardCfg.p1Slots.map((_, i) => `P1-${i + 1}`), ...boardCfg.p1Slots.map((_, i) => `P2-${i + 1}`)],
    positionAt: (seat, dist) => positionOnPath(paths[seat], dist),
  };
}

function zoneOf(x, width) {
  if (x < width / 3) return 'P1';
  if (x > (2 * width) / 3) return 'P2';
  return 'middle';
}

function pathOf(points) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    segments.push({ ax, ay, bx, by, len, start: total });
    total += len;
  }
  return { points, segments, length: total };
}

/** (x, y) at distance `dist` along a path, clamped to its ends. */
export function positionOnPath(path, dist) {
  if (dist <= 0) return [path.points[0][0], path.points[0][1]];
  for (const s of path.segments) {
    if (dist <= s.start + s.len) {
      const t = (dist - s.start) / s.len;
      return [s.ax + (s.bx - s.ax) * t, s.ay + (s.by - s.ay) * t];
    }
  }
  const last = path.points.at(-1);
  return [last[0], last[1]];
}
