// Rendering der Oberfläche. Reine View-Funktionen + Event-Delegation.

import { BUILDINGS, BUILDING_MAP } from '../data/buildings.js';
import { RESEARCH, RESEARCH_MAP } from '../data/research.js';
import { SHIPS, SHIP_MAP, SHIP_CLASSES } from '../data/ships.js';
import { DEFENSES, DEFENSE_MAP } from '../data/defenses.js';
import * as F from '../engine/formulas.js';

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
  const cell = (label, val, capVal, perH, cls) => {
    const full = capVal && val >= capVal;
    return `<div class="res ${cls}${full ? ' full' : ''}">
      <span class="res-label">${label}</span>
      <span class="res-val">${fmt(val)}${capVal ? ` / ${fmt(capVal)}` : ''}</span>
      <span class="res-rate">${perH >= 0 ? '+' : ''}${fmt(perH)}/h</span>
    </div>`;
  };
  return (
    cell('Metall', r.metal, cap.metal, prod.metal, 'c-metal') +
    cell('Kristall', r.crystal, cap.crystal, prod.crystal, 'c-crystal') +
    cell('Deuterium', r.deuterium, cap.deuterium, prod.deuterium, 'c-deut') +
    `<div class="res c-energy${e.ratio < 1 ? ' full' : ''}">
      <span class="res-label">Energie</span>
      <span class="res-val">${fmt(e.produced - e.consumed)}</span>
      <span class="res-rate">${fmt(e.produced)} / ${fmt(e.consumed)}</span>
    </div>`
  );
}

// ------------------------------------------------------------------ Übersicht

export function renderOverview(game) {
  const e = game.energy();
  const prod = game.production();
  const q = game.state.queues;
  const now = Date.now();

  const queueRow = (label, item) => {
    if (!item) return `<tr><td>${label}</td><td>–</td><td>–</td></tr>`;
    const remaining = (item.finishAt - now) / 1000;
    return `<tr><td>${label}</td><td>${game.nameOf(item.id)}</td><td>${fmtTime(remaining)}</td></tr>`;
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
      shipyardRows += `<tr><td>Werft</td><td>${game.nameOf(job.id)} ×${job.remaining}</td><td>${fmtTime(remaining)}</td></tr>`;
    });
  }

  return `
    <div class="panel">
      <h2>${game.state.planetName}</h2>
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
            <thead><tr><th>Bereich</th><th>Auftrag</th><th>Restzeit</th></tr></thead>
            <tbody>
              ${queueRow('Gebäude', q.building)}
              ${queueRow('Forschung', q.research)}
              ${shipyardRows}
            </tbody>
          </table>
        </div>
      </div>
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
  const disabled = !met || !afford;
  const busy = kind === 'building' ? !!game.state.queues.building : !!game.state.queues.research;
  return `
    <div class="card ${disabled ? 'locked' : ''}">
      <div class="card-head">
        <h4>${def.name}</h4>
        <span class="level">Stufe ${level}</span>
      </div>
      <p class="desc">${def.desc}</p>
      <div class="cost">${costLine(cost)}</div>
      <div class="meta">⏱ ${fmtTime(time)}</div>
      ${reqLine(def, game)}
      <button class="build-btn" data-kind="${kind}" data-id="${def.id}" ${disabled || busy ? 'disabled' : ''}>
        ${busy ? 'Beschäftigt' : level === 0 ? 'Bauen' : 'Ausbauen'}
      </button>
    </div>`;
}

export function renderBuildings(game) {
  return `<div class="cards">${BUILDINGS.map((b) =>
    levelCard(b, game.state.buildings[b.id] || 0, game, 'building')
  ).join('')}</div>`;
}

export function renderResearch(game) {
  if ((game.state.buildings.researchLab || 0) < 1) {
    return `<div class="panel"><p>Baue zuerst ein <b>Forschungslabor</b>, um Technologien zu erforschen.</p></div>`;
  }
  return `<div class="cards">${RESEARCH.map((r) =>
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
        <h4>${def.name}</h4>
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
