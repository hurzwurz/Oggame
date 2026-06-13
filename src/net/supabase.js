// Supabase-Client + Auth-/DB-Hilfsfunktionen.
//
// WICHTIG: supabase-js wird DYNAMISCH per CDN geladen. Schlägt das fehl
// (kein Netz, Blocker, CDN-Ausfall), liefert getClient() null – das Spiel
// fällt dann sauber in den Offline-Modus zurück, statt komplett abzustürzen.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const configured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.startsWith('DEINE') &&
  !SUPABASE_ANON_KEY.startsWith('DEIN');

export function isConfigured() {
  return !!configured;
}

let clientPromise = null;

/** Lädt supabase-js bei Bedarf und erstellt den Client. null bei Offline/Fehler. */
export function getClient() {
  if (!configured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then((m) => m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
      .catch((e) => {
        console.warn('supabase-js konnte nicht geladen werden:', e);
        return null;
      });
  }
  return clientPromise;
}

async function need() {
  const sb = await getClient();
  if (!sb) throw new Error('Verbindung zu Supabase nicht möglich.');
  return sb;
}

// ----------------------------------------------------------------- Auth

export async function signUp(email, password, username) {
  const sb = await need();
  return sb.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: typeof location !== 'undefined' ? location.origin + location.pathname : undefined,
    },
  });
}

export async function signIn(email, password) {
  const sb = await need();
  return sb.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const sb = await getClient();
  return sb ? sb.auth.signOut() : null;
}

export async function currentUser() {
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user || null;
}

/** Reagiert auf An-/Abmeldungen. Gibt (Promise einer) Unsubscribe-Funktion zurück. */
export async function onAuthChange(cb) {
  const sb = await getClient();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user || null));
  return () => data.subscription.unsubscribe();
}

// ----------------------------------------------------------- Datenzugriff

/** Galaxie-Übersicht aller Spieler (nur öffentliche Felder). */
export async function loadGalaxyOverview() {
  const sb = await need();
  const { data, error } = await sb
    .from('galaxy_overview')
    .select('*')
    .order('galaxy', { ascending: true })
    .order('system', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}
