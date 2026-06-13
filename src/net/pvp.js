// PvP: Angriff auf echte Spieler über die server-seitige DB-Funktion.

import { getClient } from './supabase.js';

/**
 * Greift den Spieler an den Zielkoordinaten an (server-autoritativ).
 * @param coords [g,s,p]
 * @param ships  { id: count }
 * @returns { winner, loot, attacker_ships, attacker_resources }
 */
export async function attackPlayer(coords, ships) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline – nicht mit dem Server verbunden.');
  const { data, error } = await sb.rpc('attack_player', {
    t_g: coords[0], t_s: coords[1], t_p: coords[2], atk_ships: ships,
  });
  if (error) throw error;
  return data;
}

/** Löst einen PvP-Angriff bei Ankunft serverseitig auf. */
export async function resolvePvpAttack(coords, ships) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { data, error } = await sb.rpc('resolve_pvp_attack', { t_g: coords[0], t_s: coords[1], t_p: coords[2], atk_ships: ships });
  if (error) throw error;
  return data;
}

/** Spioniert einen Spieler aus (Momentaufnahme). */
export async function spyPlayer(coords) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { data, error } = await sb.rpc('spy_player', { t_g: coords[0], t_s: coords[1], t_p: coords[2] });
  if (error) throw error;
  return data;
}

/** Lädt die letzten Server-Berichte des Nutzers (z. B. erlittene Angriffe/Spionage). */
export async function loadReports() {
  const sb = await getClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from('reports')
    .select('id, type, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}
