// Coins-Währung & Admin-Funktionen (Client-Seite).

import { getClient } from './supabase.js';

/** Kontostand abrufen (legt Wallet bei Bedarf an). */
export async function getCoins() {
  const sb = await getClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc('ensure_wallet');
  if (error) throw error;
  return Number(data) || 0;
}

/** Coins ausgeben; liefert den neuen Kontostand. */
export async function spendCoins(amount) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { data, error } = await sb.rpc('spend_coins', { amount });
  if (error) throw error;
  return Number(data) || 0;
}

/** Ist der eingeloggte Nutzer Admin? */
export async function amIAdmin() {
  const sb = await getClient();
  if (!sb) return false;
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return false;
  const { data } = await sb.from('game_admins').select('user_id').eq('user_id', u.user.id).maybeSingle();
  return !!data;
}

/** Admin: Coins an einen Spieler vergeben. */
export async function adminGrant(username, amount) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { data, error } = await sb.rpc('admin_grant_coins', { target_username: username, amount });
  if (error) throw error;
  return Number(data) || 0;
}

/** Ist der Nutzer gesperrt? */
export async function isBanned(userId) {
  const sb = await getClient();
  if (!sb) return false;
  const { data } = await sb.from('profiles').select('is_banned').eq('id', userId).maybeSingle();
  return !!(data && data.is_banned);
}

/** Admin: alle Spieler (Name, Punkte, Coins, Status). */
export async function adminListPlayers() {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { data, error } = await sb.rpc('admin_list_players');
  if (error) throw error;
  return data || [];
}

/** Admin: Spieler sperren/freigeben. */
export async function adminSetBanned(username, banned) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { error } = await sb.rpc('admin_set_banned', { target_username: username, banned });
  if (error) throw error;
}

/** Admin: Punkte/XP eines Spielers setzen. */
export async function adminSetPoints(username, points) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { error } = await sb.rpc('admin_set_points', { target_username: username, pts: points });
  if (error) throw error;
}

/** Admin: Level eines Spielers setzen. */
export async function adminSetLevel(username, level) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { error } = await sb.rpc('admin_set_level', { target_username: username, lvl: level });
  if (error) throw error;
}

/** Admin: Ressourcen eines Spielers setzen. */
export async function adminSetResources(username, m, c, d, g, ti) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { error } = await sb.rpc('admin_set_resources', {
    target_username: username, m, c, d, g, ti,
  });
  if (error) throw error;
}

/** Admin: eine einzelne Ressource erhöhen/verringern. */
export async function adminAddResource(username, kind, amount) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { error } = await sb.rpc('admin_add_resource', { target_username: username, kind, amount });
  if (error) throw error;
}

/** Globale Einstellung lesen (z. B. 'free_build'). */
export async function getSetting(key) {
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.from('game_settings').select('value').eq('key', key).maybeSingle();
  return data ? data.value : null;
}

/** Admin: globale Einstellung setzen. */
export async function adminSetSetting(key, value) {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { error } = await sb.rpc('admin_set_setting', { k: key, v: value });
  if (error) throw error;
}

/** Battle Pass: Status (Streak + heute abholbar). */
export async function dailyStatus() {
  const sb = await getClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc('daily_status');
  if (error) throw error;
  return data;
}

/** Battle Pass: Tagesbelohnung abholen. */
export async function claimDaily() {
  const sb = await getClient();
  if (!sb) throw new Error('Offline');
  const { data, error } = await sb.rpc('claim_daily');
  if (error) throw error;
  return data;
}
