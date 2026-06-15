// Prozedurale Low-Poly-3D-Modelle für Gebäude (statt flacher Bilder).
// Jede Funktion bekommt das geladene THREE-Modul und baut ein THREE.Group,
// dessen Grundfläche bei y=0 steht (Footprint ~0.8 Welteinheiten).

function mat(THREE, color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0.1, flatShading: true });
}
// Box, die mit ihrer Unterkante auf y steht.
function box(THREE, g, w, h, d, color, x = 0, y = 0, z = 0, ry = 0, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(THREE, color, o));
  m.position.set(x, y + h / 2, z); m.rotation.y = ry; g.add(m); return m;
}
function cyl(THREE, g, r1, r2, h, color, x = 0, y = 0, z = 0, seg = 12, o) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat(THREE, color, o));
  m.position.set(x, y + h / 2, z); g.add(m); return m;
}
function pyr(THREE, g, r, h, color, x = 0, y = 0, z = 0, seg = 4, o) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(THREE, color, o));
  m.position.set(x, y + h / 2, z); m.rotation.y = Math.PI / 4; g.add(m); return m;
}
function dome(THREE, g, r, color, x = 0, y = 0, z = 0, o) {
  const geo = new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(THREE, color, o)); m.position.set(x, y, z); g.add(m); return m;
}
function gem(THREE, g, r, color, x, y, z, o) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(r), mat(THREE, color, { ...o, rough: 0.3, metal: 0.4 }));
  m.position.set(x, y + r, z); g.add(m); return m;
}

const C = {
  wall: 0xb9c2cf, wall2: 0x8a93a0, roofDark: 0x33414f, roofRed: 0x8a3f31,
  steel: 0x9aa3b2, crystal: 0x6fd0e6, deut: 0x6fd99a, solar: 0x16356b,
  fusion: 0xff9a3c, factory: 0x5b6470, glass: 0x9fc8ff, gold: 0xffd24a,
};

function pad(THREE, g) { box(THREE, g, 0.86, 0.06, 0.86, 0x2a3038, 0, 0, 0); } // Fundament

const BUILDERS = {
  metalMine(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.62, 0.28, 0.62, C.wall2, 0, 0.06);
    // Förderturm
    pyr(THREE, g, 0.16, 0.5, C.steel, 0.0, 0.34, 0.0, 4, { metal: 0.5, rough: 0.5 });
    box(THREE, g, 0.1, 0.1, 0.1, 0x2a3038, 0, 0.84);
    box(THREE, g, 0.5, 0.12, 0.18, C.steel, 0.28, 0.1, 0.0); // Förderband
  },
  crystalMine(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.6, 0.26, 0.6, C.wall2, 0, 0.06);
    gem(THREE, g, 0.2, C.crystal, 0, 0.32, 0, { rough: 0.15 });
    gem(THREE, g, 0.1, C.crystal, 0.22, 0.32, 0.18, { rough: 0.15 });
  },
  deuteriumSynth(THREE, g) {
    pad(THREE, g);
    cyl(THREE, g, 0.18, 0.18, 0.5, C.deut, -0.16, 0.06, 0);
    cyl(THREE, g, 0.14, 0.14, 0.4, C.deut, 0.18, 0.06, 0.06);
    box(THREE, g, 0.3, 0.2, 0.3, C.wall2, 0.0, 0.06, -0.2);
    cyl(THREE, g, 0.03, 0.03, 0.3, 0x3a424c, 0.0, 0.5, 0); // Rohr
  },
  solarPlant(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.5, 0.16, 0.3, C.wall2, 0, 0.06, -0.24);
    // drei geneigte Solarpanel-Reihen
    for (let k = 0; k < 3; k++) {
      const p = box(THREE, g, 0.74, 0.02, 0.2, C.solar, 0, 0.16, 0.16 - k * 0.22, 0, { metal: 0.6, rough: 0.25 });
      p.rotation.x = -0.5;
    }
  },
  fusionPlant(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.7, 0.2, 0.7, C.factory, 0, 0.06);
    dome(THREE, g, 0.26, C.fusion, 0, 0.26, 0, { rough: 0.3, metal: 0.2 });
    cyl(THREE, g, 0.05, 0.05, 0.2, 0x2a3038, 0.28, 0.26, 0.28);
  },
  researchLab(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.62, 0.34, 0.62, C.wall, 0, 0.06);
    dome(THREE, g, 0.22, C.glass, 0, 0.4, 0, { rough: 0.1, metal: 0.1 });
    cyl(THREE, g, 0.012, 0.012, 0.3, 0xcfd7e2, 0.24, 0.4, 0.24);
    gem(THREE, g, 0.04, C.glass, 0.24, 0.7, 0.24);
  },
  shipyard(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.78, 0.34, 0.5, C.factory, 0, 0.06, -0.06);
    // Tonnendach
    const roof = box(THREE, g, 0.8, 0.18, 0.5, C.roofDark, 0, 0.4, -0.06);
    roof.scale.y = 1;
    box(THREE, g, 0.08, 0.5, 0.08, C.steel, 0.3, 0.06, 0.28); // Kran
    box(THREE, g, 0.3, 0.06, 0.06, C.steel, 0.18, 0.5, 0.28);
  },
  roboticsFactory(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.72, 0.3, 0.6, C.factory, 0, 0.06);
    cyl(THREE, g, 0.06, 0.06, 0.3, C.wall2, -0.2, 0.36, -0.16);
    cyl(THREE, g, 0.06, 0.06, 0.22, C.wall2, 0.0, 0.36, -0.16);
    box(THREE, g, 0.5, 0.04, 0.5, C.roofDark, 0, 0.36);
  },
  naniteFactory(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.7, 0.4, 0.6, 0x474f5b, 0, 0.06);
    gem(THREE, g, 0.12, C.glass, 0, 0.5, 0, { rough: 0.1 });
    cyl(THREE, g, 0.05, 0.05, 0.28, C.steel, 0.26, 0.46, 0.2);
  },
  metalStorage(THREE, g) { silo(THREE, g, C.steel); },
  crystalStorage(THREE, g) { silo(THREE, g, C.crystal); },
  deuteriumTank(THREE, g) { silo(THREE, g, C.deut); },
  allianceDepot(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.74, 0.3, 0.64, C.wall2, 0, 0.06);
    box(THREE, g, 0.74, 0.1, 0.64, C.roofRed, 0, 0.36);
    box(THREE, g, 0.12, 0.12, 0.12, C.gold, 0, 0.46);
  },
  terraformer(THREE, g) {
    pad(THREE, g);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 20), mat(THREE, C.glass, { metal: 0.4, rough: 0.3 }));
    t.rotation.x = Math.PI / 2; t.position.y = 0.5; g.add(t);
    cyl(THREE, g, 0.12, 0.16, 0.5, C.factory, 0, 0.06);
    gem(THREE, g, 0.1, C.deut, 0, 0.56, 0, { rough: 0.2 });
  },
  _default(THREE, g) {
    pad(THREE, g);
    box(THREE, g, 0.6, 0.34, 0.6, C.wall, 0, 0.06);
    pyr(THREE, g, 0.46, 0.28, C.roofRed, 0, 0.4);
  },
};

function silo(THREE, g, color) {
  pad(THREE, g);
  cyl(THREE, g, 0.26, 0.26, 0.5, color, -0.12, 0.06, 0, 14, { metal: 0.3, rough: 0.5 });
  pyr(THREE, g, 0.3, 0.16, 0x33414f, -0.12, 0.56, 0, 14);
  cyl(THREE, g, 0.16, 0.16, 0.34, color, 0.22, 0.06, 0.1, 12, { metal: 0.3, rough: 0.5 });
  pyr(THREE, g, 0.2, 0.12, 0x33414f, 0.22, 0.4, 0.1, 12);
}

export function makeBuilding(THREE, id, level = 1) {
  const g = new THREE.Group();
  (BUILDERS[id] || BUILDERS._default)(THREE, g);
  // Gebäude wachsen leicht mit der Stufe
  const grow = 1 + Math.min(20, Math.max(0, level - 1)) * 0.025;
  g.scale.y = grow;
  return g;
}
