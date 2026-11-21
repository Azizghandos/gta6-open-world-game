// The city simulation: generation, movement, traffic, pedestrians, police and
// wanted level, combat, pickups, taxi fares and the save hooks. Drawing lives
// in render.js; this file only moves state. Everything is seeded, so the same
// seed builds the same city every time.
import {
  CAR_MODELS,
  CITY,
  DISTRICTS,
  ECONOMY,
  PACKAGE_COUNT,
  PED_COUNT,
  PLAYER,
  SHOPS,
  TRAFFIC_COUNT,
  WANTED,
  WEAPONS,
} from './config.js';
import { createRandom, randomInt, randomPick, randomPoint } from './random.js';

const PED_COLORS = ['#e8d8c8', '#c9a227', '#7ba8c9', '#c97b8a', '#8ac9a2'];
const PICKUP_KINDS = ['health', 'ammo', 'cash', 'smg'];

function roadLines() {
  const lines = [];
  for (let at = CITY.firstRoad; at < CITY.size; at += CITY.roadGap) lines.push(at);
  return lines;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function circleHitsBuilding(state, x, y, r) {
  for (const b of state.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r) return true;
  }
  return false;
}

function pointInBuilding(state, x, y) {
  for (const b of state.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** Move by (dx, dy) with building and city-edge collision, sliding on one axis. */
function moveWithCollision(state, x, y, dx, dy, r) {
  let nx = x + dx;
  if (nx < r || nx > CITY.size - r || circleHitsBuilding(state, nx, y, r)) nx = x;
  let ny = y + dy;
  if (ny < r || ny > CITY.size - r || circleHitsBuilding(state, nx, ny, r)) ny = y;
  return { x: nx, y: ny };
}

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

function genBuildings(next, state) {
  const lines = roadLines();
  const buildings = [];
  // Blocks sit between the roads; each block holds one to three buildings.
  for (let bx = 0; bx < lines.length; bx += 1) {
    for (let by = 0; by < lines.length; by += 1) {
      const x0 = (bx === 0 ? 0 : lines[bx - 1] + CITY.roadWidth / 2 + 12) + 8;
      const x1 = (bx < lines.length ? lines[bx] - CITY.roadWidth / 2 - 12 : CITY.size) - 8;
      const y0 = (by === 0 ? 0 : lines[by - 1] + CITY.roadWidth / 2 + 12) + 8;
      const y1 = (by < lines.length ? lines[by] - CITY.roadWidth / 2 - 12 : CITY.size) - 8;
      const count = 1 + Math.floor(next() * 3);
      for (let i = 0; i < count && buildings.length < 95; i += 1) {
        const w = 60 + next() * 120;
        const h = 60 + next() * 120;
        if (x1 - x0 < w + 10 || y1 - y0 < h + 10) continue;
        const x = x0 + next() * (x1 - x0 - w);
        const y = y0 + next() * (y1 - y0 - h);
        // Keep the shops reachable: no building on top of a shop door.
        if (SHOPS.some((s) => Math.hypot(s.x - (x + w / 2), s.y - (y + h / 2)) < 90)) continue;
        const district = districtAt(x + w / 2, y + h / 2);
        buildings.push({ x, y, w, h, color: district.roof, shade: 0.75 + next() * 0.25 });
      }
    }
  }
  return buildings;
}

function roadPoint(next) {
  const lines = roadLines();
  if (next() < 0.5) {
    return { x: randomPick(next, lines), y: 80 + next() * (CITY.size - 160) };
  }
  return { x: 80 + next() * (CITY.size - 160), y: randomPick(next, lines) };
}

function sidewalkPoint(next) {
  const lines = roadLines();
  const line = randomPick(next, lines);
  const along = 80 + next() * (CITY.size - 160);
  const off = CITY.roadWidth / 2 + 6 + next() * 14;
  const side = next() < 0.5 ? -off : off;
  if (next() < 0.5) return { x: line + side, y: along };
  return { x: along, y: line + side };
}

/** A fresh world for `seed`: the same seed always builds the same city. */
export function createWorld(seed = 1) {
  const next = createRandom(seed);
  const state = {
    seed,
    time: 0,
    wanted: 0,
    heatTimer: 0,
    bustTimer: 0,
    dead: false,
    busted: false,
    nextId: 1,
    player: {
      x: 600,
      y: 760,
      angle: 0,
      hp: PLAYER.health,
      cash: PLAYER.startCash,
      weapon: 'fists',
      ammo: { pistol: WEAPONS.pistol.ammo, smg: 0 },
      inCar: null,
      fireCooldown: 0,
      speed: 0,
    },
    cars: [],
    police: [],
    peds: [],
    bullets: [],
    buildings: [],
    shops: SHOPS.map((s) => ({ ...s })),
    packages: [],
    pickups: [],
    fare: null,
    mission: { index: 0, stage: 0, data: {} },
    message: '',
    messageTimer: 0,
    events: [],
    stats: { stolen: 0, packages: 0, smashed: 0, fares: 0 },
  };
  state.buildings = genBuildings(next, state);

  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const spot = roadPoint(next);
    const alongRoad = next() < 0.5;
    const angle = alongRoad ? randomPick(next, [0, Math.PI]) : randomPick(next, [Math.PI / 2, -Math.PI / 2]);
    const model = randomInt(next, 0, CAR_MODELS.length - 1); // never the police model
    state.cars.push({
      id: state.nextId,
      model,
      kind: 'traffic',
      x: spot.x,
      y: spot.y,
      angle,
      speed: 0,
      hp: 100,
      cruise: 0.4 + next() * 0.2,
      wreck: false,
    });
    state.nextId += 1;
  }

  for (let i = 0; i < PED_COUNT; i += 1) {
    const spot = sidewalkPoint(next);
    state.peds.push({
      x: clamp(spot.x, 16, CITY.size - 16),
      y: clamp(spot.y, 16, CITY.size - 16),
      angle: next() * Math.PI * 2,
      speed: 30 + next() * 30,
      hp: 100,
      color: randomPick(next, PED_COLORS),
      dirTimer: 1 + next() * 3,
    });
  }

  for (let i = 0; i < PACKAGE_COUNT; i += 1) {
    let spot = null;
    for (let tries = 0; tries < 24; tries += 1) {
      const candidate = randomPoint(next, { x: 0, y: 0, w: CITY.size, h: CITY.size }, 120);
      if (!pointInBuilding(state, candidate.x, candidate.y)) {
        spot = candidate;
        break;
      }
    }
    if (!spot) spot = { x: 600, y: 600 + i * 40 };
    state.packages.push({ id: i, x: spot.x, y: spot.y, collected: false });
  }

  for (let i = 0; i < 4; i += 1) spawnPickup(state, next);
  return state;
}

function spawnPickup(state, next) {
  const kinds = PICKUP_KINDS;
  const spot = sidewalkPoint(next || Math.random);
  state.pickups.push({
    x: clamp(spot.x, 16, CITY.size - 16),
    y: clamp(spot.y, 16, CITY.size - 16),
    kind: kinds[Math.floor((next || Math.random)() * kinds.length)],
    active: true,
  });
}

export function addHeat(state, n) {
  if (n <= 0) return;
  state.wanted = Math.min(WANTED.max, state.wanted + n);
  state.heatTimer = 0;
}

function damagePed(state, ped, dmg) {
  if (ped.hp <= 0) return;
  ped.hp -= dmg;
  if (ped.hp <= 0) addHeat(state, WANTED.pedKillHeat);
  else addHeat(state, WANTED.pedHitHeat);
}

function tryFire(state, control) {
  const p = state.player;
  if (p.fireCooldown > 0) return;
  const w = WEAPONS[p.weapon];
  p.angle = Math.atan2(control.aimY - p.y, control.aimX - p.x);
  if (p.weapon === 'fists') {
    p.fireCooldown = w.rate;
    let hit = false;
    for (const ped of state.peds) {
      if (ped.hp <= 0) continue;
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < w.range && Math.abs(angleDiff(Math.atan2(ped.y - p.y, ped.x - p.x), p.angle)) < 1.1) {
        damagePed(state, ped, w.damage);
        hit = true;
      }
    }
    for (const cop of state.police) {
      const d = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (d < w.range + 20 && Math.abs(angleDiff(Math.atan2(cop.y - p.y, cop.x - p.x), p.angle)) < 1.1) {
        cop.hp -= w.damage;
        hit = true;
      }
    }
    if (hit) state.events.push({ type: 'thud' });
    return;
  }
  if ((p.ammo[p.weapon] || 0) <= 0) {
    p.weapon = 'fists';
    state.message = 'Out of ammo — fists it is. Press 2 or 3 to switch back.';
    state.messageTimer = 3;
    return;
  }
  p.ammo[p.weapon] -= 1;
  p.fireCooldown = w.rate;
  const angle = Math.atan2(control.aimY - p.y, control.aimX - p.x) + (Math.random() - 0.5) * w.spread * 2;
  state.bullets.push({
    x: p.x + Math.cos(angle) * 22,
    y: p.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * w.bulletSpeed,
    vy: Math.sin(angle) * w.bulletSpeed,
    damage: w.damage,
    range: w.range,
    traveled: 0,
  });
  addHeat(state, WANTED.shotHeat);
  state.events.push({ type: 'shot', weapon: p.weapon });
}

function stealCar(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'traffic' || car.wreck) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < PLAYER.stealRange && d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return false;
  best.kind = 'player';
  p.inCar = best.id;
  p.x = best.x;
  p.y = best.y;
  p.angle = best.angle;
  addHeat(state, WANTED.stealHeat);
  state.stats.stolen += 1;
  state.message = 'Wheels acquired. Leo will be pleased.';
  state.messageTimer = 3;
  state.events.push({ type: 'carStolen' });
  return true;
}

function buyAtShop(state) {
  const p = state.player;
  const shop = state.shops.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < PLAYER.interactRange);
  if (!shop) return false;
  if (p.hp < PLAYER.health && p.cash >= ECONOMY.healthPrice) {
    p.hp = Math.min(PLAYER.health, p.hp + ECONOMY.healthRestore);
    p.cash -= ECONOMY.healthPrice;
    state.message = `Patched up at ${shop.name}. -$${ECONOMY.healthPrice}`;
    state.messageTimer = 3;
    state.events.push({ type: 'buy', what: 'health' });
    return true;
  }
  if (p.cash >= ECONOMY.ammoPrice) {
    if (p.weapon === 'fists') {
      p.weapon = 'pistol';
      p.ammo.pistol = Math.max(p.ammo.pistol, WEAPONS.pistol.ammo);
      p.cash -= ECONOMY.ammoPrice;
      state.message = `Bought a pistol at ${shop.name}. -$${ECONOMY.ammoPrice}`;
    } else {
      p.ammo[p.weapon] = (p.ammo[p.weapon] || 0) + ECONOMY.ammoPack;
      p.cash -= ECONOMY.ammoPrice;
      state.message = `Ammo restocked at ${shop.name}. -$${ECONOMY.ammoPrice}`;
    }
    state.messageTimer = 3;
    state.events.push({ type: 'buy', what: 'ammo' });
    return true;
  }
  state.message = `${shop.name}: nothing you need right now.`;
  state.messageTimer = 2;
  return true;
}

function collectNearby(state) {
  const p = state.player;
  for (const pkg of state.packages) {
    if (pkg.collected) continue;
    if (Math.hypot(pkg.x - p.x, pkg.y - p.y) < 30) {
      pkg.collected = true;
      p.cash += ECONOMY.packageValue;
      state.stats.packages += 1;
      state.message = `Hidden package found! +$${ECONOMY.packageValue}`;
      state.messageTimer = 3;
      state.events.push({ type: 'package', id: pkg.id });
    }
  }
  for (const pickup of state.pickups) {
    if (!pickup.active) continue;
    if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 30) {
      pickup.active = false;
      if (pickup.kind === 'health') {
        p.hp = Math.min(PLAYER.health, p.hp + ECONOMY.healthRestore);
        state.message = `Health +${ECONOMY.healthRestore}`;
      } else if (pickup.kind === 'ammo') {
        const gun = p.weapon === 'fists' ? 'pistol' : p.weapon;
        p.ammo[gun] = (p.ammo[gun] || 0) + ECONOMY.ammoPack;
        state.message = `Ammo +${ECONOMY.ammoPack}`;
      } else if (pickup.kind === 'cash') {
        const value = randomInt(Math.random, ECONOMY.cashPickupMin, ECONOMY.cashPickupMax + 1);
        p.cash += value;
        state.message = `Found $${value} on the street`;
      } else if (pickup.kind === 'smg') {
        p.weapon = 'smg';
        p.ammo.smg = Math.max(p.ammo.smg, 60);
        state.message = 'Picked up an SMG';
      }
      state.messageTimer = 2;
      state.events.push({ type: 'pickup', kind: pickup.kind });
    }
  }
}

function updatePlayer(state, control, dt) {
  const p = state.player;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  if (p.inCar === null) {
    const moved = moveWithCollision(
      state, p.x, p.y,
      control.moveX * PLAYER.walkSpeed * dt,
      control.moveY * PLAYER.walkSpeed * dt,
      PLAYER.radius,
    );
    p.x = moved.x;
    p.y = moved.y;
    p.speed = Math.hypot(control.moveX, control.moveY) * PLAYER.walkSpeed;
    if ((control.moveX || control.moveY) && !control.fire) {
      p.angle = Math.atan2(control.moveY, control.moveX);
    }
    if (control.interact) {
      if (!stealCar(state)) buyAtShop(state);
    }
    if (control.fire) tryFire(state, control);
    collectNearby(state);
    return;
  }
  const car = state.cars.find((c) => c.id === p.inCar);
  if (!car) {
    p.inCar = null;
    return;
  }
  const model = CAR_MODELS[car.model];
  const throttle = -control.moveY;
  const steer = control.moveX;
  car.speed += throttle * model.accel * dt;
  car.speed -= car.speed * 0.6 * dt;
  car.speed = clamp(car.speed, -140, model.topSpeed);
  car.angle += steer * model.grip * (car.speed / model.topSpeed) * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const moved = moveWithCollision(state, car.x, car.y, nx - car.x, ny - car.y, model.width / 2);
  if (moved.x !== nx || moved.y !== ny) {
    if (Math.abs(car.speed) > 200) state.events.push({ type: 'crash' });
    car.speed *= 0.4;
  }
  car.x = moved.x;
  car.y = moved.y;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  if (control.interact) {
    car.kind = 'traffic';
    car.speed = 0;
    p.inCar = null;
    const side = { x: p.x + Math.cos(p.angle + Math.PI / 2) * 34, y: p.y + Math.sin(p.angle + Math.PI / 2) * 34 };
    if (!circleHitsBuilding(state, side.x, side.y, PLAYER.radius)) {
      p.x = side.x;
      p.y = side.y;
    }
    state.fare = null;
    return;
  }
  if (control.fire) tryFire(state, control);
}

function updateTraffic(state, dt) {
  const lines = roadLines();
  for (const car of state.cars) {
    if (car.kind !== 'traffic' || car.wreck) continue;
    const model = CAR_MODELS[car.model];
    const target = model.topSpeed * car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 0.8);
    const nearX = lines.some((l) => Math.abs(car.x - l) < 26);
    const nearY = lines.some((l) => Math.abs(car.y - l) < 26);
    if (nearX && nearY && Math.random() < dt * 0.12) {
      car.angle += Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (car.x < 90 || car.x > CITY.size - 90 || car.y < 90 || car.y > CITY.size - 90) {
      car.angle += Math.PI;
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const moved = moveWithCollision(state, car.x, car.y, nx - car.x, ny - car.y, model.width / 2);
    car.x = moved.x;
    car.y = moved.y;
  }
}

function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    ped.dirTimer -= dt;
    if (ped.dirTimer <= 0) {
      ped.angle = Math.random() * Math.PI * 2;
      ped.dirTimer = 2 + Math.random() * 4;
    }
    const moved = moveWithCollision(
      state, ped.x, ped.y,
      Math.cos(ped.angle) * ped.speed * dt,
      Math.sin(ped.angle) * ped.speed * dt,
      9,
    );
    ped.x = moved.x;
    ped.y = moved.y;
  }
}

function updateBullets(state, dt) {
  const alive = [];
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += Math.hypot(b.vx, b.vy) * dt;
    if (b.traveled > b.range || b.x < 0 || b.x > CITY.size || b.y < 0 || b.y > CITY.size) continue;
    if (pointInBuilding(state, b.x, b.y)) continue;
    let spent = false;
    for (const ped of state.peds) {
      if (ped.hp > 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        damagePed(state, ped, b.damage);
        spent = true;
        break;
      }
    }
    if (!spent) {
      for (const cop of state.police) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 30) {
          cop.hp -= b.damage;
          spent = true;
          break;
        }
      }
    }
    if (!spent) {
      for (const car of state.cars) {
        if (car.kind !== 'traffic' || car.wreck) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
          car.hp -= b.damage;
          if (car.hp <= 0) {
            car.wreck = true;
            car.speed = 0;
          }
          spent = true;
          break;
        }
      }
    }
    if (!spent) alive.push(b);
  }
  state.bullets = alive;
}

function updatePolice(state, dt) {
  const p = state.player;
  const desired = state.wanted * WANTED.policePerStar;
  if (state.police.length < desired && state.heatTimer < 3) {
    spawnPolice(state, 1, p.x, p.y);
  }
  const kept = [];
  for (const cop of state.police) {
    cop.ramCooldown = Math.max(0, cop.ramCooldown - dt);
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    if (d > 1100) {
      cop.lostTimer += dt;
      if (cop.lostTimer > 5) continue; // gave up: the trail went cold.
    } else {
      cop.lostTimer = 0;
    }
    if (cop.hp <= 0) {
      state.stats.smashed += 1;
      state.message = 'Interceptor down!';
      state.messageTimer = 3;
      state.events.push({ type: 'policeDestroyed' });
      continue;
    }
    const model = CAR_MODELS[cop.model];
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    // A cop pinned against a building by a straight-line chase sidesteps
    // around it instead of pushing at the wall forever.
    let steerTarget = wantAngle;
    if (cop.avoidTimer > 0) {
      steerTarget = wantAngle + cop.avoidDir * (Math.PI / 2);
      cop.avoidTimer -= dt;
    }
    const turn = clamp(angleDiff(steerTarget, cop.angle), -2.4 * dt, 2.4 * dt);
    cop.angle += turn;
    // On foot the cop creeps in to make the arrest instead of running the
    // player down; in a car it comes in at full speed to ram.
    const targetSpeed = p.inCar === null
      ? clamp((d - 35) * 3, 0, 260)
      : model.topSpeed * 0.92;
    cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 0.9);
    const prevX = cop.x;
    const prevY = cop.y;
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const moved = moveWithCollision(state, cop.x, cop.y, nx - cop.x, ny - cop.y, model.width / 2);
    cop.x = moved.x;
    cop.y = moved.y;
    const movedDist = Math.hypot(cop.x - prevX, cop.y - prevY);
    if (cop.speed > 40 && movedDist < cop.speed * dt * 0.25) {
      cop.avoidTimer = 1.2;
      cop.avoidDir = cop.id % 2 === 0 ? 1 : -1;
    }
    if (p.inCar !== null && d < 50 && cop.ramCooldown <= 0) {
      p.hp -= WANTED.policeRamDamage;
      cop.ramCooldown = WANTED.policeRamCooldown;
      state.events.push({ type: 'ram' });
      if (p.hp <= 0) {
        state.dead = true;
        state.events.push({ type: 'dead' });
      }
    }
    // A bust needs the cop close while the player is cornered or standing
    // still — a player who keeps moving on foot can still slip away.
    if (p.inCar === null && d < WANTED.bustDistance && p.speed < 60) {
      state.bustTimer += dt;
      if (state.bustTimer >= WANTED.bustSeconds) {
        state.busted = true;
        state.events.push({ type: 'busted' });
      }
    } else if (d > WANTED.bustDistance + 24) {
      state.bustTimer = 0;
    }
    kept.push(cop);
  }
  state.police = kept;
}

function updateFare(state, dt) {
  const p = state.player;
  if (p.inCar === null) {
    state.fare = null;
    return;
  }
  const car = state.cars.find((c) => c.id === p.inCar);
  if (!car || CAR_MODELS[car.model].name !== 'Taxi') {
    state.fare = null;
    return;
  }
  if (!state.fare) {
    if (Math.random() < dt * 0.1) {
      const pickup = roadPoint(Math.random);
      const dest = roadPoint(Math.random);
      state.fare = {
        phase: 'wait',
        pickup,
        dest,
        value: randomInt(Math.random, ECONOMY.taxiMin, ECONOMY.taxiMax + 1),
      };
      state.message = 'Fare waiting — pick them up at the green marker.';
      state.messageTimer = 3;
    }
    return;
  }
  const fare = state.fare;
  if (fare.phase === 'wait' && Math.hypot(p.x - fare.pickup.x, p.y - fare.pickup.y) < 60) {
    fare.phase = 'ride';
    state.message = 'Passenger aboard — take them to the marker.';
    state.messageTimer = 3;
  } else if (fare.phase === 'ride' && Math.hypot(p.x - fare.dest.x, p.y - fare.dest.y) < 60) {
    p.cash += fare.value;
    state.stats.fares += 1;
    state.message = `Fare complete! +$${fare.value}`;
    state.messageTimer = 3;
    state.events.push({ type: 'fare', value: fare.value });
    state.fare = null;
  }
}

function updatePickups(state, dt) {
  const active = state.pickups.filter((pk) => pk.active).length;
  if (active < 6 && Math.random() < dt * 0.2) spawnPickup(state, Math.random);
}

/** One fixed step of the simulation. `control` is the input contract. */
export function stepWorld(state, control, dt) {
  if (state.dead || state.busted) return;
  state.time += dt;
  state.heatTimer += dt;
  if (state.wanted > 0 && state.heatTimer >= WANTED.decaySeconds) {
    state.wanted -= 1;
    state.heatTimer = 0;
    if (state.wanted === 0) {
      state.police = [];
      state.message = 'You lost them.';
      state.messageTimer = 3;
    }
  }
  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.message = '';
  }
  updatePlayer(state, control, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateBullets(state, dt);
  updatePolice(state, dt);
  updateFare(state, dt);
  updatePickups(state, dt);
  if (state.player.hp <= 0 && !state.dead) {
    state.dead = true;
    state.events.push({ type: 'dead' });
  }
}

/** A plain snapshot the save system can stringify and restore. */
export function worldSnapshot(state) {
  const snap = JSON.parse(JSON.stringify(state));
  snap.events = [];
  return snap;
}

/** Restore a snapshot into a live state object (same reference). */
export function worldLoad(state, snap) {
  const keep = state.buildings;
  for (const key of Object.keys(snap)) state[key] = snap[key];
  if (!state.buildings || state.buildings.length === 0) state.buildings = keep;
  state.events = [];
}

/** Teleport the player (on foot) — used by shot staging. */
export function placePlayer(state, x, y, angle) {
  const p = state.player;
  if (p.inCar !== null) {
    const car = state.cars.find((c) => c.id === p.inCar);
    if (car) car.kind = 'traffic';
    p.inCar = null;
  }
  p.x = x;
  p.y = y;
  p.angle = angle || 0;
}

/** Put the player behind the wheel of a fresh car of `modelIdx` at (x, y). */
export function giveCar(state, modelIdx, x, y, angle) {
  const car = {
    id: state.nextId,
    model: modelIdx,
    kind: 'player',
    x,
    y,
    angle: angle || 0,
    speed: 0,
    hp: 100,
    cruise: 0.5,
    wreck: false,
  };
  state.nextId += 1;
  state.cars.push(car);
  const p = state.player;
  p.inCar = car.id;
  p.x = x;
  p.y = y;
  p.angle = angle || 0;
  return car;
}

/** Set the wanted level and mark the heat as fresh (police may spawn). */
export function setWanted(state, n) {
  state.wanted = clamp(n, 0, WANTED.max);
  state.heatTimer = 0;
}

/** Spawn `count` police cars near (x, y), on the nearest road, no closer than
 * `minDist` to the player — so the player sees them coming instead of finding
 * one on top of them. Gameplay spawns use the default; shot staging passes a
 * smaller minimum so the chase reads in frame. */
export function spawnPolice(state, count, x, y, minDist = 450) {
  const lines = roadLines();
  function roadNear(ax, ay) {
    const px = ax + (Math.random() - 0.5) * 480;
    const py = ay + (Math.random() - 0.5) * 480;
    const nearX = lines.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a), lines[0]);
    const nearY = lines.reduce((a, b) => (Math.abs(b - py) < Math.abs(a - py) ? b : a), lines[0]);
    const onVertical = Math.abs(nearX - px) < Math.abs(nearY - py);
    return onVertical
      ? { x: nearX, y: clamp(py, 60, CITY.size - 60) }
      : { x: clamp(px, 60, CITY.size - 60), y: nearY };
  }
  // A road point at an exact distance from the player: pick a road, then the
  // along-road offset that lands the distance in [minDist, minDist + 300].
  function annulusSpot() {
    for (let tries = 0; tries < 24; tries += 1) {
      const vertical = Math.random() < 0.5;
      const line = lines[Math.floor(Math.random() * lines.length)];
      const target = minDist + Math.random() * 300;
      if (vertical) {
        const dx = line - state.player.x;
        if (Math.abs(dx) > target) continue;
        const dy = Math.sqrt(target * target - dx * dx);
        const y = state.player.y + (Math.random() < 0.5 ? -dy : dy);
        if (y < 60 || y > CITY.size - 60) continue;
        return { x: line, y };
      }
      const dy = line - state.player.y;
      if (Math.abs(dy) > target) continue;
      const dx = Math.sqrt(target * target - dy * dy);
      const x = state.player.x + (Math.random() < 0.5 ? -dx : dx);
      if (x < 60 || x > CITY.size - 60) continue;
      return { x, y: line };
    }
    return null;
  }
  for (let i = 0; i < count; i += 1) {
    let spot = null;
    // First try near the anchor (keeps a staged chase behind the player).
    for (let tries = 0; tries < 8 && !spot; tries += 1) {
      const cand = roadNear(x, y);
      if (Math.hypot(cand.x - state.player.x, cand.y - state.player.y) >= minDist) spot = cand;
    }
    // Otherwise anywhere in the city at a fair distance from the player.
    if (!spot) spot = annulusSpot();
    if (!spot) spot = roadNear(x, y);
    state.police.push({
      id: state.nextId,
      model: CAR_MODELS.length - 1, // Interceptor
      kind: 'police',
      x: spot.x,
      y: spot.y,
      angle: Math.atan2(state.player.y - spot.y, state.player.x - spot.x),
      speed: 0,
      hp: WANTED.policeHealth,
      ramCooldown: 0,
      lostTimer: 0,
      avoidTimer: 0,
      avoidDir: 1,
    });
    state.nextId += 1;
  }
}
