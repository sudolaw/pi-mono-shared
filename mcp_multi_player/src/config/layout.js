// Reads a level's ASCII board (spec §2.1): finds the spawn, base and slots, follows the path
// tiles from spawn to base into one polyline, and computes slot info: which stretches of path
// each tower type reaches from each slot (at base range and at the largest range upgrades
// allow), and the order in which towers soak up leaks (closest to the base first). A broken or
// branching path is rejected, naming the tile.

import { pointAt, inRange } from '../engine/geometry.js';

const PATH = '#B';

export const tileId = (r, c) => String.fromCharCode(65 + r) + (c + 1);

export function parseLayout({ tile, rows }, towers, rules) {
  const width = rows[0].length;
  if (!rows.every((row) => row.length === width)) throw new Error('layout: every row must have the same length');
  let spawn = null, base = null;
  const slots = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (!'S#Bo.'.includes(ch)) throw new Error(`layout: unknown tile "${ch}" at ${tileId(r, c)}`);
    if (ch === 'S') { if (spawn) throw new Error('layout: more than one S'); spawn = { r, c }; }
    if (ch === 'B') { if (base) throw new Error('layout: more than one B'); base = { r, c }; }
    if (ch === 'o') slots.push({ id: tileId(r, c), r, c, x: c * tile + tile / 2, y: r * tile + tile / 2 });
  }));
  if (!spawn || !base) throw new Error('layout: needs one S and one B');

  const isPath = (r, c) => r >= 0 && r < rows.length && c >= 0 && c < width && PATH.includes(rows[r][c]);
  const cells = [spawn];
  const seen = new Set([spawn.r + ',' + spawn.c]);
  let cur = spawn;
  while (cur.r !== base.r || cur.c !== base.c) {
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dr, dc]) => ({ r: cur.r + dr, c: cur.c + dc }))
      .filter((p) => isPath(p.r, p.c) && !seen.has(p.r + ',' + p.c));
    if (next.length === 0) throw new Error(`layout: the path stops at ${tileId(cur.r, cur.c)} before reaching B`);
    if (next.length > 1) throw new Error(`layout: the path branches at ${tileId(cur.r, cur.c)}`);
    cur = next[0];
    seen.add(cur.r + ',' + cur.c);
    cells.push(cur);
  }
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '#' && !seen.has(r + ',' + c)) throw new Error(`layout: path tile ${tileId(r, c)} is not on the route from S to B`);
  }));

  const points = cells.map((p) => ({ x: p.c * tile + tile / 2, y: p.r * tile + tile / 2 }));
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const path = { points, cum, length: cum[cum.length - 1], tiles: cells.map((p) => tileId(p.r, p.c)) };

  const maxScale = 1 + rules.upgrade.step * rules.upgrade.maxRangeUps;
  for (const s of slots) {
    s.cover = {}; s.reach = {};
    for (const [type, def] of Object.entries(towers)) {
      const base = reach(path, tile, s, def.base.range), max = reach(path, tile, s, def.base.range * maxScale);
      s.cover[type] = base.tiles;
      s.reach[type] = { base: base.ranges, max: max.ranges, max_tiles: max.tiles };
    }
    s.toBase = Math.round((Math.hypot(s.x - points.at(-1).x, s.y - points.at(-1).y) / tile) * 100) / 100;
  }
  // Leaks hit the tower closest to the base first; ties go to the slot that comes first by id.
  const leakOrder = [...slots].sort((a, b) => a.toBase - b.toBase || a.id.localeCompare(b.id)).map((s) => s.id);
  return { tile, rows, width: width * tile, height: rows.length * tile, slots, path, leakOrder,
    spawn: tileId(spawn.r, spawn.c), base: tileId(base.r, base.c) };
}

/**
 * Which path tiles a tower at slot s reaches with this range: the total (in tiles) and the
 * stretches as [first, last] path tile numbers (1 = the spawn tile), sampled every 8 units.
 */
function reach(path, tile, s, range) {
  let inside = 0, ranges = [], open = null;
  for (let d = 0; d <= path.length; d += 8) {
    const p = pointAt(path, d), n = Math.round(d / tile) + 1;
    if (inRange(p.x, p.y, s.x, s.y, range)) {
      inside += 8;
      if (open) open[1] = n; else ranges.push(open = [n, n]);
    } else open = null;
  }
  return { tiles: Math.round((inside / tile) * 10) / 10, ranges };
}
