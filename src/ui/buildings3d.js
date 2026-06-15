// Prozedurale Low-Poly-3D-Modelle für Gebäude – mit prozeduralen Texturen
// (Fenster, Metallpaneele) und Schattenwurf, damit es nicht flach wirkt.

const texStore = new Map();
function canvasTex(THREE, key, draw) {
  if (texStore.has(key)) return texStore.get(key);
  if (typeof document === 'undefined') return null;
  const S = 96;
  const c = document.createElement('canvas'); c.width = c.height = S;
  draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texStore.set(key, t);
  return t;
}
const hex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
function shade(color, f) {
  const r = Math.min(255, ((color >> 16) & 255) * f), g = Math.min(255, ((color >> 8) & 255) * f), b = Math.min(255, (color & 255) * f);
  return (r << 16) | (g << 8) | b;
}
// Wand mit Fenster-Raster
function windowsTex(THREE, base) {
  return canvasTex(THREE, 'win' + base, (x, s) => {
    x.fillStyle = hex(base); x.fillRect(0, 0, s, s);
    x.fillStyle = hex(shade(base, 0.7));
    for (let i = 0; i < s; i += s / 6) x.fillRect(i, 0, 1, s); // Fugen
    const cols = 4, rows = 4, pad = s / 12, cw = (s - pad * (cols + 1)) / cols, ch = (s - pad * (rows + 1)) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      x.fillStyle = (i + j) % 2 ? '#bfe2ff' : '#7fb6e6';
      x.fillRect(pad + i * (cw + pad), pad + j * (ch + pad), cw, ch * 0.7);
    }
  });
}
// Metallpaneele / Riffelblech
function panelTex(THREE, base) {
  return canvasTex(THREE, 'pan' + base, (x, s) => {
    x.fillStyle = hex(base); x.fillRect(0, 0, s, s);
    x.strokeStyle = hex(shade(base, 1.25)); x.lineWidth = 1;
    for (let i = 0; i < s; i += s / 8) { x.beginPath(); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); }
    x.strokeStyle = hex(shade(base, 0.7));
    for (let i = 0; i < s; i += s / 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.stroke(); }
  });
}

function mat(THREE, color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0.1, flatShading: o.flat ?? true });
  if (o.tex) { const t = o.tex; if (t) m.map = t; }
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emi ?? 0.6; }
  return m;
}
function finish(m) { m.castShadow = true; m.receiveShadow = true; return m; }

function box(THREE, g, w, h, d, color, x = 0, y = 0, z = 0, ry = 0, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(THREE, color, o));
  m.position.set(x, y + h / 2, z); m.rotation.y = ry; g.add(finish(m)); return m;
}
// Gebäudekörper mit Fenstertextur, leuchtenden Fenstern, Neon-Sockel & Tür
function body(THREE, g, w, h, d, color, x = 0, y = 0, z = 0, ry = 0) {
  const wt = windowsTex(THREE, color);
  const m = box(THREE, g, w, h, d, color, x, y, z, ry, { tex: wt, rough: 0.6, metal: 0.18 });
  if (wt) { m.material.emissiveMap = wt; m.material.emissive = new THREE.Color(0x2b5f8c); m.material.emissiveIntensity = 0.5; }
  // leuchtende Sockel-Leiste
  box(THREE, g, w * 1.03, 0.035, d * 1.03, 0x0e1a26, x, y, z, ry, { emissive: 0x29c5ff, emi: 0.8, flat: false });
  // Tür
  box(THREE, g, Math.min(0.16, w * 0.32), Math.min(0.2, h * 0.7), 0.03, 0x0c151e, x, y, z + d / 2, ry, { emissive: 0x66ccff, emi: 0.5 });
  return m;
}
function beacon(THREE, g, x, y, z, color = 0xff4d4d) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), mat(THREE, color, { emissive: color, emi: 1.4, rough: 0.2, flat: false }));
  m.position.set(x, y, z); g.add(finish(m)); return m;
}
function vent(THREE, g, x, y, z, color = 0x3a424c) { box(THREE, g, 0.12, 0.06, 0.12, color, x, y, z); }
function cyl(THREE, g, r1, r2, h, color, x = 0, y = 0, z = 0, seg = 14, o) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat(THREE, color, o));
  m.position.set(x, y + h / 2, z); g.add(finish(m)); return m;
}
function pyr(THREE, g, r, h, color, x = 0, y = 0, z = 0, seg = 4, o) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(THREE, color, o));
  m.position.set(x, y + h / 2, z); m.rotation.y = Math.PI / 4; g.add(finish(m)); return m;
}
function dome(THREE, g, r, color, x = 0, y = 0, z = 0, o) {
  const geo = new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(THREE, color, { ...o, flat: false }));
  m.position.set(x, y, z); g.add(finish(m)); return m;
}
function gem(THREE, g, r, color, x, y, z, o) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(r), mat(THREE, color, { ...o, rough: 0.15, metal: 0.3, emissive: color, emi: 0.35 }));
  m.position.set(x, y + r, z); g.add(finish(m)); return m;
}

const C = {
  wall: 0xaeb8c6, wall2: 0x7d8794, roofDark: 0x2f3a47, roofRed: 0x7e3a2d, steel: 0x8a93a2,
  crystal: 0x57c8e6, deut: 0x4fd089, solar: 0x12366e, fusion: 0xff8a2c, factory: 0x515a66,
  glass: 0x9fc8ff, gold: 0xffcf4a, panel: 0x6a7482,
};
function pad(THREE, g) { box(THREE, g, 0.88, 0.06, 0.88, 0x252b33, 0, 0); }
function metalBox(THREE, g, w, h, d, color, x, y, z) { return box(THREE, g, w, h, d, color, x, y, z, 0, { tex: panelTex(THREE, color), metal: 0.5, rough: 0.5 }); }

const BUILDERS = {
  metalMine(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.6, 0.28, 0.6, C.wall2, 0, 0.06);
    pyr(THREE, g, 0.17, 0.5, C.steel, 0, 0.34, 0, 4, { tex: panelTex(THREE, C.steel), metal: 0.6, rough: 0.4 });
    box(THREE, g, 0.1, 0.1, 0.1, C.gold, 0, 0.84, 0, 0, { emissive: C.gold, emi: 0.4 });
    metalBox(THREE, g, 0.5, 0.1, 0.16, C.steel, 0.3, 0.1, 0);
  },
  crystalMine(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.58, 0.26, 0.58, C.wall2, 0, 0.06);
    gem(THREE, g, 0.2, C.crystal, 0, 0.32, 0); gem(THREE, g, 0.1, C.crystal, 0.2, 0.32, 0.18);
  },
  deuteriumSynth(THREE, g) {
    pad(THREE, g);
    metalBox(THREE, g, 0.34, 0.5, 0.34, C.deut, -0.16, 0.06, 0);
    metalBox(THREE, g, 0.28, 0.4, 0.28, C.deut, 0.18, 0.06, 0.06);
    body(THREE, g, 0.3, 0.2, 0.3, C.wall2, 0, 0.06, -0.22);
    cyl(THREE, g, 0.03, 0.03, 0.34, C.steel, 0, 0.5, 0, 8, { metal: 0.6 });
  },
  solarPlant(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.46, 0.16, 0.26, C.wall2, 0, 0.06, -0.26);
    for (let k = 0; k < 3; k++) {
      const p = box(THREE, g, 0.74, 0.02, 0.2, C.solar, 0, 0.18, 0.16 - k * 0.22, 0, { tex: panelTex(THREE, C.solar), metal: 0.7, rough: 0.2, flat: false });
      p.rotation.x = -0.5;
    }
  },
  fusionPlant(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.7, 0.2, 0.7, C.factory, 0, 0.06);
    dome(THREE, g, 0.26, C.fusion, 0, 0.26, 0, { emissive: C.fusion, emi: 0.5, rough: 0.4 });
    cyl(THREE, g, 0.05, 0.05, 0.2, C.steel, 0.28, 0.26, 0.28, 10, { metal: 0.5 });
  },
  researchLab(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.6, 0.34, 0.6, C.wall, 0, 0.06);
    dome(THREE, g, 0.22, C.glass, 0, 0.4, 0, { metal: 0.2, rough: 0.1, emissive: C.glass, emi: 0.2 });
    cyl(THREE, g, 0.012, 0.012, 0.3, 0xcfd7e2, 0.24, 0.4, 0.24, 6);
    gem(THREE, g, 0.04, C.glass, 0.24, 0.7, 0.24);
  },
  shipyard(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.78, 0.32, 0.5, C.factory, 0, 0.06, -0.06);
    box(THREE, g, 0.8, 0.16, 0.5, C.roofDark, 0, 0.38, -0.06, 0, { tex: panelTex(THREE, C.roofDark) });
    box(THREE, g, 0.07, 0.5, 0.07, C.steel, 0.3, 0.06, 0.28, 0, { metal: 0.6, tex: panelTex(THREE, C.steel) });
    box(THREE, g, 0.3, 0.05, 0.05, C.steel, 0.18, 0.5, 0.28, 0, { metal: 0.6 });
    beacon(THREE, g, 0.3, 0.6, 0.28); beacon(THREE, g, -0.32, 0.5, -0.22, 0x36e0ff);
  },
  roboticsFactory(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.72, 0.3, 0.6, C.factory, 0, 0.06);
    cyl(THREE, g, 0.06, 0.06, 0.3, C.wall2, -0.2, 0.36, -0.16, 10, { tex: panelTex(THREE, C.wall2) });
    cyl(THREE, g, 0.06, 0.06, 0.22, C.wall2, 0, 0.36, -0.16, 10, { tex: panelTex(THREE, C.wall2) });
    box(THREE, g, 0.5, 0.04, 0.5, C.roofDark, 0, 0.36);
    vent(THREE, g, 0.18, 0.36, 0.14); vent(THREE, g, -0.04, 0.36, 0.16);
    beacon(THREE, g, 0.22, 0.42, -0.18);
  },
  naniteFactory(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.7, 0.4, 0.6, 0x434b57, 0, 0.06);
    gem(THREE, g, 0.12, C.glass, 0, 0.5, 0); cyl(THREE, g, 0.05, 0.05, 0.28, C.steel, 0.26, 0.46, 0.2, 10, { metal: 0.6, tex: panelTex(THREE, C.steel) });
    beacon(THREE, g, -0.26, 0.46, 0.2, 0x66ffcc); beacon(THREE, g, 0.26, 0.46, -0.2);
  },
  metalStorage(THREE, g) { silo(THREE, g, C.steel); },
  crystalStorage(THREE, g) { silo(THREE, g, C.crystal); },
  deuteriumTank(THREE, g) { silo(THREE, g, C.deut); },
  allianceDepot(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.74, 0.3, 0.64, C.wall2, 0, 0.06);
    box(THREE, g, 0.76, 0.1, 0.66, C.roofRed, 0, 0.36, 0, 0, { tex: panelTex(THREE, C.roofRed) });
    box(THREE, g, 0.12, 0.12, 0.12, C.gold, 0, 0.46, 0, 0, { emissive: C.gold, emi: 0.4 });
  },
  terraformer(THREE, g) {
    pad(THREE, g);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 10, 24), mat(THREE, C.glass, { metal: 0.5, rough: 0.2, emissive: C.glass, emi: 0.3 }));
    t.rotation.x = Math.PI / 2; t.position.y = 0.5; finish(t); g.add(t);
    cyl(THREE, g, 0.12, 0.16, 0.5, C.factory, 0, 0.06, 0, 12, { tex: panelTex(THREE, C.factory) });
    gem(THREE, g, 0.1, C.deut, 0, 0.56, 0);
  },
  _default(THREE, g) {
    pad(THREE, g); body(THREE, g, 0.6, 0.34, 0.6, C.wall, 0, 0.06);
    pyr(THREE, g, 0.46, 0.28, C.roofRed, 0, 0.4, 0, 4, { tex: panelTex(THREE, C.roofRed) });
  },
};

function silo(THREE, g, color) {
  pad(THREE, g);
  metalBox(THREE, g, 0.44, 0.5, 0.44, color, -0.12, 0.06, 0);
  pyr(THREE, g, 0.32, 0.16, C.roofDark, -0.12, 0.56, 0, 4);
  metalBox(THREE, g, 0.3, 0.34, 0.3, color, 0.22, 0.06, 0.1);
  pyr(THREE, g, 0.24, 0.12, C.roofDark, 0.22, 0.4, 0.1, 4);
}

export function makeBuilding(THREE, id, level = 1) {
  const g = new THREE.Group();
  (BUILDERS[id] || BUILDERS._default)(THREE, g);
  g.scale.y = 1 + Math.min(20, Math.max(0, level - 1)) * 0.025; // wächst mit der Stufe
  return g;
}
