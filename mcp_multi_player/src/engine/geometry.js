// All position maths (spec §2.1): walking the path polyline by distance and range checks.
// Pure; used by the engine and by config/layout.js to compute slot info.

/** Point and heading at distance d along a path {points, cum, length}. */
export function pointAt(path, d) {
  const { points, cum } = path;
  if (d <= 0) return heading(points[0], points[1], points[0]);
  if (d >= path.length) return heading(points[points.length - 2], points[points.length - 1], points[points.length - 1]);
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const a = points[lo], b = points[hi], t = (d - cum[lo]) / (cum[hi] - cum[lo]);
  return heading(a, b, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

function heading(a, b, at) {
  return { x: at.x, y: at.y, dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
}

export function inRange(ax, ay, bx, by, range) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy <= range * range;
}
