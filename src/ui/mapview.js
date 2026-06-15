// Canvas-Kartenansicht im Anno/C&C-Stil: gezeichnetes Gelände, Gebäude-Sprites,
// Scrollen (ziehen) und Zoomen. Wird imperativ in einen Host-Container gehängt.

import { BASE_COLS, BASE_ROWS } from '../engine/game.js';

const TS = 84; // Basis-Kachelgröße in Weltpixeln

const imgCache = new Map();
function sprite(id) {
  if (imgCache.has(id)) return imgCache.get(id);
  const im = new Image();
  im.src = `assets/buildings/${id}.png`;
  im.decoding = 'async';
  imgCache.set(id, im);
  return im;
}

let host = null, canvas = null, ctx = null, raf = 0;
let game = null, opts = {};
let cam = { x: 0, y: 0, z: 1 };
let sel = null, move = null, hover = null;
let dpr = 1;
const drag = { on: false, moved: false, sx: 0, sy: 0, cx: 0, cy: 0 };

export function mount(h, g, o) {
  unmount();
  host = h; game = g; opts = o || {};
  host.innerHTML = `<div class="mapwrap">
    <canvas class="mapcanvas"></canvas>
    <div class="mapzoom">
      <button class="mz" data-z="in">＋</button>
      <button class="mz" data-z="out">－</button>
      <button class="mz" data-z="home">⟳</button>
    </div>
  </div>`;
  canvas = host.querySelector('.mapcanvas');
  ctx = canvas.getContext('2d');
  resize();
  centerCamera();
  bind();
  loop();
  window.addEventListener('resize', resize);
}

export function unmount() {
  if (raf) cancelAnimationFrame(raf), raf = 0;
  window.removeEventListener('resize', resize);
  if (canvas) {
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('wheel', onWheel);
  }
  host = canvas = ctx = game = null; sel = move = hover = null;
}

export function setSelection(s, m) { sel = s == null ? null : +s; move = m == null ? null : +m; }
export function refresh(g) { if (g) game = g; }

function resize() {
  if (!canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = host.clientWidth, h = Math.max(320, Math.min(560, Math.round(window.innerHeight * 0.52)));
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
}

function centerCamera() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const mapW = BASE_COLS * TS, mapH = BASE_ROWS * TS;
  cam.z = Math.min(w / mapW, h / mapH) * 0.96;
  cam.x = (mapW * cam.z - w) / 2;
  cam.y = (mapH * cam.z - h) / 2;
  clampCam();
}

function clampCam() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const mapW = BASE_COLS * TS * cam.z, mapH = BASE_ROWS * TS * cam.z;
  const maxX = Math.max(0, mapW - w), maxY = Math.max(0, mapH - h);
  const minX = Math.min(0, mapW - w), minY = Math.min(0, mapH - h);
  cam.x = Math.max(minX, Math.min(maxX, cam.x));
  cam.y = Math.max(minY, Math.min(maxY, cam.y));
}

function bind() {
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  host.querySelectorAll('.mz').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.z;
    if (k === 'home') return centerCamera();
    zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, k === 'in' ? 1.25 : 0.8);
  }));
}

function onDown(e) { drag.on = true; drag.moved = false; drag.sx = e.clientX; drag.sy = e.clientY; drag.cx = cam.x; drag.cy = cam.y; }
function onMove(e) {
  const r = canvas.getBoundingClientRect();
  hover = tileAt(e.clientX - r.left, e.clientY - r.top);
  if (!drag.on) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  cam.x = drag.cx - dx; cam.y = drag.cy - dy; clampCam();
}
function onUp(e) {
  if (!drag.on) return;
  drag.on = false;
  if (!drag.moved) {
    const r = canvas.getBoundingClientRect();
    const t = tileAt(e.clientX - r.left, e.clientY - r.top);
    if (t != null && opts.onTileClick) opts.onTileClick(t);
  }
}
function onWheel(e) { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 0.89); }

function zoomAt(px, py, factor) {
  const wx = (cam.x + px) / cam.z, wy = (cam.y + py) / cam.z;
  cam.z = Math.max(0.4, Math.min(2.4, cam.z * factor));
  cam.x = wx * cam.z - px; cam.y = wy * cam.z - py; clampCam();
}

function tileAt(px, py) {
  const wx = (cam.x + px) / cam.z, wy = (cam.y + py) / cam.z;
  const cx = Math.floor(wx / TS), cy = Math.floor(wy / TS);
  if (cx < 0 || cy < 0 || cx >= BASE_COLS || cy >= BASE_ROWS) return null;
  return cy * BASE_COLS + cx;
}

// ----------------------------------------------------------------- Zeichnen
const TCOL = {
  grass:    ['#2c6b39', '#1c4726'],
  forest:   ['#22512c', '#15331c'],
  mountain: ['#6b6f78', '#41454d'],
  water:    ['#1f6f9c', '#114b6e'],
  sand:     ['#c4ab63', '#8c7a42'],
};

function loop() {
  raf = requestAnimationFrame(loop);
  if (!ctx || !game) return;
  draw(performance.now());
}

function draw(now) {
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // Hintergrund (Wasser/Leere)
  ctx.fillStyle = '#0a1622';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const z = cam.z;
  const s = game.state;
  const movingId = move != null ? s.layout[move] : null;

  for (let i = 0; i < BASE_COLS * BASE_ROWS; i++) {
    const cx = i % BASE_COLS, cy = Math.floor(i / BASE_COLS);
    const x = cx * TS * z - cam.x, y = cy * TS * z - cam.y;
    const ts = TS * z;
    if (x > canvas.clientWidth || y > canvas.clientHeight || x + ts < 0 || y + ts < 0) continue;
    const terr = (s.terrain && s.terrain[i]) || 'grass';
    drawTile(x, y, ts, terr, now, cx, cy);

    // Platzierungs-/Versetzen-Hervorhebung
    const okTarget = move != null && movingId && game.canPlaceOn && game.canPlaceOn(movingId, i) && !s.layout[i];
    if (okTarget) {
      const a = 0.18 + 0.12 * Math.sin(now / 300);
      ctx.fillStyle = `rgba(120,220,140,${a})`;
      ctx.fillRect(x, y, ts, ts);
    }
    if (hover === i && !s.layout[i] && move == null) {
      ctx.fillStyle = 'rgba(120,200,255,.12)';
      ctx.fillRect(x, y, ts, ts);
    }

    const id = s.layout[i];
    if (id) drawBuilding(x, y, ts, id, game.isQueued && game.isQueued(id), s.buildings[id] || 0, now);

    if (sel != null && +sel === i) drawSelect(x, y, ts, '#ffd24a');
    else if (move != null && +move === i) drawSelect(x, y, ts, '#7fe3ff');
  }
}

function drawTile(x, y, ts, terr, now, cx, cy) {
  const c = TCOL[terr] || TCOL.grass;
  const g = ctx.createLinearGradient(x, y, x, y + ts);
  g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, ts, ts);
  // dezenter Raster-Rand
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);

  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, ts, ts); ctx.clip();
  const r = mulberry(cx * 73856093 ^ cy * 19349663);
  if (terr === 'forest') {
    for (let k = 0; k < 4; k++) {
      const tx = x + ts * (0.2 + 0.6 * r()), ty = y + ts * (0.25 + 0.6 * r()), s = ts * 0.18;
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(tx - s * 0.1, ty, s * 0.2, s * 0.8);
      ctx.fillStyle = '#2f7a39'; ctx.beginPath(); ctx.moveTo(tx, ty - s); ctx.lineTo(tx + s, ty + s * 0.4); ctx.lineTo(tx - s, ty + s * 0.4); ctx.closePath(); ctx.fill();
    }
  } else if (terr === 'mountain') {
    for (let k = 0; k < 3; k++) {
      const tx = x + ts * (0.2 + 0.6 * r()), ty = y + ts * (0.55 + 0.3 * r()), s = ts * 0.28;
      ctx.fillStyle = '#535862'; ctx.beginPath(); ctx.moveTo(tx, ty - s); ctx.lineTo(tx + s, ty + s * 0.5); ctx.lineTo(tx - s, ty + s * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d7dde6'; ctx.beginPath(); ctx.moveTo(tx, ty - s); ctx.lineTo(tx + s * 0.32, ty - s * 0.36); ctx.lineTo(tx - s * 0.32, ty - s * 0.36); ctx.closePath(); ctx.fill();
    }
  } else if (terr === 'water') {
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(1, ts * 0.03);
    for (let k = 0; k < 3; k++) {
      const yy = y + ts * (0.3 + k * 0.22);
      ctx.beginPath();
      for (let xx = 0; xx <= ts; xx += ts / 8) ctx.lineTo(x + xx, yy + Math.sin((xx / ts) * 6 + now / 600 + k) * ts * 0.03);
      ctx.stroke();
    }
  } else if (terr === 'sand') {
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    for (let k = 0; k < 6; k++) ctx.fillRect(x + ts * r(), y + ts * r(), 2, 2);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) { const tx = x + ts * r(), ty = y + ts * (0.3 + 0.6 * r()); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - ts * 0.12); ctx.stroke(); }
  }
  ctx.restore();
}

function drawBuilding(x, y, ts, id, busy, lvl, now) {
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x + ts / 2, y + ts * 0.82, ts * 0.34, ts * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  const im = sprite(id);
  const pad = ts * 0.12, size = ts - pad * 2;
  if (im.complete && im.naturalWidth) {
    ctx.drawImage(im, x + pad, y + pad * 0.6, size, size);
  } else {
    ctx.fillStyle = 'rgba(20,30,45,.8)'; ctx.fillRect(x + pad, y + pad, size, size);
  }
  if (busy) {
    ctx.fillStyle = `rgba(255,210,74,${0.35 + 0.25 * Math.sin(now / 250)})`;
    ctx.fillRect(x + pad, y + pad, size, size);
    ctx.fillStyle = '#1a1300'; ctx.font = `bold ${Math.round(ts * 0.18)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText('🏗️', x + ts / 2, y + ts * 0.55);
  }
  // Level-Badge
  if (lvl > 0) {
    const bw = ts * 0.3, bh = ts * 0.18;
    ctx.fillStyle = 'rgba(6,8,12,.85)'; ctx.fillRect(x + ts - bw - 3, y + 3, bw, bh);
    ctx.strokeStyle = '#2b8cff'; ctx.lineWidth = 1; ctx.strokeRect(x + ts - bw - 3, y + 3, bw, bh);
    ctx.fillStyle = '#9fc8ff'; ctx.font = `bold ${Math.round(bh * 0.7)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('L' + lvl, x + ts - bw / 2 - 3, y + 3 + bh / 2);
    ctx.textBaseline = 'alphabetic';
  }
}

function drawSelect(x, y, ts, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);
  ctx.shadowBlur = 0;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
