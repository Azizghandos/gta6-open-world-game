// ?shot= staging: drive the fresh world into the exact scene each screenshot
// needs, so chunk 3 captures real renders of the game's own code. The shot
// names come from shots.json: start (title screen), play (driving; seed 7 is
// the chase), end (a mission in progress at Vince Marlow's door).
import { STEP } from './config.js';
import { giveCar, placePlayer, setWanted, spawnPolice, stepWorld } from './world.js';

function driveFor(state, seconds) {
  const control = {
    moveX: 0,
    moveY: -1,
    fire: false,
    aimX: state.player.x + 400,
    aimY: state.player.y,
    interact: false,
  };
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(state, control, STEP);
}

/** Stage `state` for one shot and return the screen to show ('title' | 'play'). */
export function stageShot(state, shot, seed) {
  if (shot === 'start') {
    // On foot on a Marina street, the city behind the title panel.
    placePlayer(state, 600, 760, 0);
    return 'title';
  }
  if (shot === 'play') {
    // Behind the wheel of a Sport on a Downtown road, traffic moving.
    giveCar(state, 7, 600, 1400, 0);
    driveFor(state, 2.5);
    if (seed === 7) {
      // The chase: two stars, two Interceptors closing in from behind.
      // A 200 minimum keeps them in frame instead of far down the road.
      setWanted(state, 2);
      spawnPolice(state, 2, state.player.x - 320, state.player.y, 200);
      driveFor(state, 1.5);
    }
    return 'play';
  }
  if (shot === 'end') {
    // The final mission: on foot at Marlow's door in Solmar Hills, the
    // yellow marker and the mission banner in frame.
    state.mission.index = 5;
    state.mission.stage = 0;
    state.mission.data = {};
    placePlayer(state, 2600, 1330, -Math.PI / 2);
    return 'play';
  }
  return 'play';
}
