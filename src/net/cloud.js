// Cloud-Persistenz für den Online-Modus.
//
// Phase 1: Der Kernfortschritt (Ressourcen, Gebäude, Forschung, Schiffe,
// Verteidigung, Warteschlangen) liegt in der DB-Tabelle `planets`.
// Flotten/Berichte bleiben vorerst lokal (sie werden in Phase 3 server-
// autoritativ); die NPC-Galaxie wird deterministisch neu erzeugt.

import { getClient } from './supabase.js';

const STARTING = { metal: 500, crystal: 500, deuterium: 100 };
const EMPTY_QUEUES = { building: null, research: null, shipyard: [] };
const secondaryKey = (uid) => `oggame.secondary.${uid}`;

/**
 * Stellt sicher, dass ein Profil existiert (ersetzt den DB-Trigger).
 * Wählt bei Namenskollision automatisch einen freien Namen.
 */
export async function ensureProfile(user) {
  const supabase = await getClient();
  const { data: existing, error: selErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return;

  const base = ((user.user_metadata && user.user_metadata.username) ||
    (user.email ? user.email.split('@')[0] : 'Spieler')).slice(0, 20) || 'Spieler';

  for (let i = 0; i < 6; i++) {
    const username = i === 0 ? base : `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase.from('profiles').insert({ id: user.id, username });
    if (!error) return;
    if (error.code === '23505') {
      // id bereits vorhanden -> fertig; sonst Name vergeben -> neuen versuchen
      if (/\(id\)|profiles_pkey/i.test(error.message || '')) return;
      continue;
    }
    throw error;
  }
  throw new Error('Profil konnte nicht angelegt werden.');
}

/** Lädt den Heimatplaneten oder legt einen neuen an freien Koordinaten an. */
export async function ensureHomePlanet(userId) {
  const supabase = await getClient();
  const { data: existing, error: loadErr } = await supabase
    .from('planets')
    .select('*')
    .eq('owner', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (loadErr) throw loadErr;
  if (existing) return existing;

  // Freie Koordinaten suchen (bei Kollision erneut versuchen).
  for (let attempt = 0; attempt < 15; attempt++) {
    const coords = [1, 1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 15)];
    const { data, error } = await supabase
      .from('planets')
      .insert({
        owner: userId,
        name: 'Heimatplanet',
        galaxy: coords[0],
        system: coords[1],
        position: coords[2],
        resources: { ...STARTING },
        buildings: {},
        research: {},
        ships: {},
        defenses: {},
        queues: { ...EMPTY_QUEUES },
        last_update: new Date().toISOString(),
      })
      .select()
      .single();
    if (!error) return data;
    // 23505 = unique_violation (Koordinate belegt) -> nächster Versuch
    if (error.code !== '23505') throw error;
  }
  throw new Error('Kein freier Planetenplatz gefunden – bitte erneut versuchen.');
}

/** Sekundärdaten (Flotten/Berichte) je Nutzer aus localStorage laden. */
function loadSecondary(userId) {
  try {
    return JSON.parse(localStorage.getItem(secondaryKey(userId))) || {};
  } catch {
    return {};
  }
}

/** Baut den Initialzustand für die Game-Engine aus DB-Zeile + Sekundärdaten. */
export function buildInitialState(row, userId) {
  const sec = loadSecondary(userId);
  const queues = row.queues && Array.isArray(row.queues.shipyard) ? row.queues : { ...EMPTY_QUEUES };
  return {
    planetName: row.name,
    coords: [row.galaxy, row.system, row.position],
    resources: row.resources || { ...STARTING },
    buildings: row.buildings || {},
    research: row.research || {},
    ships: row.ships || {},
    defenses: row.defenses || {},
    queues,
    lastTick: Date.parse(row.last_update) || Date.now(),
    fleets: sec.fleets || [],
    reports: sec.reports || [],
    fleetSeq: sec.fleetSeq || 1,
    // Zusatz-Fortschritt (gerätelokal gesichert, da nicht in den DB-Spalten):
    officers: sec.officers,
    playtime: sec.playtime,
    playtimeClaimed: sec.playtimeClaimed,
    stats: sec.stats,
    questsClaimed: sec.questsClaimed,
    layout: sec.layout,
    debris: sec.debris,
    booster: sec.booster,
    speed: sec.speed,
    // galaxy bewusst weggelassen -> wird deterministisch neu erzeugt
  };
}

/**
 * Erzeugt einen gepufferten Speicherer: schreibt höchstens alle paar Sekunden
 * in die DB und legt Flotten/Berichte lokal ab.
 */
export function makeCloudSaver(planetId, userId) {
  let dirty = false;
  let latest = null;
  let timer = null;

  async function flush() {
    timer = null;
    if (!dirty || !latest) return;
    dirty = false;
    const s = latest;
    try {
      localStorage.setItem(
        secondaryKey(userId),
        JSON.stringify({
          fleets: s.fleets, reports: s.reports, fleetSeq: s.fleetSeq,
          officers: s.officers, playtime: s.playtime, playtimeClaimed: s.playtimeClaimed,
          stats: s.stats, questsClaimed: s.questsClaimed, layout: s.layout,
          debris: s.debris, booster: s.booster, speed: s.speed,
        })
      );
    } catch {
      /* localStorage optional */
    }
    try {
      const supabase = await getClient();
      if (!supabase) { dirty = true; return; }
      const { error } = await supabase
        .from('planets')
        .update({
          name: s.planetName,
          resources: s.resources,
          buildings: s.buildings,
          research: s.research,
          ships: s.ships,
          defenses: s.defenses,
          queues: s.queues,
          last_update: new Date(s.lastTick).toISOString(),
        })
        .eq('id', planetId);
      if (error) throw error;
      // Punkte/XP serverseitig spiegeln (für Rangliste & Admin)
      await supabase.from('profiles').update({ points: Math.floor(s.xp || 0) }).eq('id', userId);
    } catch (e) {
      console.warn('Cloud-Speichern fehlgeschlagen:', e.message || e);
      dirty = true; // beim nächsten Mal erneut versuchen
    }
  }

  function onSave(state) {
    latest = state;
    dirty = true;
    if (!timer) timer = setTimeout(flush, 3000);
  }

  return { onSave, flush };
}
