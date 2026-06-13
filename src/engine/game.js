// Kern-Spiel-Engine: Zustand, Tick-Schleife und Bauwarteschlangen.

import { BUILDING_MAP } from '../data/buildings.js';
import { RESEARCH_MAP } from '../data/research.js';
import { SHIP_MAP } from '../data/ships.js';
import { DEFENSE_MAP } from '../data/defenses.js';
import * as F from './formulas.js';
import { loadGame, saveGame } from './storage.js';

const STARTING_RESOURCES = { metal: 500, crystal: 500, deuterium: 100 };

function defaultState() {
  return {
    version: 1,
    lastTick: Date.now(),
    planetName: 'Heimatplanet',
    resources: { ...STARTING_RESOURCES },
    buildings: {},
    research: {},
    ships: {},
    defenses: {},
    queues: {
      building: null, // { id, finishAt }
      research: null, // { id, finishAt }
      shipyard: [], // [ { id, kind, remaining, perUnitSeconds, nextAt } ]
    },
  };
}

export class Game {
  constructor() {
    const saved = loadGame();
    this.state = saved ? this._migrate(saved) : defaultState();
    // Offline-Fortschritt nachholen
    this.tick();
  }

  _migrate(saved) {
    const base = defaultState();
    return {
      ...base,
      ...saved,
      resources: { ...base.resources, ...(saved.resources || {}) },
      buildings: { ...(saved.buildings || {}) },
      research: { ...(saved.research || {}) },
      ships: { ...(saved.ships || {}) },
      defenses: { ...(saved.defenses || {}) },
      queues: { ...base.queues, ...(saved.queues || {}) },
    };
  }

  save() {
    saveGame(this.state);
  }

  // ----------------------------------------------------------------- Abfragen

  get resources() {
    return this.state.resources;
  }

  get satellites() {
    return this.state.ships.solarSatellite || 0;
  }

  production() {
    return F.hourlyProduction(this.state.buildings, this.state.research, this.satellites);
  }

  energy() {
    return F.energyBalance(this.state.buildings, this.state.research, this.satellites);
  }

  capacities() {
    return F.capacities(this.state.buildings);
  }

  nameOf(id) {
    return (
      (BUILDING_MAP[id] && BUILDING_MAP[id].name) ||
      (RESEARCH_MAP[id] && RESEARCH_MAP[id].name) ||
      (SHIP_MAP[id] && SHIP_MAP[id].name) ||
      (DEFENSE_MAP[id] && DEFENSE_MAP[id].name) ||
      id
    );
  }

  // -------------------------------------------------------------------- Tick

  /** Verarbeitet verstrichene Zeit: Ressourcen + Warteschlangen. */
  tick(now = Date.now()) {
    const elapsed = Math.max(0, (now - this.state.lastTick) / 1000);
    if (elapsed <= 0) {
      this.state.lastTick = now;
      return;
    }

    // Ressourcen anhand der Produktion gutschreiben (auf Lager begrenzt).
    const prod = this.production();
    const cap = this.capacities();
    const res = this.state.resources;
    res.metal = Math.min(cap.metal, res.metal + (prod.metal / 3600) * elapsed);
    res.crystal = Math.min(cap.crystal, res.crystal + (prod.crystal / 3600) * elapsed);
    // Deuterium darf nicht unter 0 fallen (Fusion verbraucht es)
    res.deuterium = Math.max(0, Math.min(cap.deuterium, res.deuterium + (prod.deuterium / 3600) * elapsed));

    this._processQueues(now);
    this.state.lastTick = now;
  }

  _processQueues(now) {
    const q = this.state.queues;

    if (q.building && now >= q.building.finishAt) {
      this.state.buildings[q.building.id] = (this.state.buildings[q.building.id] || 0) + 1;
      q.building = null;
    }

    if (q.research && now >= q.research.finishAt) {
      this.state.research[q.research.id] = (this.state.research[q.research.id] || 0) + 1;
      q.research = null;
    }

    // Werft: sequenziell, ein Stück nach dem anderen
    while (q.shipyard.length > 0) {
      const job = q.shipyard[0];
      if (now < job.nextAt) break;
      // Stück fertigstellen
      const target = job.kind === 'ship' ? this.state.ships : this.state.defenses;
      target[job.id] = (target[job.id] || 0) + 1;
      job.remaining -= 1;
      if (job.remaining <= 0) {
        q.shipyard.shift();
        if (q.shipyard.length > 0) {
          q.shipyard[0].nextAt = job.nextAt + q.shipyard[0].perUnitSeconds;
        }
      } else {
        job.nextAt += job.perUnitSeconds;
      }
    }
  }

  // --------------------------------------------------------------- Bauaktionen

  _spend(cost) {
    this.state.resources.metal -= cost.metal || 0;
    this.state.resources.crystal -= cost.crystal || 0;
    this.state.resources.deuterium -= cost.deuterium || 0;
  }

  /** Versucht, ein Gebäude in Auftrag zu geben. Gibt {ok, error} zurück. */
  buildBuilding(id) {
    const def = BUILDING_MAP[id];
    if (!def) return { ok: false, error: 'Unbekanntes Gebäude' };
    if (this.state.queues.building) return { ok: false, error: 'Bauschleife belegt' };
    if (!F.requirementsMet(def, this.state)) return { ok: false, error: 'Voraussetzungen fehlen' };
    const level = this.state.buildings[id] || 0;
    const cost = F.levelCost(def, level);
    if (!F.canAfford(this.state.resources, cost)) return { ok: false, error: 'Nicht genug Ressourcen' };
    this._spend(cost);
    const seconds = F.buildTimeSeconds(cost, this.state.buildings);
    this.state.queues.building = { id, finishAt: Date.now() + seconds * 1000 };
    this.save();
    return { ok: true };
  }

  /** Versucht, eine Forschung zu starten. */
  research(id) {
    const def = RESEARCH_MAP[id];
    if (!def) return { ok: false, error: 'Unbekannte Forschung' };
    if ((this.state.buildings.researchLab || 0) < 1)
      return { ok: false, error: 'Forschungslabor benötigt' };
    if (this.state.queues.research) return { ok: false, error: 'Labor belegt' };
    if (!F.requirementsMet(def, this.state)) return { ok: false, error: 'Voraussetzungen fehlen' };
    const level = this.state.research[id] || 0;
    const cost = F.levelCost(def, level);
    if (!F.canAfford(this.state.resources, cost)) return { ok: false, error: 'Nicht genug Ressourcen' };
    this._spend(cost);
    const seconds = F.researchTimeSeconds(cost, this.state.buildings);
    this.state.queues.research = { id, finishAt: Date.now() + seconds * 1000 };
    this.save();
    return { ok: true };
  }

  /** Baut Schiffe oder Verteidigung (kind = 'ship' | 'defense'). */
  buildUnits(id, amount, kind) {
    amount = Math.max(1, Math.floor(amount));
    const def = kind === 'ship' ? SHIP_MAP[id] : DEFENSE_MAP[id];
    if (!def) return { ok: false, error: 'Unbekannte Einheit' };
    if ((this.state.buildings.shipyard || 0) < 1)
      return { ok: false, error: 'Raumschiffwerft benötigt' };
    if (!F.requirementsMet(def, this.state)) return { ok: false, error: 'Voraussetzungen fehlen' };

    // Einmalig baubare Verteidigung (z. B. Schildkuppeln)
    if (def.max) {
      const have = (this.state.defenses[id] || 0) + this._queuedUnitCount(id, kind);
      amount = Math.min(amount, def.max - have);
      if (amount <= 0) return { ok: false, error: 'Maximale Anzahl erreicht' };
    }

    const totalCost = F.unitCost(def, amount);
    if (!F.canAfford(this.state.resources, totalCost)) {
      // So viele bauen, wie leistbar sind
      const affordable = this._affordableAmount(def);
      if (affordable <= 0) return { ok: false, error: 'Nicht genug Ressourcen' };
      amount = def.max ? Math.min(amount, affordable) : affordable;
    }

    const finalCost = F.unitCost(def, amount);
    this._spend(finalCost);
    const perUnitSeconds = F.buildTimeSeconds(F.unitCost(def, 1), this.state.buildings);
    const q = this.state.queues.shipyard;
    const startNow = q.length === 0;
    q.push({
      id, kind, remaining: amount, perUnitSeconds,
      nextAt: startNow ? Date.now() + perUnitSeconds * 1000 : 0,
    });
    this.save();
    return { ok: true, amount };
  }

  _affordableAmount(def) {
    const r = this.state.resources;
    const c = def.cost;
    let max = Infinity;
    if (c.metal) max = Math.min(max, Math.floor(r.metal / c.metal));
    if (c.crystal) max = Math.min(max, Math.floor(r.crystal / c.crystal));
    if (c.deuterium) max = Math.min(max, Math.floor(r.deuterium / c.deuterium));
    return Number.isFinite(max) ? max : 0;
  }

  _queuedUnitCount(id, kind) {
    return this.state.queues.shipyard
      .filter((j) => j.id === id && j.kind === kind)
      .reduce((sum, j) => sum + j.remaining, 0);
  }
}
