// @ts-check
// The host key check (spec §8). The host key guards the dashboard's actions and the live
// boards; it is compared in constant time and never stored.

import { timingSafeEqual, createHash } from 'node:crypto';

export function sameSecret(given, expected) {
  if (typeof given !== 'string' || !given) return false;
  const a = createHash('sha256').update(given).digest(), b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
