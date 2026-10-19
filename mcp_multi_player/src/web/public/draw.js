// Draws one board on a canvas from render data (spec §11): tiles, path, slots, towers,
// attackers with health bars, shots and effects. Drawing style adapted from the Wave Duel
// prototype (itself after boxops/tower_defense_js, Apache-2.0).

const css = getComputedStyle(document.documentElement);
export const C = Object.fromEntries(['p1', 'p2', 'grass', 'grass-2', 'path', 'path-edge', 'slot', 'slot-edge', 'crawler', 'runner', 'scarab', 'laser', 'cannon', 'cryo', 'danger', 'fg', 'muted']
  .map((k) => [k, css.getPropertyValue('--' + k).trim()]));
const UNIT = { crawler: C.crawler, runner: C.runner, scarab: C.scarab };
const TOWER = { laser: C.laser, cannon: C.cannon, cryo: C.cryo };

export function setupCanvas(canvas, layout) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = layout.width * dpr; canvas.height = layout.height * dpr;
  canvas.style.aspectRatio = `${layout.width} / ${layout.height}`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function poly(ctx, x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + (i * Math.PI * 2) / n; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}

/** board: { health, towers, units, shots }; fx: { beams, tracers, booms, pops, leak, hits, lost } */
export function drawBoard(ctx, layout, board, seat, fx = {}) {
  const T = layout.tile, seatColor = seat === 'P1' ? C.p1 : C.p2;
  ctx.clearRect(0, 0, layout.width, layout.height);
  layout.rows.forEach((row, r) => [...row].forEach((ch, c) => {
    ctx.fillStyle = (r + c) % 2 ? C.grass : C['grass-2'];
    ctx.fillRect(c * T, r * T, T, T);
    if ('#SB'.includes(ch)) { ctx.fillStyle = C.path; ctx.fillRect(c * T, r * T, T, T); }
  }));
  ctx.strokeStyle = C['path-edge']; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
  ctx.beginPath(); layout.path.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'top';
  for (const s of layout.slots) {
    ctx.fillStyle = C.slot; ctx.fillRect(s.x - T / 2 + 6, s.y - T / 2 + 6, T - 12, T - 12);
    ctx.strokeStyle = C['slot-edge']; ctx.lineWidth = 1; ctx.strokeRect(s.x - T / 2 + 6.5, s.y - T / 2 + 6.5, T - 13, T - 13);
    ctx.fillStyle = C.muted; ctx.fillText(s.id, s.x - T / 2 + 9, s.y - T / 2 + 8);
  }
  const S = layout.path[0], B = layout.path[layout.path.length - 1];
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.strokeStyle = C.muted; ctx.lineWidth = 2; ctx.strokeRect(S.x - 18, S.y - 18, 36, 36);
  ctx.fillStyle = C.muted; ctx.fillText('IN', S.x, S.y);
  ctx.fillStyle = fx.leak ? C.danger : seatColor; poly(ctx, B.x, B.y, 24, 6, Math.PI / 6); ctx.fill();
  ctx.fillStyle = '#0c1310'; ctx.font = '700 15px "Chakra Petch", system-ui, sans-serif'; ctx.fillText(String(board?.health ?? ''), B.x, B.y + 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (!board) return;

  const slotAt = Object.fromEntries(layout.slots.map((s) => [s.id, s]));
  for (const t of board.towers) {
    const s = slotAt[t.slot]; if (!s) continue;
    ctx.fillStyle = TOWER[t.type] ?? C.fg; ctx.strokeStyle = fx.hits?.has(t.slot) ? C.danger : seatColor; ctx.lineWidth = 3;
    if (t.type === 'laser') poly(ctx, s.x, s.y + 2, 17, 4, 0);
    else if (t.type === 'cannon') poly(ctx, s.x, s.y + 2, 16, 8, Math.PI / 8);
    else poly(ctx, s.x, s.y + 2, 16, 6, 0);
    ctx.fill(); ctx.stroke();
    // Health bar along the bottom of the slot, and the upgrade counts top right (d, r, g = range).
    const share = Math.max(0, t.health) / (layout.tower_health || 1);
    ctx.fillStyle = '#00000099'; ctx.fillRect(s.x - 20, s.y + 20, 40, 4);
    ctx.fillStyle = share > 0.5 ? C.crawler : share > 0.25 ? C.runner : C.danger; ctx.fillRect(s.x - 20, s.y + 20, 40 * share, 4);
    const ups = t.ups ? [['d', t.ups.damage], ['r', t.ups.rate], ['g', t.ups.range]].filter(([, n]) => n).map(([k, n]) => k + n).join(' ') : '';
    if (ups) {
      ctx.font = '600 9px "JetBrains Mono", ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = C.fg; ctx.fillText(ups, s.x + T / 2 - 8, s.y - T / 2 + 9);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }
  for (const l of fx.lost ?? []) {
    const s = slotAt[l.slot]; if (!s) continue;
    ctx.strokeStyle = C.danger; ctx.lineWidth = 3; ctx.globalAlpha = 1 - l.k;
    ctx.beginPath(); ctx.arc(s.x, s.y, 14 + 22 * l.k, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x - 12, s.y - 12); ctx.lineTo(s.x + 12, s.y + 12); ctx.moveTo(s.x + 12, s.y - 12); ctx.lineTo(s.x - 12, s.y + 12); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const u of board.units) {
    ctx.fillStyle = UNIT[u.type] ?? C.fg;
    if (u.type === 'crawler') { ctx.beginPath(); ctx.arc(u.x, u.y, 9, 0, Math.PI * 2); ctx.fill(); }
    else if (u.type === 'runner') {
      const a = Math.atan2(u.dy, u.dx);
      ctx.beginPath(); ctx.moveTo(u.x + Math.cos(a) * 11, u.y + Math.sin(a) * 11);
      ctx.lineTo(u.x + Math.cos(a + 2.4) * 10, u.y + Math.sin(a + 2.4) * 10);
      ctx.lineTo(u.x + Math.cos(a - 2.4) * 10, u.y + Math.sin(a - 2.4) * 10); ctx.closePath(); ctx.fill();
    } else { ctx.fillRect(u.x - 10, u.y - 10, 20, 20); ctx.strokeStyle = '#00000066'; ctx.lineWidth = 3; ctx.strokeRect(u.x - 8.5, u.y - 8.5, 17, 17); }
    if (u.slowed) { ctx.strokeStyle = C.cryo; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.x, u.y, 13, 0, Math.PI * 2); ctx.stroke(); }
    const w = 22;
    ctx.fillStyle = '#00000099'; ctx.fillRect(u.x - w / 2, u.y - 18, w, 4);
    ctx.fillStyle = u.hp > 0.5 ? C.crawler : u.hp > 0.25 ? C.runner : C.danger; ctx.fillRect(u.x - w / 2, u.y - 18, w * u.hp, 4);
  }
  for (const t of fx.tracers ?? []) { ctx.fillStyle = TOWER[t.tower] ?? C.fg; ctx.beginPath(); ctx.arc(t.x1 + (t.x2 - t.x1) * t.k, t.y1 + (t.y2 - t.y1) * t.k, t.tower === 'cannon' ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); }
  for (const b of fx.beams ?? []) { ctx.strokeStyle = C.laser; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
  for (const b of fx.booms ?? []) { ctx.strokeStyle = C.cannon; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * b.k, 0, Math.PI * 2); ctx.stroke(); }
  for (const p of fx.pops ?? []) { ctx.strokeStyle = UNIT[p.unit] ?? C.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + 10 * p.k, 0, Math.PI * 2); ctx.stroke(); }
  if (board.health <= 0) {
    ctx.fillStyle = '#0c1310cc'; ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = C.danger; ctx.font = '700 44px "Chakra Petch", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BASE DOWN', layout.width / 2, layout.height / 2); ctx.textAlign = 'left';
  }
}
