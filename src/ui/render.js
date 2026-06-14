// Rendering der Oberfläche. Reine View-Funktionen + Event-Delegation.

import { BUILDINGS, BUILDING_MAP } from '../data/buildings.js';
import { RESEARCH, RESEARCH_MAP } from '../data/research.js';
import { SHIPS, SHIP_MAP, SHIP_CLASSES } from '../data/ships.js';
import { DEFENSES, DEFENSE_MAP } from '../data/defenses.js';
import { OFFICERS, officerCost } from '../data/officers.js';
import * as F from '../engine/formulas.js';
import * as G from '../data/galaxy.js';
import { getIcon } from '../data/icons.js';

export const BOOSTER_COST = 100; // Coins für 1 Std Booster

// Bild mit Emoji-Fallback. Das Bild ist standardmäßig sichtbar (kein onload nötig);
// nur falls die Datei fehlt, blendet onerror auf das Emoji um.
export function thumbHtml(folder, id, emoji) {
  return `<span class="thumb hasimg"><img class="thumb-img" src="assets/${folder}/${id}.png" alt="" loading="lazy" onerror="this.style.display='none';var e=this.parentNode.querySelector('.thumb-emoji');if(e)e.style.display='inline-flex';"><span class="thumb-emoji">${emoji}</span></span>`;
}

// ------------------------------------------------------------------ Formatierung

export function fmt(n) {
  n = Math.floor(n);
  return n.toLocaleString('de-DE');
}

export function fmtTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}t`);
  if (h || d) parts.push(`${h}h`);
  if (m || h || d) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function costLine(cost) {
  const parts = [];
  if (cost.metal) parts.push(`<span class="c-metal">${fmt(cost.metal)} M</span>`);
  if (cost.crystal) parts.push(`<span class="c-crystal">${fmt(cost.crystal)} K</span>`);
  if (cost.deuterium) parts.push(`<span class="c-deut">${fmt(cost.deuterium)} D</span>`);
  if (cost.energy) parts.push(`<span class="c-energy">${fmt(cost.energy)} E</span>`);
  return parts.join(' · ') || '–';
}

function reqLine(def, game) {
  const missing = F.missingRequirements(def, game.state, (id) => game.nameOf(id));
  if (missing.length === 0) return '';
  return `<div class="req">Benötigt: ${missing.join(', ')}</div>`;
}

// -------------------------------------------------------------------- Topbar

export function renderTopbar(game) {
  const r = game.resources;
  const cap = game.capacities();
  const prod = game.production();
  const e = game.energy();
  const cell = (icon, label, val, capVal, perH, cls) => {
    const full = capVal && val >= capVal;
    return `<div class="res ${cls}${full ? ' full' : ''}">
      <span class="res-label">${icon} ${label}</span>
      <span class="res-val">${fmt(val)}${capVal ? ` / ${fmt(capVal)}` : ''}</span>
      <span class="res-rate">${perH >= 0 ? '+' : ''}${fmt(perH)}/h</span>
    </div>`;
  };
  const lv = game.xpInfo ? game.xpInfo() : { level: 1, into: 0, need: 100 };
  const lvCell = `<div class="res c-xp">
      <span class="res-label">⭐ Level</span>
      <span class="res-val">${lv.level} / 150</span>
      <span class="res-rate">${lv.max ? 'MAX erreicht 🏆' : `XP ${fmt(lv.into)}/${fmt(lv.need)}`}</span>
    </div>`;
  return (
    lvCell +
    cell(getIcon('metal'), 'Metall', r.metal, cap.metal, prod.metal, 'c-metal') +
    cell(getIcon('crystal'), 'Kristall', r.crystal, cap.crystal, prod.crystal, 'c-crystal') +
    cell(getIcon('deuterium'), 'Deuterium', r.deuterium, cap.deuterium, prod.deuterium, 'c-deut') +
    `<div class="res c-energy${e.ratio < 1 ? ' full' : ''}">
      <span class="res-label">${getIcon('energy')} Energie</span>
      <span class="res-val">${fmt(e.produced - e.consumed)}</span>
      <span class="res-rate">${fmt(e.produced)} / ${fmt(e.consumed)}</span>
    </div>` +
    (r.gold ? `<div class="res c-gold"><span class="res-label">${getIcon('gold')} Gold</span><span class="res-val">${fmt(r.gold)}</span><span class="res-rate">Sonderressource</span></div>` : '') +
    (r.titan ? `<div class="res c-titan"><span class="res-label">${getIcon('titan')} Titan</span><span class="res-val">${fmt(r.titan)}</span><span class="res-rate">Sonderressource</span></div>` : '') +
    (typeof game.coins === 'number'
      ? `<div class="res c-coin">
          <span class="res-label">🪙 Coins</span>
          <span class="res-val">${fmt(game.coins)}</span>
          <span class="res-rate">durch Kämpfe</span>
        </div>`
      : '')
  );
}

// ------------------------------------------------------------------ Übersicht

export function renderOverview(game) {
  const e = game.energy();
  const prod = game.production();
  const q = game.state.queues;
  const now = Date.now();

  const online = typeof game.coins === 'number';
  const thumbFor = (id, kind) => thumbHtml(kind === 'research' ? 'research' : 'buildings', id, getIcon(id, kind));
  const queueRow = (label, item, kind, slot) => {
    if (!item) return `<tr><td>${label}</td><td>–</td><td>–</td><td></td></tr>`;
    const remaining = (item.finishAt - now) / 1000;
    const cost = Math.max(1, Math.ceil(remaining / 300));
    const skip = online ? `<button class="skip" data-kind="${kind}" data-cost="${cost}">⏩ ${cost} 🪙</button>` : '';
    const cancel = `<button class="cancel-build ghost" data-cancel="${kind}" data-slot="${slot || kind}" title="Abbrechen – 30 % zurück">✖</button>`;
    return `<tr><td>${label}</td><td>${thumbFor(item.id, kind)} ${game.nameOf(item.id)}</td><td>${fmtTime(remaining)}</td><td>${skip} ${cancel}</td></tr>`;
  };

  let shipyardRows = '';
  if (q.shipyard.length === 0) {
    shipyardRows = `<tr><td>Werft</td><td>–</td><td>–</td></tr>`;
  } else {
    q.shipyard.forEach((job, i) => {
      const remaining =
        i === 0
          ? (job.nextAt - now) / 1000 + (job.remaining - 1) * job.perUnitSeconds
          : job.remaining * job.perUnitSeconds;
      const cancel = `<button class="cancel-build ghost" data-cancel="shipyard" data-index="${i}" title="Abbrechen – 30 % zurück">✖</button>`;
      const thumb = thumbHtml(DEFENSE_MAP[job.id] ? 'defenses' : 'ships', job.id, getIcon(job.id, job.kind));
      shipyardRows += `<tr><td>Werft</td><td>${thumb} ${game.nameOf(job.id)} ×${job.remaining}</td><td>${fmtTime(remaining)}</td><td>${cancel}</td></tr>`;
    });
  }

  const boostActive = game.boosterActive && game.boosterActive();
  const b2cancel = q.building2 ? `<button class="cancel-build ghost" data-cancel="building" data-slot="building2" title="Abbrechen – 30 % zurück">✖</button>` : '';
  const b2row = (boostActive || q.building2)
    ? `<tr><td>Gebäude 2</td><td>${q.building2 ? `${thumbFor(q.building2.id, 'building')} ${game.nameOf(q.building2.id)}` : '–'}</td><td>${q.building2 ? fmtTime((q.building2.finishAt - now) / 1000) : '–'}</td><td>${b2cancel}</td></tr>`
    : '';
  // Vorgemerkte Aufträge (Warteschlange) – mit Abbrechen.
  const pendRows = (list, label, kind) => (list || []).map((o, i) =>
    `<tr class="queued-row"><td>${label} <span class="muted small">#${i + 1}</span></td><td>${thumbFor(o.id, kind === 'researchQueue' ? 'research' : 'building')} ${game.nameOf(o.id)}</td><td class="muted">wartet…</td>
       <td><button class="cancel-build ghost" data-cancel="${kind}" data-index="${i}" title="Abbrechen – 30 % zurück">✖</button></td></tr>`).join('');
  const buildingQueueRows = pendRows(q.buildingQueue, 'Gebäude', 'buildingQueue');
  const researchQueueRows = pendRows(q.researchQueue, 'Forschung', 'researchQueue');
  const boosterBar = online
    ? `<div class="booster-bar">${boostActive
        ? `⚡ <b>Booster aktiv</b> – noch ${fmtTime(game.boosterRemaining())} · 2× Tempo + 2. Bauslot`
        : `<button id="booster-btn" class="build-btn">⚡ Booster aktivieren (1 Std · ${BOOSTER_COST} 🪙)</button> <span class="muted small">2 Gebäude gleichzeitig + doppeltes Bautempo</span>`}</div>`
    : '';

  return `
    <div class="panel">
      <h2>${thumbHtml('world', 'planet', '🪐')} ${game.state.planetName}</h2>
      ${boosterBar}
      <div class="grid2">
        <div>
          <h3>Produktion / Stunde</h3>
          <ul class="stats">
            <li><span class="c-metal">Metall</span><b>+${fmt(prod.metal)}</b></li>
            <li><span class="c-crystal">Kristall</span><b>+${fmt(prod.crystal)}</b></li>
            <li><span class="c-deut">Deuterium</span><b>+${fmt(prod.deuterium)}</b></li>
          </ul>
          <h3>Energie</h3>
          <ul class="stats">
            <li>Erzeugt<b>${fmt(e.produced)}</b></li>
            <li>Verbraucht<b>${fmt(e.consumed)}</b></li>
            <li>Effizienz<b>${Math.round(e.ratio * 100)} %</b></li>
          </ul>
        </div>
        <div>
          <h3>Warteschlangen</h3>
          <table class="queue">
            <thead><tr><th>Bereich</th><th>Auftrag</th><th>Restzeit</th><th></th></tr></thead>
            <tbody>
              ${queueRow('Gebäude', q.building, 'building', 'building')}
              ${b2row}
              ${buildingQueueRows}
              ${queueRow('Forschung', q.research, 'research', 'research')}
              ${researchQueueRows}
              ${shipyardRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    ${overviewBaseStrip(game)}`;
}

// Bild-Streifen der eigenen Gebäude für die Übersicht (zeigt die Asset-Grafiken).
function overviewBaseStrip(game) {
  const s = game.state;
  const built = BUILDINGS.filter((b) => (s.buildings[b.id] || 0) > 0);
  if (!built.length) return '';
  const buildingNow = s.queues.building ? s.queues.building.id : null;
  const tiles = built.map((b) => {
    const now = b.id === buildingNow ? ' building-now' : '';
    return `<div class="base-tile${now}">
      ${thumbHtml('buildings', b.id, getIcon(b.id, 'building'))}
      <div class="bt-name">${b.name}</div>
      <div class="bt-level">Stufe ${s.buildings[b.id]}${now ? ' · baut…' : ''}</div>
    </div>`;
  }).join('');
  return `<div class="panel">
      <h3>🏛️ Deine Anlagen</h3>
      <div class="base-grid">${tiles}</div>
    </div>`;
}

// --------------------------------------------------- Gebäude & Forschung (Stufen)

function levelCard(def, level, game, kind) {
  const cost = F.levelCost(def, level);
  const met = F.requirementsMet(def, game.state);
  const afford = F.canAfford(game.resources, cost);
  const time =
    kind === 'building'
      ? F.buildTimeSeconds(cost, game.state.buildings)
      : F.researchTimeSeconds(cost, game.state.buildings);
  const q = game.state.queues;
  // Wird genau DIESES Objekt gerade gebaut?
  const inProgressItem = kind === 'building'
    ? ((q.building && q.building.id === def.id && q.building) || (q.building2 && q.building2.id === def.id && q.building2))
    : (q.research && q.research.id === def.id && q.research);
  const busy = kind === 'building'
    ? !!q.building && !(game.boosterActive && game.boosterActive() && !q.building2)
    : !!q.research;
  // Wichtig: NUR fehlende Voraussetzungen/Ressourcen graut aus – nicht "busy".
  const disabled = !met || !afford;
  const ready = met && afford && !busy && !inProgressItem; // jetzt baubar
  const effTime = game.boosterActive && game.boosterActive() ? Math.ceil(time / 2) : time;
  const remaining = inProgressItem ? (inProgressItem.finishAt - Date.now()) / 1000 : 0;
  return `
    <div class="card ${disabled && !inProgressItem ? 'locked' : ''} ${ready ? 'ready' : ''} ${inProgressItem ? 'building-now' : ''}">
      <div class="card-head">
        <h4>${thumbHtml(kind === 'research' ? 'research' : 'buildings', def.id, getIcon(def.id, kind))} ${def.name}</h4>
        <span class="level">${ready ? '<span class="ready-tag">● baubar</span> ' : ''}Stufe ${level}</span>
      </div>
      <p class="desc">${def.desc}</p>
      <div class="cost">${costLine(cost)}</div>
      <div class="meta">⏱ ${fmtTime(effTime)}${effTime !== time ? ' <span class="c-coin">(Booster)</span>' : ''}</div>
      ${reqLine(def, game)}
      ${inProgressItem
        ? `<div class="build-row"><button class="build-btn building-timer" disabled>⏳ ${fmtTime(remaining)}</button>
           <button class="cancel-build ghost" data-cancel="${kind}" data-slot="${kind === 'building' ? (q.building && q.building.id === def.id ? 'building' : 'building2') : 'research'}" title="Abbrechen – 30 % zurück">✖ Abbrechen</button></div>`
        : `<button class="build-btn" data-kind="${kind}" data-id="${def.id}" ${disabled ? 'disabled' : ''}>${busy ? '➕ Warteschlange' : (level === 0 ? 'Bauen' : 'Ausbauen')}</button>`}
    </div>`;
}

function buildableCount(defs, levels, game, kind) {
  return defs.filter((d) => {
    if (!F.requirementsMet(d, game.state)) return false;
    return F.canAfford(game.resources, F.levelCost(d, levels[d.id] || 0));
  }).length;
}

export function renderBuildings(game) {
  const n = buildableCount(BUILDINGS, game.state.buildings, game, 'building');
  return `<div class="buildable-note">🟢 <b>${n}</b> Gebäude jetzt baubar</div>
    <div class="cards">${BUILDINGS.map((b) =>
    levelCard(b, game.state.buildings[b.id] || 0, game, 'building')
  ).join('')}</div>`;
}

export function renderResearch(game) {
  if ((game.state.buildings.researchLab || 0) < 1) {
    return `<div class="panel"><p>Baue zuerst ein <b>Forschungslabor</b>, um Technologien zu erforschen.</p></div>`;
  }
  const n = buildableCount(RESEARCH, game.state.research, game, 'research');
  return `<div class="buildable-note">🟢 <b>${n}</b> Technologien jetzt erforschbar</div>
    <div class="cards">${RESEARCH.map((r) =>
    levelCard(r, game.state.research[r.id] || 0, game, 'research')
  ).join('')}</div>`;
}

// ----------------------------------------------------------- Schiffe & Verteidigung

function unitCard(def, owned, game, kind) {
  const met = F.requirementsMet(def, game.state);
  const hasYard = (game.state.buildings.shipyard || 0) >= 1;
  const disabled = !met || !hasYard;
  const s = def.stats;
  const statBits = [];
  statBits.push(`🛡 ${fmt(s.structure)}`);
  if (s.shield) statBits.push(`⚡ ${fmt(s.shield)}`);
  if (s.weapon) statBits.push(`⚔ ${fmt(s.weapon)}`);
  if (s.cargo) statBits.push(`📦 ${fmt(s.cargo)}`);
  if (s.speed) statBits.push(`🚀 ${fmt(s.speed)}`);
  return `
    <div class="card ${disabled ? 'locked' : ''}">
      <div class="card-head">
        <h4>${thumbHtml(kind === 'defense' ? 'defenses' : 'ships', def.id, getIcon(def.id, def.class || kind))} ${def.name}</h4>
        <span class="level">Anzahl: ${fmt(owned)}</span>
      </div>
      <p class="desc">${def.desc}</p>
      <div class="unit-stats">${statBits.join(' &nbsp; ')}</div>
      <div class="cost">${costLine(def.cost)}</div>
      ${reqLine(def, game)}
      <div class="build-row">
        <input type="number" min="1" value="1" class="amount" data-id="${def.id}" ${disabled ? 'disabled' : ''} />
        <button class="build-btn" data-kind="${kind}" data-id="${def.id}" data-unit="1" ${disabled ? 'disabled' : ''}>Bauen</button>
      </div>
    </div>`;
}

export function renderShipyard(game) {
  if ((game.state.buildings.shipyard || 0) < 1) {
    return `<div class="panel"><p>Baue zuerst eine <b>Raumschiffwerft</b> (benötigt Roboterfabrik Stufe 2).</p></div>`;
  }
  let html = '';
  for (const [cls, label] of Object.entries(SHIP_CLASSES)) {
    const group = SHIPS.filter((s) => s.class === cls);
    if (group.length === 0) continue;
    html += `<h3 class="group">${label}</h3><div class="cards">`;
    html += group.map((s) => unitCard(s, game.state.ships[s.id] || 0, game, 'ship')).join('');
    html += `</div>`;
  }
  return html;
}

export function renderDefense(game) {
  if ((game.state.buildings.shipyard || 0) < 1) {
    return `<div class="panel"><p>Baue zuerst eine <b>Raumschiffwerft</b>, um Verteidigung zu errichten.</p></div>`;
  }
  return `<div class="cards">${DEFENSES.map((d) =>
    unitCard(d, game.state.defenses[d.id] || 0, game, 'defense')
  ).join('')}</div>`;
}

// ----------------------------------------------------------------- Flotte / Hangar

export function renderFleet(game) {
  const rows = (map, store, title) => {
    const owned = Object.entries(store).filter(([, n]) => n > 0);
    if (owned.length === 0) return `<h3>${title}</h3><p class="muted">Noch nichts gebaut.</p>`;
    return (
      `<h3>${title}</h3><table class="queue"><thead><tr><th>Einheit</th><th>Anzahl</th></tr></thead><tbody>` +
      owned.map(([id, n]) => `<tr><td>${map[id] ? map[id].name : id}</td><td>${fmt(n)}</td></tr>`).join('') +
      `</tbody></table>`
    );
  };
  return `<div class="panel">
    ${rows(SHIP_MAP, game.state.ships, 'Schiffe')}
    ${rows(DEFENSE_MAP, game.state.defenses, 'Verteidigung')}
  </div>`;
}

// --------------------------------------------------------------- Hilfsfunktionen

function unitName(id) {
  return (SHIP_MAP[id] && SHIP_MAP[id].name) || (DEFENSE_MAP[id] && DEFENSE_MAP[id].name) || id;
}

export function coordFmt(c) {
  return `[${c[0]}:${c[1]}:${c[2]}]`;
}

function countList(map, sep = ', ') {
  const entries = Object.entries(map || {}).filter(([, n]) => n > 0);
  if (entries.length === 0) return '–';
  return entries.map(([id, n]) => `${unitName(id)} ×${fmt(n)}`).join(sep);
}

const MISSION_LABELS = { attack: 'Angriff', espionage: 'Spionage', expedition: 'Expedition', recycle: '♻️ Recyceln', pvp_attack: '⚔️ PvP-Angriff', pvp_spy: '🛰️ Spionage (Spieler)' };
// Nur diese Missionen sind im Flotten-Formular wählbar:
const DISPATCH_MISSIONS = { attack: 'Angriff', espionage: 'Spionage', expedition: 'Expedition', recycle: '♻️ Recyceln' };

// ----------------------------------------------------------------- Galaxie

export function renderGalaxy(game, dispatch, players = []) {
  const coords = [dispatch.g, dispatch.s, dispatch.p];
  const ownedShips = Object.entries(game.state.ships).filter(([, n]) => n > 0);

  const missionOpts = Object.entries(DISPATCH_MISSIONS)
    .map(([k, l]) => `<option value="${k}" ${dispatch.mission === k ? 'selected' : ''}>${l}</option>`)
    .join('');

  const shipInputs = ownedShips.length
    ? ownedShips
        .map(
          ([id, n]) => `<label class="ship-pick">
            <span>${SHIP_MAP[id].name} <small class="muted">(${fmt(n)})</small></span>
            <input type="number" min="0" max="${n}" value="0" class="fleet-ship" data-id="${id}" />
          </label>`
        )
        .join('')
    : `<p class="muted">Keine Schiffe vorhanden. Baue zuerst Schiffe in der Werft.</p>`;

  const form = `
    <div class="panel dispatch">
      <h3>Flotte entsenden</h3>
      <div class="dispatch-row">
        <label>Galaxie<input type="number" id="d-g" min="1" max="${G.GALAXY_COUNT}" value="${dispatch.g}" /></label>
        <label>System<input type="number" id="d-s" min="1" max="${G.SYSTEM_COUNT}" value="${dispatch.s}" /></label>
        <label>Position<input type="number" id="d-p" min="1" max="${G.POSITION_COUNT + 4}" value="${dispatch.p}" /></label>
        <label>Mission<select id="d-mission">${missionOpts}</select></label>
      </div>
      <div class="ship-grid">${shipInputs}</div>
      <div class="dispatch-row">
        <label>Ladung Metall<input type="number" id="c-metal" min="0" value="0" /></label>
        <label>Kristall<input type="number" id="c-crystal" min="0" value="0" /></label>
        <label>Deuterium<input type="number" id="c-deut" min="0" value="0" /></label>
      </div>
      <div id="dispatch-estimate" class="estimate muted"></div>
      <button id="send-fleet" class="build-btn" ${ownedShips.length ? '' : 'disabled'}>Flotte starten</button>
      <p class="muted small">Tipp: Position ${G.POSITION_COUNT + 1}–${G.POSITION_COUNT + 4} = leerer Raum für <b>Expeditionen</b>.</p>
    </div>`;

  // Zielliste nach System gruppiert
  const bySystem = {};
  for (const t of game.state.galaxy) {
    (bySystem[t.coords[1]] = bySystem[t.coords[1]] || []).push(t);
  }
  let list = '';
  for (const s of Object.keys(bySystem).sort((a, b) => a - b)) {
    list += `<h4 class="group">System ${s}</h4><table class="queue galaxy-tbl"><thead><tr>
      <th>Pos.</th><th>Name</th><th>Tier</th><th>Distanz</th><th></th></tr></thead><tbody>`;
    for (const t of bySystem[s].sort((a, b) => a.coords[2] - b.coords[2])) {
      const dist = G.distance(game.state.coords, t.coords);
      list += `<tr>
        <td>${t.coords[2]}</td>
        <td>${t.name}</td>
        <td>${'★'.repeat(Math.min(5, Math.ceil(t.tier / 2)))}<span class="muted"> T${t.tier}</span></td>
        <td>${fmt(dist)}</td>
        <td><button class="pick-target" data-g="${t.coords[0]}" data-s="${t.coords[1]}" data-p="${t.coords[2]}">Ziel wählen</button></td>
      </tr>`;
    }
    list += `</tbody></table>`;
  }

  let roster = '';
  if (players && players.length) {
    const rows = players
      .map(
        (p) => `<tr>
          <td>[${p.galaxy}:${p.system}:${p.position}]</td>
          <td>${p.name}</td>
          <td>${p.owner_name}${p.is_self ? ' <span class="win">(du)</span>' : ''}</td>
          <td>${fmt(p.points || 0)}</td>
          <td>${p.is_self ? '' : `<button class="attack-player" data-g="${p.galaxy}" data-s="${p.system}" data-p="${p.position}">⚔️ Angreifen</button>`}</td>
        </tr>`
      )
      .join('');
    roster = `<div class="panel">
      <h3>Spieler in der Galaxie <span class="muted small">(${players.length})</span></h3>
      <table class="queue"><thead><tr><th>Koord.</th><th>Planet</th><th>Spieler</th><th>Punkte</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="muted small">„Angreifen" setzt das Ziel im Formular oben – Schiffe wählen und „Flotte starten". Der Kampf wird serverseitig ausgetragen.</p>
    </div>`;
  }

  // Trümmerfelder (zum Recyceln)
  const debris = game.state.debris || {};
  const dkeys = Object.keys(debris).filter((k) => (debris[k].metal || 0) + (debris[k].crystal || 0) > 0);
  let debrisPanel = '';
  if (dkeys.length) {
    const drows = dkeys.map((k) => {
      const [g, s, p] = k.split(':');
      const d = debris[k];
      return `<tr><td>[${g}:${s}:${p}]</td><td class="c-metal">${fmt(d.metal || 0)} M</td><td class="c-crystal">${fmt(d.crystal || 0)} K</td>
        <td><button class="recycle-target" data-g="${g}" data-s="${s}" data-p="${p}">♻️ Recyceln</button></td></tr>`;
    }).join('');
    debrisPanel = `<div class="panel"><h3>♻️ Trümmerfelder</h3>
      <table class="queue"><thead><tr><th>Koord.</th><th>Metall</th><th>Kristall</th><th></th></tr></thead><tbody>${drows}</tbody></table>
      <p class="muted small">„Recyceln" setzt das Ziel oben – wähle Recycler-Schiffe und starte die Flotte.</p></div>`;
  }

  return form + roster + debrisPanel + `<div class="panel">${list}</div>`;
}

// ------------------------------------------------------------------ Login

export function renderLogin(state) {
  const { mode = 'login', error = '', info = '', busy = false, email = '' } = state;
  const isSignup = mode === 'signup';
  return `<div class="login-wrap">
    <div class="panel login-card">
      <h2>🚀 NEXARION</h2>
      <p class="muted">${isSignup ? 'Neues Imperium gründen' : 'Willkommen zurück, Kommandant.'}</p>
      ${error ? `<div class="login-error">${error}</div>` : ''}
      ${info ? `<div class="login-info">${info}</div>` : ''}
      <form id="auth-form">
        ${isSignup ? `<label>Spielername<input type="text" id="auth-username" autocomplete="username" required /></label>` : ''}
        <label>E-Mail<input type="email" id="auth-email" autocomplete="email" value="${email}" required /></label>
        <label>Passwort<input type="password" id="auth-password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" minlength="6" required /></label>
        <button type="submit" class="build-btn" ${busy ? 'disabled' : ''}>${busy ? 'Bitte warten…' : isSignup ? 'Registrieren' : 'Einloggen'}</button>
      </form>
      ${isSignup ? '' : '<p class="muted small"><a href="#" id="auth-forgot">Passwort vergessen?</a></p>'}
      <p class="muted small toggle-line">
        ${isSignup ? 'Schon ein Konto?' : 'Noch kein Konto?'}
        <a href="#" id="auth-toggle">${isSignup ? 'Einloggen' : 'Registrieren'}</a>
      </p>
    </div>
  </div>`;
}

/** Screen zum Setzen eines neuen Passworts (nach Klick auf den Recovery-Link). */
export function renderReset(state = {}) {
  const { error = '', info = '', busy = false } = state;
  return `<div class="login-wrap">
    <div class="panel login-card">
      <h2>🔑 Neues Passwort</h2>
      <p class="muted">Lege ein neues Passwort für dein Konto fest.</p>
      ${error ? `<div class="login-error">${error}</div>` : ''}
      ${info ? `<div class="login-info">${info}</div>` : ''}
      <form id="reset-form">
        <label>Neues Passwort<input type="password" id="reset-password" autocomplete="new-password" minlength="6" required /></label>
        <button type="submit" class="build-btn" ${busy ? 'disabled' : ''}>${busy ? 'Speichere…' : 'Passwort speichern'}</button>
      </form>
    </div>
  </div>`;
}

/** Live-Schätzung für Distanz / Flugzeit / Treibstoff (im Dispatch-Formular). */
export function flightEstimate(game, coords, ships) {
  const dist = G.distance(game.state.coords, coords);
  const speed = G.fleetSpeed(ships, game.state.research);
  if (speed <= 0) return `Distanz ${fmt(dist)} · keine flugfähige Flotte ausgewählt`;
  const ft = G.flightTime(dist, ships, game.state.research);
  const fuel = G.fuelCost(dist, ships);
  const cap = G.cargoCapacity(ships);
  return `Distanz ${fmt(dist)} · Flugzeit ${fmtTime(ft)} (einfach) · Treibstoff ${fmt(fuel)} Deut · Frachtraum ${fmt(cap)}`;
}

// ------------------------------------------------------------- Flottenbewegungen

export function renderMovements(game) {
  const fleets = game.state.fleets;
  if (fleets.length === 0) return `<div class="panel"><p class="muted">Keine Flotten unterwegs.</p></div>`;
  const now = Date.now();
  const rows = fleets
    .map((f) => {
      const arriving = f.phase === 'outbound';
      const eta = arriving ? (f.arriveAt - now) / 1000 : (f.returnAt - now) / 1000;
      return `<tr>
        <td>${MISSION_LABELS[f.mission] || f.mission}</td>
        <td>${f.targetName} ${coordFmt(f.target)}</td>
        <td>${countList(f.ships)}</td>
        <td>${arriving ? '→ unterwegs' : '← Rückflug'}</td>
        <td>${fmtTime(eta)}</td>
        <td>${arriving ? `<button class="recall" data-id="${f.id}">Rückruf</button>` : ''}</td>
      </tr>`;
    })
    .join('');
  return `<div class="panel"><table class="queue"><thead><tr>
    <th>Mission</th><th>Ziel</th><th>Flotte</th><th>Status</th><th>Ankunft</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ------------------------------------------------------------------ Berichte

export function renderReports(game) {
  const reports = game.state.reports;
  if (reports.length === 0) return `<div class="panel"><p class="muted">Noch keine Berichte.</p></div>`;
  return `<div class="reports">${reports.map(reportCard).join('')}</div>`;
}

function reportCard(r) {
  const t = new Date(r.time).toLocaleTimeString('de-DE');
  if (r.type === 'pvp_attack') {
    const v = r.winner === 'attacker' ? '<b class="win">Sieg!</b>' : r.winner === 'defender' ? '<b class="lose">Niederlage</b>' : '<b>Unentschieden</b>';
    const loot = (r.loot && (r.loot.metal || r.loot.crystal || r.loot.deuterium))
      ? `Beute: ${costLine(r.loot)}` : 'Keine Beute';
    return card(`⚔️ Angriff auf Spieler ${coordFmt(r.target)}`, t, `${v}<br>${loot}`);
  }
  if (r.type === 'spied') {
    return card('🛰️ Spionage entdeckt', t, `Du wurdest von ${coordFmt(r.from || [0, 0, 0])} ausspioniert.`);
  }
  if (r.type === 'pvp_defense') {
    const v = r.winner === 'defender' ? '<b class="win">Verteidigt!</b>' : r.winner === 'attacker' ? '<b class="lose">Geplündert!</b>' : '<b>Unentschieden</b>';
    const loot = (r.loot && (r.loot.metal || r.loot.crystal || r.loot.deuterium))
      ? `Verlust: ${costLine(r.loot)}` : 'Kein Verlust';
    return card(`🛡️ Angriff von ${coordFmt(r.from || [0, 0, 0])}`, t, `${v}<br>${loot}`);
  }
  if (r.type === 'attack') {
    if (r.empty) return card('Angriff', t, `Ziel ${coordFmt(r.target)} war leer – keine Beute.`);
    const verdict =
      r.winner === 'attacker' ? '<b class="win">Sieg!</b>' : r.winner === 'defender' ? '<b class="lose">Niederlage</b>' : '<b>Unentschieden</b>';
    const lootBits = (r.loot.metal || r.loot.crystal || r.loot.deuterium)
      ? `Beute: ${costLine({ metal: r.loot.metal, crystal: r.loot.crystal, deuterium: r.loot.deuterium })}`
      : 'Keine Beute';
    return card(
      `Angriff auf ${r.targetName} ${coordFmt(r.target)}`, t,
      `${verdict} nach ${r.rounds} Runden.<br>
       Eigene Verluste: ${countList(r.attackerLosses) || 'keine'}<br>
       Gegner verlor: ${countList({ ...r.defenderShipLosses, ...r.defenderDefenseLosses }) || 'nichts'}<br>
       ${lootBits}<br>Trümmerfeld: ${costLine({ metal: r.debris.metal, crystal: r.debris.crystal })}
       ${r.attackerWiped ? '<br><b class="lose">Deine Flotte wurde vernichtet!</b>' : ''}`
    );
  }
  if (r.type === 'espionage') {
    if (r.empty) return card('Spionage', t, `Ziel ${coordFmt(r.target)} ist unbewohnt.`);
    return card(
      `Spionage: ${r.targetName} ${coordFmt(r.target)}`, t,
      `Ressourcen: ${costLine(r.resources)}<br>
       Flotte: ${countList(r.fleet)}<br>
       Verteidigung: ${countList(r.defense)}`
    );
  }
  if (r.type === 'recycle') {
    const c = r.collected || {};
    const has = (c.metal || 0) + (c.crystal || 0) > 0;
    return card(`♻️ Recycling ${coordFmt(r.target)}`, t, has ? `Eingesammelt: ${costLine({ metal: c.metal, crystal: c.crystal })}` : 'Kein Trümmer gefunden.');
  }
  if (r.type === 'expedition') {
    const map = {
      resources: () => `Ressourcenfund: ${costLine(r.found)}`,
      ships: () => `Schiffe gefunden: ${countList(r.gained)}`,
      disaster: () => `<b class="lose">Katastrophe!</b> Verluste: ${countList(r.losses)}`,
      nothing: () => 'Nichts gefunden – die Weite des Alls bleibt still.',
    };
    return card('Expedition', t, (map[r.outcome] || map.nothing)());
  }
  if (r.type === 'return') {
    const c = r.cargo;
    const hasCargo = c.metal || c.crystal || c.deuterium;
    return card('Flotte zurückgekehrt', t,
      `Von ${r.targetName} (${MISSION_LABELS[r.mission] || r.mission}).${hasCargo ? `<br>Geladen: ${costLine(c)}` : ''}`);
  }
  return card('Bericht', t, '');
}

function card(title, time, body) {
  return `<div class="report-card">
    <div class="card-head"><h4>${title}</h4><span class="muted">${time}</span></div>
    <div class="report-body">${body}</div>
  </div>`;
}

// ------------------------------------------------------------------ Simulator

export function renderSimulator(sim) {
  const shipOpts = (selected) =>
    SHIPS.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${s.name}</option>`).join('');
  const defOpts = DEFENSES.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');

  const sideRows = (side, list) =>
    list.length
      ? list
          .map(
            (row, i) => `<tr>
        <td><select class="sim-unit" data-side="${side}" data-i="${i}">${
              row.kind === 'defense' ? defOpts.replace(`value="${row.id}"`, `value="${row.id}" selected`) : shipOpts(row.id)
            }</select></td>
        <td><input type="number" min="1" value="${row.count}" class="sim-count" data-side="${side}" data-i="${i}" /></td>
        <td><button class="sim-del" data-side="${side}" data-i="${i}">✕</button></td>
      </tr>`
          )
          .join('')
      : `<tr><td colspan="3" class="muted">Noch keine Einheiten.</td></tr>`;

  const techRow = (side) => `
    <div class="dispatch-row">
      <label>Waffen<input type="number" min="0" value="${sim[side].tech.weaponsTech}" class="sim-tech" data-side="${side}" data-tech="weaponsTech" /></label>
      <label>Schild<input type="number" min="0" value="${sim[side].tech.shieldTech}" class="sim-tech" data-side="${side}" data-tech="shieldTech" /></label>
      <label>Panzer<input type="number" min="0" value="${sim[side].tech.armorTech}" class="sim-tech" data-side="${side}" data-tech="armorTech" /></label>
    </div>`;

  return `
    <div class="sim-grid">
      <div class="panel">
        <h3>Angreifer</h3>
        ${techRow('attacker')}
        <table class="queue"><tbody>${sideRows('attacker', sim.attacker.units)}</tbody></table>
        <button class="sim-add" data-side="attacker" data-kind="ship">+ Schiff</button>
      </div>
      <div class="panel">
        <h3>Verteidiger</h3>
        ${techRow('defender')}
        <table class="queue"><tbody>${sideRows('defender', sim.defender.units)}</tbody></table>
        <button class="sim-add" data-side="defender" data-kind="ship">+ Schiff</button>
        <button class="sim-add" data-side="defender" data-kind="defense">+ Verteidigung</button>
      </div>
    </div>
    <div class="sim-actions">
      <button id="sim-run" class="build-btn">Schlacht simulieren</button>
    </div>
    <div id="sim-result">${sim.result ? simResult(sim.result) : ''}</div>`;
}

function simResult(r) {
  const verdict =
    r.winner === 'attacker' ? '<b class="win">Angreifer siegt</b>'
    : r.winner === 'defender' ? '<b class="lose">Verteidiger siegt</b>'
    : '<b>Unentschieden</b>';
  return `<div class="panel">
    <h3>Ergebnis – ${verdict} (${r.rounds} Runden)</h3>
    <div class="grid2">
      <div>
        <h4>Angreifer</h4>
        <p>Eingesetzt: ${countList(r.attacker.before)}</p>
        <p>Überlebt: ${countList(r.attacker.survivors) || '<span class="lose">vernichtet</span>'}</p>
      </div>
      <div>
        <h4>Verteidiger</h4>
        <p>Schiffe übrig: ${countList(r.defender.shipSurvivors) || 'keine'}</p>
        <p>Verteidigung übrig: ${countList(r.defender.defenseSurvivors) || 'keine'}</p>
      </div>
    </div>
    <p class="muted">Trümmerfeld: ${costLine({ metal: r.debris.metal, crystal: r.debris.crystal })}</p>
  </div>`;
}

// ------------------------------------------------------------------ Basis-Übersicht

export function renderBase(game) {
  const s = game.state;
  const built = BUILDINGS.filter((b) => (s.buildings[b.id] || 0) > 0);
  const buildingNow = s.queues.building ? s.queues.building.id : null;

  const shipCount = Object.values(s.ships).reduce((a, b) => a + b, 0);
  const defCount = Object.values(s.defenses).reduce((a, b) => a + b, 0);
  const fleetsOut = (s.fleets || []).length;

  const planetThumb = thumbHtml('world', 'planet', '🪐');

  let tiles;
  if (built.length === 0) {
    tiles = `<p class="muted">Noch keine Gebäude errichtet. Beginne im Tab <b>Gebäude</b> mit der Metallmine und einem Solarkraftwerk.</p>`;
  } else {
    tiles = `<div class="base-grid">` + built
      .map((b) => {
        const lvl = s.buildings[b.id];
        const now = b.id === buildingNow ? ' building-now' : '';
        return `<div class="base-tile${now}">
          ${thumbHtml('buildings', b.id, getIcon(b.id, 'building'))}
          <div class="bt-name">${b.name}</div>
          <div class="bt-level">Stufe ${lvl}${now ? ' · baut…' : ''}</div>
        </div>`;
      })
      .join('') + `</div>`;
  }

  return `
    <div class="panel base-head">
      ${planetThumb}
      <div>
        <h2 style="margin:0">${s.planetName}</h2>
        <div class="muted">${coordFmt(s.coords)}</div>
        <div class="base-stats">
          <span>🏗️ ${built.length} Gebäude</span>
          <span>🚀 ${fmt(shipCount)} Schiffe</span>
          <span>🛡️ ${fmt(defCount)} Verteidigung</span>
          <span>📡 ${fleetsOut} Flotten unterwegs</span>
        </div>
      </div>
    </div>
    <div class="panel">
      <h3>Anlagen & Fabriken</h3>
      ${tiles}
    </div>`;
}

// ------------------------------------------------------------------ Allianz

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function allianceRankingPanel(state) {
  const rows = (state.ranking || []).length
    ? state.ranking.map((a, i) => `<tr><td>${i + 1}</td><td>[${esc(a.tag)}] ${esc(a.name)}</td><td>${a.members}</td><td>${fmt(a.points)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">—</td></tr>';
  return `<div class="panel"><h3>🏆 Allianz-Rangliste</h3>
    <table class="queue"><thead><tr><th>#</th><th>Allianz</th><th>Mitgl.</th><th>Punkte</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function renderAlliance(state) {
  if (!state.online) return `<div class="panel"><p class="muted">Allianzen gibt es nur im Online-Modus (eingeloggt).</p></div>`;
  if (state.error) return `<div class="panel"><div class="login-error">${state.error}</div></div>`;
  if (state.loading) return `<div class="panel"><p class="muted">Lädt…</p></div>`;

  if (state.membership) {
    const a = state.membership.alliances || {};
    const rows = (state.members || [])
      .map((m) => {
        const p = m.profiles || {};
        return `<tr><td>${esc(p.username) || '?'}</td><td>${m.role === 'founder' ? '👑 Gründer' : 'Mitglied'}</td><td>${fmt(p.points || 0)}</td></tr>`;
      })
      .join('');
    const msgs = (state.messages || []).length
      ? state.messages.map((m) => `<div class="chat-msg"><span class="chat-name">${esc(m.sender_name)}</span> <span class="muted small">${new Date(m.created_at).toLocaleTimeString('de-DE')}</span><div>${esc(m.body)}</div></div>`).join('')
      : '<p class="muted">Noch keine Nachrichten.</p>';
    return `<div class="panel">
        <h2>[${esc(a.tag)}] ${esc(a.name)}</h2>
        <p class="muted">${(state.members || []).length} Mitglied(er)</p>
        <table class="queue"><thead><tr><th>Spieler</th><th>Rolle</th><th>Punkte</th></tr></thead><tbody>${rows}</tbody></table>
        <button id="leave-alliance" class="ghost" data-id="${state.membership.alliance_id}" style="margin-top:12px">Allianz verlassen</button>
      </div>
      <div class="panel">
        <h3>💬 Allianz-Chat <button id="al-chat-refresh" class="ghost" style="float:right">Aktualisieren</button></h3>
        <div class="chat-box">${msgs}</div>
        <div class="dispatch-row" style="margin-top:10px">
          <input id="al-msg" maxlength="500" placeholder="Nachricht an die Allianz…" style="flex:1;min-width:160px" />
          <button id="al-send" class="build-btn">Senden</button>
        </div>
      </div>
      ${allianceRankingPanel(state)}`;
  }

  const list = (state.alliances || []).length
    ? `<table class="queue"><thead><tr><th>Tag</th><th>Name</th><th></th></tr></thead><tbody>${state.alliances
        .map((a) => `<tr><td>[${esc(a.tag)}]</td><td>${esc(a.name)}</td><td><button class="join-alliance build-btn" data-id="${a.id}">Beitreten</button></td></tr>`)
        .join('')}</tbody></table>`
    : `<p class="muted">Noch keine Allianzen – gründe die erste!</p>`;

  return `
    <div class="panel">
      <h3>Allianz gründen</h3>
      <div class="dispatch-row">
        <label>Tag (1–6)<input id="al-tag" maxlength="6" placeholder="ABC" /></label>
        <label>Name (2–40)<input id="al-name" maxlength="40" placeholder="Galaktische Föderation" /></label>
        <button id="create-alliance" class="build-btn" style="align-self:end">Gründen</button>
      </div>
    </div>
    <div class="panel"><h3>Allianzen beitreten</h3>${list}</div>
    ${allianceRankingPanel(state)}`;
}

// ------------------------------------------------------------------ Freunde

export function renderFriends(state) {
  if (!state.online) return `<div class="panel"><p class="muted">Freunde gibt es nur im Online-Modus (eingeloggt).</p></div>`;
  if (state.error) return `<div class="panel"><div class="login-error">${state.error}</div></div>`;
  if (state.loading) return `<div class="panel"><p class="muted">Lädt…</p></div>`;

  const f = state.friends || [];
  const accepted = f.filter((x) => x.status === 'accepted');
  const incoming = f.filter((x) => x.status === 'pending' && x.incoming);
  const outgoing = f.filter((x) => x.status === 'pending' && x.outgoing);

  const accRows = accepted.length
    ? accepted.map((x) => `<tr><td>🤝 ${x.otherName}</td><td><button class="friend-remove ghost" data-id="${x.id}">Entfernen</button></td></tr>`).join('')
    : `<tr><td class="muted" colspan="2">Noch keine Freunde.</td></tr>`;

  const inRows = incoming.length
    ? incoming.map((x) => `<tr><td>${x.otherName} möchte dein Freund sein</td><td>
        <button class="friend-accept build-btn" data-id="${x.id}">Annehmen</button>
        <button class="friend-decline ghost" data-id="${x.id}">Ablehnen</button></td></tr>`).join('')
    : '';

  const outRows = outgoing.length
    ? outgoing.map((x) => `<tr><td>${x.otherName}</td><td class="muted">Anfrage gesendet…</td></tr>`).join('')
    : '';

  return `
    <div class="panel">
      <h3>Freund hinzufügen</h3>
      <div class="dispatch-row">
        <label>Spielername<input id="fr-name" placeholder="Spielername" /></label>
        <button id="add-friend" class="build-btn" style="align-self:end">Anfrage senden</button>
      </div>
    </div>
    ${incoming.length ? `<div class="panel"><h3>Offene Anfragen</h3><table class="queue"><tbody>${inRows}</tbody></table></div>` : ''}
    <div class="panel"><h3>Freunde</h3><table class="queue"><tbody>${accRows}</tbody></table></div>
    ${outgoing.length ? `<div class="panel"><h3>Gesendet</h3><table class="queue"><tbody>${outRows}</tbody></table></div>` : ''}`;
}

// ------------------------------------------------------------------ Admin

export function renderAdmin(state) {
  if (!state.online) return `<div class="panel"><p class="muted">Nur im Online-Modus.</p></div>`;
  if (!state.isAdmin) return `<div class="panel"><p class="muted">Kein Zugriff – nur für Admins.</p></div>`;

  const players = state.players || [];
  const cards = players.length
    ? players.map((p) => {
        const lvl = Math.floor(Math.sqrt((p.points || 0) / 100)) + 1;
        const u = p.username;
        if (!u) {
          return `<div class="admin-card"><div class="ac-head"><span class="muted">(nie gespielt)</span></div><div class="muted small">${esc(p.email)}</div></div>`;
        }
        const res = [['metal', '⛏️ Metall'], ['crystal', '💎 Kristall'], ['deuterium', '🛢️ Deut'], ['gold', '🟡 Gold'], ['titan', '🔩 Titan']]
          .map(([k, lbl]) => `<button class="admin-res" data-user="${esc(u)}" data-kind="${k}">${lbl}</button>`).join('');
        return `<div class="admin-card ${p.banned ? 'banned-row' : ''}">
          <div class="ac-head"><b>${esc(u)}</b>${p.banned ? ' <span class="lose">🚫 gesperrt</span>' : ''}</div>
          <div class="muted small">${esc(p.email)}</div>
          <div class="ac-stats">⭐ Lvl ${lvl} · ${fmt(p.points || 0)} P · 🪙 ${fmt(p.coins || 0)}</div>
          <div class="admin-actions">
            <button class="admin-gift" data-user="${esc(u)}">🪙 Coins</button>
            <button class="admin-xp" data-user="${esc(u)}">⭐ XP</button>
            <button class="admin-level" data-user="${esc(u)}">🎚 Level</button>
            ${res}
            ${state.meEmail && p.email === state.meEmail
              ? `<span class="muted small">👑 Inhaber</span>`
              : p.banned
                ? `<button class="admin-unban" data-user="${esc(u)}">✅ Freigeben</button>`
                : `<button class="admin-ban ghost" data-user="${esc(u)}">🚫 Bannen</button>`}
          </div>
        </div>`;
      }).join('')
    : `<p class="muted">${state.loading ? 'Lädt…' : (state.error || 'Keine Spieler.')}</p>`;

  return `
    <div class="panel">
      <h2>🛡️ Admin</h2>
      <p class="muted">Coins gezielt vergeben (negativ = abziehen).</p>
      <div class="dispatch-row">
        <label>Spielername<input id="adm-user" placeholder="Spielername" /></label>
        <label>Coins<input id="adm-amount" type="number" value="100" /></label>
        <button id="admin-grant" class="build-btn" style="align-self:end">Vergeben</button>
      </div>
      <div class="booster-bar" style="margin-top:12px">
        🏗️ <b>Bau-Limits</b> <span class="muted small">(Kosten · Bauzeit · Warteschleife)</span>:
        ${state.godBuild ? '<span class="lose">AUS (gratis · sofort · unbegrenzt)</span>' : '<span class="win">AN (normal)</span>'}
        <button id="admin-godbuild" class="ghost">${state.godBuild ? 'Einschalten' : 'Ausschalten'}</button>
      </div>
    </div>
    <div class="panel">
      <h3>Spielerliste <span class="muted small">(${players.length})</span>
        <button id="admin-refresh" class="ghost" style="float:right">Aktualisieren</button></h3>
      <div class="admin-cards">${cards}</div>
    </div>`;
}

export function renderBanned() {
  return `<div class="login-wrap"><div class="panel login-card">
    <h2>🚫 Account gesperrt</h2>
    <p class="muted">Dein Zugang wurde von einem Admin gesperrt. Bei Fragen wende dich an den Spielbetreiber.</p>
    <button class="ghost" onclick="location.reload()">Neu laden</button>
  </div></div>`;
}

// ------------------------------------------------------------------ Profil

export function renderProfile(state) {
  if (!state.online) return `<div class="panel"><p class="muted">Profil gibt es nur im Online-Modus (eingeloggt).</p></div>`;
  return `
    <div class="panel">
      <h2>👤 ${state.username || 'Profil'}</h2>
      <div class="grid2">
        <div>
          <h3>Übersicht</h3>
          <ul class="stats">
            <li>Spielername<b>${state.username || '–'}</b></li>
            <li>E-Mail<b>${state.email || '–'}</b></li>
            <li>⭐ Level<b>${state.level || 1}</b></li>
            <li>🪙 Coins<b>${fmt(state.coins || 0)}</b></li>
            <li>Punkte<b>${fmt(state.points || 0)}</b></li>
            ${state.isAdmin ? '<li>Rolle<b>🛡️ Admin</b></li>' : ''}
          </ul>
        </div>
        <div>
          <h3>Einstellungen</h3>
          <div class="dispatch-row">
            <label>Spielername<input id="pf-username" value="${state.username || ''}" maxlength="20" /></label>
            <button id="pf-save-name" class="build-btn" style="align-self:end">Name speichern</button>
          </div>
          <div class="dispatch-row">
            <label>Planetenname<input id="pf-planet" value="${state.planetName || ''}" maxlength="30" /></label>
            <button id="pf-save-planet" class="build-btn" style="align-self:end">Planet speichern</button>
          </div>
          <button id="pf-logout" class="ghost" style="margin-top:10px">Logout</button>
        </div>
      </div>
    </div>`;
}

// ------------------------------------------------------------------ Rangliste

export function renderRanking(state) {
  if (!state.online) return `<div class="panel"><p class="muted">Rangliste gibt es nur im Online-Modus (eingeloggt).</p></div>`;
  if (state.error) return `<div class="panel"><div class="login-error">${state.error}</div></div>`;
  if (state.loading) return `<div class="panel"><p class="muted">Lädt…</p></div>`;

  const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`);

  const prows = (state.players || []).length
    ? state.players.map((p, i) => {
        const lvl = Math.floor(Math.sqrt((p.points || 0) / 100)) + 1;
        const me = p.owner_name === state.me;
        return `<tr class="${me ? 'rank-me' : ''}"><td>${medal(i)}</td><td>${esc(p.owner_name)}${me ? ' <span class="win">(du)</span>' : ''}</td><td>⭐ ${lvl}</td><td>${fmt(p.points || 0)}</td></tr>`;
      }).join('')
    : '<tr><td colspan="4" class="muted">Noch keine Spieler.</td></tr>';

  const arows = (state.alliances || []).length
    ? state.alliances.map((a, i) => `<tr><td>${medal(i)}</td><td>[${esc(a.tag)}] ${esc(a.name)}</td><td>${a.members}</td><td>${fmt(a.points)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Noch keine Allianzen.</td></tr>';

  return `
    <div class="panel">
      <h2>🏆 Rangliste</h2>
      <h3>Top-Spieler</h3>
      <table class="queue"><thead><tr><th>#</th><th>Spieler</th><th>Level</th><th>Punkte</th></tr></thead><tbody>${prows}</tbody></table>
    </div>
    <div class="panel">
      <h3>Top-Allianzen</h3>
      <table class="queue"><thead><tr><th>#</th><th>Allianz</th><th>Mitgl.</th><th>Punkte</th></tr></thead><tbody>${arows}</tbody></table>
    </div>`;
}

// ------------------------------------------------------------------ Battle Pass

export const SPEED_COST = 50; // Coins für den Speed-Gutschein

export function renderDaily(state, game) {
  if (!state.online) return `<div class="panel"><p class="muted">Battle Pass gibt es nur im Online-Modus (eingeloggt).</p></div>`;
  const dayInCycle = (((state.streak || 0) - 1) % 7) + 1;
  let days = '';
  for (let i = 1; i <= 7; i++) {
    const reached = state.streak > 0 && i <= dayInCycle;
    const isCur = state.claimable && i === ((state.streak % 7) + 1 || 1) ? false : false; // nur Stil
    days += `<div class="bp-day ${reached ? 'done' : ''}">
      <div class="bp-d">Tag ${i}</div><div class="muted small">${50 * i} 🪙</div></div>`;
  }
  const speedActive = game && game.speedActive && game.speedActive();
  // Spielzeit-Belohnung (Zyklus 2/4/6/8 Std)
  const pt = game && game.playtimeInfo ? game.playtimeInfo() : null;
  let playtimePanel = '';
  if (pt) {
    const total = pt.total;
    const remain = Math.max(0, pt.nextAt - total);
    const cycle = [1, 2, 3, 4].map((s) =>
      `<div class="bp-day ${pt.step === s ? 'done' : ''}">
        <div class="bp-d">${s * 2} Std</div><div class="muted small">Paket ${s}</div></div>`).join('');
    playtimePanel = `
    <div class="panel">
      <h3>⏳ Spielzeit-Belohnung</h3>
      <p class="muted small">Aktive Spielzeit: <b>${fmtTime(total)}</b> · alle 2 Std ein Belohnungspaket (Ressourcen + XP), Zyklus 2/4/6/8 Std.</p>
      <div class="bp-grid">${cycle}</div>
      ${pt.ready
        ? `<button id="claim-playtime" class="build-btn" style="margin-top:12px">🎁 Spielzeit-Paket ${pt.step} abholen</button>`
        : `<p class="muted" style="margin-top:10px">Nächstes Paket in <b>${fmtTime(remain)}</b> aktiver Spielzeit.</p>`}
    </div>`;
  }
  return `
    <div class="panel">
      <h2>📅 Battle Pass</h2>
      <p>🔥 Streak: <b>${state.streak || 0}</b> Tag(e) in Folge</p>
      <div class="bp-grid">${days}</div>
      ${state.claimable
        ? `<button id="claim-daily" class="build-btn" style="margin-top:14px">🎁 Tagesbelohnung abholen</button>`
        : `<p class="muted" style="margin-top:10px">Heute schon abgeholt – komm morgen wieder für mehr! ✅</p>`}
    </div>
    ${playtimePanel}
    <div class="panel">
      <h3>⚡ Gutscheine</h3>
      <div class="booster-bar">
        <span><b>Speed-Gutschein</b> – 70 % schnellerer Bau für 5 Min</span>
        ${speedActive
          ? `<b class="win">aktiv – noch ${fmtTime(game.speedRemaining())}</b>`
          : `<button id="buy-speed" class="build-btn">Aktivieren (${SPEED_COST} 🪙)</button>`}
      </div>
    </div>`;
}

// ------------------------------------------------------------------ Mitarbeiter
export function renderOfficers(game) {
  const online = typeof game.coins === 'number';
  const coins = online ? (game.coins || 0) : 0;
  const cards = OFFICERS.map((o) => {
    const lvl = game.officerLevel(o.id);
    const maxed = lvl >= o.max;
    const cost = maxed ? 0 : officerCost(o, lvl);
    const afford = coins >= cost;
    // Aktueller Effekt-Text
    const eff = o.effect === 'queue' ? `+${lvl} Warteschlangen-Plätze`
      : o.effect === 'speed' ? `-${Math.round(o.per * lvl * 100)} % Bauzeit`
      : `+${Math.round(o.per * lvl * 100)} % ${o.effect === 'storage' ? 'Lager' : o.effect === 'mining' ? 'Metall/Kristall' : 'Produktion'}`;
    return `<div class="card ${maxed ? 'ready' : ''}">
      <div class="card-head">
        <h4><span class="thumb hasimg" style="font-size:20px">${o.icon}</span> ${o.name}</h4>
        <span class="level">Stufe ${lvl}/${o.max}</span>
      </div>
      <p class="desc">${o.desc}</p>
      <div class="meta">Aktuell: <b>${lvl > 0 ? eff : '—'}</b></div>
      ${maxed
        ? `<button class="build-btn" disabled>Maximale Stufe</button>`
        : `<button class="build-btn hire-officer" data-id="${o.id}" data-cost="${cost}" ${online && afford ? '' : 'disabled'}>
             ${online ? `Anheuern (${fmt(cost)} 🪙)` : 'Nur online'}
           </button>`}
    </div>`;
  }).join('');
  return `<div class="panel">
      <h2>👥 Mitarbeiter</h2>
      <p class="muted small">Heuere Spezialisten mit Coins an (aus Kämpfen verdient). Jede Stufe verstärkt deinen Bonus dauerhaft.</p>
    </div>
    <div class="cards">${cards}</div>`;
}

// ---------------------------------------------------------------------- Quests
export function renderQuests(game) {
  const list = game.quests ? game.quests() : [];
  const open = list.filter((q) => !q.claimed);
  const doneCount = list.filter((q) => q.claimed).length;
  const card = (q) => {
    const pct = Math.min(100, Math.round((q.current / q.goal) * 100));
    const rw = q.reward || {};
    const rwText = [rw.xp ? `⭐ ${fmt(rw.xp)} XP` : '', rw.metal ? `⛏️ ${fmt(rw.metal)}` : '', rw.crystal ? `💎 ${fmt(rw.crystal)}` : '', rw.deuterium ? `🛢️ ${fmt(rw.deuterium)}` : '']
      .filter(Boolean).join(' · ');
    return `<div class="card ${q.claimed ? '' : q.done ? 'ready' : ''}">
      <div class="card-head">
        <h4><span class="thumb hasimg" style="font-size:20px">${q.icon || '🎯'}</span> ${q.name}</h4>
        <span class="level">${fmt(q.current)}/${fmt(q.goal)}</span>
      </div>
      <p class="desc">${q.desc}</p>
      <div class="quest-bar"><span style="width:${pct}%"></span></div>
      <div class="meta">Belohnung: <b>${rwText}</b></div>
      ${q.claimed
        ? `<button class="build-btn" disabled>✅ Abgeholt</button>`
        : q.done
          ? `<button class="build-btn claim-quest" data-id="${q.id}">🎁 Belohnung abholen</button>`
          : `<button class="build-btn" disabled>In Arbeit…</button>`}
    </div>`;
  };
  return `<div class="panel">
      <h2>🎯 Quests</h2>
      <p class="muted small">Schließe Aufgaben ab und kassiere XP. Abgeschlossen: <b>${doneCount}/${list.length}</b>.</p>
    </div>
    <div class="cards">${open.map(card).join('')}${list.filter((q) => q.claimed).map(card).join('')}</div>`;
}
