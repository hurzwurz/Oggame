// Supabase-Client + Auth-/DB-Hilfsfunktionen.
//
// supabase-js wird per ESM-CDN geladen, damit das Frontend weiterhin ohne
// Build-Schritt auf GitHub Pages läuft.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const configured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.startsWith('DEINE') &&
  !SUPABASE_ANON_KEY.startsWith('DEIN');

export const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/** Ist eine gültige Supabase-Konfiguration hinterlegt? */
export function isConfigured() {
  return !!supabase;
}

// ----------------------------------------------------------------- Auth

export async function signUp(email, password, username) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

/** Reagiert auf An-/Abmeldungen. Gibt eine Unsubscribe-Funktion zurück. */
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user || null));
  return () => data.subscription.unsubscribe();
}

// ----------------------------------------------------------- Datenzugriff

/** Eigenen Heimatplaneten laden (oder null, falls noch keiner existiert). */
export async function loadHomePlanet(userId) {
  const { data, error } = await supabase
    .from('planets')
    .select('*')
    .eq('owner', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Planetenzustand speichern (Teil-Update per JSONB-Spalten). */
export async function savePlanet(planetId, patch) {
  const { error } = await supabase.from('planets').update(patch).eq('id', planetId);
  if (error) throw error;
}

/** Galaxie-Übersicht aller Spieler (nur öffentliche Felder). */
export async function loadGalaxyOverview() {
  const { data, error } = await supabase
    .from('galaxy_overview')
    .select('*')
    .order('galaxy', { ascending: true })
    .order('system', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}
