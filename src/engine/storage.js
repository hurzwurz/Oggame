// Spielstand laden/speichern via localStorage.

const SAVE_KEY = 'oggame.save.v1';

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Spielstand konnte nicht geladen werden:', e);
    return null;
  }
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('Spielstand konnte nicht gespeichert werden:', e);
    return false;
  }
}

export function clearGame() {
  localStorage.removeItem(SAVE_KEY);
}
