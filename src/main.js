// App-Einstieg: Spiel initialisieren, Tabs, Tick-Schleife, Event-Handling.

import { Game } from './engine/game.js';
import { clearGame } from './engine/storage.js';
import * as V from './ui/render.js';

const game = new Game();

const TABS = {
  overview: { label: 'Übersicht', render: V.renderOverview },
  buildings: { label: 'Gebäude', render: V.renderBuildings },
  research: { label: 'Forschung', render: V.renderResearch },
  shipyard: { label: 'Werft', render: V.renderShipyard },
  defense: { label: 'Verteidigung', render: V.renderDefense },
  fleet: { label: 'Hangar', render: V.renderFleet },
};

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
    .map(
      ([key, t]) =>
        `<button class="tab ${key === activeTab ? 'active' : ''}" data-tab="${key}">${t.label}</button>`
    )
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
  toast._t = setTimeout(() => (el.className = ''), 2200);
}

// ---------------------------------------------------------------- Events

tabsEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.tab');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  renderTabs();
  renderView();
});

viewEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.build-btn');
  if (!btn) return;
  const { kind, id } = btn.dataset;
  let result;
  if (kind === 'building') {
    result = game.buildBuilding(id);
  } else if (kind === 'research') {
    result = game.research(id);
  } else {
    // ship / defense — Menge aus dem zugehörigen Input lesen
    const input = viewEl.querySelector(`.amount[data-id="${id}"]`);
    const amount = input ? parseInt(input.value, 10) || 1 : 1;
    result = game.buildUnits(id, amount, kind);
  }
  if (result.ok) {
    const extra = result.amount ? ` (${result.amount}×)` : '';
    toast(`Auftrag erteilt${extra}.`, true);
  } else {
    toast(result.error || 'Aktion nicht möglich.', false);
  }
  renderView();
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Spielstand wirklich löschen?')) {
    clearGame();
    location.reload();
  }
});

// ---------------------------------------------------------------- Tick-Schleife

function loop() {
  game.tick();
  renderView();
}

renderTabs();
renderView();
setInterval(loop, 1000); // Ressourcen & Anzeige jede Sekunde
setInterval(() => game.save(), 10000); // regelmäßig speichern
window.addEventListener('beforeunload', () => game.save());
