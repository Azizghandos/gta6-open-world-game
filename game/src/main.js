// Boot and the one loop (chunk 2: systems wired in). Input is read every
// frame, the world advances in fixed 1/60 s steps (several in a slow frame,
// none in a fast one), and the renderer paints what is there. The game moves
// between title, help, play, paused, shop, busted and wasted screens.
// Missions, saving and synthesised sound live in their own modules now;
// this file only wires them to the world and the renderer.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { PLACES, PRICES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_HELP, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_SHOP, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_HELP, ACTION_MUTE, ACTION_PAUSE,
  ACTION_QUIT, ACTION_RELOAD, ACTION_SAVE, ACTION_TAXI, ACTION_WEAPON1,
  ACTION_WEAPON2, ACTION_WEAPON3, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { clearSave, hasSave, loadSave, saveGame } from './save.js';
import {
  failMission, missionPrompt, retryMission, startMission, updateMissions,
} from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

// For play-testing from the console or a script: window.__solmar.state.
window.__solmar = { world, state: world.state };

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let returnScreen = SCREEN_TITLE;
  let menuIndex = 0;
  let lastMoveY = 0;
  let banner = null;
  let bannerT = 0;
  let shop = null;
  let accumulator = 0;
  let last = performance.now();
  let lastEnemyShot = 0;
  let prevMissionDone = false;
  let prevMissionFailed = false;

  function announce(message) {
    status.textContent = message;
  }
  function menuItems() {
    const sound = audio.isMuted() ? 'Sound: Off' : 'Sound: On';
    return hasSave()
      ? ['Continue', 'New Game', 'How to Play', sound]
      : ['New Game', 'How to Play', sound];
  }
  function toggleMute() {
    audio.setMuted(!audio.isMuted());
  }

  function startNewGame() {
    world.reset();
    clearSave();
    screen = SCREEN_PLAY;
    announce('New game. Rosa is waiting at the diner — go see her.');
  }

  function continueGame() {
    const data = loadSave();
    if (!data) {
      startNewGame();
      return;
    }
    world.reset();
    world.applySave(data);
    screen = SCREEN_PLAY;
    announce('Welcome back, Leo. The city missed you.');
  }

  function respawn(kind) {
    const state = world.state;
    if (kind === 'busted') {
      state.cash = Math.floor(state.cash * 0.85);
      state.player.x = PLACES.policeHq.x;
      state.player.y = PLACES.policeHq.y + 70;
    } else {
      state.cash = Math.floor(state.cash * 0.9);
      state.player.x = PLACES.hospital.x;
      state.player.y = PLACES.hospital.y + 70;
    }
    state.hp = 100;
    state.wanted.heat = 0;
    state.wanted.stars = 0;
    state.wanted.hiddenTimer = 0;
    state.cops = [];
    state.enemies = [];
    state.bullets = [];
    if (state.player.car) {
      state.player.car = null;
      state.player.onFoot = true;
    }
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    screen = SCREEN_PLAY;
  }

  function nearPlace(place, radius) {
    const p = world.state.player;
    const dx = p.x - place.x;
    const dy = p.y - place.y;
    return dx * dx + dy * dy < radius * radius;
  }
  function promptFor() {
    const state = world.state;
    const p = state.player;
    if (state.dialog) return null;
    if (p.onFoot && nearPlace(PLACES.gunShop, 90)) return { text: 'Press E — Ironworks Arms (buy weapons)', action: 'gun' };
    if (!p.onFoot && nearPlace(PLACES.sprayShop, 90)) return { text: 'Press E — Spray ’n Go: repair $150, lose the cops', action: 'spray' };
    if (p.onFoot && nearPlace(PLACES.safehouse, 90)) return { text: 'Press E — Safehouse (rest, heal and save)', action: 'safehouse' };
    const mission = missionPrompt(world);
    if (mission) return mission;
    return null;
  }

  function openShop(kind) {
    if (kind === 'gun') {
      shop = {
        title: 'Ironworks Arms',
        items: [
          { name: 'P9 Pistol', desc: 'Sidearm + 48 rounds', price: PRICES.pistol, buy: () => { world.state.owned.pistol = true; world.state.ammo.pistol.reserve += 48; } },
          { name: 'VK-9 SMG', desc: 'Rapid fire + 120 rounds', price: PRICES.smg, buy: () => { world.state.owned.smg = true; world.state.ammo.smg.reserve += 120; } },
          { name: 'Pistol ammo ×48', desc: 'Restock', price: PRICES.pistolAmmo, buy: () => { world.state.ammo.pistol.reserve += 48; } },
          { name: 'SMG ammo ×120', desc: 'Restock', price: PRICES.smgAmmo, buy: () => { world.state.ammo.smg.reserve += 120; } },
          { name: 'Body armor', desc: '+50 armor', price: PRICES.armor, buy: () => { world.state.armor = Math.min(100, world.state.armor + 50); } },
        ],
      };
    } else {
      shop = {
        title: "Spray 'n Go",
        items: [
          { name: 'Full repair + repaint', desc: 'Fix the car, lose the cops', price: PRICES.spray, buy: () => {
            const car = world.state.player.car;
            if (car) {
              car.hp = 100;
              car.color = ['#c0392b', '#2e86c1', '#16a085', '#f39c12', '#8e44ad'][Math.floor(Math.random() * 5)];
            }
            world.state.wanted.heat = 0;
            world.state.wanted.stars = 0;
          } },
          { name: 'Repaint only', desc: 'A fresh colour', price: 50, buy: () => {
            const car = world.state.player.car;
            if (car) car.color = ['#c0392b', '#2e86c1', '#16a085', '#f39c12', '#8e44ad'][Math.floor(Math.random() * 5)];
          } },
        ],
      };
    }
    screen = SCREEN_SHOP;
  }

  function buyShopItem(index) {
    if (!shop || index < 0 || index >= shop.items.length) return;
    const item = shop.items[index];
    const state = world.state;
    if (state.cash < item.price) {
      world.addToast('Not enough cash');
      return;
    }
    state.cash -= item.price;
    item.buy();
    world.addToast(`Bought: ${item.name}`);
    audio.blip();
  }

  // Shop number keys live here, not in the input module.
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (screen === SCREEN_SHOP) {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(event.code);
      if (n >= 0) buyShopItem(n);
      if (event.code === 'Escape') screen = SCREEN_PLAY;
    }
  });

  // One-shot presses since the last frame, as a plain object.
  function takeEdges() {
    const actions = input.takeActions();
    const clicked = input.takeClick();
    if (actions !== 0 || clicked) audio.unlock();
    let weapon = 0;
    if (actions & ACTION_WEAPON1) weapon = 1;
    else if (actions & ACTION_WEAPON2) weapon = 2;
    else if (actions & ACTION_WEAPON3) weapon = 3;
    return {
      confirm: !!(actions & ACTION_CONFIRM) || clicked,
      pause: !!(actions & ACTION_PAUSE),
      enter: !!(actions & ACTION_ENTER),
      reload: !!(actions & ACTION_RELOAD),
      weapon,
      taxi: !!(actions & ACTION_TAXI),
      mute: !!(actions & ACTION_MUTE),
      help: !!(actions & ACTION_HELP),
      save: !!(actions & ACTION_SAVE),
      quit: !!(actions & ACTION_QUIT),
      click: clicked,
    };
  }

  function buildCtrl(edges) {
    const mv = input.move();
    const cam = world.state.camera;
    return {
      mx: mv.x,
      my: mv.y,
      run: input.run(),
      handbrake: input.handbrake(),
      aimX: cam.x - 640 + input.mouse.x,
      aimY: cam.y - 360 + input.mouse.y,
      firing: input.mouse.down,
      firePressed: edges.click,
      enterPressed: edges.enter,
      reloadPressed: edges.reload,
      weaponKey: edges.weapon,
    };
  }

  // Advance an open dialogue one line; when the last line passes, run what
  // it was waiting for (a failed mission retries from its start).
  function advanceDialog() {
    const dialog = world.state.dialog;
    if (!dialog) return;
    dialog.idx += 1;
    if (dialog.idx < dialog.lines.length) return;
    const done = dialog.onDone;
    world.state.dialog = null;
    if (done === 'mission-failed') retryMission(world);
  }

  // One frame of play: consume the fixed-step accumulator and return the
  // world's EVENT_* flags for this frame.
  function stepPlay(edges, dt) {
    const state = world.state;
    const prompt = promptFor();
    const ctrl = buildCtrl(edges);
    if (prompt && edges.enter) {
      if (prompt.action === 'gun' || prompt.action === 'spray') openShop(prompt.action);
      else if (prompt.action === 'safehouse') {
        state.hp = 100;
        if (saveGame(world)) world.addToast('Saved — health restored');
        else world.addToast('Rested — health restored');
      } else if (prompt.action === 'mission') {
        startMission(world, prompt.missionIndex);
      }
      ctrl.enterPressed = false;
    }
    if (edges.taxi) {
      state.taxi.on = !state.taxi.on;
      world.addToast(state.taxi.on ? 'Taxi jobs: ON — pick up fares' : 'Taxi jobs: OFF');
    }
    if (edges.mute) toggleMute();
    if (edges.help) {
      returnScreen = SCREEN_PLAY;
      screen = SCREEN_HELP;
      accumulator = 0;
      return 0;
    }
    // Snapshots for the sound hooks: what changed across this frame.
    const beforeCash = state.cash;
    const beforeWeapon = state.weapon;
    const beforeMag = state.ammo[beforeWeapon] ? state.ammo[beforeWeapon].mag : 0;
    const beforePunch = state.player.punchCd;
    const beforeShake = state.shake;
    const beforeCarHp = state.player.car ? state.player.car.hp : 0;
    const hadCar = !!state.player.car;
    const beforeEnemyBullets = state.bullets.filter((b) => b.from !== 'player').length;
    let events = 0;
    let first = true;
    while (accumulator >= STEP) {
      const stepCtrl = first ? ctrl : { ...ctrl, enterPressed: false, reloadPressed: false, firePressed: false, weaponKey: 0 };
      events |= world.step(STEP, stepCtrl);
      accumulator -= STEP;
      first = false;
      if (screen !== SCREEN_PLAY) break;
    }
    // Sound hooks: shots, punches, cash, explosions, crashes, enemy fire.
    if (state.ammo[beforeWeapon] && state.ammo[beforeWeapon].mag < beforeMag) audio.shoot(beforeWeapon);
    if (beforePunch <= 0 && state.player.punchCd > 0) audio.punch();
    if (state.cash > beforeCash) audio.cash();
    if (state.shake >= 14 && beforeShake < 14) audio.explosion();
    if (state.player.car && state.player.car.hp < beforeCarHp) audio.crash(0.3);
    const enemyBullets = state.bullets.filter((b) => b.from !== 'player').length;
    if (enemyBullets > beforeEnemyBullets && performance.now() - lastEnemyShot > 300) {
      lastEnemyShot = performance.now();
      audio.enemyShoot();
    }
    if (!hadCar && state.player.car) audio.horn();
    // Missions: advance the interpreter, then react to finishing or failing.
    updateMissions(world, dt);
    const m = state.mission;
    const doneNow = !!(m && m.done);
    const failedNow = !!(m && m.failed);
    if (doneNow && !prevMissionDone) {
      audio.missionDone();
      banner = 'Mission Complete';
      bannerT = 3;
    }
    if (failedNow && !prevMissionFailed) {
      audio.missionFail();
      banner = 'Mission Failed';
      bannerT = 3;
    }
    prevMissionDone = doneNow;
    prevMissionFailed = failedNow;
    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    const edges = takeEdges();
    const state = world.state;

    if (screen !== SCREEN_PLAY) {
      audio.engine(0, false);
      audio.siren(false);
    }

    if (screen === SCREEN_TITLE) {
      // Attract mode: traffic runs, the camera drifts over downtown.
      const ctrl = { mx: 0, my: 0, run: false, handbrake: false, aimX: 0, aimY: 0, firing: false, firePressed: false, enterPressed: false, reloadPressed: false, weaponKey: 0 };
      while (accumulator >= STEP) {
        world.step(STEP, ctrl);
        accumulator -= STEP;
      }
      state.camera.x = 1550 + Math.cos(state.elapsed * 0.05) * 420;
      state.camera.y = 1350 + Math.sin(state.elapsed * 0.05) * 300;
      const mv = input.move();
      if (mv.y === -1 && lastMoveY !== -1) menuIndex = (menuIndex + menuItems().length - 1) % menuItems().length;
      if (mv.y === 1 && lastMoveY !== 1) menuIndex = (menuIndex + 1) % menuItems().length;
      lastMoveY = mv.y;
      if (edges.confirm || edges.click) {
        const item = menuItems()[menuIndex];
        if (item === 'Continue') continueGame();
        else if (item === 'New Game') startNewGame();
        else if (item === 'How to Play') {
          returnScreen = SCREEN_TITLE;
          screen = SCREEN_HELP;
        } else if (item.startsWith('Sound:')) toggleMute();
      }
      if (edges.mute) toggleMute();
      renderer.draw(state, screen, { hasSave: hasSave(), menuIndex, muted: audio.isMuted() });
      return;
    }

    if (screen === SCREEN_HELP) {
      if (edges.confirm || edges.pause || edges.help) screen = returnScreen;
      renderer.draw(state, screen, { hasSave: hasSave(), menuIndex, muted: audio.isMuted() });
      return;
    }

    if (screen === SCREEN_SHOP) {
      if (edges.pause) screen = SCREEN_PLAY;
      renderer.draw(state, screen, { shopTitle: shop.title, shopItems: shop.items, menuIndex: 0, muted: audio.isMuted(), mouse: input.mouse });
      return;
    }

    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (edges.confirm || edges.click) respawn(screen === SCREEN_BUSTED ? 'busted' : 'wasted');
      renderer.draw(state, screen, { hasSave: hasSave(), menuIndex, muted: audio.isMuted(), mouse: input.mouse });
      return;
    }

    if (screen === SCREEN_PAUSED) {
      if (edges.pause || edges.confirm) screen = SCREEN_PLAY;
      if (edges.help) {
        returnScreen = SCREEN_PAUSED;
        screen = SCREEN_HELP;
      }
      if (edges.save) {
        if (saveGame(world)) {
          world.addToast('Game saved');
          announce('Game saved.');
        } else {
          announce('Could not save.');
        }
      }
      if (edges.quit) {
        world.reset();
        screen = SCREEN_TITLE;
        announce('SOLMAR. Press Enter or click to start.');
      }
      renderer.draw(state, screen, {
        hasSave: hasSave(), menuIndex, muted: audio.isMuted(), mouse: input.mouse,
        pausedPrompt: 'S save · Q quit to title · P / Esc resume · H help',
      });
      accumulator = 0;
      return;
    }

    // SCREEN_PLAY.
    if (state.dialog) {
      // Dialogue freezes the world; Enter or a click moves it on.
      if (edges.confirm) advanceDialog();
      renderer.draw(state, screen, {
        hasSave: hasSave(), menuIndex, muted: audio.isMuted(), mouse: input.mouse,
        prompt: null, banner: bannerT > 0 ? banner : null,
        bannerT: bannerT > 0 ? Math.min(1, bannerT) : 0,
      });
      accumulator = 0;
      return;
    }
    if (edges.pause) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      renderer.draw(state, screen, {
        hasSave: hasSave(), menuIndex, muted: audio.isMuted(), mouse: input.mouse,
        pausedPrompt: 'S save · Q quit to title · P / Esc resume · H help',
      });
      accumulator = 0;
      return;
    }
    const events = stepPlay(edges, dt);
    if (events & EVENT_BUSTED) {
      if (state.mission && state.mission.active) failMission(world, 'busted');
      screen = SCREEN_BUSTED;
      announce('Busted.');
    } else if (events & EVENT_WASTED) {
      if (state.mission && state.mission.active) failMission(world, 'wasted');
      screen = SCREEN_WASTED;
      announce('Wasted.');
    }
    // Driving sounds follow the car; the siren follows the wanted stars.
    const driving = !!state.player.car;
    const speed01 = driving ? Math.min(1, Math.abs(state.player.car.speed) / 560) : 0;
    audio.engine(speed01, driving);
    audio.siren(state.wanted.stars > 0);
    if (bannerT > 0) bannerT -= dt;
    const prompt = promptFor();
    renderer.draw(state, screen, {
      hasSave: hasSave(), menuIndex, muted: audio.isMuted(), mouse: input.mouse,
      prompt: prompt ? prompt.text : null,
      banner: bannerT > 0 ? banner : null,
      bannerT: bannerT > 0 ? Math.min(1, bannerT) : 0,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('SOLMAR. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
