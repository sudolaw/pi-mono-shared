// One stable hash for any JSON value (keys sorted), used for state hashes in the log,
// and request-argument hashes for safe retries (spec §5, §6).

import { createHash } from 'node:crypto';

/** JSON with object keys in sorted order, so equal values always serialise the same. */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

export function hashValue(value, length = 16) {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, length);
}
