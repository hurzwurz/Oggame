// Galaxie: Generierung von NPC-Zielen + Distanz-, Flugzeit- und Treibstofflogik.

import { makeRng } from '../engine/combat.js';
import { SHIP_MAP } from './ships.js';

export const GALAXY_COUNT = 1;
export const SYSTEM_COUNT = 9;
export const POSITION_COUNT = 12;
export const HOME_COORDS = [1, 1, 4];

const NPC_NAMES = [
  'Verlassene Kolonie', 'Piratennest', 'Handelsposten', 'Bergbaustation',
  'Rebellenbasis', 'Schmugglerhafen', 'Forschungsaußenposten', 'Söldnerwelt',
  'Grenzfestung', 'Asteroidenmine', 'Kultwelt', 'Kriegerklan',
];

/** OGame-artige Distanz zwischen zwei Koordinaten [g,s,p]. */
export function distance(a, b) {
  if (a[0] !== b[0]) return 20000 * Math.abs(a[0] - b[0]);
  if (a[1] !== b[1]) return 2700 + 95 * Math.abs(a[1] - b[1]);
  if (a[2] !== b[2]) return 1000 + 5 * Math.abs(a[2] - b[2]);
  return 5;
}

const DRIVE_BONUS = { combustion: 0.1, impulse: 0.2, hyperspace: 0.3 };
const DRIVE_RESEARCH = { combustion: 'combustionDrive', impulse: 'impulseDrive', hyperspace: 'hyperspaceDrive' };

/** Effektive Geschwindigkeit eines Schiffstyps unter Berücksichtigung des Antriebs. */
export function shipSpeed(ship, research) {
  const lvl = research[DRIVE_RESEARCH[ship.stats.drive]] || 0;
  return Math.floor(ship.stats.speed * (1 + DRIVE_BONUS[ship.stats.drive] * lvl));
}

/** Geschwindigkeit der Flotte = langsamstes (beweglicher) Schiff. */
export function fleetSpeed(ships, research) {
  let min = Infinity;
  for (const [id, n] of Object.entries(ships)) {
    if (n <= 0) continue;
    const sp = shipSpeed(SHIP_MAP[id], research);
    if (sp > 0) min = Math.min(min, sp);
  }
  return Number.isFinite(min) ? min : 0;
}

/** Flugdauer in Sekunden (einfache Strecke), speedFactor in (0,1]. */
export function flightTime(dist, ships, research, speedFactor = 1) {
  const speed = fleetSpeed(ships, research);
  if (speed <= 0) return 0;
  return Math.max(1, Math.round((10 + (35000 / (speedFactor * 100)) * Math.sqrt((10 * dist) / speed))));
}

/** Treibstoffverbrauch (Deuterium) für die gesamte Hin- und Rückreise. */
export function fuelCost(dist, ships, speedFactor = 1) {
  let fuel = 0;
  for (const [id, n] of Object.entries(ships)) {
    if (n <= 0) continue;
    const f = SHIP_MAP[id].stats.fuel || 0;
    fuel += f * n * (dist / 35000);
  }
  // Hin- und Rückflug
  return Math.max(1, Math.ceil(fuel * 2 * speedFactor));
}

/** Gesamte Frachtkapazität einer Flotte. */
export function cargoCapacity(ships) {
  let cap = 0;
  for (const [id, n] of Object.entries(ships)) {
    if (n <= 0) continue;
    cap += (SHIP_MAP[id].stats.cargo || 0) * n;
  }
  return cap;
}

/**
 * Erzeugt eine deterministische Galaxie mit NPC-Planeten.
 * Stärke skaliert mit der Entfernung zum Heimatplaneten.
 */
export function generateGalaxy(seed = 1337) {
  const rng = makeRng(seed);
  const targets = [];
  for (let s = 1; s <= SYSTEM_COUNT; s++) {
    for (let p = 1; p <= POSITION_COUNT; p++) {
      if (s === HOME_COORDS[1] && p === HOME_COORDS[2]) continue; // Heimat aussparen
      if (rng() > 0.35) continue; // ~35 % der Positionen besiedelt
      const coords = [1, s, p];
      const dist = distance(HOME_COORDS, coords);
      // Schwierigkeit steigt mit der Entfernung – nahe Ziele sind für Anfänger machbar.
      const tier = Math.min(10, 1 + Math.floor(dist / 1200) + Math.floor(rng() * 2));
      targets.push(makeNpc(coords, tier, rng));
    }
  }
  return targets;
}

function makeNpc(coords, tier, rng) {
  const name = NPC_NAMES[Math.floor(rng() * NPC_NAMES.length)];
  const k = tier;
  // Ressourcen, Verteidigung und Flotte skalieren mit dem Tier
  const resources = {
    metal: Math.floor((2000 + rng() * 8000) * k),
    crystal: Math.floor((1000 + rng() * 5000) * k),
    deuterium: Math.floor((500 + rng() * 2000) * k),
  };
  const defense = {};
  const fleet = {};
  const add = (obj, id, base) => { const n = Math.floor(base * (0.5 + rng())); if (n > 0) obj[id] = n; };

  add(defense, 'rocketLauncher', 4 * k);
  add(defense, 'lightLaser', 3 * k);
  if (k >= 3) add(defense, 'heavyLaser', 2 * k);
  if (k >= 5) add(defense, 'gaussCannon', k);
  if (k >= 7) add(defense, 'plasmaTurret', Math.floor(k / 2));

  add(fleet, 'lightFighter', 3 * k);
  if (k >= 2) add(fleet, 'heavyFighter', 2 * k);
  if (k >= 4) add(fleet, 'cruiser', k);
  if (k >= 6) add(fleet, 'battleship', Math.floor(k / 2));
  if (k >= 8) add(fleet, 'destroyer', Math.floor(k / 3));

  const tech = { weaponsTech: Math.floor(k / 2), shieldTech: Math.floor(k / 2), armorTech: Math.floor(k / 2) };

  return { coords, name, tier, resources, defense, fleet, tech };
}
