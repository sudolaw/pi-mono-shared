// All series on this server. Each series is independent: its own state, logs, seats and
// timers. The manager only creates, finds and recovers them.

import { EventEmitter } from 'node:events';
import { Series } from './series.js';
import { createEngine } from '../engine/index.js';

export class SeriesManager extends EventEmitter {
  constructor(store, { clock, engineFactory = createEngine, enginePool = null } = {}) {
    super();
    this.store = store;
    this.clock = clock;
    this.engineFactory = engineFactory;
    this.enginePool = enginePool;
    this.all = new Map();
  }

  /** Loads every series found on disk (restart recovery). */
  async recoverAll() {
    for (const id of await this.store.listSeriesIds()) this.track(await Series.load(this.store, id, { clock: this.clock, engineFactory: this.engineFactory }));
    return this.all.size;
  }

  async create(overrides) {
    return this.track(await Series.create(this.store, { overrides, clock: this.clock, engineFactory: this.engineFactory }));
  }

  get(id) { return this.all.get(id) ?? null; }

  list() {
    return [...this.all.values()].sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt));
  }

  /** Series this player sits in, newest first (for get_match without a series id). */
  forPlayer(playerId) {
    return this.list().filter((s) => s.seatOf(playerId));
  }

  track(series) {
    this.all.set(series.id, series);
    series.on('changed', () => this.emit('changed', series.id));
    series.on('fault', () => this.emit('fault', series.id));
    this.emit('changed', series.id);
    return series;
  }

  async close() { await Promise.all([...this.all.values()].map((s) => s.close())); await this.enginePool?.close(); }
}
