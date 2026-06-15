// Echte 3D-Kartenansicht (WebGL / Three.js, frei drehbar).
// Three.js wird dynamisch per CDN geladen; klappt das nicht, zeigt die Karte
// einen Hinweis statt eines leeren Bildschirms.

import { BASE_COLS, BASE_ROWS } from '../engine/game.js';
import { makeBuilding } from './buildings3d.js';

const THREE_URL = 'https://esm.sh/three@0.161.0';
const ORBIT_URL = 'https://esm.sh/three@0.161.0/examples/jsm/controls/OrbitControls.js';

let THREE = null, OrbitControls = null;
async function loadThree() {
  if (THREE) return true;
  try {
    THREE = await import(/* @vite-ignore */ THREE_URL);
    const oc = await import(/* @vite-ignore */ ORBIT_URL);
    OrbitControls = oc.OrbitControls;
    return true;
  } catch (e) {
    console.warn('Three.js konnte nicht geladen werden:', e && e.message);
    return false;
  }
}

// Geländehöhen & Farben
const TERR = {
  water:    { h: 0.25, color: 0x1f6f9c },
  sand:     { h: 0.55, color: 0xc4ab63 },
  grass:    { h: 0.7,  color: 0x2c6b39 },
  forest:   { h: 0.85, color: 0x22512c },
  mountain: { h: 1.7,  color: 0x6b6f78 },
};

let host = null, opts = {}, game = null;
let renderer, scene, camera, controls, raf = 0;
let tileMeshes = [], buildingGroup = null, highlight = null, targetGroup = null;
let sel = null, move = null, ready = false, layoutSig = '';
const COLS = BASE_COLS, ROWS = BASE_ROWS;

export async function mount(h, g, o) {
  unmount();
  host = h; game = g; opts = o || {};
  host.innerHTML = `<div class="map3d-wrap">
    <div class="map3d"></div>
    <div class="map3d-load">🌍 Lade 3D-Welt…</div>
    <div class="mapzoom"><button class="mz" data-z="reset">⟳</button></div>
  </div>`;
  const ok = await loadThree();
  if (!ok || !host) { showError(); return; }
  try { build(); ready = true; }
  catch (e) { console.warn('3D-Aufbau fehlgeschlagen:', e); showError(); }
}

function showError() {
  if (!host) return;
  const l = host.querySelector('.map3d-load');
  if (l) l.innerHTML = '⚠️ 3D-Karte konnte nicht geladen werden (Internet/Browser). <button class="ghost mz" data-z="retry" style="margin-top:8px">Nochmal versuchen</button>';
  const btn = host.querySelector('[data-z="retry"]');
  if (btn) btn.addEventListener('click', () => mount(host, game, opts));
}

export function unmount() {
  if (raf) cancelAnimationFrame(raf), raf = 0;
  window.removeEventListener('resize', onResize);
  if (controls) { controls.dispose(); controls = null; }
  if (renderer) {
    renderer.domElement.removeEventListener('pointerdown', onDown);
    renderer.domElement.removeEventListener('pointerup', onUp);
    renderer.dispose();
    renderer = null;
  }
  scene = camera = null; tileMeshes = []; buildingGroup = highlight = targetGroup = null;
  ready = false; layoutSig = '';
  host = null;
}

export function setSelection(s, m) {
  sel = s == null ? null : +s; move = m == null ? null : +m;
  if (ready) { updateHighlight(); updateTargets(); }
}
export function refresh(g) {
  if (g) game = g;
  if (ready) rebuildBuildings();
}

// ----------------------------------------------------------------- Aufbau
function build() {
  const el = host.querySelector('.map3d');
  const w = host.clientWidth, hh = Math.max(340, Math.min(560, Math.round(window.innerHeight * 0.55)));

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, hh);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1622);
  scene.fog = new THREE.Fog(0x0a1622, COLS * 1.6, COLS * 4);

  camera = new THREE.PerspectiveCamera(50, w / hh, 0.1, 200);
  resetCamera();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49; // nicht unter den Boden
  controls.minDistance = 4; controls.maxDistance = COLS * 3;
  controls.target.set(0, 0, 0);

  // Licht
  scene.add(new THREE.AmbientLight(0x8898b0, 1.1));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
  sun.position.set(COLS * 0.6, COLS * 1.2, ROWS * 0.4);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9fc8ff, 0x202830, 0.5));

  buildTerrain();
  highlight = makeHighlight(0xffd24a);
  scene.add(highlight); highlight.visible = false;
  targetGroup = new THREE.Group(); scene.add(targetGroup);
  buildingGroup = new THREE.Group(); scene.add(buildingGroup);
  rebuildBuildings();
  updateHighlight();

  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  window.addEventListener('resize', onResize);

  const loadEl = host.querySelector('.map3d-load');
  if (loadEl) loadEl.remove();
  host.querySelectorAll('.mz').forEach((b) => b.addEventListener('click', () => { if (b.dataset.z === 'reset') resetCamera(); }));

  loop();
}

function resetCamera() {
  if (!camera) return;
  camera.position.set(0, COLS * 1.15, ROWS * 1.25);
  camera.lookAt(0, 0, 0);
  if (controls) { controls.target.set(0, 0, 0); controls.update(); }
}

// Weltkoordinate der Kachelmitte
function tileWorld(i) {
  const cx = i % COLS, cy = Math.floor(i / COLS);
  return { x: cx - (COLS - 1) / 2, z: cy - (ROWS - 1) / 2 };
}

function buildTerrain() {
  const s = game.state;
  for (let i = 0; i < COLS * ROWS; i++) {
    const terr = (s.terrain && s.terrain[i]) || 'grass';
    const def = TERR[terr] || TERR.grass;
    const { x, z } = tileWorld(i);
    const geo = new THREE.BoxGeometry(0.98, def.h, 0.98);
    const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.95, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, def.h / 2, z);
    mesh.userData = { index: i, top: def.h };
    scene.add(mesh);
    tileMeshes.push(mesh);
    addDecor(terr, x, def.h, z, i);
  }
}

function addDecor(terr, x, top, z, i) {
  const r = (Math.sin(i * 127.1) * 43758.5453) % 1;
  if (terr === 'forest') {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.ConeGeometry(0.13, 0.4, 6);
      const m = new THREE.MeshStandardMaterial({ color: 0x2f7a39, roughness: 1 });
      const c = new THREE.Mesh(g, m);
      const ox = ((i * 13 + k * 7) % 5 - 2) * 0.13, oz = ((i * 7 + k * 11) % 5 - 2) * 0.13;
      c.position.set(x + ox, top + 0.2, z + oz);
      scene.add(c);
    }
  } else if (terr === 'mountain') {
    const g = new THREE.ConeGeometry(0.32, 0.5, 4);
    const m = new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 1, flatShading: true });
    const c = new THREE.Mesh(g, m);
    c.position.set(x, top + 0.25, z); c.rotation.y = r;
    scene.add(c);
  }
}

function makeHighlight(color) {
  const geo = new THREE.BoxGeometry(1.02, 0.06, 1.02);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  return new THREE.Mesh(geo, mat);
}

function rebuildBuildings() {
  if (!buildingGroup) return;
  const s = game.state;
  // Signatur inkl. Stufe -> Modell wird bei Ausbau neu erzeugt (wächst).
  const sig = Object.entries(s.layout).map(([p, id]) => p + ':' + id + ':' + (s.buildings[id] || 0)).sort().join('|');
  if (sig === layoutSig) return; // nichts geändert
  layoutSig = sig;
  while (buildingGroup.children.length) buildingGroup.remove(buildingGroup.children[0]);
  for (const [p, id] of Object.entries(s.layout)) {
    const i = +p;
    const top = (tileMeshes[i] && tileMeshes[i].userData.top) || 0.7;
    const { x, z } = tileWorld(i);
    const model = makeBuilding(THREE, id, s.buildings[id] || 0);
    model.position.set(x, top, z);
    buildingGroup.add(model);
  }
}

function updateHighlight() {
  if (!highlight) return;
  if (sel == null) { highlight.visible = false; return; }
  const top = (tileMeshes[sel] && tileMeshes[sel].userData.top) || 0.7;
  const { x, z } = tileWorld(sel);
  highlight.position.set(x, top + 0.04, z);
  highlight.visible = true;
}

function updateTargets() {
  if (!targetGroup) return;
  while (targetGroup.children.length) targetGroup.remove(targetGroup.children[0]);
  if (move == null || !game.state.layout[move]) return;
  const id = game.state.layout[move];
  for (let i = 0; i < COLS * ROWS; i++) {
    if (game.state.layout[i]) continue;
    if (game.canPlaceOn && !game.canPlaceOn(id, i)) continue;
    const top = (tileMeshes[i] && tileMeshes[i].userData.top) || 0.7;
    const { x, z } = tileWorld(i);
    const m = makeHighlight(0x7fe3aa); m.material.opacity = 0.5;
    m.position.set(x, top + 0.05, z);
    targetGroup.add(m);
  }
}

// ----------------------------------------------------------------- Events
const down = { x: 0, y: 0, t: 0 };
function onDown(e) { down.x = e.clientX; down.y = e.clientY; down.t = Date.now(); }
function onUp(e) {
  if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) return; // war Drehen/Ziehen
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const hit = ray.intersectObjects(tileMeshes, false)[0];
  if (hit && opts.onTileClick) opts.onTileClick(hit.object.userData.index);
}

function onResize() {
  if (!renderer || !host) return;
  const w = host.clientWidth, hh = Math.max(340, Math.min(560, Math.round(window.innerHeight * 0.55)));
  renderer.setSize(w, hh);
  camera.aspect = w / hh; camera.updateProjectionMatrix();
}

function loop() {
  raf = requestAnimationFrame(loop);
  if (!renderer || !ready) return;
  if (highlight && highlight.visible) highlight.material.opacity = 0.55 + 0.35 * Math.sin(Date.now() / 250);
  controls.update();
  renderer.render(scene, camera);
}
