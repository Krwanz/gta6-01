// Save / load through localStorage: cash, missions done, position, health.
const KEY = 'solmar-bay-save-v1';

export function saveGameState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) { return false; }
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

export function hasSave() { return loadGameState() !== null; }
