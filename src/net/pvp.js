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
