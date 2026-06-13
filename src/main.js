// App-Einstieg: Auth (online) bzw. Offline-Modus, Tabs, Tick-Schleife, Events.

import { Game } from './engine/game.js';
import { clearGame } from './engine/storage.js';
import { simulateBattle } from './engine/combat.js';
import * as V from './ui/render.js';
import { isConfigured, currentUser, signIn, signUp, signOut, onAuthChange, loadGalaxyOverview } from './net/supabase.js';
import { ensureProfile, ensureHomePlanet, buildInitialState, makeCloudSaver } from './net/cloud.js';

// ------------------------------------------------------------- globaler Zustand
let game = null;
let userInfo = null; // { email, planetId } im Online-Modus, sonst null
let cloudSaver = null;
let players = []; // andere Spieler aus der Galaxie

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
  galaxy: { label: 'Galaxie', render: (g) => V.renderGalaxy(g, dispatch, players) },
  movement: { label: 'Flotten', render: (g) => V.renderMovements(g) },
  reports: { label: 'Berichte', render: (g) => V.renderReports(g) },
  simulator: { label: 'Simulator', render: () => V.renderSimulator(sim) },
};
const LIVE_TABS = new Set(['overview', 'movement', 'reports']);
let activeTab = 'overview';

const app = document.getElementById('app');
let topbarEl, tabsEl, viewEl;

// =================================================================== Bootstrap

async function boot() {
  if (!isConfigured()) {
    // Offline-Modus: lokaler Spielstand wie gehabt.
    game = new Game();
    userInfo = null;
    startGameUI();
    return;
  }
  try {
    const user = await currentUser();
    if (!user) {
      renderAuthScreen({ mode: 'login' });
      return;
    }
    await startOnline(user);
  } catch (e) {
    renderErrorScreen(e);
  }
}

async function startOnline(user) {
  app.innerHTML = `<div class="login-wrap"><div class="panel login-card"><h2>🚀 Oggame</h2><p class="muted">Lade dein Imperium…</p></div></div>`;
  await ensureProfile(user);
  const row = await ensureHomePlanet(user.id);
  cloudSaver = makeCloudSaver(row.id, user.id);
  game = new Game({ initialState: buildInitialState(row, user.id), onSave: cloudSaver.onSave });
  userInfo = { email: user.email, planetId: row.id };
  dispatch.g = row.galaxy; dispatch.s = row.system; dispatch.p = row.position;
  await refreshPlayers();
  startGameUI();
  // Bei Logout/Token-Verlust zurück zum Login.
  onAuthChange((u) => { if (!u) location.reload(); });
}

async function refreshPlayers() {
  try {
    const rows = await loadGalaxyOverview();
    players = rows.map((p) => ({
      ...p,
      is_self: game && p.galaxy === game.state.coords[0] && p.system === game.state.coords[1] && p.position === game.state.coords[2],
    }));
  } catch (e) {
    console.warn('Spielerliste konnte nicht geladen werden:', e.message || e);
  }
}

// ===================================================================== Screens

function renderAuthScreen(authState) {
  app.innerHTML = V.renderLogin(authState);
  const form = document.getElementById('auth-form');
  const toggle = document.getElementById('auth-toggle');
  toggle.addEventListener('click', (ev) => {
    ev.preventDefault();
    renderAuthScreen({ mode: authState.mode === 'login' ? 'signup' : 'login' });
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const username = (document.getElementById('auth-username') || {}).value;
    renderAuthScreen({ ...authState, busy: true });
    try {
      if (authState.mode === 'signup') {
        const { data, error } = await signUp(email, password, (username || '').trim() || email.split('@')[0]);
        if (error) throw error;
        if (!data.session) {
          renderAuthScreen({ mode: 'login', error: 'Konto erstellt! Bitte E-Mail bestätigen (oder „Confirm email“ in Supabase deaktivieren), dann einloggen.' });
          return;
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
      await boot();
    } catch (e) {
      renderAuthScreen({ mode: authState.mode, error: friendlyError(e) });
    }
  });
  // Felder nach Re-Render wieder befüllen wäre möglich; wir halten es einfach.
  setTimeout(() => { const f = document.getElementById('auth-email'); if (f) f.focus(); }, 0);
}

function renderErrorScreen(e) {
  app.innerHTML = `<div class="login-wrap"><div class="panel login-card">
    <h2>⚠️ Verbindungsproblem</h2>
    <div class="login-error">${friendlyError(e)}</div>
    <button class="build-btn" onclick="location.reload()">Erneut versuchen</button>
    <p class="muted small">Tipp: Stelle sicher, dass <code>supabase/schema.sql</code> im SQL-Editor ausgeführt wurde und der Email-Login aktiv ist.</p>
  </div></div>`;
}

function friendlyError(e) {
  const msg = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/relation .* does not exist|table .* not found|schema/i.test(msg))
    return 'Datenbank-Tabellen fehlen. Bitte supabase/schema.sql im SQL-Editor ausführen.';
  if (/Invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort falsch.';
  if (/already registered|already exists/i.test(msg)) return 'Diese E-Mail ist bereits registriert – bitte einloggen.';
  if (/Email not confirmed/i.test(msg)) return 'E-Mail noch nicht bestätigt.';
  return msg;
}

// ============================================================== Spiel-Oberfläche

function startGameUI() {
  app.innerHTML = `
    <header id="topbar"></header>
    <nav id="tabs"></nav>
    <main id="view"></main>
    <footer id="footer">
      <span class="muted">${userInfo ? '👤 ' + userInfo.email : 'Offline-Modus (lokal gespeichert)'}</span>
      <span>${userInfo
        ? '<button id="logout-btn" class="ghost">Logout</button>'
        : '<button id="reset-btn" class="ghost">Spielstand zurücksetzen</button>'}</span>
    </footer>`;

  topbarEl = document.getElementById('topbar');
  tabsEl = document.getElementById('tabs');
  viewEl = document.getElementById('view');

  tabsEl.addEventListener('click', onTabClick);
  viewEl.addEventListener('click', onViewClick);
  viewEl.addEventListener('input', onViewInput);

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    if (cloudSaver) await cloudSaver.flush();
    await signOut();
    location.reload();
  });
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (confirm('Spielstand wirklich löschen?')) { clearGame(); location.reload(); }
  });

  renderTabs();
  renderView();
  setInterval(loop, 1000);
  setInterval(() => game.save(), 10000);
  window.addEventListener('beforeunload', () => { game.save(); if (cloudSaver) cloudSaver.flush(); });
}

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
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
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
  for (const u of units) if (u.kind === kind) out[u.id] = (out[u.id] || 0) + u.count;
  return out;
}

function num(sel, fallback) {
  const el = viewEl.querySelector(sel);
  if (!el) return fallback;
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) ? v : fallback;
}

// ----------------------------------------------------------------- Events

async function onTabClick(ev) {
  const btn = ev.target.closest('.tab');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  renderTabs();
  renderView();
  // Galaxie online: Spielerliste aktualisieren.
  if (activeTab === 'galaxy' && userInfo) {
    await refreshPlayers();
    if (activeTab === 'galaxy') renderView();
  }
}

function onViewClick(ev) {
  const btn = ev.target.closest('button');
  if (!btn) return;

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

  if (btn.classList.contains('pick-target')) {
    dispatch.g = +btn.dataset.g; dispatch.s = +btn.dataset.s; dispatch.p = +btn.dataset.p;
    renderView();
    return;
  }

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
    if (res.ok) { toast('Flotte gestartet.', true); activeTab = 'movement'; renderTabs(); }
    else toast(res.error || 'Start nicht möglich.', false);
    renderView();
    return;
  }

  if (btn.classList.contains('recall')) {
    game.recallFleet(+btn.dataset.id);
    toast('Flotte kehrt um.', true);
    renderView();
    return;
  }

  if (btn.classList.contains('sim-add')) {
    syncSim();
    sim[btn.dataset.side].units.push({ id: btn.dataset.kind === 'defense' ? 'rocketLauncher' : 'lightFighter', count: 10, kind: btn.dataset.kind });
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
    sim.result = simulateBattle(
      { ships: unitsToMap(sim.attacker.units, 'ship'), tech: sim.attacker.tech },
      { ships: unitsToMap(sim.defender.units, 'ship'), defense: unitsToMap(sim.defender.units, 'defense'), tech: sim.defender.tech },
      Math.floor(Math.random() * 1e9)
    );
    renderView();
    return;
  }
}

function onViewInput(ev) {
  if (activeTab === 'galaxy') {
    const estEl = viewEl.querySelector('#dispatch-estimate');
    if (estEl) {
      const coords = [num('#d-g', 1), num('#d-s', 1), num('#d-p', 1)];
      const ships = {};
      viewEl.querySelectorAll('.fleet-ship').forEach((el) => {
        const n = parseInt(el.value, 10) || 0;
        if (n > 0) ships[el.dataset.id] = n;
      });
      estEl.textContent = Object.keys(ships).length ? V.flightEstimate(game, coords, ships) : 'Wähle Schiffe für eine Schätzung.';
    }
  }
  if (activeTab === 'simulator' && ev.target.matches('.sim-count, .sim-tech, .sim-unit')) syncSim();
}

// ---------------------------------------------------------------- Tick-Schleife

function loop() {
  game.tick();
  topbarEl.innerHTML = V.renderTopbar(game);
  if (LIVE_TABS.has(activeTab)) viewEl.innerHTML = TABS[activeTab].render(game);
}

boot();
