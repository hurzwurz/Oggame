// Echte 3D-Kartenansicht (WebGL / Three.js, frei drehbar).
// Three.js wird dynamisch per CDN geladen; klappt das nicht, zeigt die Karte
// einen Hinweis statt eines leeren Bildschirms.

import { BASE_COLS, BASE_ROWS } from '../engine/game.js';
import { makeBuilding } from './buildings3d.js';

const THREE_URL = 'https://esm.sh/three@0.161.0';
const JSM = 'https://esm.sh/three@0.161.0/examples/jsm/';

let THREE = null, OrbitControls = null, GLTFLoader = null;
let post = null, RoomEnvironment = null; // optionale Effekte (Bloom/Umgebung)
async function loadThree() {
  if (THREE) return true;
  try {
    THREE = await import(/* @vite-ignore */ THREE_URL);
    const oc = await import(/* @vite-ignore */ JSM + 'controls/OrbitControls.js');
    OrbitControls = oc.OrbitControls;
  } catch (e) {
    console.warn('Three.js konnte nicht geladen werden:', e && e.message);
    return false;
  }
  // glTF-Lader für echte 3D-Modelle (optional – sonst prozedurale Modelle).
  try {
    const lo = await import(/* @vite-ignore */ JSM + 'loaders/GLTFLoader.js');
    GLTFLoader = lo.GLTFLoader;
  } catch (e) { GLTFLoader = null; }
  // Effekte sind optional – fehlen sie, läuft die Karte ohne Bloom weiter.
  try {
    const [ec, rp, bp, op, re] = await Promise.all([
      import(/* @vite-ignore */ JSM + 'postprocessing/EffectComposer.js'),
      import(/* @vite-ignore */ JSM + 'postprocessing/RenderPass.js'),
      import(/* @vite-ignore */ JSM + 'postprocessing/UnrealBloomPass.js'),
      import(/* @vite-ignore */ JSM + 'postprocessing/OutputPass.js'),
      import(/* @vite-ignore */ JSM + 'environments/RoomEnvironment.js'),
    ]);
    post = { EffectComposer: ec.EffectComposer, RenderPass: rp.RenderPass, UnrealBloomPass: bp.UnrealBloomPass, OutputPass: op.OutputPass };
    RoomEnvironment = re.RoomEnvironment;
  } catch (e) {
    console.warn('Grafik-Effekte (Bloom) nicht geladen:', e && e.message);
    post = null; RoomEnvironment = null;
  }
  return true;
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
let renderer, scene, camera, controls, raf = 0, composer = null;
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
  if (composer) { try { composer.dispose(); } catch (e) { /* egal */ } composer = null; }
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  el.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x0b1a2a, COLS * 1.8, COLS * 4.5);

  // Umgebungs-Reflexionen für Metall/Glas (PBR sieht damit viel edler aus)
  if (RoomEnvironment) {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch (e) { /* ohne Umgebung weiter */ }
  }

  camera = new THREE.PerspectiveCamera(50, w / hh, 0.1, 200);
  resetCamera();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49; // nicht unter den Boden
  controls.minDistance = 4; controls.maxDistance = COLS * 3;
  controls.target.set(0, 0, 0);

  // Licht: warme Sonne mit Schatten + kühles Umgebungslicht
  scene.add(new THREE.AmbientLight(0xb6c2d4, 1.0));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
  sun.position.set(COLS * 0.7, COLS * 1.5, ROWS * 0.55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -COLS; sc.right = COLS; sc.top = ROWS; sc.bottom = -ROWS; sc.near = 0.5; sc.far = COLS * 4;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9fc8ff, 0x1a2230, 0.55));

  // Boden, der Schatten auffängt
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(COLS * 3, ROWS * 3), new THREE.MeshStandardMaterial({ color: 0x0a1622, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  buildTerrain();
  highlight = makeHighlight(0xffd24a);
  scene.add(highlight); highlight.visible = false;
  targetGroup = new THREE.Group(); scene.add(targetGroup);
  buildingGroup = new THREE.Group(); scene.add(buildingGroup);
  rebuildBuildings();
  updateHighlight();

  // Post-Processing: Bloom (Glühen) für leuchtende Akzente
  composer = null;
  if (post) {
    try {
      composer = new post.EffectComposer(renderer);
      composer.addPass(new post.RenderPass(scene, camera));
      const bloom = new post.UnrealBloomPass(new THREE.Vector2(w, hh), 0.7, 0.6, 0.82);
      composer.addPass(bloom);
      composer.addPass(new post.OutputPass());
    } catch (e) { composer = null; }
  }

  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  window.addEventListener('resize', onResize);

  const loadEl = host.querySelector('.map3d-load');
  if (loadEl) loadEl.remove();
  host.querySelectorAll('.mz').forEach((b) => b.addEventListener('click', () => { if (b.dataset.z === 'reset') resetCamera(); }));

  loop();
}

function skyTexture() {
  if (typeof document === 'undefined') return new THREE.Color(0x0b1a2a);
  const c = document.createElement('canvas'); c.width = 16; c.height = 256;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#1b3a5c'); grd.addColorStop(0.45, '#102a44'); grd.addColorStop(1, '#070f1a');
  x.fillStyle = grd; x.fillRect(0, 0, 16, 256);
  // ein paar Sterne oben
  x.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 30; i++) x.fillRect(Math.random() * 16, Math.random() * 90, 1, 1);
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

const terrTexCache = {};
function shadeC(color, f) {
  const r = Math.min(255, ((color >> 16) & 255) * f), g = Math.min(255, ((color >> 8) & 255) * f), b = Math.min(255, (color & 255) * f);
  return (r << 16) | (g << 8) | b;
}
function terrainTexture(type, color) {
  if (terrTexCache[type]) return terrTexCache[type];
  if (typeof document === 'undefined') return null;
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#' + (color & 0xffffff).toString(16).padStart(6, '0'); x.fillRect(0, 0, S, S);
  for (let k = 0; k < 160; k++) {
    const f = 0.78 + Math.random() * 0.5;
    x.fillStyle = '#' + (shadeC(color, f) & 0xffffff).toString(16).padStart(6, '0');
    const sz = type === 'water' ? 3 : 2;
    x.fillRect(Math.random() * S, Math.random() * S, sz, sz);
  }
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  terrTexCache[type] = t; return t;
}

function buildTerrain() {
  const s = game.state;
  for (let i = 0; i < COLS * ROWS; i++) {
    const terr = (s.terrain && s.terrain[i]) || 'grass';
    const def = TERR[terr] || TERR.grass;
    const { x, z } = tileWorld(i);
    const geo = new THREE.BoxGeometry(0.98, def.h, 0.98);
    const tex = terrainTexture(terr, def.color);
    const mat = new THREE.MeshStandardMaterial({ color: tex ? 0xffffff : def.color, map: tex || null, roughness: terr === 'water' ? 0.4 : 0.95, metalness: terr === 'water' ? 0.2 : 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, def.h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
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
      c.castShadow = true; c.receiveShadow = true;
      scene.add(c);
    }
  } else if (terr === 'mountain') {
    const g = new THREE.ConeGeometry(0.32, 0.5, 4);
    const m = new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 1, flatShading: true });
    const c = new THREE.Mesh(g, m);
    c.position.set(x, top + 0.25, z); c.rotation.y = r;
    c.castShadow = true; c.receiveShadow = true;
    scene.add(c);
  }
}

function makeHighlight(color) {
  const geo = new THREE.BoxGeometry(1.02, 0.06, 1.02);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  return new THREE.Mesh(geo, mat);
}

// --------------------------------------------------- echte 3D-Modelle (glTF)
const modelTpl = new Map(); // id -> THREE.Group (normalisiert) | 'loading' | 'failed'
function modelUrl(id) { return `assets/models/${id}.glb`; }

// Modell auf ~0.82 Grundfläche skalieren, mittig, Unterkante auf y=0, Schatten an.
function normalizeModel(obj) {
  const bbox = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3(); bbox.getSize(size);
  const center = new THREE.Vector3(); bbox.getCenter(center);
  const maxXZ = Math.max(size.x, size.z) || 1;
  obj.position.set(-center.x, -bbox.min.y, -center.z);
  const g = new THREE.Group();
  g.add(obj);
  g.scale.setScalar(0.82 / maxXZ);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

function ensureModel(id) {
  if (!GLTFLoader || modelTpl.has(id)) return;
  modelTpl.set(id, 'loading');
  const loader = new GLTFLoader();
  loader.load(modelUrl(id),
    (gltf) => { try { modelTpl.set(id, normalizeModel(gltf.scene)); layoutSig = ''; rebuildBuildings(); } catch (e) { modelTpl.set(id, 'failed'); } },
    undefined,
    () => { modelTpl.set(id, 'failed'); }); // keine Datei -> prozedurales Modell bleibt
}

function buildingFor(id, level, x, z, top) {
  const tpl = modelTpl.get(id);
  let model;
  if (tpl && tpl !== 'loading' && tpl !== 'failed') {
    model = tpl.clone(true);
    model.scale.y *= 1 + Math.min(20, Math.max(0, level - 1)) * 0.02;
  } else {
    model = makeBuilding(THREE, id, level);
    ensureModel(id); // echtes Modell nachladen, falls vorhanden
  }
  model.position.set(x, top, z);
  return model;
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
    buildingGroup.add(buildingFor(id, s.buildings[id] || 0, x, z, top));
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
  if (composer) composer.setSize(w, hh);
  camera.aspect = w / hh; camera.updateProjectionMatrix();
}

function loop() {
  raf = requestAnimationFrame(loop);
  if (!renderer || !ready) return;
  if (highlight && highlight.visible) highlight.material.opacity = 0.55 + 0.35 * Math.sin(Date.now() / 250);
  controls.update();
  if (composer) composer.render(); else renderer.render(scene, camera);
}
