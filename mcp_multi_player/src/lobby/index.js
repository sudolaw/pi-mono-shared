// @ts-check
// The front office (spec §8): creates and finds series and keeps the keys. Creating a series
// needs the host key, and only one series is open at a time: both seat addresses always point
// at it, so an agent registered once can play every series without new setup.

import { newSeriesId } from '../shared/ids.js';
import { listLevels, loadLevel } from '../config/load.js';
import { createSeries, restoreSeries } from '../series/index.js';
import { createMatch, restoreMatch } from '../match/index.js';
import { sameSecret } from './tokens.js';
import { restoreAll } from './restore.js';

const fail = (code, message) => ({ ok: false, code, message });

/**
 * deps: { store, clock, engine, hostKey, readyS?, gapS?, log?, onClosing? } (log receives
 * background failures; onClosing(graceMs) stops the process when the host closes the server)
 */
export function createLobby({ store, clock, engine, hostKey, readyS, gapS, log = console, onClosing }) {
  let closing = false;
  /** Every series by id: the open one and the finished ones still on disk. */
  const registry = new Map();
  const listeners = new Set();
  /** @type {{ series: { id: string, levelId: string, createdAt: number }[] }} */
  let index = { series: [] };

  const seriesDeps = (id) => {
    const handle = store.openSeries(id);
    const matchDeps = (n) => ({ engine, clock, log, store: handle.match(n) });
    return {
      store: handle, clock, engine, log,
      matches: { create: (o) => createMatch(matchDeps(o.matchNo), o), restore: (o) => restoreMatch(matchDeps(o.matchNo), o) },
    };
  };
  const newestFirst = () => [...registry.values()].sort((a, b) => b.status().created_at - a.status().created_at);

  const lobby = {
    hostKeyMatches: (key) => sameSecret(key, hostKey),

    /**
     * @param {string} key
     * @param {{ levelId?: string, target?: number, deadlineS?: number, paceS?: number, warmupWaves?: number }} [settings]
     */
    async createSeries(key, { levelId = 'normal', target = 2, deadlineS, paceS, warmupWaves } = {}) {
      if (!sameSecret(key, hostKey)) return fail('forbidden', 'wrong host key');
      if (closing) return fail('closing', 'the server is closing');
      const open = lobby.openSeries();
      if (open) return fail('series_open', `series ${open.id} is still open; cancel it first (only one series runs at a time, and both seats always join it)`);
      if (!Number.isInteger(target) || target < 1 || target > 5) return fail('invalid_target', 'target must be 1-5 wins');
      if (deadlineS !== undefined && (!Number.isFinite(deadlineS) || deadlineS < 10 || deadlineS > 600)) return fail('invalid_deadline', 'deadline must be 10-600 seconds');
      if (paceS !== undefined && (!Number.isFinite(paceS) || paceS < 0 || paceS > 120)) return fail('invalid_pace', 'seconds per wave on screen must be 0-120');
      if (warmupWaves !== undefined && (!Number.isInteger(warmupWaves) || warmupWaves < 0 || warmupWaves > 10)) return fail('invalid_warmup', 'warm-up waves must be 0-10');
      let level;
      try { level = loadLevel(levelId); } catch (err) { return fail('unknown_level', err.message); }
      const id = newSeriesId();
      const series = await createSeries(seriesDeps(id), { id, level, target, deadlineS, paceS, warmupWaves, readyS, gapS, createdAt: clock.now() });
      index = { series: [...index.series, { id, levelId, createdAt: clock.now() }] };
      await store.writeIndex(index);
      registry.set(id, series);
      for (const fn of [...listeners]) { try { fn({ type: 'series_created', id }); } catch { /* ignore */ } }
      return { ok: true, seriesId: id };
    },

    /** The series both seats play in: the newest one that is not over, or null. */
    openSeries: () => newestFirst().find((s) => !s.isClosed()) ?? null,
    /** The newest series of all, open or not (to tell an agent how the last one ended). */
    latestSeries: () => newestFirst()[0] ?? null,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    get: (id) => registry.get(id) ?? null,
    list: () => [...registry.values()].map((s) => s.status()).sort((a, b) => b.created_at - a.created_at),
    levels: () => listLevels(),

    /**
     * Closing the server: the open series is cancelled, so every agent's next reply says stop
     * (agents check in at least every 25 s); `onClosed` shuts the process down after a grace
     * period long enough for them to hear it.
     */
    async close(key, graceMs = 30_000) {
      if (!sameSecret(key, hostKey)) return fail('forbidden', 'wrong host key');
      closing = true;
      const open = lobby.openSeries();
      if (open) await open.cancel('the host closed the server');
      onClosing?.(graceMs);
      return { ok: true, closes_in_s: graceMs / 1000 };
    },
    isClosing: () => closing,

    async cancel(key, id, reason) {
      if (!sameSecret(key, hostKey)) return fail('forbidden', 'wrong host key');
      const series = registry.get(id);
      if (!series) return fail('not_found', `no series ${id}`);
      await series.cancel(reason);
      return { ok: true };
    },

    async delete(key, id) {
      if (!sameSecret(key, hostKey)) return fail('forbidden', 'wrong host key');
      const series = registry.get(id);
      if (!series) return fail('not_found', `no series ${id}`);
      const phase = series.status().phase;
      if (phase === 'in_match' || phase === 'between') return fail('live', 'cancel the series before deleting it');
      registry.delete(id);
      index = { series: index.series.filter((e) => e.id !== id) };
      await store.writeIndex(index);
      await store.deleteSeries(id);
      return { ok: true };
    },

    async restore() {
      index = await restoreAll({
        store, registry, log,
        loadSeries: (entry) => restoreSeries(seriesDeps(entry.id), { id: entry.id, level: loadLevel(entry.levelId), readyS, gapS, createdAt: entry.createdAt }),
      });
    },
  };
  return lobby;
}
