// The live stream of one series for the host (spec §11): a snapshot on connect (which is also
// how a reconnecting browser catches up), then every turn, phase change and result. A
// browser that falls far behind is dropped; it reconnects and gets a fresh snapshot.

const MAX_BUFFER = 8 * 1024 * 1024;

/** Turn events worth animating (spawns show up in the frames). */
const visible = () => (e) => e.type !== 'spawn';

export function streamSeries(req, res, series, publicStatus) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  const keep = visible(series.level);
  const send = (event, data, id) => {
    if (res.writableLength > MAX_BUFFER) { res.end(); return; }
    res.write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const hello = () => {
    const m = series.currentMatch(), g = m?.getRender();
    send('hello', { series: publicStatus(series), match: g && g.render ? { number: m.matchNo, version: g.version, status: g.status, render: g.render, report: g.report } : null }, g ? `${m.matchNo}:${g.version}` : undefined);
  };

  let matchOff = null;
  const watchMatch = () => {
    matchOff?.();
    const m = series.currentMatch();
    matchOff = m?.subscribe((msg) => {
      const id = `${m.matchNo}:${msg.version}`;
      if (msg.type === 'turn') send('turn', { match: m.matchNo, version: msg.version, events: msg.events.filter(keep), frames: msg.frames, render: msg.render, status: msg.status }, id);
      else if (msg.type === 'phase') send('phase', { match: m.matchNo, status: msg.status });
      else if (msg.type === 'match_end') send('match_end', { match: m.matchNo, result: msg.result, report: msg.report, render: msg.render, status: msg.status }, id);
    }) ?? null;
  };
  const seriesOff = series.subscribe((msg) => {
    if (msg.type === 'match_start') { watchMatch(); hello(); }
    else send(msg.type === 'series_end' ? 'series_end' : 'series', { series: publicStatus(series) });
  });
  watchMatch();
  hello();
  const beat = setInterval(() => res.write(': keep-alive\n\n'), 15000);
  req.on('close', () => { clearInterval(beat); seriesOff(); matchOff?.(); });
}
