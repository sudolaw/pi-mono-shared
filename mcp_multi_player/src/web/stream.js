// Shared spectator serialization and bounded SSE delivery (SPEC.md §14).
// A slow browser may reconnect; it must never hold up combat or buffer without limit.
import { spectatorView } from '../series/views.js';

const MAX_BUFFER = 256 * 1024;
const MAX_HISTORY = 96 * 1024;
const hubs = new WeakMap();
const wire = (type, json) => `event: ${type}\ndata: ${json}\n\n`;

export function spectatorHub(series) {
  let hub = hubs.get(series);
  if (hub) return hub;
  const clients = new Set();
  let cachedKey = null;
  let cachedView = null;
  // Live combat moves attackers without bumping the version, so the tick is part of the key.
  const viewJson = () => {
    const key = `${series.record.version}:${series.state?.tick ?? ''}`;
    if (cachedKey !== key) {
      cachedView = JSON.stringify(spectatorView(series));
      cachedKey = key;
    }
    return cachedView;
  };
  const broadcast = (type, json) => {
    const message = wire(type, json);
    for (const client of clients) client.send(message);
  };
  const onChanged = () => broadcast('view', viewJson());
  const onEvent = (event) => broadcast('event', JSON.stringify(event));
  const onCombat = (snapshot) => broadcast('combat', JSON.stringify(snapshot));

  hub = { viewJson, async connect(req, res) {
    let initializing = true;
    let blocked = false;
    let closed = false;
    let bytes = 0;
    const pending = [];
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(ping);
      clients.delete(client);
      res.off('drain', drain);
      pending.length = 0;
      if (!clients.size) {
        series.off('changed', onChanged);
        series.off('event', onEvent);
        series.off('combat', onCombat);
      }
    };
    const send = (message) => {
      if (closed) return;
      const size = Buffer.byteLength(message);
      if (bytes + res.writableLength + size > MAX_BUFFER) {
        close(); res.destroy(); return;
      }
      if (initializing || blocked) { pending.push(message); bytes += size; }
      else blocked = !res.write(message);
    };
    const drain = () => {
      blocked = false;
      while (!initializing && !blocked && pending.length && !closed) {
        const message = pending.shift();
        bytes -= Buffer.byteLength(message);
        blocked = !res.write(message);
      }
    };
    const client = { send };
    const ping = setInterval(() => send(': ping\n\n'), 15000);
    res.on('drain', drain);
    req.on('close', close);
    try {
      // Subscribe and take the starting picture between two mutations: every event up to
      // `seq` is then in the history, and every later one arrives as a live message.
      let seq, initialView, snapshot;
      await series.read(() => {
        if (closed) return;
        if (!clients.size) {
          series.on('changed', onChanged);
          series.on('event', onEvent);
          series.on('combat', onCombat);
        }
        clients.add(client);
        seq = series.record.seq;
        initialView = viewJson();
        snapshot = series.liveSnapshot();
      });
      if (closed) return;
      // Buffer changes across the history load.
      let history = (await series.store.recentEvents(series.id)).filter((e) => e.seq <= seq);
      let json = JSON.stringify(history);
      while (Buffer.byteLength(json) > MAX_HISTORY && history.length) {
        history = history.slice(Math.max(1, Math.floor(history.length / 4)));
        json = JSON.stringify(history);
      }
      if (closed) return;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      // Prepend the captured view/history/combat, then changes that arrived during loading.
      const first = [wire('view', initialView), wire('history', json)];
      if (snapshot) first.push(wire('combat', JSON.stringify(snapshot)));
      pending.unshift(...first);
      for (const message of first) bytes += Buffer.byteLength(message);
      initializing = false;
      drain();
    } catch (err) { close(); throw err; }
  } };
  hubs.set(series, hub);
  return hub;
}
