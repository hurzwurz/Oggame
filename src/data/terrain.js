// Gelände der Basis-Karte (Siedler-Stil). Jede Kachel hat einen Geländetyp;
// Gebäude dürfen nur auf passendem Gelände stehen.

export const TERRAINS = {
  grass:    { name: 'Wiese',  emoji: '🌱' },
  forest:   { name: 'Wald',   emoji: '🌲' },
  mountain: { name: 'Berg',   emoji: '⛰️' },
  water:    { name: 'Wasser', emoji: '🌊' },
  sand:     { name: 'Sand',   emoji: '🏜️' },
};

// Erlaubtes Gelände je Gebäude. Default (nicht gelistet): Wiese/Sand.
export const BUILD_TERRAIN = {
  metalMine: ['mountain'],
  crystalMine: ['mountain'],
  deuteriumSynth: ['water'],
  fusionPlant: ['mountain', 'grass'],
  solarPlant: ['grass', 'sand'],
  researchLab: ['grass'],
  shipyard: ['water', 'grass'],
  roboticsFactory: ['grass', 'sand'],
  naniteFactory: ['grass', 'sand'],
  metalStorage: ['grass', 'sand', 'mountain'],
  crystalStorage: ['grass', 'sand', 'mountain'],
  deuteriumTank: ['grass', 'sand', 'water'],
  allianceDepot: ['grass', 'sand'],
  terraformer: ['grass', 'sand', 'mountain', 'forest', 'water'],
};

export function terrainAllowed(id, t) {
  const a = BUILD_TERRAIN[id];
  return a ? a.includes(t) : (t === 'grass' || t === 'sand');
}

export function terrainList(id) {
  const a = BUILD_TERRAIN[id] || ['grass', 'sand'];
  return a.map((t) => TERRAINS[t].name).join(', ');
}

// Deterministischer Zufall (Mulberry32) – gleiche Karte bei gleichem Seed.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Erzeugt ein Gelände-Raster: Grundwiese + ein paar Berg-/Wald-/Wasser-Inseln.
export function generateTerrain(cols, rows, seed = 1) {
  const r = rng(seed);
  const n = cols * rows;
  const grid = new Array(n).fill('grass');
  const idx = (x, y) => y * cols + x;

  const blob = (type, count, radius) => {
    for (let k = 0; k < count; k++) {
      const cx = Math.floor(r() * cols);
      const cy = Math.floor(r() * rows);
      const rad = radius + Math.floor(r() * 2);
      for (let y = Math.max(0, cy - rad); y <= Math.min(rows - 1, cy + rad); y++) {
        for (let x = Math.max(0, cx - rad); x <= Math.min(cols - 1, cx + rad); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d <= rad && r() > 0.25) grid[idx(x, y)] = type;
        }
      }
    }
  };

  blob('mountain', 2, 1);
  blob('forest', 2, 1);
  blob('water', 1, 1);
  // etwas Sand an die Ränder streuen
  for (let i = 0; i < n; i++) if (grid[i] === 'grass' && r() < 0.08) grid[i] = 'sand';
  return grid;
}
