// The save lives in this browser's localStorage under SAVE_KEY: one JSON blob,
// the world's snapshot. Everything is guarded, so a browser with no storage
// (or a corrupt save) plays as if there were no save, instead of throwing.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** The saved snapshot, or null when there is none or it does not parse. */
export function loadGame() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // No storage to clear; nothing to do.
  }
}
