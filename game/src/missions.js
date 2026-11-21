// The six story missions: Leo Costa sends the driving jobs, Rosa Delgado the
// quiet ones, and Vince Marlow waits at the end. Missions read the world's
// event queue (carStolen, package, policeDestroyed, ...) and the player's
// position, and advance themselves; completing one pays its reward and moves
// the story on. Nothing here touches the DOM.
import { DISTRICTS, MISSIONS } from './config.js';

const DROP_POINT = { x: 600, y: 1400 }; // Portside road crossing.
const MARLOW_DOOR = { x: 2600, y: 1400 }; // Solmar Hills road crossing.
const REACH_RANGE = 70;

export function createMissionState() {
  return { index: 0, stage: 0, data: {} };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The package this mission wants: the first uncollected one in Marina Bay. */
function pickupPackage(state) {
  const bay = DISTRICTS[0];
  const inBay = state.packages.find(
    (pkg) => !pkg.collected && pkg.x >= bay.x && pkg.x < bay.x + bay.w && pkg.y >= bay.y && pkg.y < bay.y + bay.h,
  );
  if (inBay) return inBay;
  return state.packages.find((pkg) => !pkg.collected) || null;
}

function nearestCar(state, kind) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (kind && car.kind !== kind) continue;
    const d = dist(state.player, car);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Where the yellow `!` marker goes for the current mission, or null. */
export function missionTarget(state) {
  const mission = MISSIONS[state.mission.index];
  if (!mission) return null;
  if (mission.kind === 'steal') {
    const car = nearestCar(state, 'traffic');
    return car ? { x: car.x, y: car.y } : null;
  }
  if (mission.kind === 'package') {
    const pkg = pickupPackage(state);
    return pkg ? { x: pkg.x, y: pkg.y } : null;
  }
  if (mission.kind === 'deliver') return DROP_POINT;
  if (mission.kind === 'smash') {
    const cop = state.police[0];
    return cop ? { x: cop.x, y: cop.y } : null;
  }
  if (mission.kind === 'reach') return MARLOW_DOOR;
  return null; // evade: the point is to lose the cops, not to go somewhere.
}

function complete(state, mission) {
  state.player.cash += mission.reward;
  state.message = `Mission complete: ${mission.title}  +$${mission.reward}`;
  state.messageTimer = 4;
  state.mission.index += 1;
  state.mission.stage = 0;
  state.mission.data = {};
  if (state.mission.index >= MISSIONS.length) {
    state.message = 'Story complete — Solmar is yours, Leo. Free roam unlocked.';
    state.messageTimer = 6;
  }
  return ['complete'];
}

/** Advance the current mission one step. Reads state.events; the caller clears
 * the queue afterwards. Returns happenings ('complete', 'stage') for sound. */
export function updateMissions(state) {
  const mission = MISSIONS[state.mission.index];
  if (!mission) return [];
  const events = state.events || [];
  const player = state.player;

  if (mission.kind === 'steal') {
    if (events.some((e) => e.type === 'carStolen')) return complete(state, mission);
  }

  if (mission.kind === 'package') {
    // Any package counts: the marker points at one, but collecting a package
    // while this mission is active is the job done.
    if (events.some((e) => e.type === 'package')) return complete(state, mission);
  }

  if (mission.kind === 'evade') {
    if (state.mission.stage === 0) {
      if (state.wanted >= 2) {
        state.mission.stage = 1;
        state.message = 'Heat is on — now lose them!';
        state.messageTimer = 3;
        return ['stage'];
      }
    } else if (state.wanted === 0) {
      return complete(state, mission);
    }
  }

  if (mission.kind === 'deliver') {
    if (dist(player, DROP_POINT) < REACH_RANGE) return complete(state, mission);
  }

  if (mission.kind === 'smash') {
    const smashed = (state.mission.data.smashed || 0) + events.filter((e) => e.type === 'policeDestroyed').length;
    state.mission.data.smashed = smashed;
    if (smashed >= 2) return complete(state, mission);
  }

  if (mission.kind === 'reach') {
    if (dist(player, MARLOW_DOOR) < REACH_RANGE) return complete(state, mission);
  }

  return [];
}
