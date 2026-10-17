// Player credentials (SPEC.md §11). Each agent has one long-lived bearer token, made once
// with `npm run add-player`. Only the SHA-256 hash is stored (players.json in the data
// directory); the token itself is shown once and never written or logged by the server.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export class Players {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'players.json');
    fs.mkdirSync(dataDir, { recursive: true });
    this.reload();
  }

  reload() {
    try {
      this.players = JSON.parse(fs.readFileSync(this.file, 'utf8')).players ?? {};
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.players = {};
    }
  }

  /** Creates (or replaces) a player and returns its new token. The old token stops working. */
  add(playerId) {
    if (!ID_RE.test(playerId)) throw new Error('player id: 1–32 chars, lowercase letters, digits, _ or -, starting with a letter or digit');
    const token = `mmp_${randomBytes(24).toString('base64url')}`;
    this.reload();
    this.players[playerId] = { hash: sha256(token), createdAt: new Date().toISOString() };
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ players: this.players }, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
    return token;
  }

  /** Returns the player id for a token, or null. Re-reads the file once on a miss, so new players work without a restart. */
  async verify(token) {
    if (typeof token !== 'string' || !token.startsWith('mmp_')) return null;
    const h = Buffer.from(sha256(token), 'hex');
    const find = () => {
      for (const [id, p] of Object.entries(this.players)) {
        if (timingSafeEqual(Buffer.from(p.hash, 'hex'), h)) return id;
      }
      return null;
    };
    const hit = find();
    if (hit) return hit;
    this.reloading ??= fsp.readFile(this.file, 'utf8').then((text) => { this.players = JSON.parse(text).players ?? {}; }).catch((err) => { if (err.code !== 'ENOENT') throw err; this.players = {}; }).finally(() => { this.reloading = null; });
    await this.reloading;
    return find();
  }
}

/** Express middleware: Bearer token → req.auth (the SDK forwards it to tools as authInfo). */
export function bearerAuth(players) {
  return async (req, res, next) => {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    const playerId = m ? await players.verify(m[1]) : null;
    if (!playerId) {
      res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'missing or unknown player token' });
      return;
    }
    // expiresAt far in the future: player tokens don't expire, and some SDK helpers require the field.
    req.auth = { token: m[1], clientId: playerId, scopes: [], expiresAt: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600 };
    next();
  };
}

/** Host key: printed at server start, required for create / cancel / forfeit. */
export function newHostKey() {
  return `host_${randomBytes(18).toString('base64url')}`;
}

export function hostKeyMatches(expected, given) {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
