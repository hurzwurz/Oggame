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
let rankingData = { online: false };
let dailyData = { online: false };
let isAdmin = false;
let adminData = { online: false, isAdmin: false, players: [] };

let mapSel = null; // ausgewähltes Feld der Basis-Karte (Index) oder null
let mapMove = null; // Feld, das gerade versetzt wird (Index) oder null

const dispatch = { g: 1, s: 1, p: 1, mission: 'attack' };
const sim = {
  attacker: { tech: { weaponsTech: 0, shieldTech: 0, armorTech: 0 }, units: [{ id: 'lightFighter', count: 100, kind: 'ship' }] },
  defender: { tech: { weaponsTech: 0, shieldTech: 0, armorTech: 0 }, units: [{ id: 'rocketLauncher', count: 50, kind: 'defense' }] },
  result: null,
};

const TABS = {
  overview: { label: 'Übersicht', render: (g) => V.renderOverview(g) },
  base: { label: 'Basis', render: (g) => V.renderBase(g) },
  map: { label: '🗺️ Karte', render: (g) => V.renderBaseMap(g, mapSel, mapMove) },
  buildings: { label: 'Gebäude', render: (g) => V.renderBuildings(g) },
  research: { label: 'Forschung', render: (g) => V.renderResearch(g) },
  shipyard: { label: 'Werft', render: (g) => V.renderShipyard(g) },
  defense: { label: 'Verteidigung', render: (g) => V.renderDefense(g) },
  fleet: { label: 'Hangar', render: (g) => V.renderFleet(g) },
  galaxy: { label: 'Galaxie', render: (g) => V.renderGalaxy(g, dispatch, players) },
  movement: { label: 'Flotten', render: (g) => V.renderMovements(g) },
  reports: { label: 'Berichte', render: (g) => V.renderReports(g) },
  ranking: { label: '🏆 Rangliste', render: () => V.renderRanking(rankingData) },
  daily: { label: '📅 Battle Pass', render: () => V.renderDaily(dailyData, game) },
  officers: { label: '👥 Mitarbeiter', render: (g) => V.renderOfficers(g) },
  quests: { label: '🎯 Quests', render: (g) => V.renderQuests(g) },
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
const LIVE_TABS = new Set(['overview', 'base', 'movement', 'reports', 'buildings', 'research', 'daily']);
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

// Beim Zurückkehren in die App: Stand frisch vom Server holen (DB ist maßgeblich).
let lastReload = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && userInfo && Date.now() - lastReload > 4000) {
    lastReload = Date.now();
    reloadFromServer();
  }
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
  // Admin/Inhaber zuerst bestimmen – ein Admin kann NIE ausgesperrt werden.
  try { isAdmin = await Coins.amIAdmin(); } catch { isAdmin = false; }
  // Gesperrte Accounts blockieren (Admins ausgenommen).
  if (!isAdmin) {
    try {
      if (await Coins.isBanned(user.id)) { app.innerHTML = V.renderBanned(); return; }
    } catch { /* ignorieren, falls Spalte/Funktion fehlt */ }
  }
  const row = await ensureHomePlanet(user.id);
  cloudSaver = makeCloudSaver(row.id, user.id);
  game = new Game({ initialState: buildInitialState(row, user.id), onSave: cloudSaver.onSave });
  userInfo = { id: user.id, email: user.email, planetId: row.id };
  dispatch.g = row.galaxy; dispatch.s = row.system; dispatch.p = row.position;
  game.coins = 0; // Online-Marker (aktiviert Coins-Anzeige/Skip)
  await refreshPlayers();
  try { game.coins = await Coins.getCoins(); } catch (e) { console.warn('Coins:', e.message || e); }
  try {
    const god = (await Coins.getSetting('god_build')) === 'true';
    game.freeBuild = god; game.freeTime = god; game.freeQueue = god;
  } catch { /* Standard: alle Limits an */ }
  try {
    const pr = await Social.getProfile(user.id);
    if (pr) {
      userInfo.username = pr.username;
      userInfo.points = pr.points || 0;
      game.state.xp = Math.max(game.state.xp || 0, pr.points || 0); // Server-Punkte (z. B. Admin) übernehmen
    }
  } catch { /* Name optional */ }
  await mergeServerReports();
  startGameUI();
  // Bei Logout/Token-Verlust zurück zum Login.
  onAuthChange((u) => { if (!u) location.reload(); });
}

// Schreibt den aktuellen Stand SOFORT in die DB (statt erst nach Debounce).
function persistNow() {
  if (cloudSaver) cloudSaver.flush();
}

// Holt den Planeten frisch vom Server und übernimmt ihn (DB ist maßgeblich).
// Fleets/Berichte/Trümmer bleiben lokal.
async function reloadFromServer() {
  if (!userInfo || !game) return;
  try {
    const row = await ensureHomePlanet(userInfo.id);
    const s = game.state;
    s.planetName = row.name;
    s.resources = { metal: 0, crystal: 0, deuterium: 0, gold: 0, titan: 0, ...(row.resources || {}) };
    s.buildings = row.buildings || {};
    s.research = row.research || {};
    s.ships = row.ships || {};
    s.defenses = row.defenses || {};
    s.queues = row.queues && Array.isArray(row.queues.shipyard)
      ? row.queues : { building: null, building2: null, research: null, shipyard: [] };
    if (!('building2' in s.queues)) s.queues.building2 = null;
    s.lastTick = Date.parse(row.last_update) || Date.now();
    game.tick(); // Offline-Produktion nachholen
    try { game.coins = await Coins.getCoins(); } catch { /* optional */ }
    try { const pr = await Social.getProfile(userInfo.id); if (pr) s.xp = Math.max(s.xp || 0, pr.points || 0); } catch { /* optional */ }
    if (topbarEl) topbarEl.innerHTML = V.renderTopbar(game);
    renderView();
  } catch (e) {
    console.warn('Server-Reload:', e.message || e);
  }
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
    const ranking = await Social.allianceRanking().catch(() => []);
    const messages = membership ? await Social.allianceMessages(membership.alliance_id).catch(() => []) : [];
    allianceData = { online: true, membership, members, alliances, ranking, messages };
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
    persistNow();
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
    persistNow();
    toast('Sofort fertiggestellt.', true);
    renderView();
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

// Bricht einen laufenden Auftrag ab – 30 % der Ressourcen zurück.
function doCancel(btn) {
  if (!confirm('Auftrag abbrechen? Du bekommst nur 30 % der Ressourcen zurück.')) return;
  const what = btn.dataset.cancel;
  const idx = parseInt(btn.dataset.index, 10) || 0;
  let res;
  if (what === 'building') res = game.cancelBuilding(btn.dataset.slot || 'building');
  else if (what === 'research') res = game.cancelResearch();
  else if (what === 'shipyard') res = game.cancelShipyard(idx);
  else if (what === 'buildingQueue') res = game.cancelBuildingQueue(idx);
  else if (what === 'researchQueue') res = game.cancelResearchQueue(idx);
  else return;
  if (res && res.ok) { toast('Abgebrochen – 30 % zurückerstattet.', true); persistNow(); }
  else toast((res && res.error) || 'Abbruch nicht möglich.', false);
  renderView();
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

// Lädt erlittene Angriffe/Spionage (Server-Berichte) und mischt sie in die Liste.
async function mergeServerReports() {
  if (!userInfo || !game) return;
  try {
    const rows = await Pvp.loadReports();
    const srv = rows
      .filter((r) => r.type === 'pvp_defense' || r.type === 'spied')
      .map((rw) => ({ id: 'srv:' + rw.id, time: Date.parse(rw.created_at) || Date.now(), type: rw.type, ...(rw.payload || {}) }));
    const local = game.state.reports.filter((r) => !(typeof r.id === 'string' && r.id.startsWith('srv:')));
    game.state.reports = [...srv, ...local].sort((a, b) => b.time - a.time).slice(0, 50);
  } catch (e) {
    console.warn('Server-Berichte:', e.message || e);
  }
}

// Verarbeitet fliegende PvP-Flotten: Auflösung bei Ankunft (Server), Rückkehr.
let pvpBusy = false;
async function processPvpFleets() {
  if (!userInfo || !game || pvpBusy) return;
  const now = Date.now();
  // 1) Eine fällige Auflösung pro Durchlauf (vermeidet parallele Server-Aufrufe)
  const due = game.state.fleets.find((f) => f.pvp && f.phase === 'outbound' && now >= f.arriveAt && !f.resolving);
  if (due) {
    due.resolving = true;
    pvpBusy = true;
    try {
      if (due.mission === 'pvp_spy') {
        const d = await Pvp.spyPlayer(due.target);
        game.state.reports.unshift({
          id: game.state.fleetSeq++, time: Date.now(), type: 'espionage',
          target: due.target, targetName: d.name, resources: d.resources, fleet: d.ships, defense: d.defenses,
        });
        toast('Spionagebericht erhalten.', true);
      } else {
        const res = await Pvp.resolvePvpAttack(due.target, due.ships);
        due.ships = res.survivors || {};
        const loot = res.loot || {};
        due.cargo.metal += loot.metal || 0; due.cargo.crystal += loot.crystal || 0; due.cargo.deuterium += loot.deuterium || 0;
        game.state.reports.unshift({
          id: game.state.fleetSeq++, time: Date.now(), type: 'pvp_attack',
          target: due.target, winner: res.winner, loot,
        });
        if (Object.values(due.ships).every((n) => n <= 0)) due.lost = true;
        if (res.winner === 'attacker') {
          const lt = (loot.metal || 0) + (loot.crystal || 0) + (loot.deuterium || 0);
          game.recordCombatWin(400 + Math.floor(lt / 30)); // PvP-Siege geben mehr XP
        }
        try { game.coins = await Coins.getCoins(); } catch { /* optional */ }
        toast(`PvP: ${res.winner === 'attacker' ? 'Sieg!' : res.winner === 'defender' ? 'Niederlage' : 'Unentschieden'}`, res.winner === 'attacker');
      }
      due.phase = 'returning';
    } catch (e) {
      toast(friendlyError(e), false);
      due.phase = 'returning'; // bei Fehler Flotte heimkehren lassen
    } finally {
      due.resolving = false; pvpBusy = false;
      game.save();
      if (activeTab === 'movement' || activeTab === 'reports') renderView();
    }
  }
  // 2) Rückkehr abgeschlossener PvP-Flotten
  let changed = false;
  for (const f of game.state.fleets) {
    if (f.pvp && f.phase === 'returning' && now >= f.returnAt && !f._done) {
      f._done = true; changed = true;
      if (!f.lost) {
        for (const [id, n] of Object.entries(f.ships)) if (n > 0) game.state.ships[id] = (game.state.ships[id] || 0) + n;
        const cap = game.capacities();
        const r = game.state.resources;
        r.metal = Math.min(cap.metal, r.metal + (f.cargo.metal || 0));
        r.crystal = Math.min(cap.crystal, r.crystal + (f.cargo.crystal || 0));
        r.deuterium = Math.min(cap.deuterium, r.deuterium + (f.cargo.deuterium || 0));
        game.state.reports.unshift({ id: game.state.fleetSeq++, time: Date.now(), type: 'return', targetName: f.targetName, mission: f.mission, cargo: f.cargo });
      }
    }
  }
  if (changed) {
    game.state.fleets = game.state.fleets.filter((f) => !f._done);
    game.save();
  }
}

async function refreshRanking() {
  if (!userInfo) { rankingData = { online: false }; if (activeTab === 'ranking') renderView(); return; }
  rankingData = { online: true, loading: true };
  if (activeTab === 'ranking') renderView();
  try {
    const players = await Social.playerRanking().catch(() => []);
    const alliances = await Social.allianceRanking().catch(() => []);
    rankingData = { online: true, players, alliances, me: userInfo.username };
  } catch (e) {
    rankingData = { online: true, error: friendlyError(e) };
  }
  if (activeTab === 'ranking') renderView();
}

async function refreshDaily() {
  if (!userInfo) { dailyData = { online: false }; if (activeTab === 'daily') renderView(); return; }
  dailyData = { online: true, loading: true };
  if (activeTab === 'daily') renderView();
  try {
    const st = await Coins.dailyStatus();
    dailyData = { online: true, streak: (st && st.streak) || 0, claimable: !!(st && st.claimable) };
  } catch (e) {
    dailyData = { online: true, streak: 0, claimable: false, error: friendlyError(e) };
  }
  if (activeTab === 'daily') renderView();
}

async function doClaimDaily() {
  try {
    const res = await Coins.claimDaily();
    if (res && res.already) { toast('Heute schon abgeholt – komm morgen wieder!', false); }
    else {
      try { game.coins = await Coins.getCoins(); } catch { /* optional */ }
      if (topbarEl) topbarEl.innerHTML = V.renderTopbar(game);
      toast(`🎁 +${(res && res.reward_coins) || 0} Coins! Streak: ${(res && res.streak) || 1} Tag(e).`, true);
    }
    await refreshDaily();
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

async function doHireOfficer(btn) {
  const id = btn.dataset.id;
  const cost = parseInt(btn.dataset.cost, 10) || 0;
  try {
    game.coins = await Coins.spendCoins(cost);
    const res = game.upgradeOfficer(id);
    if (!res.ok) { toast(res.error || 'Nicht möglich.', false); return; }
    persistNow();
    if (topbarEl) topbarEl.innerHTML = V.renderTopbar(game);
    toast(`Mitarbeiter angeheuert (Stufe ${res.level}).`, true);
    renderView();
  } catch (e) {
    toast(friendlyError(e), false);
  }
}

function doClaimQuest(btn) {
  const res = game.claimQuest(btn.dataset.id);
  if (!res.ok) { toast(res.error || 'Nicht möglich.', false); return; }
  persistNow();
  if (topbarEl) topbarEl.innerHTML = V.renderTopbar(game);
  const rw = res.reward || {};
  toast(`🎁 Quest abgeschlossen! +${rw.xp ? fmtNum(rw.xp) + ' XP' : 'Belohnung'}`, true);
  renderView();
}

function fmtNum(n) { return (n || 0).toLocaleString('de'); }

function doClaimPlaytime() {
  const res = game.claimPlaytime();
  if (!res.ok) { toast(res.error || 'Noch nicht bereit.', false); return; }
  persistNow();
  if (topbarEl) topbarEl.innerHTML = V.renderTopbar(game);
  toast(`🎁 Spielzeit-Paket ${res.step}: +${res.metal.toLocaleString('de')} Metall & XP!`, true);
  renderView();
}

async function doBuySpeed() {
  try {
    game.coins = await Coins.spendCoins(V.SPEED_COST);
    game.activateSpeed(300, 0.3);
    persistNow();
    toast('⚡ Speed-Gutschein aktiv: 70 % schneller bauen für 5 Min!', true);
    if (topbarEl) topbarEl.innerHTML = V.renderTopbar(game);
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
    const players = await Coins.adminListPlayers();
    const godBuild = (await Coins.getSetting('god_build')) === 'true';
    adminData = { online: true, isAdmin: true, players, godBuild, meEmail: userInfo.email };
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
  const isSelf = !!(userInfo && user === userInfo.username);
  const syncTopbar = () => { if (topbarEl) topbarEl.innerHTML = V.renderTopbar(game); };
  try {
    if (btn.id === 'admin-refresh') return refreshAdmin();
    if (btn.classList.contains('admin-gift')) {
      const n = askNum(`Wie viele Coins für ${user}? (negativ = abziehen)`, 100);
      if (n === null) return;
      const bal = await Coins.adminGrant(user, n);
      if (isSelf && game) { game.coins = bal; syncTopbar(); }
      toast(`${user}: ${bal} Coins.${isSelf ? '' : ' (Spieler muss neu laden)'}`, true);
      return refreshAdmin();
    }
    if (btn.classList.contains('admin-xp')) {
      const n = askNum(`XP/Punkte für ${user} setzen auf:`, 0);
      if (n === null) return;
      await Coins.adminSetPoints(user, n);
      if (isSelf && game) { game.state.xp = Math.max(0, n); game.save(); persistNow(); syncTopbar(); }
      toast(`${user}: XP gesetzt auf ${n}.${isSelf ? '' : ' (Spieler muss neu laden)'}`, true);
      return refreshAdmin();
    }
    if (btn.classList.contains('admin-level')) {
      const n = askNum(`Level für ${user} setzen auf:`, 1);
      if (n === null) return;
      await Coins.adminSetLevel(user, n);
      if (isSelf && game) { game.state.xp = 100 * Math.pow(Math.max(1, n) - 1, 2); game.save(); persistNow(); syncTopbar(); }
      toast(`${user}: Level ${n} gesetzt.${isSelf ? '' : ' (Spieler muss neu laden)'}`, true);
      return refreshAdmin();
    }
    if (btn.classList.contains('admin-res')) {
      const k = btn.dataset.kind;
      const names = { metal: 'Metall', crystal: 'Kristall', deuterium: 'Deuterium', gold: 'Gold', titan: 'Titan' };
      const n = askNum(`${names[k] || k} für ${user} (negativ = abziehen):`, 1000);
      if (n === null) return;
      await Coins.adminAddResource(user, k, n);
      if (isSelf && game) { game.state.resources[k] = Math.max(0, (game.state.resources[k] || 0) + n); game.save(); persistNow(); syncTopbar(); }
      toast(`${user}: ${n >= 0 ? '+' : ''}${n} ${names[k] || k}.${isSelf ? '' : ' (Spieler muss neu laden)'}`, true);
      return refreshAdmin();
    }
    if (btn.id === 'admin-godbuild') {
      const on = adminData.godBuild ? 'false' : 'true';
      await Coins.adminSetSetting('god_build', on);
      const god = on === 'true';
      if (game) { game.freeBuild = god; game.freeTime = god; game.freeQueue = god; }
      toast(`Bau-Limits ${god ? 'AUS (gratis · sofort · unbegrenzt)' : 'AN (normal)'}.`, true);
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
    } else if (btn.id === 'al-send') {
      const input = viewEl.querySelector('#al-msg');
      const body = ((input && input.value) || '').trim();
      if (!body) return;
      await Social.sendAllianceMessage(allianceData.membership.alliance_id, userInfo.id, userInfo.username || 'Spieler', body);
      await refreshAlliance();
    } else if (btn.id === 'al-chat-refresh') {
      await refreshAlliance();
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
  mapSel = null; mapMove = null; // Kartenauswahl/Versetzen beim Tabwechsel zurücksetzen
  renderTabs();
  renderView();
  // Galaxie online: Spielerliste aktualisieren.
  if (activeTab === 'galaxy' && userInfo) {
    await refreshPlayers();
    if (activeTab === 'galaxy') renderView();
  }
  if (activeTab === 'alliance') await refreshAlliance();
  if (activeTab === 'friends') await refreshFriends();
  if (activeTab === 'ranking') await refreshRanking();
  if (activeTab === 'daily') await refreshDaily();
  if (activeTab === 'admin') await refreshAdmin();
  if (activeTab === 'reports' && userInfo) { await mergeServerReports(); renderView(); }
}

function onViewClick(ev) {
  const btn = ev.target.closest('button');
  if (!btn) return;

  // Soziale Aktionen (Allianz/Freunde)
  if (
    btn.id === 'create-alliance' || btn.id === 'leave-alliance' || btn.id === 'add-friend' ||
    btn.classList.contains('join-alliance') || btn.classList.contains('friend-accept') ||
    btn.classList.contains('friend-decline') || btn.classList.contains('friend-remove') ||
    btn.id === 'al-send' || btn.id === 'al-chat-refresh'
  ) {
    doSocial(btn);
    return;
  }

  if (btn.id === 'pf-save-name') { doSaveName(); return; }
  if (btn.id === 'pf-save-planet') { doSavePlanet(); return; }
  if (btn.id === 'pf-logout') { doLogout(); return; }
  if (btn.id === 'booster-btn') { doBooster(); return; }
  if (btn.id === 'claim-daily') { doClaimDaily(); return; }
  if (btn.id === 'claim-playtime') { doClaimPlaytime(); return; }
  if (btn.id === 'buy-speed') { doBuySpeed(); return; }
  if (btn.classList.contains('hire-officer')) { doHireOfficer(btn); return; }
  if (btn.classList.contains('claim-quest')) { doClaimQuest(btn); return; }

  // Basis-Karte: Feld wählen / platzieren / ausbauen / versetzen / abreißen
  if (btn.classList.contains('plot')) {
    const i = +btn.dataset.plot;
    if (mapMove != null) { // Im Versetzen-Modus: Zielfeld gewählt
      const res = game.movePlot(mapMove, i);
      toast(res.ok ? 'Gebäude versetzt.' : (res.error || 'Versetzen nicht möglich.'), res.ok);
      if (res.ok) persistNow();
      mapMove = null; mapSel = null; renderView();
      return;
    }
    mapSel = i; renderView();
    return;
  }
  if (btn.classList.contains('map-deselect')) { mapSel = null; renderView(); return; }
  if (btn.classList.contains('map-move')) { mapMove = +btn.dataset.plot; mapSel = null; toast('Tippe ein freies Feld als Ziel.', true); renderView(); return; }
  if (btn.classList.contains('map-move-cancel')) { mapMove = null; renderView(); return; }
  if (btn.classList.contains('map-demolish')) {
    const plot = +btn.dataset.plot;
    if (!confirm(`„${btn.dataset.name}" wirklich abreißen? Du bekommst 30 % der Baukosten zurück.`)) return;
    const res = game.demolishPlot(plot);
    if (res.ok) { toast('Gebäude abgerissen – 30 % zurück.', true); persistNow(); mapSel = null; }
    else toast(res.error || 'Abreißen nicht möglich.', false);
    renderView();
    return;
  }
  if (btn.classList.contains('place-pick')) {
    const res = game.placeBuilding(+btn.dataset.plot, btn.dataset.id);
    if (res.ok) { toast(res.queued ? 'In die Warteschlange gestellt.' : 'Gebäude platziert – wird gebaut.', true); persistNow(); mapSel = null; }
    else toast(res.error || 'Platzieren nicht möglich.', false);
    renderView();
    return;
  }
  if (btn.classList.contains('map-upgrade')) {
    const res = game.buildBuilding(btn.dataset.id);
    if (res.ok) { toast(res.queued ? 'In die Warteschlange gestellt.' : 'Ausbau gestartet.', true); persistNow(); }
    else toast(res.error || 'Ausbau nicht möglich.', false);
    renderView();
    return;
  }
  if (btn.classList.contains('skip')) { doSkip(+btn.dataset.cost, btn.dataset.kind); return; }
  if (btn.id === 'admin-grant') { doAdminGrant(); return; }
  if (btn.classList.contains('cancel-build')) { doCancel(btn); return; }
  if (btn.id === 'admin-refresh' || btn.id === 'admin-godbuild' || btn.classList.contains('admin-gift') ||
      btn.classList.contains('admin-xp') || btn.classList.contains('admin-level') ||
      btn.classList.contains('admin-res') ||
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
    if (result.ok) {
      const msg = result.queued ? 'In die Warteschlange gestellt.' : `Auftrag erteilt${result.amount ? ` (${result.amount}×)` : ''}.`;
      toast(msg, true); persistNow();
    }
    else toast(result.error || 'Aktion nicht möglich.', false);
    renderView();
    return;
  }

  if (btn.classList.contains('pick-target')) {
    dispatch.g = +btn.dataset.g; dispatch.s = +btn.dataset.s; dispatch.p = +btn.dataset.p;
    renderView();
    return;
  }

  // Trümmerfeld ins Formular übernehmen (Recyceln)
  if (btn.classList.contains('recycle-target')) {
    dispatch.g = +btn.dataset.g; dispatch.s = +btn.dataset.s; dispatch.p = +btn.dataset.p; dispatch.mission = 'recycle';
    renderView();
    toast('Ziel gesetzt – Recycler wählen und „Flotte starten".', true);
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
    // Ist das Ziel ein echter Spieler? -> PvP-Flotte mit Flugzeit
    const isPlayer = userInfo &&
      players.some((p) => !p.is_self && p.galaxy === coords[0] && p.system === coords[1] && p.position === coords[2]);
    if (isPlayer && (mission === 'attack' || mission === 'espionage')) {
      const res = game.sendPvpFleet(mission === 'attack' ? 'attack' : 'spy', coords, ships);
      if (res.ok) { toast(mission === 'attack' ? 'Angriffsflotte gestartet.' : 'Spionageflotte gestartet.', true); activeTab = 'movement'; renderTabs(); }
      else toast(res.error || 'Start nicht möglich.', false);
      renderView();
      return;
    }
    const res = game.sendFleet(mission, coords, ships, cargo);
    if (res.ok) { toast('Flotte gestartet.', true); activeTab = 'movement'; renderTabs(); persistNow(); }
    else toast(res.error || 'Start nicht möglich.', false);
    renderView();
    return;
  }

  if (btn.classList.contains('recall')) {
    game.recallFleet(+btn.dataset.id);
    toast('Flotte kehrt um.', true);
    persistNow();
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
  if (userInfo) processPvpFleets(); // PvP-Flotten serverseitig auflösen
  topbarEl.innerHTML = V.renderTopbar(game);
  if (LIVE_TABS.has(activeTab)) viewEl.innerHTML = TABS[activeTab].render(game);
}

boot();
