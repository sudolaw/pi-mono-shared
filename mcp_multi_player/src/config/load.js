// Loads a level by id (spec §2, §4.2): read the file, check it, add the parsed layout,
// deep-freeze it and attach its hash. The engine trusts what comes out of here.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkLevel } from './schema.js';
import { parseLayout } from './layout.js';
import { hashValue } from '../shared/hash.js';

const LEVEL_DIR = fileURLToPath(new URL('../../levels/', import.meta.url));

export function listLevels(dir = LEVEL_DIR) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const lv = JSON.parse(readFileSync(dir + f, 'utf8'));
    return { id: lv.id, name: lv.name, description: lv.description };
  });
}

export function loadLevel(id, dir = LEVEL_DIR) {
  if (!/^[a-z0-9_-]+$/.test(id)) throw new Error(`unknown level ${id}`);
  let raw;
  try { raw = JSON.parse(readFileSync(dir + id + '.json', 'utf8')); } catch { throw new Error(`unknown level ${id}`); }
  return prepareLevel(raw);
}

/** Checks a raw level object and returns the frozen, hashed Level the engine uses. */
export function prepareLevel(raw) {
  const errors = checkLevel(raw);
  if (errors.length) throw new Error(`level ${raw?.id}: ${errors.join('; ')}`);
  const hash = hashValue(raw);
  return deepFreeze({ ...raw, hash, layout: parseLayout(raw.layout, raw.towers, raw.rules) });
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}
