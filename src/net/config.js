// Supabase-Konfiguration.
//
// Diese beiden Werte sind ÖFFENTLICH unbedenklich (sie landen ohnehin im
// Browser) und werden durch Row-Level-Security in der Datenbank geschützt.
// Den service_role-Key hier NIEMALS eintragen.
//
// Werte findest du im Supabase-Dashboard unter:
//   Project Settings → API → Project URL  /  Project API keys → anon public
//
// Solange hier Platzhalter stehen, läuft das Spiel im lokalen Offline-Modus
// (localStorage) weiter.

export const SUPABASE_URL = 'https://guclzlianvalcmcqrwub.supabase.co';
export const SUPABASE_ANON_KEY = 'DEIN_ANON_PUBLIC_KEY_HIER';
