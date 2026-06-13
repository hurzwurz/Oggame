// Spielformeln — Kosten, Produktion, Bauzeiten.
// Bewusst an klassischen Browser-Strategiespielen orientiert, aber eigenständig.

import { BUILDING_MAP } from '../data/buildings.js';

/** Multipliziert eine Kostenstruktur mit einem Faktor und rundet ab. */
function scaleCost(base, mult) {
  return {
    metal: Math.floor((base.metal || 0) * mult),
    crystal: Math.floor((base.crystal || 0) * mult),
    deuterium: Math.floor((base.deuterium || 0) * mult),
    energy: Math.floor((base.energy || 0) * mult),
  };
}

/**
 * Kosten für die NÄCHSTE Stufe eines stufenbasierten Objekts
 * (Gebäude/Forschung). currentLevel 0 => Grundkosten.
 */
export function levelCost(def, currentLevel) {
  return scaleCost(def.baseCost, Math.pow(def.factor, currentLevel));
}

/** Kosten für eine Menge von Einheiten (Schiffe/Verteidigung). */
export function unitCost(def, amount = 1) {
  return scaleCost(def.cost, amount);
}

/** Reichen die vorhandenen Ressourcen für die Kosten? */
export function canAfford(resources, cost) {
  return (
    resources.metal >= (cost.metal || 0) &&
    resources.crystal >= (cost.crystal || 0) &&
    resources.deuterium >= (cost.deuterium || 0)
  );
}

// ----------------------------------------------------------- Produktion (pro h)

export function metalProduction(level) {
  if (level === 0) return 30; // Grundförderung des Planeten
  return Math.floor(30 * level * Math.pow(1.1, level)) + 30;
}

export function crystalProduction(level) {
  if (level === 0) return 15;
  return Math.floor(20 * level * Math.pow(1.1, level)) + 15;
}

export function deuteriumProduction(level) {
  if (level === 0) return 0;
  return Math.floor(10 * level * Math.pow(1.1, level));
}

export function solarOutput(level) {
  return Math.floor(20 * level * Math.pow(1.1, level));
}

export function fusionOutput(level, energyTech = 0) {
  if (level === 0) return 0;
  return Math.floor(30 * level * Math.pow(1.05 + 0.01 * energyTech, level));
}

export function satelliteOutput(count) {
  // Vereinfachte Energie pro Solarsatellit
  return Math.floor(count * 25);
}

/**
 * Berechnet Energiebilanz und Effizienz der Minen.
 * Gibt { produced, consumed, ratio } zurück (ratio in [0,1]).
 */
export function energyBalance(buildings, research, satellites = 0) {
  const produced =
    solarOutput(buildings.solarPlant || 0) +
    fusionOutput(buildings.fusionPlant || 0, research.energyTech || 0) +
    satelliteOutput(satellites);

  let consumed = 0;
  for (const id of ['metalMine', 'crystalMine', 'deuteriumSynth']) {
    const lvl = buildings[id] || 0;
    if (lvl > 0 && BUILDING_MAP[id].energyCost) {
      consumed += BUILDING_MAP[id].energyCost(lvl);
    }
  }
  if (buildings.terraformer && BUILDING_MAP.terraformer.energyCost) {
    consumed += BUILDING_MAP.terraformer.energyCost(buildings.terraformer);
  }

  const ratio = consumed === 0 ? 1 : Math.min(1, produced / consumed);
  return { produced, consumed, ratio };
}

// Grundförderung des Planeten – unabhängig von Energie.
const BASE = { metal: 30, crystal: 15, deuterium: 0 };

/**
 * Effektive Ressourcenproduktion pro Stunde.
 * Die Grundförderung bleibt immer erhalten; nur der Minenanteil über der
 * Grundförderung wird mit der Energieeffizienz skaliert.
 */
export function hourlyProduction(buildings, research, satellites = 0) {
  const { ratio } = energyBalance(buildings, research, satellites);
  // Fusionskraftwerk verbraucht Deuterium
  const fusionDeut = Math.floor(10 * (buildings.fusionPlant || 0) * Math.pow(1.1, buildings.fusionPlant || 0));
  const scaled = (total, base) => base + Math.max(0, total - base) * ratio;
  return {
    metal: scaled(metalProduction(buildings.metalMine || 0), BASE.metal),
    crystal: scaled(crystalProduction(buildings.crystalMine || 0), BASE.crystal),
    deuterium: scaled(deuteriumProduction(buildings.deuteriumSynth || 0), BASE.deuterium) - fusionDeut,
  };
}

// -------------------------------------------------------------- Lagerkapazität

export function storageCapacity(level) {
  // Stufe 0 = Grundlager
  return Math.floor(5000 * Math.floor(2.5 * Math.exp(20 * level / 33)));
}

export function capacities(buildings) {
  return {
    metal: storageCapacity(buildings.metalStorage || 0),
    crystal: storageCapacity(buildings.crystalStorage || 0),
    deuterium: storageCapacity(buildings.deuteriumTank || 0),
  };
}

// -------------------------------------------------------------------- Bauzeiten

/**
 * Bauzeit in Sekunden für Gebäude/Verteidigung.
 * Beschleunigt durch Roboterfabrik und Nanitenfabrik.
 */
export function buildTimeSeconds(cost, buildings) {
  const robot = buildings.roboticsFactory || 0;
  const nanite = buildings.naniteFactory || 0;
  const structurePoints = (cost.metal || 0) + (cost.crystal || 0);
  const hours = structurePoints / (2500 * (1 + robot) * Math.pow(2, nanite));
  return Math.max(1, Math.floor(hours * 3600));
}

/** Forschungszeit in Sekunden, beschleunigt durch das Forschungslabor. */
export function researchTimeSeconds(cost, buildings) {
  const lab = buildings.researchLab || 0;
  const structurePoints = (cost.metal || 0) + (cost.crystal || 0);
  const hours = structurePoints / (1000 * (1 + lab));
  return Math.max(1, Math.floor(hours * 3600));
}

// -------------------------------------------------------------- Voraussetzungen

/** Prüft, ob alle Voraussetzungen erfüllt sind. */
export function requirementsMet(def, state) {
  const req = def.requirements;
  if (!req) return true;
  if (req.buildings) {
    for (const [id, lvl] of Object.entries(req.buildings)) {
      if ((state.buildings[id] || 0) < lvl) return false;
    }
  }
  if (req.research) {
    for (const [id, lvl] of Object.entries(req.research)) {
      if ((state.research[id] || 0) < lvl) return false;
    }
  }
  return true;
}

/** Liefert eine lesbare Liste fehlender Voraussetzungen. */
export function missingRequirements(def, state, nameLookup) {
  const out = [];
  const req = def.requirements;
  if (!req) return out;
  for (const kind of ['buildings', 'research']) {
    if (!req[kind]) continue;
    for (const [id, lvl] of Object.entries(req[kind])) {
      const have = (state[kind][id] || 0);
      if (have < lvl) out.push(`${nameLookup(id)} Stufe ${lvl}`);
    }
  }
  return out;
}
