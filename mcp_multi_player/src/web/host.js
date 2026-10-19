// Guards host-only routes (spec §11). The key comes in the X-Host-Key header, or as ?key=
// for the live stream (a browser's EventSource cannot set headers). Every failure gets the
// same answer.

export function keyOf(req) {
  return req.get('x-host-key') || (typeof req.query.key === 'string' ? req.query.key : '');
}

export function requireHost(lobby) {
  return (req, res, next) => {
    if (lobby.hostKeyMatches(keyOf(req))) return next();
    res.status(403).json({ ok: false, code: 'forbidden', message: 'wrong host key' });
  };
}
