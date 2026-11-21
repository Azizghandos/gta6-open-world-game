// SOLMAR's city and its rules, with no drawing and no browser in it: the
// street grid, buildings, traffic, pedestrians, police, combat, the wanted
// level, the clock, pickups, taxi fares and the hidden packages. step()
// advances one fixed step and returns what happened as bit flags, so the
// caller can react (sounds, screens, saves) without the world knowing
// about them.
import {
  BULLET_SPEED, CAR, CAR_MODELS, HEAT, HOUR_SECONDS, PALETTE, PLACES,
  PLAYER, POPULATION, PRICES, STEP, STREETS, WANTED_STARS, WEAPONS, WORLD,
} from './config.js';
import { pick, range } from './random.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_KILL = 4;
export const EVENT_CRASH = 8;
export const EVENT_STEAL = 16;
export const EVENT_SHOT = 32;
export const EVENT_PICKUP = 64;
export const EVENT_CASH = 128;
export const EVENT_EXPLOSION = 256;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, nx, ny) < r * r;
}
function resolveCircleRect(obj, r, rect) {
  const nx = clamp(obj.x, rect.x, rect.x + rect.w);
  const ny = clamp(obj.y, rect.y, rect.y + rect.h);
  const dx = obj.x - nx;
  const dy = obj.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    obj.x = nx + (dx / d) * r;
    obj.y = ny + (dy / d) * r;
  } else {
    // Centre inside the rectangle: push out along the smallest penetration.
    const left = obj.x - rect.x;
    const right = rect.x + rect.w - obj.x;
    const top = obj.y - rect.y;
    const bottom = rect.y + rect.h - obj.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) obj.x = rect.x - r;
    else if (min === right) obj.x = rect.x + rect.w + r;
    else if (min === top) obj.y = rect.y - r;
    else obj.y = rect.y + rect.h + r;
  }
  return true;
}

// Daylight factor 0..1 from the clock: full day 07:00-17:00, dusk to 20:00,
// night to 05:00, dawn to 07:00.
export function daylight(timeMinutes) {
  const h = (timeMinutes / 60) % 24;
  if (h >= 7 && h < 17) return 1;
  if (h >= 17 && h < 20) return 1 - (h - 17) / 3;
  if (h >= 20 || h < 5) return 0;
  return (h - 5) / 2;
}

export function createWorld(random) {
  // ---- city generation (deterministic from the seed) ----
  const buildings = [];
  const trees = [];
  const lamps = [];
  const bounds = [0, ...STREETS, WORLD.size];
  const parkBlock = { x0: 1150 + 61, y0: 1150 + 61, x1: 1550 - 61, y1: 1550 - 61 };
  const pond = { x: 1350, y: 1350, r: 62 };

  function addBuilding(x, y, w, h, hgt, color, roof) {
    buildings.push({ x, y, w, h, hgt, color, roof, seed: random() });
  }
  function districtAt(bx, by) {
    if (bx >= 1150 && bx < 2350 && by >= 750 && by < 1950) return 'downtown';
    if (bx < 1150 && by >= 2350) return 'docks';
    if (bx < 1150) return 'residential';
    return 'mixed';
  }
  for (let i = 0; i < bounds.length - 1; i += 1) {
    for (let j = 0; j < bounds.length - 1; j += 1) {
      const bx0 = bounds[i] + 61;
      const bx1 = bounds[i + 1] - 61;
      const by0 = bounds[j] + 61;
      const by1 = bounds[j + 1] - 61;
      if (bx1 - bx0 < 60 || by1 - by0 < 60) continue;
      if (bx0 >= 2900) continue; // beach strip: sand, no buildings
      if (bx0 >= parkBlock.x0 - 1 && bx0 <= parkBlock.x1 && by0 >= parkBlock.y0 - 1 && by0 <= parkBlock.y1) continue; // park
      const district = districtAt(bx0, by0);
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (district === 'downtown') {
        const split = random() < 0.5;
        if (split) {
          addBuilding(bx0 + 8, by0 + 8, bw / 2 - 16, bh - 16, range(random, 46, 92), PALETTE.downtownRoof, '#3d4a5a');
          addBuilding(bx0 + bw / 2 + 8, by0 + 8, bw / 2 - 16, bh - 16, range(random, 30, 70), PALETTE.downtownRoof, '#46586a');
        } else {
          addBuilding(bx0 + 10, by0 + 10, bw - 20, bh - 20, range(random, 55, 95), PALETTE.downtownRoof, '#3d4a5a');
        }
      } else if (district === 'docks') {
        addBuilding(bx0 + 6, by0 + 6, bw - 12, bh - 12, range(random, 18, 28), PALETTE.warehouseRoof, '#556655');
        for (let c = 0; c < 3; c += 1) {
          addBuilding(bx0 + 20 + c * 70, by1 - 46, 56, 30, 10, pick(random, ['#b03a2e', '#2874a6', '#7d6608', '#1e8449']), '#222');
        }
      } else if (district === 'residential') {
        const cols = 2;
        const rows = 2;
        const houseColors = ['#a8574a', '#b07a45', '#7a5a6e', '#5a7a5a', '#96684a'];
        const roofColors = ['#8a4a3e', '#8a5f36', '#5f4457', '#466046', '#75523a'];
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            const w = bw / cols - 24;
            const h = bh / rows - 24;
            const ci = Math.floor(random() * houseColors.length);
            addBuilding(bx0 + 12 + cx * (bw / cols), by0 + 12 + cy * (bh / rows), w, h, range(random, 12, 22), houseColors[ci], roofColors[ci]);
          }
        }
      } else {
        addBuilding(bx0 + 10, by0 + 10, bw * 0.55 - 14, bh - 20, range(random, 20, 44), PALETTE.buildingRoof, '#5d564e');
        addBuilding(bx0 + bw * 0.55 + 6, by0 + 10, bw * 0.45 - 16, bh * 0.5 - 14, range(random, 14, 30), PALETTE.buildingRoof, '#5d564e');
      }
    }
  }
  // Park trees and pond-side palms.
  for (let i = 0; i < 46; i += 1) {
    const x = range(random, parkBlock.x0 + 10, parkBlock.x1 - 10);
    const y = range(random, parkBlock.y0 + 10, parkBlock.y1 - 10);
    if (dist2(x, y, pond.x, pond.y) < (pond.r + 14) * (pond.r + 14)) continue;
    trees.push({ x, y, r: range(random, 9, 15), palm: false });
  }
  for (let i = 0; i < 26; i += 1) {
    trees.push({ x: range(random, 2960, 3100), y: range(random, 60, 3140), r: range(random, 10, 15), palm: true });
  }
  for (let i = 0; i < 40; i += 1) {
    const x = range(random, 80, 3120);
    const y = range(random, 80, 3120);
    if (buildings.some((b) => circleHitsRect(x, y, 24, b))) continue;
    if (isOnRoad(x, y)) continue;
    trees.push({ x, y, r: range(random, 8, 13), palm: false });
  }
  // Street lamps along every street.
  for (const s of STREETS) {
    for (let p = 120; p < WORLD.size; p += 260) {
      lamps.push({ x: s - 58, y: p });
      lamps.push({ x: p, y: s - 58 });
    }
  }

  function isOnRoad(x, y) {
    for (const s of STREETS) {
      if (Math.abs(x - s) <= WORLD.roadHalf + WORLD.sidewalk) return true;
      if (Math.abs(y - s) <= WORLD.roadHalf + WORLD.sidewalk) return true;
    }
    return false;
  }
  function nearestStreetCoord(v) {
    let best = STREETS[0];
    for (const s of STREETS) if (Math.abs(v - s) < Math.abs(v - best)) best = s;
    return best;
  }
  function randomRoadPoint(minDistFrom, minDist) {
    for (let tries = 0; tries < 40; tries += 1) {
      const vertical = random() < 0.5;
      const s = pick(random, STREETS);
      const along = range(random, 120, WORLD.size - 120);
      const x = vertical ? s : along;
      const y = vertical ? along : s;
      if (minDistFrom && dist2(x, y, minDistFrom.x, minDistFrom.y) < minDist * minDist) continue;
      return { x, y };
    }
    return { x: 1550, y: 1550 };
  }
  function randomSidewalkPoint(near, radius) {
    for (let tries = 0; tries < 30; tries += 1) {
      const vertical = random() < 0.5;
      const s = pick(random, STREETS);
      const along = clamp((near ? (vertical ? near.y : near.x) : 1600) + range(random, -radius, radius), 100, WORLD.size - 100);
      const off = (random() < 0.5 ? -1 : 1) * (WORLD.roadHalf + 8);
      const x = vertical ? s + off : along;
      const y = vertical ? along : s + off;
      if (x < 40 || x > 3160 || y < 40 || y > 3160) continue;
      if (x > 3050) continue;
      return { x, y };
    }
    return { x: 1550, y: 1550 };
  }

  const city = { buildings, trees, lamps, park: parkBlock, pond, waterX: 3110, sandX: 2950, pier: { x: 2950, y: 1480, w: 230, h: 80 } };

  // ---- dynamic state ----
  const state = {
    city,
    time: 540, // 09:00 on the first morning
    cash: 150,
    hp: PLAYER.maxHp,
    armor: 0,
    weapon: 'fists',
    ammo: { pistol: { mag: 12, reserve: 48 }, smg: { mag: 0, reserve: 0 } },
    owned: { pistol: false, smg: false },
    player: { x: 350, y: 420, angle: -Math.PI / 2, vx: 0, vy: 0, onFoot: true, car: null, speed: 0, aimAngle: -Math.PI / 2, fireCd: 0, punchCd: 0, invuln: 0 },
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    parts: [],
    pickups: [],
    packages: [],
    wanted: { heat: 0, stars: 0, hidden: true, hiddenTimer: 0 },
    camera: { x: 350, y: 420 },
    shake: 0,
    toasts: [],
    objective: null,
    dialog: null,
    mission: null,
    taxi: { on: false, fare: null },
    stats: { kills: 0, stolen: 0, earned: 0, fares: 0, packages: 0, missions: 0 },
    storyComplete: false,
    elapsed: 0,
  };

  let carId = 1;

  function addToast(text) {
    state.toasts.push({ text, t: 4.5 });
    if (state.toasts.length > 4) state.toasts.shift();
  }
  function addCash(amount, silent) {
    state.cash += amount;
    state.stats.earned += amount;
    if (!silent) addToast(`+$${amount}`);
  }
  function addHeat(amount) {
    state.wanted.heat = clamp(state.wanted.heat + amount, 0, 1000);
  }
  function starsFor(heat) {
    let stars = 0;
    for (let i = 1; i < WANTED_STARS.length; i += 1) if (heat >= WANTED_STARS[i]) stars = i;
    return stars;
  }
  function makeCar(x, y, angle, modelName, color, kind) {
    const model = CAR_MODELS.find((m) => m.name === modelName) || CAR_MODELS[0];
    const car = {
      id: carId++,
      x, y, angle, speed: 0, vx: 0, vy: 0,
      model: model.name, len: model.len, wid: model.wid,
      color: color || pick(random, model.colors),
      hp: CAR.maxHp, kind: kind || 'traffic',
      driver: kind === 'traffic' ? 'traffic' : null,
      police: modelName === 'police',
      axis: 'x', dir: 1, cruise: range(random, 120, 180), stuck: 0,
      target: null, smoke: 0, bumpCd: 0,
    };
    if (kind === 'traffic') {
      car.axis = random() < 0.5 ? 'x' : 'y';
      car.dir = random() < 0.5 ? -1 : 1;
    }
    state.cars.push(car);
    return car;
  }
  function spawnTrafficCar(near) {
    const p = randomRoadPoint(near, 500);
    const vertical = random() < 0.5;
    const s = vertical ? nearestStreetCoord(p.x) : nearestStreetCoord(p.y);
    const dir = random() < 0.5 ? -1 : 1;
    const lane = 22;
    let x;
    let y;
    let axis;
    if (vertical) {
      axis = 'y';
      x = s + (dir === 1 ? -lane : lane);
      y = p.y;
    } else {
      axis = 'x';
      x = p.x;
      y = s + (dir === 1 ? lane : -lane);
    }
    const model = pick(random, ['sedan', 'sedan', 'coupe', 'van', 'truck', 'taxi']);
    const car = makeCar(x, y, axis === 'x' ? (dir === 1 ? 0 : Math.PI) : dir === 1 ? Math.PI / 2 : -Math.PI / 2, model, undefined, 'traffic');
    car.axis = axis;
    car.dir = dir;
    car.speed = car.cruise;
    return car;
  }
  function spawnParkedCar() {
    const vertical = random() < 0.5;
    const s = pick(random, STREETS);
    const along = range(random, 150, WORLD.size - 150);
    const off = (random() < 0.5 ? -1 : 1) * (WORLD.roadHalf - 14);
    const x = vertical ? s + off : along;
    const y = vertical ? along : s + off;
    const angle = vertical ? (off > 0 ? Math.PI / 2 : -Math.PI / 2) : off > 0 ? 0 : Math.PI;
    const model = pick(random, ['sedan', 'coupe', 'sports', 'van']);
    return makeCar(x, y, angle, model, undefined, 'parked');
  }
  function spawnPed(near) {
    const p = randomSidewalkPoint(near, 700);
    const ped = {
      x: p.x, y: p.y, angle: range(random, 0, TAU), speed: 0,
      tx: p.x, ty: p.y, state: 'walk', timer: range(random, 0, 2),
      color: pick(random, ['#e67e22', '#16a085', '#8e44ad', '#c0392b', '#2c3e50', '#d4ac0d', '#e5e8e8']),
      shirt: pick(random, ['#f5f5f5', '#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ff9f1c']),
      down: 0, fleeX: 0, fleeY: 0,
    };
    state.peds.push(ped);
    return ped;
  }
  function spawnCopCar() {
    const p = randomRoadPoint(state.player, 620);
    const car = makeCar(p.x, p.y, angleTo(p.x, p.y, state.player.x, state.player.y), 'police', '#1c2b39', 'cop');
    car.driver = 'cop';
    car.cruise = 300;
    return car;
  }
  function spawnFootCop() {
    const p = randomSidewalkPoint(state.player, 500);
    const cop = {
      x: p.x, y: p.y, angle: 0, speed: 0, onFoot: true, car: null,
      bustTimer: 0, shootTimer: range(random, 0.5, 1.5), hp: 50,
    };
    state.cops.push(cop);
    return cop;
  }
  function spawnEnemy(x, y) {
    const e = { x, y, angle: 0, speed: 0, hp: 60, shootTimer: range(random, 0.4, 1.2), state: 'fight', color: '#7b2d26' };
    state.enemies.push(e);
    return e;
  }
  function burst(x, y, n, color, speed, life, size, grav) {
    for (let i = 0; i < n; i += 1) {
      const a = range(random, 0, TAU);
      const v = range(random, speed * 0.3, speed);
      state.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: range(random, life * 0.5, life), max: life, size: range(random, size * 0.6, size * 1.4), color, grav: grav || 0 });
    }
  }
  function explodeCar(car) {
    // Take the car out of the list first: the blast damages its neighbours,
    // and a car must never damage itself back into explodeCar.
    state.cars = state.cars.filter((c) => c !== car);
    burst(car.x, car.y, 26, '#ff7b00', 320, 0.9, 7, 0);
    burst(car.x, car.y, 18, '#3a3a3a', 140, 1.6, 12, -20);
    burst(car.x, car.y, 12, '#ffd60a', 420, 0.5, 5, 0);
    state.shake = Math.max(state.shake, 14);
    damageNearby(car.x, car.y, 130, 45, null);
    if (state.player.car === car) {
      state.player.car = null;
      state.player.onFoot = true;
      state.player.x = car.x + 30;
      state.player.y = car.y;
      hurtPlayer(25);
    }
  }
  function damageNearby(x, y, radius, dmg, from) {
    for (const car of [...state.cars]) {
      if (dist2(x, y, car.x, car.y) < radius * radius) damageCar(car, dmg, from);
    }
    for (const ped of [...state.peds]) {
      if (dist2(x, y, ped.x, ped.y) < radius * radius) killPed(ped, 'explosion');
    }
    if (dist2(x, y, state.player.x, state.player.y) < radius * radius) hurtPlayer(dmg * 0.6);
  }
  function damageCar(car, dmg) {
    if (car.hp <= 0) return; // already wrecked: never explode twice
    car.hp -= dmg;
    if (car.hp <= 0) explodeCar(car);
    else if (car.hp < 40) car.smoke = 1;
  }
  function killPed(ped, cause) {
    if (ped.state === 'dead') return;
    ped.state = 'dead';
    ped.down = 999;
    burst(ped.x, ped.y, 10, '#a93226', 160, 0.7, 5, 0);
    if (cause === 'player') {
      state.stats.kills += 1;
      addHeat(HEAT.killPed);
    }
  }
  function hurtPlayer(dmg) {
    if (state.player.invuln > 0) return;
    let remaining = dmg;
    if (state.armor > 0) {
      const absorbed = Math.min(state.armor, remaining * 0.7);
      state.armor -= absorbed;
      remaining -= absorbed;
    }
    state.hp -= remaining;
    state.player.invuln = 0.4;
    if (state.hp <= 0) {
      state.hp = 0;
    }
  }
  function inWater(x, y) {
    if (x < city.waterX) return false;
    const pier = city.pier;
    return !(x >= pier.x && x <= pier.x + pier.w && y >= pier.y && y <= pier.y + pier.h);
  }
  function blocked(x, y, r) {
    if (x < r || y < r || x > WORLD.size - r || y > WORLD.size - r) return true;
    if (inWater(x, y)) return true;
    if (dist2(x, y, city.pond.x, city.pond.y) < (city.pond.r + r) * (city.pond.r + r)) return true;
    for (const b of buildings) {
      if (circleHitsRect(x, y, r, b)) return true;
    }
    return false;
  }
  function moveWithCollision(obj, r, dx, dy) {
    const nx = obj.x + dx;
    if (!blocked(nx, obj.y, r)) obj.x = nx;
    const ny = obj.y + dy;
    if (!blocked(obj.x, ny, r)) obj.y = ny;
  }

  // ---- packages, pickups ----
  const PACKAGE_SPOTS = [
    [1230, 1230], [1470, 1470], [3000, 1520], [420, 2680], [2680, 2680],
    [1620, 820], [820, 1620], [2280, 1620], [620, 620], [2350, 1150],
  ];
  function resetPackages() {
    state.packages = PACKAGE_SPOTS.map(([x, y]) => ({ x, y, taken: false }));
  }
  function resetPickups() {
    state.pickups = [
      { x: PLACES.hospital.x, y: PLACES.hospital.y + 60, kind: 'health', taken: false, respawn: 0 },
      { x: PLACES.safehouse.x, y: PLACES.safehouse.y + 60, kind: 'health', taken: false, respawn: 0 },
      { x: PLACES.gunShop.x, y: PLACES.gunShop.y + 60, kind: 'armor', taken: false, respawn: 0 },
    ];
  }

  function reset() {
    state.time = 540;
    state.cash = 150;
    state.hp = PLAYER.maxHp;
    state.armor = 0;
    state.weapon = 'fists';
    state.ammo = { pistol: { mag: 12, reserve: 48 }, smg: { mag: 0, reserve: 0 } };
    state.owned = { pistol: false, smg: false };
    state.player.x = PLACES.safehouse.x;
    state.player.y = PLACES.safehouse.y + 70;
    state.player.angle = -Math.PI / 2;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onFoot = true;
    state.player.car = null;
    state.player.aimAngle = -Math.PI / 2;
    state.player.fireCd = 0;
    state.player.invuln = 0;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.enemies = [];
    state.bullets = [];
    state.parts = [];
    state.wanted = { heat: 0, stars: 0, hidden: true, hiddenTimer: 0 };
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    state.shake = 0;
    state.toasts = [];
    state.objective = null;
    state.dialog = null;
    state.mission = null;
    state.taxi = { on: false, fare: null };
    state.stats = { kills: 0, stolen: 0, earned: 0, fares: 0, packages: 0, missions: 0 };
    state.storyComplete = false;
    state.elapsed = 0;
    resetPackages();
    resetPickups();
    for (let i = 0; i < 12; i += 1) spawnParkedCar();
    for (let i = 0; i < POPULATION.traffic; i += 1) spawnTrafficCar();
    for (let i = 0; i < POPULATION.peds; i += 1) spawnPed();
    // The player's own starter car waits by the safehouse.
    const starter = makeCar(PLACES.safehouse.x + 40, PLACES.safehouse.y + 70, Math.PI / 2, 'sedan', '#2e86c1', 'parked');
    starter.driver = null;
    starter.own = true;
  }

  // ---- firing ----
  function fireBullet(fromX, fromY, angle, dmg, from) {
    const spread = from === 'player' ? (WEAPONS[state.weapon].spread || 0) : 0.12;
    const a = angle + range(random, -spread, spread);
    state.bullets.push({
      x: fromX + Math.cos(a) * 20,
      y: fromY + Math.sin(a) * 20,
      vx: Math.cos(a) * BULLET_SPEED,
      vy: Math.sin(a) * BULLET_SPEED,
      life: 0.9, dmg, from,
    });
  }
  function playerShoot() {
    const p = state.player;
    const w = WEAPONS[state.weapon];
    if (p.fireCd > 0) return false;
    if (state.weapon === 'fists') {
      if (p.punchCd > 0) return false;
      p.punchCd = w.rate;
      // A swing in front of the player.
      const hx = p.x + Math.cos(p.aimAngle) * 26;
      const hy = p.y + Math.sin(p.aimAngle) * 26;
      let hit = false;
      for (const ped of state.peds) {
        if (ped.state !== 'dead' && dist2(hx, hy, ped.x, ped.y) < 26 * 26) {
          killPed(ped, 'player');
          hit = true;
        }
      }
      for (const e of state.enemies) {
        if (dist2(hx, hy, e.x, e.y) < 26 * 26) {
          e.hp -= w.damage;
          hit = true;
        }
      }
      for (const cop of state.cops) {
        if (cop.onFoot && dist2(hx, hy, cop.x, cop.y) < 26 * 26) {
          cop.hp -= w.damage;
          hit = true;
        }
      }
      return hit;
    }
    const ammo = state.ammo[state.weapon];
    if (!ammo || ammo.mag <= 0) return false;
    ammo.mag -= 1;
    p.fireCd = w.rate;
    fireBullet(p.x, p.y, p.aimAngle, w.damage, 'player');
    burst(p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22, 3, '#ffd60a', 120, 0.12, 3, 0);
    addHeat(HEAT.shoot * 0.4);
    return true;
  }
  function reloadWeapon() {
    const ammo = state.ammo[state.weapon];
    if (!ammo) return;
    const magSize = state.weapon === 'pistol' ? 12 : 30;
    const need = magSize - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    if (take > 0) {
      ammo.mag += take;
      ammo.reserve -= take;
    }
  }

  // ---- driving / walking ----
  function nearestCar(x, y, maxDist, exclude) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car === exclude) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }
  function enterCar(car) {
    const p = state.player;
    if (!car) return;
    if (car.driver === 'traffic') {
      // Drag the driver out at the car: they run off, and the theft is a crime.
      const driver = {
        x: car.x + 24, y: car.y, angle: 0, speed: 0, tx: car.x + 24, ty: car.y,
        state: 'flee', timer: 3, color: '#2c3e50', shirt: '#f5f5f5', down: 0,
        fleeX: car.x, fleeY: car.y,
      };
      state.peds.push(driver);
      car.driver = null;
      addHeat(HEAT.stealCar);
      state.stats.stolen += 1;
      if (state.cops.some((c) => dist2(c.x, c.y, car.x, car.y) < 380 * 380)) addHeat(HEAT.stealSeen);
    } else if (car.kind === 'parked' && car.driver === null && car !== state.player.car) {
      // Parked cars are free to take, but a cop watching makes it a crime.
      if (state.cops.some((c) => dist2(c.x, c.y, car.x, car.y) < 300 * 300)) addHeat(HEAT.stealCar);
      if (!car.own) state.stats.stolen += 1;
    }
    if (car.kind === 'cop') return; // police cars cannot be stolen while a cop is near
    p.car = car;
    p.onFoot = false;
    car.driver = 'player';
    car.kind = 'player';
  }
  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    p.car = null;
    p.onFoot = true;
    car.driver = null;
    car.kind = 'parked';
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    if (blocked(p.x, p.y, PLAYER.radius)) {
      p.x = car.x - Math.cos(side) * 34;
      p.y = car.y - Math.sin(side) * 34;
    }
    p.vx = 0;
    p.vy = 0;
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
  }

  function stepPlayer(dt, ctrl) {
    const p = state.player;
    if (p.fireCd > 0) p.fireCd -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (!p.onFoot) return;
    const speed = ctrl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = ctrl.mx;
    let my = ctrl.my;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    p.vx += (mx * speed - p.vx) * Math.min(1, PLAYER.accel * dt / speed);
    p.vy += (my * speed - p.vy) * Math.min(1, PLAYER.accel * dt / speed);
    const fr = Math.exp(-PLAYER.friction * dt * 0.2);
    if (len === 0) {
      p.vx *= fr;
      p.vy *= fr;
    }
    moveWithCollision(p, PLAYER.radius, p.vx * dt, p.vy * dt);
    p.speed = Math.hypot(p.vx, p.vy);
    if (p.speed > 20) p.angle = Math.atan2(p.vy, p.vx);
    // Aim at the mouse; the body turns to face the crosshair when armed.
    if (state.weapon !== 'fists' || ctrl.firing) {
      p.aimAngle = Math.atan2(ctrl.aimY - p.y, ctrl.aimX - p.x);
    } else {
      p.aimAngle = p.angle;
    }
    if (ctrl.firing || ctrl.firePressed) {
      const w = WEAPONS[state.weapon];
      if (state.weapon === 'fists' ? ctrl.firePressed : (w.auto ? ctrl.firing : ctrl.firePressed)) {
        playerShoot();
      }
    }
    if (ctrl.reloadPressed) reloadWeapon();
    if (ctrl.enterPressed) {
      const car = nearestCar(p.x, p.y, 70, null);
      if (car) enterCar(car);
    }
  }

  function stepPlayerCar(dt, ctrl) {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const right = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
    let vF = car.vx * forward.x + car.vy * forward.y;
    let vL = car.vx * right.x + car.vy * right.y;
    const throttle = ctrl.my < 0 ? 1 : ctrl.my > 0 ? -1 : 0; // W = forward
    const steer = ctrl.mx; // A/D or arrows
    if (throttle > 0) vF += CAR.accel * dt;
    else if (throttle < 0) {
      if (vF > 10) vF -= CAR.brake * dt;
      else vF -= CAR.reverseAccel * dt;
    } else {
      vF *= Math.exp(-0.35 * dt);
    }
    vF = clamp(vF, -CAR.maxReverse, CAR.maxSpeed);
    const grip = ctrl.handbrake ? 1.6 : CAR.grip;
    vL *= Math.exp(-grip * dt);
    if (ctrl.handbrake) vF *= Math.exp(-1.2 * dt);
    const steerAmount = steer * CAR.turnRate * dt * clamp(Math.abs(vF) / 160, 0, 1) * (vF >= 0 ? 1 : -1);
    car.angle += steerAmount;
    const nf = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const nr = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
    car.vx = nf.x * vF + nr.x * vL;
    car.vy = nf.y * vF + nr.y * vL;
    car.speed = Math.hypot(car.vx, car.vy);
    const prevX = car.x;
    const prevY = car.y;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    // Building collision: three sample circles along the body.
    let hit = false;
    for (const b of buildings) {
      for (const t of [-0.35, 0, 0.35]) {
        const cx = car.x + Math.cos(car.angle) * car.len * t;
        const cy = car.y + Math.sin(car.angle) * car.len * t;
        if (circleHitsRect(cx, cy, CAR.radius, b)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (car.x < 20 || car.y < 20 || car.x > WORLD.size - 20 || car.y > WORLD.size - 20 || inWater(car.x, car.y)) hit = true;
    if (hit) {
      const impact = car.speed;
      car.x = prevX;
      car.y = prevY;
      car.vx *= -0.25;
      car.vy *= -0.25;
      car.speed = Math.hypot(car.vx, car.vy);
      if (impact > 180 && car.bumpCd <= 0) {
        car.bumpCd = 0.5;
        const dmg = (impact - 180) / 22;
        damageCar(car, dmg);
        hurtPlayer(dmg * 0.5);
        state.shake = Math.max(state.shake, 6);
        burst(car.x, car.y, 6, '#c8c8c8', 120, 0.5, 4, 0);
      }
    }
    // Hit pedestrians.
    for (const ped of state.peds) {
      if (ped.state === 'dead' || ped.state === 'down') continue;
      if (dist2(car.x, car.y, ped.x, ped.y) < (CAR.radius + 12) * (CAR.radius + 12) && car.speed > 80) {
        if (car.speed > 200) {
          killPed(ped, 'player');
        } else {
          ped.state = 'down';
          ped.down = 3;
          burst(ped.x, ped.y, 6, '#a93226', 120, 0.6, 4, 0);
          addHeat(HEAT.hitPed);
        }
        car.speed *= 0.85;
      }
    }
    // Car-to-car bumps.
    for (const other of state.cars) {
      if (other === car) continue;
      const d2 = dist2(car.x, car.y, other.x, other.y);
      const min = CAR.radius + CAR.radius;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const nx = (car.x - other.x) / d;
        const ny = (car.y - other.y) / d;
        const push = (min - d) / 2;
        car.x += nx * push;
        car.y += ny * push;
        other.x -= nx * push;
        other.y -= ny * push;
        const rel = Math.abs(car.speed - other.speed);
        if (rel > 120 && car.bumpCd <= 0 && other.bumpCd <= 0) {
          car.bumpCd = 0.5;
          other.bumpCd = 0.5;
          damageCar(other, rel / 40);
          damageCar(car, rel / 60);
          state.shake = Math.max(state.shake, 4);
        }
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (ctrl.enterPressed) exitCar();
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      // Pick a new direction at intersections.
      const nearX = nearestStreetCoord(car.x);
      const nearY = nearestStreetCoord(car.y);
      const atIntersection = Math.abs(car.x - nearX) < 26 && Math.abs(car.y - nearY) < 26;
      if (atIntersection && random() < 0.02) {
        const options = [];
        if (car.axis === 'x') {
          options.push({ axis: 'y', dir: 1 }, { axis: 'y', dir: -1 });
        } else {
          options.push({ axis: 'x', dir: 1 }, { axis: 'x', dir: -1 });
        }
        if (random() < 0.5) options.push({ axis: car.axis, dir: car.dir });
        const choice = pick(random, options);
        car.axis = choice.axis;
        car.dir = choice.dir;
      }
      // Slow for the car ahead in the same lane.
      let targetSpeed = car.cruise;
      for (const other of state.cars) {
        if (other === car) continue;
        if (car.axis === 'x' && other.axis === 'x' && Math.abs(other.y - car.y) < 30) {
          const ahead = (other.x - car.x) * car.dir;
          if (ahead > 0 && ahead < 80) targetSpeed = Math.min(targetSpeed, Math.max(0, (ahead - 40) * 2));
        }
        if (car.axis === 'y' && other.axis === 'y' && Math.abs(other.x - car.x) < 30) {
          const ahead = (other.y - car.y) * car.dir;
          if (ahead > 0 && ahead < 80) targetSpeed = Math.min(targetSpeed, Math.max(0, (ahead - 40) * 2));
        }
      }
      // Brake for the player's car ahead.
      const pc = state.player.car;
      if (pc && pc !== car) {
        if (car.axis === 'x' && Math.abs(pc.y - car.y) < 34) {
          const ahead = (pc.x - car.x) * car.dir;
          if (ahead > 0 && ahead < 90) targetSpeed = 0;
        }
        if (car.axis === 'y' && Math.abs(pc.x - car.x) < 34) {
          const ahead = (pc.y - car.y) * car.dir;
          if (ahead > 0 && ahead < 90) targetSpeed = 0;
        }
      }
      car.speed += (targetSpeed - car.speed) * Math.min(1, 2 * dt);
      const targetAngle = car.axis === 'x' ? (car.dir === 1 ? 0 : Math.PI) : dirAngle(car.dir);
      car.angle += angleDiff(car.angle, targetAngle) * Math.min(1, 6 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Keep on the road: snap back onto the lane if pushed off.
      if (car.axis === 'x') {
        const laneY = nearestStreetCoord(car.y) + (car.dir === 1 ? 22 : -22);
        car.y += (laneY - car.y) * Math.min(1, 3 * dt);
      } else {
        const laneX = nearestStreetCoord(car.x) + (car.dir === 1 ? -22 : 22);
        car.x += (laneX - car.x) * Math.min(1, 3 * dt);
      }
      // Wrap around the city edges so traffic never runs out.
      if (car.x < 60 || car.x > WORLD.size - 60 || car.y < 60 || car.y > WORLD.size - 60) {
        const p = randomRoadPoint(state.player, 700);
        car.x = p.x;
        car.y = p.y;
        car.speed = car.cruise;
      }
      if (car.speed < 5) {
        car.stuck += dt;
        if (car.stuck > 6) {
          const p = randomRoadPoint(state.player, 700);
          car.x = p.x;
          car.y = p.y;
          car.stuck = 0;
          car.speed = car.cruise;
        }
      } else {
        car.stuck = 0;
      }
      if (car.hp < 40) {
        car.smoke += dt;
        if (car.smoke > 0.12) {
          car.smoke = 0;
          state.parts.push({ x: car.x + range(random, -8, 8), y: car.y + range(random, -8, 8), vx: range(random, -10, 10), vy: range(random, -40, -10), life: 1.1, max: 1.1, size: 9, color: '#555', grav: -30 });
        }
      }
    }
  }
  function dirAngle(dir) {
    return dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.state === 'dead') continue;
      if (ped.state === 'down') {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.state = 'flee';
          ped.fleeX = p.x;
          ped.fleeY = p.y;
          ped.timer = 2;
        }
        continue;
      }
      // Flee from gunfire, explosions and fast cars.
      const threatNear = (state.bullets.length > 0 && state.bullets.some((b) => dist2(b.x, b.y, ped.x, ped.y) < 220 * 220))
        || (p.car && p.car.speed > 240 && dist2(p.x, p.y, ped.x, ped.y) < 140 * 140);
      if (threatNear && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.fleeX = p.x;
        ped.fleeY = p.y;
        ped.timer = 2.5;
      }
      if (ped.state === 'flee') {
        ped.timer -= dt;
        const away = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
        ped.angle = away;
        ped.speed = 210;
        moveWithCollision(ped, 10, Math.cos(away) * ped.speed * dt, Math.sin(away) * ped.speed * dt);
        if (ped.timer <= 0) ped.state = 'walk';
        continue;
      }
      ped.timer -= dt;
      if (ped.timer <= 0 || dist2(ped.x, ped.y, ped.tx, ped.ty) < 20 * 20) {
        const t = randomSidewalkPoint(ped, 500);
        ped.tx = t.x;
        ped.ty = t.y;
        ped.timer = range(random, 4, 10);
      }
      const a = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.angle = a;
      ped.speed = 42;
      moveWithCollision(ped, 10, Math.cos(a) * ped.speed * dt, Math.sin(a) * ped.speed * dt);
    }
    // Keep the crowd near the player: recycle far peds, top up the count.
    state.peds = state.peds.filter((ped) => ped.state !== 'dead' || dist2(ped.x, ped.y, p.x, p.y) < 900 * 900);
    while (state.peds.length < POPULATION.peds) spawnPed(p);
    while (state.cars.filter((c) => c.kind === 'traffic').length < POPULATION.traffic) spawnTrafficCar(p);
  }

  function stepCops(dt) {
    const p = state.player;
    const stars = state.wanted.stars;
    // Wanted level decides how many police cars hunt the player.
    const wantCars = stars === 0 ? 0 : Math.min(stars, POPULATION.maxCops);
    const copCars = state.cops.filter((c) => !c.onFoot);
    while (copCars.length < wantCars) {
      const car = spawnCopCar();
      state.cops.push({ x: car.x, y: car.y, angle: car.angle, speed: 0, onFoot: false, car, bustTimer: 0, shootTimer: 1, hp: 50, ramCd: 0 });
      copCars.push(state.cops[state.cops.length - 1]);
    }
    if (stars === 0) {
      for (const cop of [...state.cops]) {
        if (cop.onFoot) {
          state.cops = state.cops.filter((c) => c !== cop);
        } else if (cop.car) {
          state.cars = state.cars.filter((c) => c !== cop.car);
          state.cops = state.cops.filter((c) => c !== cop);
        }
      }
    }
    for (const cop of [...state.cops]) {
      if (!cop.onFoot && cop.car) {
        const car = cop.car;
        if (car.hp <= 0) {
          state.cops = state.cops.filter((c) => c !== cop);
          continue;
        }
        const targetAngle = angleTo(car.x, car.y, p.x, p.y);
        car.angle += clamp(angleDiff(car.angle, targetAngle), -3.4 * dt, 3.4 * dt);
        const targetSpeed = stars >= 4 ? 520 : 440;
        car.speed += (targetSpeed - car.speed) * Math.min(1, 1.5 * dt);
        car.vx = Math.cos(car.angle) * car.speed;
        car.vy = Math.sin(car.angle) * car.speed;
        const prevX = car.x;
        const prevY = car.y;
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        let hit = false;
        for (const b of buildings) {
          if (circleHitsRect(car.x, car.y, CAR.radius, b)) {
            hit = true;
            break;
          }
        }
        if (hit) {
          car.x = prevX;
          car.y = prevY;
          car.speed *= 0.4;
          car.angle += 0.9;
        }
        cop.x = car.x;
        cop.y = car.y;
        cop.angle = car.angle;
        // Ram the player's car: throttled, so a shove is a shove, not a melt.
        const pc = p.car;
        if (cop.ramCd > 0) cop.ramCd -= dt;
        if (pc && dist2(car.x, car.y, pc.x, pc.y) < 46 * 46) {
          if (car.speed > 60 && cop.ramCd <= 0) {
            cop.ramCd = 0.8;
            damageCar(pc, 6);
          }
          car.speed *= 0.7;
        }
        // A slow cop car next to a player on foot gets out to make the arrest.
        if (p.onFoot && dist2(car.x, car.y, p.x, p.y) < 70 * 70 && car.speed < 120) {
          cop.onFoot = true;
          cop.car = null;
          car.driver = null;
          car.kind = 'parked';
          car.speed = 0;
          state.cars = state.cars.filter((c) => c !== car);
        }
      } else if (cop.onFoot) {
        const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
        if (p.onFoot && d < 34) {
          cop.bustTimer += dt;
          if (cop.bustTimer > 1.2) {
            return EVENT_BUSTED;
          }
        } else {
          cop.bustTimer = 0;
        }
        const a = angleTo(cop.x, cop.y, p.x, p.y);
        cop.angle = a;
        const speed = 245;
        moveWithCollision(cop, 12, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
        // Cops shoot at an armed player on foot from a distance.
        cop.shootTimer -= dt;
        if (p.onFoot && d < 340 && d > 60 && cop.shootTimer <= 0 && stars >= 2) {
          cop.shootTimer = range(random, 1.1, 2.0);
          fireBullet(cop.x, cop.y, angleTo(cop.x, cop.y, p.x, p.y), 8, 'cop');
        }
        if (d > 1100) {
          state.cops = state.cops.filter((c) => c !== cop);
        }
      }
    }
    // Extra foot cops at high wanted levels.
    const wantFoot = stars >= 3 ? stars - 2 : 0;
    const footCount = state.cops.filter((c) => c.onFoot).length;
    if (wantFoot > footCount && stars > 0) spawnFootCop();
    return 0;
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (const e of [...state.enemies]) {
      if (e.hp <= 0) {
        burst(e.x, e.y, 10, '#a93226', 160, 0.7, 5, 0);
        state.enemies = state.enemies.filter((x) => x !== e);
        state.stats.kills += 1;
        addCash(25, true);
        continue;
      }
      const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
      const a = angleTo(e.x, e.y, p.x, p.y);
      e.angle = a;
      if (d > 220) {
        moveWithCollision(e, 12, Math.cos(a) * 150 * dt, Math.sin(a) * 150 * dt);
      } else if (d < 120) {
        moveWithCollision(e, 12, -Math.cos(a) * 90 * dt, -Math.sin(a) * 90 * dt);
      }
      e.shootTimer -= dt;
      if (d < 380 && e.shootTimer <= 0) {
        e.shootTimer = range(random, 0.9, 1.8);
        fireBullet(e.x, e.y, angleTo(e.x, e.y, p.x, p.y), 9, 'enemy');
      }
    }
  }

  function stepBullets(dt) {
    for (const b of [...state.bullets]) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) {
        for (const building of buildings) {
          if (b.x >= building.x && b.x <= building.x + building.w && b.y >= building.y && b.y <= building.y + building.h) {
            burst(b.x, b.y, 3, '#ffd60a', 100, 0.2, 3, 0);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.from === 'player') {
        for (const car of [...state.cars]) {
          if (dist2(b.x, b.y, car.x, car.y) < (CAR.radius + 4) * (CAR.radius + 4)) {
            damageCar(car, b.dmg);
            burst(b.x, b.y, 4, '#ff9f0a', 140, 0.3, 3, 0);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const ped of state.peds) {
            if (ped.state !== 'dead' && dist2(b.x, b.y, ped.x, ped.y) < 15 * 15) {
              killPed(ped, 'player');
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const e of state.enemies) {
            if (dist2(b.x, b.y, e.x, e.y) < 15 * 15) {
              e.hp -= b.dmg;
              burst(b.x, b.y, 4, '#a93226', 120, 0.3, 3, 0);
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const cop of state.cops) {
            if (cop.onFoot && dist2(b.x, b.y, cop.x, cop.y) < 15 * 15) {
              cop.hp -= b.dmg;
              burst(b.x, b.y, 4, '#a93226', 120, 0.3, 3, 0);
              if (cop.hp <= 0) {
                addHeat(HEAT.killCop);
                state.stats.kills += 1;
                state.cops = state.cops.filter((c) => c !== cop);
              }
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && (b.from === 'cop' || b.from === 'enemy')) {
        const p = state.player;
        if (p.onFoot && dist2(b.x, b.y, p.x, p.y) < (PLAYER.radius + 2) * (PLAYER.radius + 2)) {
          hurtPlayer(b.dmg);
          dead = true;
        }
        if (!dead && p.car && dist2(b.x, b.y, p.car.x, p.car.y) < (CAR.radius + 4) * (CAR.radius + 4)) {
          damageCar(p.car, b.dmg * 0.5);
          dead = true;
        }
      }
      if (dead) state.bullets = state.bullets.filter((x) => x !== b);
    }
  }

  function stepPickups(dt) {
    const p = state.player;
    for (const pk of state.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.taken = false;
        continue;
      }
      if (p.onFoot && dist2(p.x, p.y, pk.x, pk.y) < 26 * 26) {
        pk.taken = true;
        pk.respawn = 30;
        if (pk.kind === 'health') {
          state.hp = Math.min(PLAYER.maxHp, state.hp + 40);
          addToast('Health +40');
        } else {
          state.armor = Math.min(PLAYER.maxArmor, state.armor + 50);
          addToast('Armor +50');
        }
      }
    }
    for (const pkg of state.packages) {
      if (!pkg.taken && dist2(p.x, p.y, pkg.x, pkg.y) < 30 * 30) {
        pkg.taken = true;
        state.stats.packages += 1;
        addCash(PRICES.package);
        addToast(`Hidden package ${state.stats.packages}/10`);
      }
    }
  }

  function stepTaxi(dt) {
    const taxi = state.taxi;
    if (!taxi.on) {
      taxi.fare = null;
      return;
    }
    const p = state.player;
    if (!p.car) {
      taxi.fare = null;
      return;
    }
    if (!taxi.fare) {
      const spot = randomSidewalkPoint(p, 600);
      taxi.fare = { state: 'wait', x: spot.x, y: spot.y, dx: 0, dy: 0, timer: 60, reward: 0 };
      state.objective = { text: 'Pick up the fare (yellow marker)', x: spot.x, y: spot.y };
      return;
    }
    const fare = taxi.fare;
    fare.timer -= dt;
    if (fare.timer <= 0) {
      addToast('Fare cancelled — too slow');
      taxi.fare = null;
      state.objective = null;
      return;
    }
    if (fare.state === 'wait') {
      if (dist2(p.x, p.y, fare.x, fare.y) < 60 * 60) {
        const dest = randomRoadPoint(p, 700);
        fare.state = 'ride';
        fare.dx = dest.x;
        fare.dy = dest.y;
        fare.timer = 75;
        fare.reward = 40 + Math.floor(random() * 9) * 10;
        state.objective = { text: `Take the fare to the marker — $${fare.reward}`, x: dest.x, y: dest.y };
        addToast('Passenger aboard!');
      }
    } else if (dist2(p.x, p.y, fare.dx, fare.dy) < 60 * 60) {
      addCash(fare.reward);
      state.stats.fares += 1;
      addToast(`Fare complete — $${fare.reward}`);
      taxi.fare = null;
      state.objective = null;
    }
  }

  function stepWanted(dt) {
    const w = state.wanted;
    const p = state.player;
    let nearestCop = Infinity;
    for (const cop of state.cops) {
      const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
      if (d < nearestCop) nearestCop = d;
    }
    w.hidden = nearestCop > 380 || w.stars === 0;
    if (w.stars > 0 || w.heat > 0) {
      if (w.hidden) {
        w.hiddenTimer += dt;
        w.heat -= (HEAT.decayPerSec + HEAT.decayHiddenBonus) * dt;
      } else {
        w.hiddenTimer = 0;
        w.heat -= HEAT.decayPerSec * 0.25 * dt;
      }
      w.heat = Math.max(0, w.heat);
      const newStars = starsFor(w.heat);
      if (newStars > w.stars) {
        // Heat just earned: the stars go up at once.
        w.stars = newStars;
        w.hiddenTimer = 0;
      } else if (newStars < w.stars && w.hiddenTimer >= 3) {
        // Stars only drop once the player has stayed hidden a few seconds.
        w.stars = newStars;
      }
    }
  }

  function stepCamera(dt) {
    const p = state.player;
    const tx = clamp(p.x, 640, WORLD.size - 640);
    const ty = clamp(p.y, 360, WORLD.size - 360);
    const k = Math.min(1, 5 * dt);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
  }

  function stepParticles(dt) {
    for (const part of [...state.parts]) {
      part.life -= dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vy += (part.grav || 0) * dt;
      if (part.life <= 0) state.parts = state.parts.filter((x) => x !== part);
    }
    for (const toast of [...state.toasts]) {
      toast.t -= dt;
      if (toast.t <= 0) state.toasts = state.toasts.filter((x) => x !== toast);
    }
  }

  /**
   * One fixed step. `ctrl` is the frame's control state:
   * { mx, my, run, handbrake, aimX, aimY, firing, firePressed, enterPressed,
   *   reloadPressed, weaponKey } — main.js builds it from input; shots.js fakes it.
   * Returns EVENT_* flags.
   */
  function step(dt, ctrl) {
    let events = 0;
    state.elapsed += dt;
    state.time = (state.time + (dt * 60) / HOUR_SECONDS) % 1440;
    for (const car of state.cars) if (car.bumpCd > 0) car.bumpCd -= dt;

    if (ctrl.weaponKey) {
      const names = ['fists', 'pistol', 'smg'];
      const want = names[ctrl.weaponKey - 1];
      if (want === 'fists' || state.owned[want]) state.weapon = want;
    }
    if (state.player.onFoot) stepPlayer(dt, ctrl);
    else stepPlayerCar(dt, ctrl);

    stepTraffic(dt);
    stepPeds(dt);
    const busted = stepCops(dt);
    if (busted & EVENT_BUSTED) events |= EVENT_BUSTED;
    stepEnemies(dt);
    stepBullets(dt);
    stepPickups(dt);
    stepTaxi(dt);
    stepWanted(dt);
    stepCamera(dt);
    stepParticles(dt);

    if (state.hp <= 0) events |= EVENT_WASTED;
    return events;
  }

  function applySave(save) {
    state.cash = save.cash;
    state.owned = save.owned;
    state.ammo = save.ammo;
    state.weapon = save.weapon;
    state.stats = save.stats;
    state.storyComplete = save.storyComplete;
    for (let i = 0; i < state.packages.length; i += 1) {
      if (save.packages && save.packages[i]) state.packages[i].taken = true;
    }
    if (save.missionIndex) {
      // Missions resume at the next uncompleted story mission.
      state.mission = { index: save.missionIndex, step: 0, timer: 0, data: {}, active: false, started: false, failed: false };
    }
    state.player.x = PLACES.safehouse.x;
    state.player.y = PLACES.safehouse.y + 70;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  reset();
  return {
    state, city, reset, step,
    addToast, addCash, addHeat, starsFor,
    makeCar, spawnTrafficCar, spawnParkedCar, spawnPed, spawnCopCar, spawnFootCop, spawnEnemy,
    nearestCar, enterCar, exitCar, fireBullet, reloadWeapon, hurtPlayer, damageCar, explodeCar,
    burst, daylight: () => daylight(state.time), applySave,
    randomRoadPoint, randomSidewalkPoint,
    isOnRoad,
  };
}
