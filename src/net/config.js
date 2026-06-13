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
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Y2x6bGlhbnZhbGNtY3Fyd3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzg3MDAsImV4cCI6MjA5NjkxNDcwMH0.9bJauNyCIyCRqYjeG4xgox6TmN56iWpD7wi3cUh2j6M';
