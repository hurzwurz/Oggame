// Kern-Spiel-Engine: Zustand, Tick-Schleife und Bauwarteschlangen.

import { BUILDING_MAP } from '../data/buildings.js';
import { RESEARCH_MAP } from '../data/research.js';
import { SHIP_MAP } from '../data/ships.js';
import { DEFENSE_MAP } from '../data/defenses.js';
import * as F from './formulas.js';
import { loadGame, saveGame } from './storage.js';
import { simulateBattle } from './combat.js';
import * as G from '../data/galaxy.js';

const STARTING_RESOURCES = { metal: 500, crystal: 500, deuterium: 100, gold: 0, titan: 0 };

function defaultState() {
  return {
    version: 1,
    lastTick: Date.now(),
    planetName: 'Heimatplanet',
    coords: [...G.HOME_COORDS],
    resources: { ...STARTING_RESOURCES },
    buildings: {},
    research: {},
    ships: {},
    defenses: {},
    queues: {
      building: null, // { id, finishAt }
      building2: null, // zweiter Gebäude-Slot (nur mit Booster)
      research: null, // { id, finishAt }
      shipyard: [], // [ { id, kind, remaining, perUnitSeconds, nextAt } ]
    },
    booster: { until: 0 }, // { until } – aktiv solange until > now
    xp: 0, // Erfahrungspunkte (jeder Bau bringt XP)
    galaxy: G.generateGalaxy(),
    fleets: [], // unterwegs befindliche Missionen
    reports: [], // Kampf-/Spionage-/Expeditionsberichte (neueste zuerst)
    fleetSeq: 1,
  };
}

export class Game {
  constructor(options = {}) {
    // Speicher-Callback: online -> Cloud, sonst localStorage.
    this._onSave = options.onSave || ((state) => saveGame(state));
    const source = options.initialState || loadGame();
    this.state = source ? this._migrate(source) : defaultState();
    // Offline-Fortschritt nachholen
    this.tick();
  }

  _migrate(saved) {
    const base = defaultState();
    return {
      ...base,
      ...saved,
      coords: saved.coords || base.coords,
      resources: { ...base.resources, ...(saved.resources || {}) },
      buildings: { ...(saved.buildings || {}) },
      research: { ...(saved.research || {}) },
      ships: { ...(saved.ships || {}) },
      defenses: { ...(saved.defenses || {}) },
      queues: { ...base.queues, ...(saved.queues || {}) },
      galaxy: saved.galaxy && saved.galaxy.length ? saved.galaxy : base.galaxy,
      fleets: saved.fleets || [],
      reports: saved.reports || [],
      fleetSeq: saved.fleetSeq || 1,
      xp: saved.xp || 0,
    };
  }

  // -------------------------------------------------------------------- Level/XP
  _awardXp(n) { this.state.xp = (this.state.xp || 0) + Math.max(0, Math.floor(n)); }
  /** Aktuelles Level (wächst mit der Wurzel der XP). */
  level() { return Math.floor(Math.sqrt((this.state.xp || 0) / 100)) + 1; }
  /** Fortschritt zum nächsten Level: { level, into, need, xp }. */
  xpInfo() {
    const xp = this.state.xp || 0;
    const lvl = this.level();
    const base = 100 * Math.pow(lvl - 1, 2); // XP-Schwelle aktuelles Level
    const next = 100 * Math.pow(lvl, 2);     // XP-Schwelle nächstes Level
    return { level: lvl, xp, into: Math.floor(xp - base), need: Math.floor(next - base) };
  }
  _buildXp(def, newLevel) {
    if (!def) return 5;
    const c = F.levelCost(def, newLevel - 1);
    return Math.max(5, Math.floor(((c.metal || 0) + (c.crystal || 0) + (c.deuterium || 0)) / 100));
  }
  _unitXp(def) {
    if (!def) return 1;
    const c = def.cost || {};
    return Math.max(1, Math.floor(((c.metal || 0) + (c.crystal || 0) + (c.deuterium || 0)) / 300));
  }

  save() {
    this._onSave(this.state);
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

  /** Kampfrelevante Forschungsstufen des Spielers. */
  tech() {
    return {
      weaponsTech: this.state.research.weaponsTech || 0,
      shieldTech: this.state.research.shieldTech || 0,
      armorTech: this.state.research.armorTech || 0,
    };
  }

  npcAt(coords) {
    return this.state.galaxy.find(
      (t) => t.coords[0] === coords[0] && t.coords[1] === coords[1] && t.coords[2] === coords[2]
    );
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
    this._processFleets(now);
    this._regenNpc(elapsed);
    this.state.lastTick = now;
  }

  _processQueues(now) {
    const q = this.state.queues;

    if (q.building && now >= q.building.finishAt) {
      const lvl = (this.state.buildings[q.building.id] = (this.state.buildings[q.building.id] || 0) + 1);
      this._awardXp(this._buildXp(BUILDING_MAP[q.building.id], lvl));
      q.building = null;
    }
    if (q.building2 && now >= q.building2.finishAt) {
      const lvl = (this.state.buildings[q.building2.id] = (this.state.buildings[q.building2.id] || 0) + 1);
      this._awardXp(this._buildXp(BUILDING_MAP[q.building2.id], lvl));
      q.building2 = null;
    }

    if (q.research && now >= q.research.finishAt) {
      const lvl = (this.state.research[q.research.id] = (this.state.research[q.research.id] || 0) + 1);
      this._awardXp(this._buildXp(RESEARCH_MAP[q.research.id], lvl));
      q.research = null;
    }

    // Werft: sequenziell, ein Stück nach dem anderen
    while (q.shipyard.length > 0) {
      const job = q.shipyard[0];
      if (now < job.nextAt) break;
      // Stück fertigstellen
      const target = job.kind === 'ship' ? this.state.ships : this.state.defenses;
      target[job.id] = (target[job.id] || 0) + 1;
      this._awardXp(this._unitXp(job.kind === 'ship' ? SHIP_MAP[job.id] : DEFENSE_MAP[job.id]));
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

  // ------------------------------------------------------------------ Booster
  boosterActive(now = Date.now()) {
    return !!(this.state.booster && this.state.booster.until > now);
  }
  boosterRemaining(now = Date.now()) {
    return this.boosterActive(now) ? Math.ceil((this.state.booster.until - now) / 1000) : 0;
  }
  /** Aktiviert den Booster für `hours` Stunden (stapelt, wenn schon aktiv). */
  activateBooster(hours = 1) {
    const now = Date.now();
    const base = this.boosterActive(now) ? this.state.booster.until : now;
    this.state.booster = { until: base + hours * 3600 * 1000 };
    this.save();
  }

  /** Versucht, ein Gebäude in Auftrag zu geben. Gibt {ok, error} zurück. */
  buildBuilding(id) {
    const def = BUILDING_MAP[id];
    if (!def) return { ok: false, error: 'Unbekanntes Gebäude' };
    if (!F.requirementsMet(def, this.state)) return { ok: false, error: 'Voraussetzungen fehlen' };
    // Freien Bauslot finden – zweiter Slot nur mit aktivem Booster.
    let slot = null;
    if (!this.state.queues.building) slot = 'building';
    else if (this.boosterActive() && !this.state.queues.building2) slot = 'building2';
    else return { ok: false, error: 'Bauschleife belegt' };
    const level = this.state.buildings[id] || 0;
    const cost = F.levelCost(def, level);
    if (!F.canAfford(this.state.resources, cost)) return { ok: false, error: 'Nicht genug Ressourcen' };
    this._spend(cost);
    let seconds = F.buildTimeSeconds(cost, this.state.buildings);
    if (this.boosterActive()) seconds = Math.ceil(seconds / 2);
    this.state.queues[slot] = { id, finishAt: Date.now() + seconds * 1000 };
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
    let seconds = F.researchTimeSeconds(cost, this.state.buildings);
    if (this.boosterActive()) seconds = Math.ceil(seconds / 2);
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

  /** Schließt den laufenden Gebäude-Auftrag sofort ab (Coins-Skip). */
  skipBuilding() {
    const q = this.state.queues.building;
    if (!q) return false;
    this.state.buildings[q.id] = (this.state.buildings[q.id] || 0) + 1;
    this.state.queues.building = null;
    this.save();
    return true;
  }

  /** Schließt die laufende Forschung sofort ab (Coins-Skip). */
  skipResearch() {
    const q = this.state.queues.research;
    if (!q) return false;
    this.state.research[q.id] = (this.state.research[q.id] || 0) + 1;
    this.state.queues.research = null;
    this.save();
    return true;
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

  // ------------------------------------------------------------- Flottenlogik

  _addReport(report) {
    report.id = this.state.fleetSeq++;
    report.time = Date.now();
    this.state.reports.unshift(report);
    if (this.state.reports.length > 50) this.state.reports.length = 50;
  }

  /**
   * Schickt eine Flotte auf eine Mission.
   * @param mission 'attack' | 'espionage' | 'expedition'
   * @param coords  Zielkoordinaten [g,s,p]
   * @param ships   { id: count }
   * @param cargo   { metal, crystal, deuterium } mitzuführende Ladung (optional)
   */
  sendFleet(mission, coords, ships, cargo = { metal: 0, crystal: 0, deuterium: 0 }) {
    ships = Object.fromEntries(Object.entries(ships).filter(([, n]) => n > 0));
    if (Object.keys(ships).length === 0) return { ok: false, error: 'Keine Schiffe ausgewählt' };

    // Verfügbarkeit prüfen
    for (const [id, n] of Object.entries(ships)) {
      if ((this.state.ships[id] || 0) < n) return { ok: false, error: `Nicht genug ${this.nameOf(id)}` };
    }
    if (G.fleetSpeed(ships, this.state.research) <= 0)
      return { ok: false, error: 'Diese Flotte kann nicht fliegen' };

    if (mission === 'espionage' && !ships.espionageProbe)
      return { ok: false, error: 'Spionage benötigt Spionagesonden' };

    const dist = G.distance(this.state.coords, coords);
    const ft = G.flightTime(dist, ships, this.state.research);
    const fuel = G.fuelCost(dist, ships);
    const cargoLoad = (cargo.metal || 0) + (cargo.crystal || 0) + (cargo.deuterium || 0);
    const capacity = G.cargoCapacity(ships);
    if (cargoLoad > capacity) return { ok: false, error: 'Ladung übersteigt Frachtraum' };

    const needDeut = fuel + (cargo.deuterium || 0);
    if (this.state.resources.deuterium < needDeut) return { ok: false, error: 'Nicht genug Deuterium (Treibstoff)' };
    if (this.state.resources.metal < (cargo.metal || 0) || this.state.resources.crystal < (cargo.crystal || 0))
      return { ok: false, error: 'Nicht genug Ressourcen für die Ladung' };

    // Abziehen
    for (const [id, n] of Object.entries(ships)) this.state.ships[id] -= n;
    this.state.resources.deuterium -= needDeut;
    this.state.resources.metal -= cargo.metal || 0;
    this.state.resources.crystal -= cargo.crystal || 0;

    const target = this.npcAt(coords);
    const now = Date.now();
    const holdSeconds = mission === 'expedition' ? 1800 : 0; // Expedition verweilt 30 min
    this.state.fleets.push({
      id: this.state.fleetSeq++,
      mission,
      target: coords,
      targetName: target ? target.name : mission === 'expedition' ? 'Tiefer Weltraum' : 'Unbekannt',
      ships,
      cargo: { ...cargo },
      fuel,
      phase: 'outbound',
      departAt: now,
      arriveAt: now + ft * 1000,
      returnAt: now + (ft * 2 + holdSeconds) * 1000,
    });
    this.save();
    return { ok: true };
  }

  /**
   * Schickt eine PvP-Flotte (Angriff/Spionage) mit Flugzeit zu einem echten
   * Spieler. Die Auflösung passiert serverseitig bei Ankunft (siehe main.js).
   * @param kind 'attack' | 'spy'
   */
  sendPvpFleet(kind, coords, ships) {
    ships = Object.fromEntries(Object.entries(ships).filter(([, n]) => n > 0));
    if (Object.keys(ships).length === 0) return { ok: false, error: 'Keine Schiffe ausgewählt' };
    for (const [id, n] of Object.entries(ships)) {
      if ((this.state.ships[id] || 0) < n) return { ok: false, error: `Nicht genug ${this.nameOf(id)}` };
    }
    if (G.fleetSpeed(ships, this.state.research) <= 0)
      return { ok: false, error: 'Diese Flotte kann nicht fliegen' };
    if (kind === 'spy' && !ships.espionageProbe)
      return { ok: false, error: 'Spionage benötigt Spionagesonden' };

    const dist = G.distance(this.state.coords, coords);
    const ft = G.flightTime(dist, ships, this.state.research);
    const fuel = G.fuelCost(dist, ships);
    if (this.state.resources.deuterium < fuel) return { ok: false, error: 'Nicht genug Deuterium (Treibstoff)' };

    for (const [id, n] of Object.entries(ships)) this.state.ships[id] -= n;
    this.state.resources.deuterium -= fuel;

    const now = Date.now();
    this.state.fleets.push({
      id: this.state.fleetSeq++,
      mission: kind === 'spy' ? 'pvp_spy' : 'pvp_attack',
      target: coords,
      targetName: 'Spieler ' + coords.join(':'),
      ships,
      cargo: { metal: 0, crystal: 0, deuterium: 0 },
      fuel,
      pvp: true,
      resolving: false,
      phase: 'outbound',
      departAt: now,
      arriveAt: now + ft * 1000,
      returnAt: now + ft * 2 * 1000,
    });
    this.save();
    return { ok: true };
  }

  /** Bringt eine Flotte vorzeitig zurück (Rückruf). */
  recallFleet(fleetId) {
    const fleet = this.state.fleets.find((f) => f.id === fleetId);
    if (!fleet || fleet.phase === 'returning') return { ok: false };
    const now = Date.now();
    const flown = Math.max(1, now - fleet.departAt);
    fleet.phase = 'returning';
    fleet.arriveAt = now;
    fleet.returnAt = now + flown; // gleiche Zeit zurück wie schon geflogen
    this.save();
    return { ok: true };
  }

  _processFleets(now) {
    const remaining = [];
    for (const fleet of this.state.fleets) {
      if (fleet.pvp) { remaining.push(fleet); continue; } // PvP-Flotten löst main.js auf
      if (fleet.phase === 'outbound' && now >= fleet.arriveAt) {
        this._resolveMission(fleet);
        if (fleet.lost) continue; // Flotte vernichtet -> entfällt
        fleet.phase = 'returning';
      }
      if (fleet.phase === 'returning' && now >= fleet.returnAt) {
        this._returnFleet(fleet);
        continue;
      }
      remaining.push(fleet);
    }
    this.state.fleets = remaining;
  }

  _resolveMission(fleet) {
    if (fleet.mission === 'espionage') return this._resolveEspionage(fleet);
    if (fleet.mission === 'expedition') return this._resolveExpedition(fleet);
    return this._resolveAttack(fleet);
  }

  _resolveEspionage(fleet) {
    const target = this.npcAt(fleet.target);
    if (!target) {
      this._addReport({ type: 'espionage', target: fleet.target, empty: true });
      return;
    }
    this._addReport({
      type: 'espionage',
      target: fleet.target,
      targetName: target.name,
      resources: { ...target.resources },
      defense: { ...target.defense },
      fleet: { ...target.fleet },
      tier: target.tier,
    });
  }

  _resolveExpedition(fleet) {
    const rng = Math.random();
    const sizeFactor = Object.values(fleet.ships).reduce((a, b) => a + b, 0);
    if (rng < 0.1) {
      // Katastrophe: Teil der Flotte verloren
      const losses = {};
      for (const [id, n] of Object.entries(fleet.ships)) {
        const lost = Math.ceil(n * (0.2 + Math.random() * 0.4));
        if (lost > 0) { fleet.ships[id] -= lost; losses[id] = lost; }
      }
      if (Object.values(fleet.ships).every((n) => n <= 0)) fleet.lost = true;
      this._addReport({ type: 'expedition', outcome: 'disaster', losses });
    } else if (rng < 0.55) {
      // Ressourcenfund (durch Frachtraum begrenzt)
      const cap = G.cargoCapacity(fleet.ships) - ((fleet.cargo.metal || 0) + (fleet.cargo.crystal || 0) + (fleet.cargo.deuterium || 0));
      const found = Math.floor(Math.min(cap, (5000 + Math.random() * 20000) * Math.max(1, Math.log2(sizeFactor + 1))));
      const metal = Math.floor(found * 0.6);
      const crystal = Math.floor(found * 0.3);
      const deut = found - metal - crystal;
      fleet.cargo.metal = (fleet.cargo.metal || 0) + metal;
      fleet.cargo.crystal = (fleet.cargo.crystal || 0) + crystal;
      fleet.cargo.deuterium = (fleet.cargo.deuterium || 0) + deut;
      this._addReport({ type: 'expedition', outcome: 'resources', found: { metal, crystal, deuterium: deut } });
    } else if (rng < 0.75) {
      // Schiffsfund
      const gained = { smallCargo: 1 + Math.floor(Math.random() * Math.max(1, sizeFactor / 5)) };
      for (const [id, n] of Object.entries(gained)) fleet.ships[id] = (fleet.ships[id] || 0) + n;
      this._addReport({ type: 'expedition', outcome: 'ships', gained });
    } else {
      this._addReport({ type: 'expedition', outcome: 'nothing' });
    }
  }

  _resolveAttack(fleet) {
    const target = this.npcAt(fleet.target);
    if (!target || (Object.keys(target.fleet).length === 0 && Object.keys(target.defense).length === 0 &&
        target.resources.metal + target.resources.crystal + target.resources.deuterium < 1)) {
      this._addReport({ type: 'attack', target: fleet.target, empty: true });
      return;
    }

    const result = simulateBattle(
      { ships: fleet.ships, tech: this.tech() },
      { ships: target.fleet, defense: target.defense, tech: target.tech || {} },
      (this.state.fleetSeq * 2654435761) >>> 0
    );

    // Überlebende der angreifenden Flotte übernehmen
    fleet.ships = { ...result.attacker.survivors };
    const attackerWiped = Object.values(fleet.ships).every((n) => n <= 0);

    // Ziel aktualisieren: Schiffe = Überlebende, Verteidigung 70 % wiederaufgebaut
    target.fleet = { ...result.defender.shipSurvivors };
    const rebuilt = {};
    for (const [id, before] of Object.entries(result.defender.defenseBefore)) {
      const surv = result.defender.defenseSurvivors[id] || 0;
      rebuilt[id] = surv + Math.floor((before - surv) * 0.7);
    }
    target.defense = rebuilt;

    let loot = { metal: 0, crystal: 0, deuterium: 0 };
    if (result.winner === 'attacker' && !attackerWiped) {
      const cap = G.cargoCapacity(fleet.ships);
      let free = cap;
      const take = (key) => {
        const lootable = Math.floor(target.resources[key] * 0.5);
        const amount = Math.min(lootable, free);
        loot[key] = amount;
        target.resources[key] -= amount;
        free -= amount;
      };
      take('metal'); take('crystal'); take('deuterium');
      fleet.cargo.metal += loot.metal;
      fleet.cargo.crystal += loot.crystal;
      fleet.cargo.deuterium += loot.deuterium;
    }

    if (attackerWiped) fleet.lost = true;

    this._addReport({
      type: 'attack',
      target: fleet.target,
      targetName: target.name,
      winner: result.winner,
      rounds: result.rounds,
      attackerLosses: diffCounts(result.attacker.before, result.attacker.survivors),
      defenderShipLosses: diffCounts(result.defender.shipsBefore, result.defender.shipSurvivors),
      defenderDefenseLosses: diffCounts(result.defender.defenseBefore, result.defender.defenseSurvivors),
      loot,
      debris: result.debris,
      attackerWiped,
    });
  }

  _returnFleet(fleet) {
    for (const [id, n] of Object.entries(fleet.ships)) {
      if (n > 0) this.state.ships[id] = (this.state.ships[id] || 0) + n;
    }
    const cap = this.capacities();
    const r = this.state.resources;
    r.metal = Math.min(cap.metal, r.metal + (fleet.cargo.metal || 0));
    r.crystal = Math.min(cap.crystal, r.crystal + (fleet.cargo.crystal || 0));
    r.deuterium = Math.min(cap.deuterium, r.deuterium + (fleet.cargo.deuterium || 0));
    this._addReport({
      type: 'return',
      targetName: fleet.targetName,
      mission: fleet.mission,
      cargo: { ...fleet.cargo },
    });
  }

  /** NPC-Ressourcen regenerieren langsam zurück zur Ausgangsmenge. */
  _regenNpc(elapsedSeconds) {
    const hours = elapsedSeconds / 3600;
    if (hours <= 0) return;
    for (const t of this.state.galaxy) {
      if (!t.cap) t.cap = { ...t.resources };
      for (const key of ['metal', 'crystal', 'deuterium']) {
        const rate = (t.cap[key] || 0) * 0.05; // 5 % der Kapazität pro Stunde
        t.resources[key] = Math.min(t.cap[key] || 0, (t.resources[key] || 0) + rate * hours);
      }
    }
  }
}

function diffCounts(before, after) {
  const out = {};
  for (const [id, n] of Object.entries(before || {})) {
    const lost = n - (after[id] || 0);
    if (lost > 0) out[id] = lost;
  }
  return out;
}
