// Boot and the game loop: fixed 60 Hz steps, five screens (title, play, paused,
// over, busted), autosave every few seconds, and ?shot= staging for screenshots.
// The world, the renderer and the systems each own their own job; this file only
// wires them together.
import { STEP } from './config.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createWorld, stepWorld, worldLoad, worldSnapshot } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { clearSave, loadGame, saveGame } from './save.js';
import { createMissionState, missionTarget, updateMissions } from './missions.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 1;
const shot = params.get('shot');

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

let camera = { camX: 0, camY: 0, scale: 1 };
const input = createInput(canvas, () => camera);

let state = createWorld(seed);
let screen = SCREEN_TITLE;
let prevWanted = 0;
let lastSave = 0;
let lastStatus = '';

if (!shot) {
  const saved = loadGame();
  if (saved && saved.player) {
    try {
      worldLoad(state, saved);
      screen = SCREEN_PLAY;
    } catch {
      state = createWorld(seed);
    }
  }
}

if (shot) {
  screen = stageShot(state, shot, seed);
}

function playEventSounds() {
  for (const event of state.events) {
    if (event.type === 'shot') audio.shot(event.weapon);
    else if (event.type === 'thud') audio.thud();
    else if (event.type === 'pickup') audio.pickup();
    else if (event.type === 'fare' || event.type === 'buy') audio.cash();
    else if (event.type === 'crash' || event.type === 'ram') audio.crash();
  }
  if (state.wanted > prevWanted) audio.siren();
  prevWanted = state.wanted;
}

function switchWeapon(name) {
  const p = state.player;
  if (name === 'fists') {
    p.weapon = 'fists';
    return;
  }
  if ((p.ammo[name] || 0) > 0) {
    p.weapon = name;
  } else {
    state.message = `No ammo for the ${name}. Find some on the street or buy it.`;
    state.messageTimer = 2;
  }
}

function resetWorld() {
  state = createWorld(seed);
  state.mission = createMissionState();
  prevWanted = 0;
  clearSave();
}

function updateStatus() {
  const mission = state.mission.index < 6 ? `Mission ${state.mission.index + 1} of 6` : 'Story complete';
  const text = `SOLMAR — ${screen}. ${mission}. Cash $${state.player.cash}. Wanted ${state.wanted} of 5. ${state.message}`;
  if (text !== lastStatus) {
    lastStatus = text;
    if (statusEl) statusEl.textContent = text;
  }
}

const NEUTRAL = { moveX: 0, moveY: 0, fire: false, aimX: 0, aimY: 0, interact: false };

let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const control = input.poll();

  if (screen === SCREEN_TITLE) {
    if (control.start) {
      audio.ensure();
      audio.click();
      screen = SCREEN_PLAY;
    }
    acc += dt;
    while (acc >= STEP) {
      stepWorld(state, NEUTRAL, STEP);
      acc -= STEP;
    }
    state.events.length = 0;
  } else if (screen === SCREEN_PLAY) {
    if (control.pause) {
      audio.click();
      screen = SCREEN_PAUSED;
    } else {
      if (control.weapon) switchWeapon(control.weapon);
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 8) {
        stepWorld(state, control, STEP);
        acc -= STEP;
        guard += 1;
      }
      const happenings = updateMissions(state);
      if (happenings.includes('complete')) audio.mission();
      playEventSounds();
      state.events.length = 0;
      if (state.dead) screen = SCREEN_OVER;
      else if (state.busted) screen = SCREEN_BUSTED;
      audio.engine(state.player.inCar !== null ? state.player.speed / 500 : 0);
      if (now - lastSave > 5000) {
        lastSave = now;
        saveGame(worldSnapshot(state));
      }
    }
  } else if (screen === SCREEN_PAUSED) {
    if (control.pause || control.start) {
      audio.click();
      screen = SCREEN_PLAY;
    }
  } else if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
    if (control.start) {
      audio.ensure();
      audio.click();
      resetWorld();
      screen = SCREEN_PLAY;
    }
  }

  camera = renderer.draw(state, screen, { target: missionTarget(state) });
  updateStatus();
  requestAnimationFrame(frame);
}

window.addEventListener('pagehide', () => {
  if (screen === SCREEN_PLAY) saveGame(worldSnapshot(state));
});

requestAnimationFrame(frame);
