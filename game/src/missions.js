// The story of SOLMAR: six missions for Leo Costa, a wheelman back in town
// owing money to the wrong people, and the fixer Rosa Delgado who gives him
// work. A mission is data — a name, a giver, intro and outro lines, a list
// of steps and a reward — and the runner below is a small interpreter: each
// step type knows how to start, how to tell the player what to do, and when
// it is done. Failing (wasted, busted, or a step's own fail rule) offers a
// retry. Missions are started at Rosa's Diner; progress saves with the game.
import { PLACES } from './config.js';

export const MISSION_DEFS = [
  {
    name: 'Back in Solmar',
    giver: 'Rosa',
    reward: 300,
    intro: [
      { who: 'Rosa', text: 'Leo! You came back. Good. The docks crew has a package for me — go get it.' },
      { who: 'Rosa', text: 'Take a car, any car. Drive to the docks, grab the package, bring it to my diner.' },
    ],
    outro: [
      { who: 'Rosa', text: 'You still drive like a maniac. I like it. There is more work if you want it.' },
    ],
    steps: [
      { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, r: 70, text: 'Drive to the docks' },
      { type: 'hold', x: PLACES.docks.x, y: PLACES.docks.y, r: 60, seconds: 3, text: 'Pick up the package (stay by the crates)' },
      { type: 'deliver', x: PLACES.diner.x, y: PLACES.diner.y, r: 70, text: 'Deliver the package to Rosa’s Diner' },
    ],
  },
  {
    name: 'Hot Property',
    giver: 'Rosa',
    reward: 500,
    intro: [
      { who: 'Rosa', text: 'A client wants a Comet GT — red, parked outside the Palms Hotel on the beach.' },
      { who: 'Rosa', text: 'Bring it to the chop shop in one piece. The cops will not like it. Neither will I, if you scratch it.' },
    ],
    outro: [
      { who: 'Rosa', text: 'Clean. The client paid double. You are earning your keep, Leo.' },
    ],
    steps: [
      { type: 'steal', model: 'sports', color: '#ff2d55', x: PLACES.beachHotel.x, y: PLACES.beachHotel.y + 60, text: 'Steal the red Comet GT at the Palms Hotel' },
      { type: 'deliverCar', x: PLACES.chopShop.x, y: PLACES.chopShop.y, r: 80, text: 'Deliver the Comet GT to the chop shop' },
    ],
  },
  {
    name: 'The Drop',
    giver: 'Rosa',
    reward: 700,
    intro: [
      { who: 'Rosa', text: 'Vince Marlow’s boys want my corner. A contact is waiting in Central Park with a briefcase.' },
      { who: 'Rosa', text: 'Go on foot. It will not stay quiet — here, take this pistol. You will need it.' },
    ],
    outro: [
      { who: 'Rosa', text: 'You walked into an ambush and walked out. Vince will remember that.' },
    ],
    steps: [
      { type: 'goto', x: PLACES.park.x, y: PLACES.park.y, r: 70, text: 'Meet the contact in Central Park' },
      { type: 'kill', count: 4, at: [[1280, 1280], [1420, 1420], [1300, 1460], [1440, 1300]], text: 'Ambush! Take out Vince’s shooters (0/4)' },
      { type: 'deliver', x: PLACES.safehouse.x, y: PLACES.safehouse.y, r: 70, text: 'Bring the briefcase to the safehouse' },
    ],
  },
  {
    name: 'Getaway',
    giver: 'Rosa',
    reward: 900,
    intro: [
      { who: 'Rosa', text: 'The bank job is tomorrow, and the crew needs a driver who can lose a tail.' },
      { who: 'Rosa', text: 'Prove it: get the cops on you, then lose them. Three stars, ninety seconds, no jail.' },
    ],
    outro: [
      { who: 'Rosa', text: 'Three stars and you vanished like smoke. You are driving tomorrow.' },
    ],
    steps: [
      { type: 'heat', stars: 3, text: 'Raise your wanted level to 3 stars' },
      { type: 'escape', seconds: 90, text: 'Lose the cops — get back to 0 stars (90s)' },
    ],
  },
  {
    name: 'The Solmar Job',
    giver: 'Rosa',
    reward: 2500,
    intro: [
      { who: 'Rosa', text: 'Today we rob the Solmar National Bank. Walk in, hold the vault door, take the cash.' },
      { who: 'Rosa', text: 'The alarm will bring every cop in the city. Get out, get to the safehouse, do not get caught.' },
    ],
    outro: [
      { who: 'Rosa', text: 'Two and a half grand, and the whole city saw you do it. Vince is furious. Good.' },
    ],
    steps: [
      { type: 'goto', x: PLACES.bank.x, y: PLACES.bank.y, r: 70, text: 'Get to the Solmar National Bank' },
      { type: 'hold', x: PLACES.bank.x, y: PLACES.bank.y, r: 60, seconds: 5, text: 'Crack the vault (stay by the door)' },
      { type: 'survive', seconds: 45, text: 'Hold off the police — survive 45 seconds' },
      { type: 'deliver', x: PLACES.safehouse.x, y: PLACES.safehouse.y, r: 70, text: 'Escape to the safehouse' },
    ],
  },
  {
    name: 'King of the Coast',
    giver: 'Rosa',
    reward: 5000,
    intro: [
      { who: 'Rosa', text: 'Vince Marlow wants to meet at the docks. It is a trap, and we are walking into it on purpose.' },
      { who: 'Rosa', text: 'End this tonight, Leo. Then Solmar is ours.' },
    ],
    outro: [
      { who: 'Leo', text: 'It is done. Solmar is ours now.' },
      { who: 'Rosa', text: 'King of the coast. Come home, Leo. Dinner is on me.' },
    ],
    steps: [
      { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, r: 70, text: 'Meet Vince at the docks' },
      { type: 'kill', count: 6, at: [[380, 2620], [480, 2720], [320, 2780], [560, 2660], [420, 2820], [300, 2700]], text: 'Ambush! Take out Vince’s crew (0/6)' },
      { type: 'chase', text: 'Vince is running — ram his car until it stops' },
    ],
  },
];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// Start a mission: show its intro dialogue, then hand the player the first
// step once the dialogue is done (updateMissions activates it).
export function startMission(world, index) {
  const def = MISSION_DEFS[index];
  const state = world.state;
  state.mission = {
    index, step: 0, timer: 0, hold: 0, killsAtStart: state.stats.kills,
    data: {}, active: false, started: true, failed: false, done: false,
  };
  state.dialog = { lines: def.intro, idx: 0, onDone: 'mission-start' };
  state.objective = { text: def.name, x: 0, y: 0 };
  return state.mission;
}

function updateObjective(world) {
  const m = world.state.mission;
  const def = MISSION_DEFS[m.index];
  const step = def.steps[m.step];
  let text = step.text;
  if (step.type === 'kill') {
    const done = world.state.stats.kills - m.killsAtStart;
    text = step.text.replace(/\(\d+\/\d+\)/, `(${Math.min(done, step.count)}/${step.count})`);
  }
  let x = step.x !== undefined ? step.x : world.state.player.x;
  let y = step.y !== undefined ? step.y : world.state.player.y;
  if (step.type === 'kill' && step.at) {
    x = step.at[0][0];
    y = step.at[0][1];
  }
  if (step.type === 'chase' && m.data.targetCar) {
    x = m.data.targetCar.x;
    y = m.data.targetCar.y;
  }
  world.state.objective = { text, x, y };
}

function beginStep(world) {
  const m = world.state.mission;
  const def = MISSION_DEFS[m.index];
  const step = def.steps[m.step];
  const state = world.state;
  m.timer = 0;
  m.hold = 0;
  m.killsAtStart = state.stats.kills;
  m.data = {};
  if (step.type === 'steal') {
    const car = world.makeCar(step.x, step.y, 0, step.model, step.color, 'parked');
    car.driver = null;
    m.data.targetCar = car;
  }
  if (step.type === 'kill') {
    // A shootout is only fair with a gun: hand the player Rosa's pistol if
    // they own no firearm yet, so the step can never soft-lock.
    if (!state.owned.pistol && !state.owned.smg) {
      state.owned.pistol = true;
      state.ammo.pistol.reserve += 48;
      world.addToast('Rosa gave you a pistol');
    }
    for (const [x, y] of step.at) world.spawnEnemy(x, y);
  }
  if (step.type === 'chase') {
    const car = world.makeCar(state.player.x + 260, state.player.y, 0, 'sports', '#111111', 'traffic');
    car.driver = 'traffic';
    car.cruise = 380;
    car.hp = 120;
    m.data.targetCar = car;
    world.addToast('Vince is getting away!');
  }
  if (step.type === 'heat') {
    // Enough heat for three stars at once: the step is about losing them.
    world.addHeat(430);
  }
  if (step.type === 'survive') {
    world.addHeat(300);
    for (let i = 0; i < 2; i += 1) world.spawnFootCop();
  }
  updateObjective(world);
}

function completeMission(world) {
  const m = world.state.mission;
  const def = MISSION_DEFS[m.index];
  const state = world.state;
  world.addCash(def.reward);
  state.stats.missions += 1;
  m.done = true;
  m.active = false;
  state.objective = null;
  state.dialog = { lines: def.outro, idx: 0, onDone: 'mission-done' };
  if (m.index === MISSION_DEFS.length - 1) {
    state.storyComplete = true;
    world.addToast('STORY COMPLETE — you are the King of the Coast');
  }
  // The next mission starts at Rosa's diner.
  m.next = m.index + 1 < MISSION_DEFS.length ? m.index + 1 : null;
}

export function failMission(world, reason) {
  const m = world.state.mission;
  if (!m || m.failed || m.done) return;
  m.failed = true;
  m.active = false;
  world.state.objective = null;
  world.state.dialog = {
    lines: [{ who: 'SOLMAR', text: `Mission failed — ${reason}. Press Enter to try again.` }],
    idx: 0,
    onDone: 'mission-failed',
  };
}

// Called every frame while a mission is live. Returns nothing; it mutates
// world.state (objective, dialogue, wanted level, spawns) as steps complete.
export function updateMissions(world, dt) {
  const state = world.state;
  const m = state.mission;
  if (!m || m.done) return;
  if (m.failed) return;
  const def = MISSION_DEFS[m.index];
  if (!m.active) {
    // Waiting for the intro dialogue to finish.
    if (!state.dialog) {
      m.active = true;
      beginStep(world);
    }
    return;
  }
  const step = def.steps[m.step];
  const p = state.player;
  const d2 = (x, y) => dist2(p.x, p.y, x, y);

  function nextStep() {
    m.step += 1;
    if (m.step >= def.steps.length) completeMission(world);
    else beginStep(world);
  }

  switch (step.type) {
    case 'goto':
      if (d2(step.x, step.y) < step.r * step.r) nextStep();
      break;
    case 'deliver':
      if (d2(step.x, step.y) < step.r * step.r) nextStep();
      break;
    case 'deliverCar':
      if (!p.onFoot && d2(step.x, step.y) < step.r * step.r) nextStep();
      break;
    case 'steal': {
      const car = m.data.targetCar;
      if (car && p.car === car) nextStep();
      else if (car && !state.cars.includes(car)) failMission(world, 'the target car was destroyed');
      break;
    }
    case 'hold': {
      if (d2(step.x, step.y) < step.r * step.r) {
        m.hold += dt;
        state.objective.text = `${step.text} — ${Math.ceil(step.seconds - m.hold)}s`;
        if (m.hold >= step.seconds) nextStep();
      } else {
        m.hold = 0;
        updateObjective(world);
      }
      break;
    }
    case 'kill': {
      const done = state.stats.kills - m.killsAtStart;
      updateObjective(world);
      if (done >= step.count) nextStep();
      break;
    }
    case 'survive': {
      m.timer += dt;
      state.objective.text = `${step.text} — ${Math.ceil(step.seconds - m.timer)}s`;
      if (m.timer >= step.seconds) nextStep();
      break;
    }
    case 'heat': {
      if (state.wanted.stars >= step.stars) nextStep();
      break;
    }
    case 'escape': {
      m.timer += dt;
      state.objective.text = `${step.text} — ${Math.ceil(step.seconds - m.timer)}s`;
      if (state.wanted.stars === 0) nextStep();
      else if (m.timer >= step.seconds) failMission(world, 'the cops never lost you');
      break;
    }
    case 'chase': {
      const car = m.data.targetCar;
      if (!car || !state.cars.includes(car)) nextStep();
      else if (p.car === car) nextStep(); // caught his car: that stops him too
      else if (dist2(car.x, car.y, p.x, p.y) > 1400 * 1400) failMission(world, 'Vince got away');
      break;
    }
    default:
      nextStep();
      break;
  }
}

// A mission failed while the player was wasted or busted: retry from its start.
export function retryMission(world) {
  const m = world.state.mission;
  if (!m) return;
  startMission(world, m.index);
}

// The player can start the next story mission by going to Rosa's diner.
// Returns the next mission index, or null when none is available right now.
export function nextMissionAvailable(world) {
  const m = world.state.mission;
  if (!m) return 0;
  if (m.done) {
    const next = m.next !== undefined ? m.next : m.index + 1;
    return next !== null && next < MISSION_DEFS.length ? next : null;
  }
  if (m.failed) return null; // retry comes from the fail dialogue, not the diner
  if (!m.started) return m.index; // loaded from a save: next up, not started
  return null; // a mission is in progress
}

// Prompt shown at the diner when a mission is available, or null.
export function missionPrompt(world) {
  const idx = nextMissionAvailable(world);
  if (idx === null) return null;
  const state = world.state;
  if (state.dialog) return null;
  if (state.mission && state.mission.active) return null;
  if (!state.player.onFoot) return null;
  if (dist2(state.player.x, state.player.y, PLACES.diner.x, PLACES.diner.y) > 90 * 90) return null;
  const def = MISSION_DEFS[idx];
  return {
    text: `Press E — Rosa's Diner (Mission ${idx + 1}: ${def.name} — $${def.reward})`,
    action: 'mission',
    missionIndex: idx,
  };
}
