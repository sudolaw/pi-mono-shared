// Ways a tower picks its target (spec §2.2). Ties go to the attacker furthest along the
// path, then to the lowest id, so the choice never depends on list order.

const pick = (score) => (candidates) => {
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const s = score(c);
    if (!best || s > bestScore || (s === bestScore && (c.a.dist > best.a.dist || (c.a.dist === best.a.dist && c.a.id < best.a.id)))) {
      best = c; bestScore = s;
    }
  }
  return best?.a ?? null;
};

export const TARGETING = {
  first: pick((c) => c.a.dist),
  strongest: pick((c) => c.a.hp),
  weakest: pick((c) => -c.a.hp),
  fastest: pick((c) => c.speed),
};
