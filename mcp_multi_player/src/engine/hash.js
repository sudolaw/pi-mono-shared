// State fingerprint for deterministic replay (SPEC.md §13): SHA-256 of canonical JSON
// (object keys sorted), so equal states always hash equal regardless of key order.

import { createHash } from 'node:crypto';

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function hashState(state) {
  return createHash('sha256').update(canonicalJson(state)).digest('hex');
}
