// Saving: the whole campaign fits in one localStorage entry — cash, weapons,
// mission progress, collected packages and lifetime stats. The safehouse and
// the pause menu save; the title screen offers Continue when a save exists.
// Loading never touches the live world directly: loadSave returns the data
// and world.applySave puts it into a fresh world at the safehouse.
import { SAVE_KEY } from './config.js';

const SAVE_VERSION = 1;

// The mission to resume: the one in progress, or the next one after the last
// completed mission. 0 when no mission has been started yet.
function missionIndexOf(mission) {
  if (!mission) return 0;
  return mission.done ? mission.index + 1 : mission.index;
}

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function saveGame(world) {
  const state = world.state;
  const data = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    cash: state.cash,
    owned: state.owned,
    ammo: state.ammo,
    weapon: state.weapon,
    stats: state.stats,
    storyComplete: state.storyComplete,
    packages: state.packages.map((p) => p.taken),
    missionIndex: missionIndexOf(state.mission),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
