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
