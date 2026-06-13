// App-Einstieg: Spiel initialisieren, Tabs, Tick-Schleife, Event-Handling.

import { Game } from './engine/game.js';
import { clearGame } from './engine/storage.js';
import { simulateBattle } from './engine/combat.js';
import * as V from './ui/render.js';

const game = new Game();

// Interaktiver Zustand der Oberfläche (lebt nur im Speicher)
const dispatch = { g: 1, s: 1, p: 1, mission: 'attack' };
const sim = {
  attacker: { tech: { weaponsTech: 0, shieldTech: 0, armorTech: 0 }, units: [{ id: 'lightFighter', count: 100, kind: 'ship' }] },
  defender: { tech: { weaponsTech: 0, shieldTech: 0, armorTech: 0 }, units: [{ id: 'rocketLauncher', count: 50, kind: 'defense' }] },
  result: null,
};

const TABS = {
  overview: { label: 'Übersicht', render: (g) => V.renderOverview(g) },
  buildings: { label: 'Gebäude', render: (g) => V.renderBuildings(g) },
  research: { label: 'Forschung', render: (g) => V.renderResearch(g) },
  shipyard: { label: 'Werft', render: (g) => V.renderShipyard(g) },
  defense: { label: 'Verteidigung', render: (g) => V.renderDefense(g) },
  fleet: { label: 'Hangar', render: (g) => V.renderFleet(g) },
  galaxy: { label: 'Galaxie', render: (g) => V.renderGalaxy(g, dispatch) },
  movement: { label: 'Flotten', render: (g) => V.renderMovements(g) },
  reports: { label: 'Berichte', render: (g) => V.renderReports(g) },
  simulator: { label: 'Simulator', render: () => V.renderSimulator(sim) },
};

// Tabs, die sich gefahrlos jede Sekunde neu zeichnen lassen (keine Eingabefelder).
const LIVE_TABS = new Set(['overview', 'movement', 'reports']);

let activeTab = 'overview';

const app = document.getElementById('app');
app.innerHTML = `
  <header id="topbar"></header>
  <nav id="tabs"></nav>
  <main id="view"></main>
  <footer id="footer">
    <span class="muted">Oggame · ein OGame-inspiriertes Browserspiel</span>
    <button id="reset-btn" class="ghost">Spielstand zurücksetzen</button>
  </footer>
`;

const topbarEl = document.getElementById('topbar');
const tabsEl = document.getElementById('tabs');
const viewEl = document.getElementById('view');

function renderTabs() {
  tabsEl.innerHTML = Object.entries(TABS)
    .map(([key, t]) => `<button class="tab ${key === activeTab ? 'active' : ''}" data-tab="${key}">${t.label}</button>`)
    .join('');
}

function renderView() {
  topbarEl.innerHTML = V.renderTopbar(game);
  viewEl.innerHTML = TABS[activeTab].render(game);
}

function toast(msg, ok = true) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = ok ? 'show ok' : 'show err';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.className = ''), 2400);
}

// --------------------------------------------------------------- Simulator-Helfer

function syncSim() {
  viewEl.querySelectorAll('.sim-tech').forEach((el) => {
    sim[el.dataset.side].tech[el.dataset.tech] = Math.max(0, parseInt(el.value, 10) || 0);
  });
  viewEl.querySelectorAll('.sim-unit').forEach((el) => {
    const u = sim[el.dataset.side].units[+el.dataset.i];
    if (u) u.id = el.value;
  });
  viewEl.querySelectorAll('.sim-count').forEach((el) => {
    const u = sim[el.dataset.side].units[+el.dataset.i];
    if (u) u.count = Math.max(1, parseInt(el.value, 10) || 1);
  });
}

function unitsToMap(units, kind) {
  const out = {};
  for (const u of units) {
    if (u.kind === kind) out[u.id] = (out[u.id] || 0) + u.count;
  }
  return out;
}

// ----------------------------------------------------------------- Click-Events

tabsEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.tab');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  renderTabs();
  renderView();
});

viewEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button');
  if (!btn) return;

  // --- Bauen (Gebäude/Forschung/Schiffe/Verteidigung)
  if (btn.classList.contains('build-btn') && btn.dataset.kind) {
    const { kind, id } = btn.dataset;
    let result;
    if (kind === 'building') result = game.buildBuilding(id);
    else if (kind === 'research') result = game.research(id);
    else {
      const input = viewEl.querySelector(`.amount[data-id="${id}"]`);
      const amount = input ? parseInt(input.value, 10) || 1 : 1;
      result = game.buildUnits(id, amount, kind);
    }
    if (result.ok) toast(`Auftrag erteilt${result.amount ? ` (${result.amount}×)` : ''}.`, true);
    else toast(result.error || 'Aktion nicht möglich.', false);
    renderView();
    return;
  }

  // --- Galaxie: Ziel wählen
  if (btn.classList.contains('pick-target')) {
    dispatch.g = +btn.dataset.g;
    dispatch.s = +btn.dataset.s;
    dispatch.p = +btn.dataset.p;
    renderView();
    return;
  }

  // --- Galaxie: Flotte starten
  if (btn.id === 'send-fleet') {
    const coords = [num('#d-g', 1), num('#d-s', 1), num('#d-p', 1)];
    const mission = viewEl.querySelector('#d-mission').value;
    dispatch.g = coords[0]; dispatch.s = coords[1]; dispatch.p = coords[2]; dispatch.mission = mission;
    const ships = {};
    viewEl.querySelectorAll('.fleet-ship').forEach((el) => {
      const n = parseInt(el.value, 10) || 0;
      if (n > 0) ships[el.dataset.id] = n;
    });
    const cargo = { metal: num('#c-metal', 0), crystal: num('#c-crystal', 0), deuterium: num('#c-deut', 0) };
    const res = game.sendFleet(mission, coords, ships, cargo);
    if (res.ok) {
      toast('Flotte gestartet.', true);
      activeTab = 'movement';
      renderTabs();
    } else {
      toast(res.error || 'Start nicht möglich.', false);
    }
    renderView();
    return;
  }

  // --- Flotte zurückrufen
  if (btn.classList.contains('recall')) {
    game.recallFleet(+btn.dataset.id);
    toast('Flotte kehrt um.', true);
    renderView();
    return;
  }

  // --- Simulator
  if (btn.classList.contains('sim-add')) {
    syncSim();
    const side = btn.dataset.side;
    const kind = btn.dataset.kind;
    sim[side].units.push({ id: kind === 'defense' ? 'rocketLauncher' : 'lightFighter', count: 10, kind });
    renderView();
    return;
  }
  if (btn.classList.contains('sim-del')) {
    syncSim();
    sim[btn.dataset.side].units.splice(+btn.dataset.i, 1);
    renderView();
    return;
  }
  if (btn.id === 'sim-run') {
    syncSim();
    const result = simulateBattle(
      { ships: unitsToMap(sim.attacker.units, 'ship'), tech: sim.attacker.tech },
      { ships: unitsToMap(sim.defender.units, 'ship'), defense: unitsToMap(sim.defender.units, 'defense'), tech: sim.defender.tech },
      Math.floor(Math.random() * 1e9)
    );
    sim.result = result;
    renderView();
    return;
  }
});

// --------------------------------- Eingabe-Events (Live-Schätzung, Sim-Sync)

viewEl.addEventListener('input', (ev) => {
  // Galaxie: Flugzeit-Schätzung aktualisieren
  if (activeTab === 'galaxy') {
    const estEl = viewEl.querySelector('#dispatch-estimate');
    if (!estEl) return;
    const coords = [num('#d-g', 1), num('#d-s', 1), num('#d-p', 1)];
    const ships = {};
    viewEl.querySelectorAll('.fleet-ship').forEach((el) => {
      const n = parseInt(el.value, 10) || 0;
      if (n > 0) ships[el.dataset.id] = n;
    });
    estEl.textContent = Object.keys(ships).length ? V.flightEstimate(game, coords, ships) : 'Wähle Schiffe für eine Schätzung.';
  }
  // Simulator: Eingaben in den Zustand übernehmen (kein Re-Render -> kein Fokusverlust)
  if (activeTab === 'simulator' && ev.target.matches('.sim-count, .sim-tech, .sim-unit')) {
    syncSim();
  }
});

function num(sel, fallback) {
  const el = viewEl.querySelector(sel);
  if (!el) return fallback;
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) ? v : fallback;
}

document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Spielstand wirklich löschen?')) {
    clearGame();
    location.reload();
  }
});

// ---------------------------------------------------------------- Tick-Schleife

function loop() {
  game.tick();
  topbarEl.innerHTML = V.renderTopbar(game);
  // Nur Tabs ohne Eingabefelder live neu zeichnen, damit Formulare erhalten bleiben.
  if (LIVE_TABS.has(activeTab)) viewEl.innerHTML = TABS[activeTab].render(game);
}

renderTabs();
renderView();
setInterval(loop, 1000);
setInterval(() => game.save(), 10000);
window.addEventListener('beforeunload', () => game.save());
