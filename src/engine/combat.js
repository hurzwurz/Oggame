// Reine Kampf-Engine — keine DOM-/Storage-Abhängigkeiten, voll testbar.
//
// Modell (an OGame angelehnt, eigenständig umgesetzt):
//  - Bis zu 6 Runden.
//  - Jede Einheit feuert pro Runde einmal auf ein zufälliges Gegnerziel.
//  - Schaden trifft zuerst den Schild, dann die Hülle.
//  - Ist der Schaden < 1 % des Schildwerts, prallt er ab (Bounce).
//  - Schilde regenerieren zu Beginn jeder Runde vollständig; Hüllenschaden bleibt.
//  - Sinkt die Hülle unter 70 %, explodiert die Einheit mit Wahrscheinlichkeit
//    (1 - Hülle/maxHülle).
//  - Zerstörte Schiffe hinterlassen ein Trümmerfeld (Anteil der Baukosten).

import { SHIP_MAP } from '../data/ships.js';
import { DEFENSE_MAP } from '../data/defenses.js';

const MAX_ROUNDS = 6;
const DEBRIS_RATIO = 0.3; // Anteil von Metall+Kristall zerstörter Schiffe ins Trümmerfeld

/** Deterministischer RNG (mulberry32). seed beliebige Zahl. */
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const techMult = (tech, key) => 1 + 0.1 * (tech[key] || 0);

/** Erzeugt Einheiten-Instanzen aus einer Flotten-/Verteidigungsaufstellung. */
function expand(fleet, kindMap, tech, kind) {
  const units = [];
  const wm = techMult(tech, 'weaponsTech');
  const sm = techMult(tech, 'shieldTech');
  const am = techMult(tech, 'armorTech');
  for (const [id, count] of Object.entries(fleet || {})) {
    const def = kindMap[id];
    if (!def || count <= 0) continue;
    const maxHull = def.stats.structure * am;
    const maxShield = def.stats.shield * sm;
    const weapon = def.stats.weapon * wm;
    for (let i = 0; i < count; i++) {
      units.push({ id, kind, hull: maxHull, maxHull, shield: maxShield, maxShield, weapon, alive: true });
    }
  }
  return units;
}

function fireRound(attackers, defenders, rng) {
  for (const u of attackers) {
    if (!u.alive) continue;
    // Lebende Ziele finden
    if (defenders.aliveCount <= 0) break;
    let idx = Math.floor(rng() * defenders.list.length);
    // nächstes lebendes Ziel ab idx suchen
    let target = null;
    for (let k = 0; k < defenders.list.length; k++) {
      const t = defenders.list[(idx + k) % defenders.list.length];
      if (t.alive) { target = t; break; }
    }
    if (!target) break;

    // Bounce-Regel
    if (target.shield > 0 && u.weapon < target.shield * 0.01) continue;

    let dmg = u.weapon;
    if (dmg <= target.shield) {
      target.shield -= dmg;
    } else {
      dmg -= target.shield;
      target.shield = 0;
      target.hull -= dmg;
      if (target.hull <= 0) {
        target.alive = false;
        defenders.aliveCount--;
      }
    }
  }
}

function explosionPhase(group, rng) {
  for (const u of group.list) {
    if (!u.alive) continue;
    const frac = u.hull / u.maxHull;
    if (frac < 0.7) {
      if (rng() > frac) {
        u.alive = false;
        group.aliveCount--;
      }
    }
  }
}

function tally(units) {
  const out = {};
  for (const u of units) {
    if (u.alive) out[u.id] = (out[u.id] || 0) + 1;
  }
  return out;
}

function debrisFrom(before, after) {
  let metal = 0;
  let crystal = 0;
  for (const [id, n] of Object.entries(before.ships || {})) {
    const lost = n - (after[id] || 0);
    if (lost > 0 && SHIP_MAP[id]) {
      metal += SHIP_MAP[id].cost.metal * lost * DEBRIS_RATIO;
      crystal += SHIP_MAP[id].cost.crystal * lost * DEBRIS_RATIO;
    }
  }
  return { metal: Math.floor(metal), crystal: Math.floor(crystal) };
}

/**
 * Simuliert eine Schlacht.
 *
 * @param attacker { ships:{id:count}, tech:{weaponsTech,shieldTech,armorTech} }
 * @param defender { ships:{id:count}, defense:{id:count}, tech:{...} }
 * @param seed     optionaler Seed für deterministische Ergebnisse
 * @returns Kampfbericht
 */
export function simulateBattle(attacker, defender, seed) {
  const rng = makeRng(seed);

  const atkUnits = expand(attacker.ships, SHIP_MAP, attacker.tech || {}, 'ship');
  const defShips = expand(defender.ships, SHIP_MAP, defender.tech || {}, 'ship');
  const defDef = expand(defender.defense, DEFENSE_MAP, defender.tech || {}, 'defense');
  const defUnits = [...defShips, ...defDef];

  const atk = { list: atkUnits, aliveCount: atkUnits.length };
  const def = { list: defUnits, aliveCount: defUnits.length };

  let round = 0;
  for (; round < MAX_ROUNDS; round++) {
    if (atk.aliveCount === 0 || def.aliveCount === 0) break;
    // Schilde regenerieren
    for (const u of atk.list) if (u.alive) u.shield = u.maxShield;
    for (const u of def.list) if (u.alive) u.shield = u.maxShield;
    // Beide Seiten feuern (gleichzeitig modelliert)
    fireRound(atk.list, def, rng);
    fireRound(def.list, atk, rng);
    explosionPhase(atk, rng);
    explosionPhase(def, rng);
  }

  const atkSurvivors = tally(atkUnits);
  const defShipSurvivors = tally(defShips);
  const defDefSurvivors = tally(defDef);

  let winner = 'draw';
  if (atk.aliveCount > 0 && def.aliveCount === 0) winner = 'attacker';
  else if (def.aliveCount > 0 && atk.aliveCount === 0) winner = 'defender';
  else if (atk.aliveCount > 0 && def.aliveCount > 0) winner = 'draw';

  // Trümmerfelder (nur Schiffe)
  const atkDebris = debrisFrom({ ships: attacker.ships }, atkSurvivors);
  const defDebris = debrisFrom({ ships: defender.ships }, defShipSurvivors);

  return {
    rounds: round,
    winner,
    attacker: { before: attacker.ships, survivors: atkSurvivors },
    defender: {
      shipsBefore: defender.ships || {},
      shipSurvivors: defShipSurvivors,
      defenseBefore: defender.defense || {},
      defenseSurvivors: defDefSurvivors,
    },
    debris: { metal: atkDebris.metal + defDebris.metal, crystal: atkDebris.crystal + defDebris.crystal },
  };
}
