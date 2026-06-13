// App-Einstieg: Auth (online) bzw. Offline-Modus, Tabs, Tick-Schleife, Events.

import { Game } from './engine/game.js';
import { clearGame } from './engine/storage.js';
import { simulateBattle } from './engine/combat.js';
import * as V from './ui/render.js';
import { isConfigured, getClient, currentUser, signIn, signUp, signOut, onAuthChange, loadGalaxyOverview, resetPassword, updatePassword, onPasswordRecovery } from './net/supabase.js';
import { ensureProfile, ensureHomePlanet, buildInitialState, makeCloudSaver } from './net/cloud.js';
import * as Social from './net/social.js';
import * as Pvp from './net/pvp.js';
import * as Coins from './net/coins.js';

// ------------------------------------------------------------- globaler Zustand
let game = null;
let userInfo = null; // { email, planetId } im Online-Modus, sonst null
let cloudSaver = null;
let players = []; // andere Spieler aus der Galaxie
let allianceData = { online: false };
let friendData = { online: false };
let isAdmin = false;
let adminData = { online: false, isAdmin: false, players: [] };

const dispatch = { g: 1, s: 1, p: 1, mission: 'attack' };
const sim = {
  attacker: { tech: { weaponsTech: 0, shieldTech: 0, armorTech: 0 }, units: [{ id: 'lightFighter', count: 100, kind: 'ship' }] },
  defender: { tech: { weaponsTech: 0, shieldTech: 0, armorTech: 0 }, units: [{ id: 'rocketLauncher', count: 50, kind: 'defense' }] },
  result: null,
};

const TABS = {
  overview: { label: 'Übersicht', render: (g) => V.renderOverview(g) },
  base: { label: 'Basis', render: (g) => V.renderBase(g) },
  buildings: { label: 'Gebäude', render: (g) => V.renderBuildings(g) },
  research: { label: 'Forschung', render: (g) => V.renderResearch(g) },
  shipyard: { label: 'Werft', render: (g) => V.renderShipyard(g) },
  defense: { label: 'Verteidigung', render: (g) => V.renderDefense(g) },
  fleet: { label: 'Hangar', render: (g) => V.renderFleet(g) },
  galaxy: { label: 'Galaxie', render: (g) => V.renderGalaxy(g, dispatch, players) },
  movement: { label: 'Flotten', render: (g) => V.renderMovements(g) },
  reports: { label: 'Berichte', render: (g) => V.renderReports(g) },
  alliance: { label: 'Allianz', render: () => V.renderAlliance(allianceData) },
  friends: { label: 'Freunde', render: () => V.renderFriends(friendData) },
  simulator: { label: 'Simulator', render: () => V.renderSimulator(sim) },
  profile: { label: 'Profil', render: () => V.renderProfile(profileState()) },
  admin: { label: '🛡️ Admin', render: () => V.renderAdmin(adminData) },
};

function profileState() {
  return {
    online: !!userInfo,
    username: userInfo && userInfo.username,
    email: userInfo && userInfo.email,
    planetName: game && game.state.planetName,
    level: game && game.level ? game.level() : 1,
    coins: game && game.coins,
    points: (userInfo && userInfo.points) || 0,
    isAdmin,
  };
}
const LIVE_TABS = new Set(['overview', 'base', 'movement', 'reports']);
let activeTab = 'overview';

const app = document.getElementById('app');
let topbarEl, tabsEl, viewEl;

// PWA: Installations-Aufforderung abfangen
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.hidden = false;
});

// =================================================================== Bootstrap

async function boot() {
  // Offline-Modus, wenn keine Keys hinterlegt sind.
  if (!isConfigured()) return startOffline();
  // Lässt sich die Supabase-Bibliothek nicht laden (Netz/Blocker) -> offline.
  const sb = await getClient();
  if (!sb) return startOffline('Online-Modus nicht erreichbar – du spielst lokal weiter.');
  // Kommt der Nutzer über einen Passwort-Recovery-Link, Passwort-Screen zeigen.
  onPasswordRecovery(() => renderResetScreen());
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

/** Lokaler Modus mit localStorage (immer verfügbar – kein Crash möglich). */
function startOffline(notice) {
  game = new Game();
  userInfo = null;
  startGameUI();
  if (notice) setTimeout(() => toast(notice, false), 300);
}

async function startOnline(user) {
  app.innerHTML = `<div class="login-wrap"><div class="panel login-card"><h2>🚀 NEXARION</h2><p class="muted">Lade dein Imperium…</p></div></div>`;
  await ensureProfile(user);
  // Gesperrte Accounts blockieren
  try {
    if (await Coins.isBanned(user.id)) { app.innerHTML = V.renderBanned(); return; }
  } catch { /* ignorieren, falls Spalte/Funktion fehlt */ }
  const row = await ensureHomePlanet(user.id);
  cloudSaver = makeCloudSaver(row.id, user.id);
  game = new Game({ initialState: buildInitialState(row, user.id), onSave: cloudSaver.onSave });
  userInfo = { id: user.id, email: user.email, planetId: row.id };
  dispatch.g = row.galaxy; dispatch.s = row.system; dispatch.p = row.position;
  game.coins = 0; // Online-Marker (aktiviert Coins-Anzeige/Skip)
  await refreshPlayers();
  try { game.coins = await Coins.getCoins(); } catch (e) { console.warn('Coins:', e.message || e); }
  try { isAdmin = await Coins.amIAdmin(); } catch { isAdmin = false; }
  try {
    const pr = await Social.getProfile(user.id);
    if (pr) {
      userInfo.username = pr.username;
      userInfo.points = pr.points || 0;
      game.state.xp = Math.max(game.state.xp || 0, pr.points || 0); // Server-Punkte (z. B. Admin) übernehmen
    }
  } catch { /* Name optional */ }
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

async function refreshAlliance() {
  if (!userInfo) { allianceData = { online: false }; if (activeTab === 'alliance') renderView(); return; }
  allianceData = { online: true, loading: true };
  if (activeTab === 'alliance') renderView();
  try {
    const membership = await Social.myMembership(userInfo.id);
    const members = membership ? await Social.allianceMembers(membership.alliance_id) : [];
    const alliances = membership ? [] : await Social.listAlliances();
    allianceData = { online: true, membership, members, alliances };
  } catch (e) {
    allianceData = { online: true, error: friendlyError(e) };
  }
  if (activeTab === 'alliance') renderView();
}

async function refreshFriends() {
  if (!userInfo) { friendData = { online: false }; if (activeTab === 'friends') renderView(); return; }
  friendData = { online: true, loading: true };
  if (activeTab === 'friends') renderView();
  try {
    friendData = { online: true, friends: await Social.listFriends(userInfo.id) };
  } catch (e) {
    friendData = { online: true, error: friendlyError(e) };
  }
  if (activeTab === 'friends') renderView();
}

async function doSaveName() {
  const name = (viewEl.querySelector('#pf-username').value || '').trim();
  if (name.length < 2) return toast('Name zu kurz (min. 2 Zeichen).', false);
  try {
    await Social.updateUsername(userInfo.id, name);
    userInfo.username = name;
    const who = document.getElementById('who');
    if (who) who.textContent = '👤 ' + name;
    toast('Spielername gespeichert.', true);
    renderView();
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

function doSavePlanet() {
  const n = (viewEl.querySelector('#pf-planet').value || '').trim();
  if (!n) return toast('Bitte einen Planetennamen angeben.', false);
  game.state.planetName = n;
  game.save();
  toast('Planetenname gespeichert.', true);
  renderView();
}

async function doLogout() {
  if (cloudSaver) await cloudSaver.flush();
  await signOut();
  location.reload();
}

async function doBooster() {
  try {
    game.coins = await Coins.spendCoins(V.BOOSTER_COST);
    game.activateBooster(1);
    toast('Booster aktiviert: 2× Tempo + 2. Bauslot für 1 Std!', true);
    renderView();
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

async function doSkip(cost, kind) {
  try {
    game.coins = await Coins.spendCoins(cost);
    if (kind === 'building') game.skipBuilding();
    else if (kind === 'research') game.skipResearch();
    toast('Sofort fertiggestellt.', true);
    renderView();
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

async function doAdminGrant() {
  const u = (viewEl.querySelector('#adm-user').value || '').trim();
  const a = parseInt(viewEl.querySelector('#adm-amount').value, 10) || 0;
  if (!u) return toast('Bitte Spielername angeben.', false);
  try {
    const bal = await Coins.adminGrant(u, a);
    toast(`${u} hat jetzt ${bal} Coins.`, true);
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

async function doPvpAttack(coords, ships) {
  if (!Object.keys(ships).length) return toast('Keine Schiffe ausgewählt.', false);
  for (const [id, n] of Object.entries(ships)) {
    if ((game.state.ships[id] || 0) < n) return toast(`Nicht genug ${game.nameOf(id)}.`, false);
  }
  toast('Angriff läuft …', true);
  try {
    const res = await Pvp.attackPlayer(coords, ships);
    // Lokalen Zustand mit dem Server-Ergebnis abgleichen
    if (res.attacker_ships) game.state.ships = res.attacker_ships;
    if (res.attacker_resources) {
      const r = res.attacker_resources;
      game.state.resources.metal = Number(r.metal) || 0;
      game.state.resources.crystal = Number(r.crystal) || 0;
      game.state.resources.deuterium = Number(r.deuterium) || 0;
    }
    game.state.reports.unshift({
      id: game.state.fleetSeq++, time: Date.now(), type: 'pvp_attack',
      target: coords, winner: res.winner, loot: res.loot || {},
    });
    game.save();
    try { game.coins = await Coins.getCoins(); } catch { /* Coins-Anzeige optional */ }
    const msg = res.winner === 'attacker' ? 'Sieg! Beute eingefahren.' : res.winner === 'defender' ? 'Niederlage – Flotte dezimiert.' : 'Unentschieden.';
    toast(`PvP: ${msg}`, res.winner === 'attacker');
    activeTab = 'reports';
    renderTabs();
    renderView();
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

async function refreshAdmin() {
  adminData = { online: !!userInfo, isAdmin, players: adminData.players || [], loading: true };
  if (activeTab === 'admin') renderView();
  if (!userInfo || !isAdmin) { adminData.loading = false; return; }
  try {
    adminData = { online: true, isAdmin: true, players: await Coins.adminListPlayers() };
  } catch (e) {
    adminData = { online: true, isAdmin: true, players: [], error: friendlyError(e) };
  }
  if (activeTab === 'admin') renderView();
}

function askNum(msg, def) {
  if (typeof prompt !== 'function') return null;
  const v = prompt(msg, String(def));
  if (v === null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function doAdmin(btn) {
  const user = btn.dataset.user;
  try {
    if (btn.id === 'admin-refresh') return refreshAdmin();
    if (btn.classList.contains('admin-gift')) {
      const n = askNum(`Wie viele Coins für ${user}? (negativ = abziehen)`, 100);
      if (n === null) return;
      const bal = await Coins.adminGrant(user, n);
      toast(`${user}: ${bal} Coins.`, true);
      return refreshAdmin();
    }
    if (btn.classList.contains('admin-xp')) {
      const n = askNum(`XP/Punkte für ${user} setzen auf:`, 0);
      if (n === null) return;
      await Coins.adminSetPoints(user, n);
      toast(`${user}: XP gesetzt auf ${n}.`, true);
      return refreshAdmin();
    }
    if (btn.classList.contains('admin-level')) {
      const n = askNum(`Level für ${user} setzen auf:`, 1);
      if (n === null) return;
      await Coins.adminSetLevel(user, n);
      toast(`${user}: Level ${n} gesetzt.`, true);
      return refreshAdmin();
    }
    if (btn.classList.contains('admin-ban')) {
      await Coins.adminSetBanned(btn.dataset.user, true);
      toast(`${btn.dataset.user} gesperrt.`, true);
      return refreshAdmin();
    }
    if (btn.classList.contains('admin-unban')) {
      await Coins.adminSetBanned(btn.dataset.user, false);
      toast(`${btn.dataset.user} freigegeben.`, true);
      return refreshAdmin();
    }
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

async function doSocial(btn) {
  try {
    if (btn.id === 'create-alliance') {
      const tag = (viewEl.querySelector('#al-tag').value || '').trim();
      const name = (viewEl.querySelector('#al-name').value || '').trim();
      if (tag.length < 1 || name.length < 2) return toast('Bitte Tag (1–6) und Name (2–40) angeben.', false);
      await Social.createAlliance(userInfo.id, name, tag);
      toast('Allianz gegründet!', true);
      await refreshAlliance();
    } else if (btn.classList.contains('join-alliance')) {
      await Social.joinAlliance(userInfo.id, btn.dataset.id);
      toast('Allianz beigetreten.', true);
      await refreshAlliance();
    } else if (btn.id === 'leave-alliance') {
      await Social.leaveAlliance(userInfo.id, btn.dataset.id);
      toast('Allianz verlassen.', true);
      await refreshAlliance();
    } else if (btn.id === 'add-friend') {
      const name = (viewEl.querySelector('#fr-name').value || '').trim();
      if (!name) return toast('Bitte Spielername angeben.', false);
      await Social.sendFriendRequest(userInfo.id, name);
      toast('Freundschaftsanfrage gesendet.', true);
      await refreshFriends();
    } else if (btn.classList.contains('friend-accept')) {
      await Social.respondFriend(btn.dataset.id, true);
      toast('Anfrage angenommen.', true);
      await refreshFriends();
    } else if (btn.classList.contains('friend-decline')) {
      await Social.respondFriend(btn.dataset.id, false);
      toast('Anfrage abgelehnt.', true);
      await refreshFriends();
    } else if (btn.classList.contains('friend-remove')) {
      await Social.removeFriend(btn.dataset.id);
      toast('Freund entfernt.', true);
      await refreshFriends();
    }
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

// ===================================================================== Screens

let authMode = 'login';
let authBound = false;

function renderAuthScreen(state = { mode: 'login' }) {
  authMode = state.mode || 'login';
  app.innerHTML = V.renderLogin(state);
  bindAuthDelegation();
  setTimeout(() => { const f = document.getElementById('auth-email'); if (f) f.focus(); }, 0);
}

function renderResetScreen(state = {}) {
  app.innerHTML = V.renderReset(state);
  bindAuthDelegation();
}

// Ein einziger Listener am Container – überlebt jedes Neuzeichnen (robust auf Mobil).
function bindAuthDelegation() {
  if (authBound) return;
  authBound = true;
  app.addEventListener('click', (ev) => {
    const link = ev.target.closest('#auth-toggle, #auth-forgot');
    if (!link) return;
    ev.preventDefault();
    if (link.id === 'auth-toggle') renderAuthScreen({ mode: authMode === 'login' ? 'signup' : 'login' });
    else doForgot();
  });
  app.addEventListener('submit', (ev) => {
    if (ev.target.id === 'auth-form') { ev.preventDefault(); doAuthSubmit(); }
    else if (ev.target.id === 'reset-form') { ev.preventDefault(); doReset(); }
  });
}

async function doForgot() {
  const email = ((document.getElementById('auth-email') || {}).value || '').trim();
  if (!email) {
    renderAuthScreen({ mode: 'login', error: 'Bitte zuerst deine E-Mail oben eintragen, dann „Passwort vergessen“ tippen.' });
    return;
  }
  toast('Sende E-Mail …', true);
  try {
    const { error } = await resetPassword(email);
    if (error) throw error;
    renderAuthScreen({ mode: 'login', email, info: 'E-Mail zum Zurücksetzen verschickt – schau ins Postfach (ggf. Spam).' });
  } catch (e) {
    renderAuthScreen({ mode: 'login', email, error: friendlyError(e) });
  }
}

async function doAuthSubmit() {
  const email = (document.getElementById('auth-email').value || '').trim();
  const password = document.getElementById('auth-password').value;
  const username = (document.getElementById('auth-username') || {}).value;
  renderAuthScreen({ mode: authMode, email, busy: true });
  try {
    if (authMode === 'signup') {
      const { data, error } = await signUp(email, password, (username || '').trim() || email.split('@')[0]);
      if (error) throw error;
      if (!data.session) {
        renderAuthScreen({ mode: 'login', email, error: 'Konto erstellt! Bitte E-Mail bestätigen (oder „Confirm email“ in Supabase deaktivieren), dann einloggen.' });
        return;
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) throw error;
    }
    await boot();
  } catch (e) {
    renderAuthScreen({ mode: authMode, email, error: friendlyError(e) });
  }
}

async function doReset() {
  const pw = document.getElementById('reset-password').value;
  renderResetScreen({ busy: true });
  try {
    const { error } = await updatePassword(pw);
    if (error) throw error;
    // Passwort gesetzt -> Nutzer ist eingeloggt, ins Spiel starten.
    const user = await currentUser();
    if (user) await startOnline(user);
    else renderAuthScreen({ mode: 'login', info: 'Passwort geändert. Bitte einloggen.' });
  } catch (e) {
    renderResetScreen({ error: friendlyError(e) });
  }
}

function renderErrorScreen(e) {
  app.innerHTML = `<div class="login-wrap"><div class="panel login-card">
    <h2>⚠️ Verbindungsproblem</h2>
    <div class="login-error">${friendlyError(e)}</div>
    <button id="err-retry" class="build-btn">Erneut versuchen</button>
    <button id="err-offline" class="ghost" style="margin-top:8px">Offline weiterspielen</button>
    <p class="muted small">Tipp: Stelle sicher, dass <code>supabase/schema.sql</code> im SQL-Editor ausgeführt wurde und der Email-Login aktiv ist.</p>
  </div></div>`;
  document.getElementById('err-retry').addEventListener('click', () => location.reload());
  document.getElementById('err-offline').addEventListener('click', () => startOffline());
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
    <div id="brand">
      <img src="assets/world/planet.png" class="logo" alt="" onerror="this.style.display='none'" />
      <span>NEXARION <small>Stellar Dominion</small></span>
      <button id="install-btn" class="ghost" hidden>⬇️ Installieren</button>
    </div>
    <header id="topbar"></header>
    <nav id="tabs"></nav>
    <main id="view"></main>
    <footer id="footer">
      <span class="muted" id="who">${userInfo ? '👤 ' + (userInfo.username || userInfo.email) : 'Offline-Modus (lokal gespeichert)'}</span>
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

  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    if (deferredPrompt) installBtn.hidden = false;
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch { /* egal */ }
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  }

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
    .filter(([key]) => key !== 'admin' || isAdmin)
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
  if (activeTab === 'alliance') await refreshAlliance();
  if (activeTab === 'friends') await refreshFriends();
  if (activeTab === 'admin') await refreshAdmin();
}

function onViewClick(ev) {
  const btn = ev.target.closest('button');
  if (!btn) return;

  // Soziale Aktionen (Allianz/Freunde)
  if (
    btn.id === 'create-alliance' || btn.id === 'leave-alliance' || btn.id === 'add-friend' ||
    btn.classList.contains('join-alliance') || btn.classList.contains('friend-accept') ||
    btn.classList.contains('friend-decline') || btn.classList.contains('friend-remove')
  ) {
    doSocial(btn);
    return;
  }

  if (btn.id === 'pf-save-name') { doSaveName(); return; }
  if (btn.id === 'pf-save-planet') { doSavePlanet(); return; }
  if (btn.id === 'pf-logout') { doLogout(); return; }
  if (btn.id === 'booster-btn') { doBooster(); return; }
  if (btn.classList.contains('skip')) { doSkip(+btn.dataset.cost, btn.dataset.kind); return; }
  if (btn.id === 'admin-grant') { doAdminGrant(); return; }
  if (btn.id === 'admin-refresh' || btn.classList.contains('admin-gift') ||
      btn.classList.contains('admin-xp') || btn.classList.contains('admin-level') ||
      btn.classList.contains('admin-ban') || btn.classList.contains('admin-unban')) {
    doAdmin(btn); return;
  }

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

  // Echten Spieler ins Angriffs-Formular übernehmen
  if (btn.classList.contains('attack-player')) {
    dispatch.g = +btn.dataset.g; dispatch.s = +btn.dataset.s; dispatch.p = +btn.dataset.p; dispatch.mission = 'attack';
    renderView();
    toast('Ziel gesetzt – Schiffe wählen und „Flotte starten".', true);
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
    // Ist das Ziel ein echter Spieler? -> server-seitiger PvP-Angriff
    const isPlayer = userInfo && mission === 'attack' &&
      players.some((p) => !p.is_self && p.galaxy === coords[0] && p.system === coords[1] && p.position === coords[2]);
    if (isPlayer) { doPvpAttack(coords, ships); return; }
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
