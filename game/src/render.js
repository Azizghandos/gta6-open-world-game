// Drawing only: the world's state and the current screen in, pixels out. A camera follows
// the player across the 3200x3200 city; the HUD, the minimap and the panels are drawn in
// screen space on top. Flat vector shapes only — no images, no network.
import { CAR_MODELS, CITY, DAY_LENGTH, DISTRICTS, FONT, MISSIONS, PALETTE, WEAPONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const MINIMAP = 176;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function starRow(count, max) {
  let out = '';
  for (let i = 0; i < max; i += 1) out += i < count ? '★' : '☆';
  return out;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const cashLabel = cachedLabel('$');
  const ammoLabel = cachedLabel('');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.max(0.45, Math.min(1.15, Math.min(canvas.width / 1050, canvas.height / 720)));
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawCarShape(car) {
    const model = CAR_MODELS[car.model];
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = model.color;
    roundRect(-model.length / 2, -model.width / 2, model.length, model.width, 7);
    context.fill();
    context.fillStyle = model.roof;
    roundRect(-model.length / 5, -model.width / 2 + 5, model.length / 2.4, model.width - 10, 4);
    context.fill();
    context.fillStyle = 'rgba(20, 28, 40, 0.85)';
    context.fillRect(model.length / 2 - 12, -model.width / 2 + 4, 8, model.width - 8);
    if (car.kind === 'police') {
      context.fillStyle = Math.floor(performance.now() / 280) % 2 === 0 ? '#e5534b' : '#4f7dc9';
      context.fillRect(-6, -model.width / 2 - 2, 12, 5);
      context.fillStyle = Math.floor(performance.now() / 280) % 2 === 0 ? '#4f7dc9' : '#e5534b';
      context.fillRect(-6, model.width / 2 - 3, 12, 5);
    }
    context.restore();
  }

  function drawWorld(state, target) {
    const player = state.player;
    const camX = Math.max(0, Math.min(CITY.size - canvas.width / view.scale, player.x - canvas.width / view.scale / 2));
    const camY = Math.max(0, Math.min(CITY.size - canvas.height / view.scale, player.y - canvas.height / view.scale / 2));
    context.save();
    context.setTransform(view.scale, 0, 0, view.scale, -camX * view.scale, -camY * view.scale);

    // Sea and sand frame the city.
    context.fillStyle = PALETTE.sea;
    context.fillRect(camX - 80, camY - 80, canvas.width / view.scale + 160, canvas.height / view.scale + 160);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, 0, CITY.size, CITY.size);

    // Districts.
    for (const district of DISTRICTS) {
      context.fillStyle = district.ground;
      context.fillRect(district.x, district.y, district.w, district.h);
    }

    // Roads.
    context.fillStyle = PALETTE.road;
    for (let at = CITY.firstRoad; at < CITY.size; at += CITY.roadGap) {
      context.fillRect(at - CITY.roadWidth / 2, 0, CITY.roadWidth, CITY.size);
      context.fillRect(0, at - CITY.roadWidth / 2, CITY.size, CITY.roadWidth);
    }
    // Centre lines.
    context.fillStyle = PALETTE.roadLine;
    for (let at = CITY.firstRoad; at < CITY.size; at += CITY.roadGap) {
      for (let along = 0; along < CITY.size; along += 64) {
        context.fillRect(at - 2, along, 4, 30);
        context.fillRect(along, at - 2, 30, 4);
      }
    }
    // Sidewalks.
    context.fillStyle = PALETTE.sidewalk;
    for (let at = CITY.firstRoad; at < CITY.size; at += CITY.roadGap) {
      context.fillRect(at - CITY.roadWidth / 2 - 12, 0, 12, CITY.size);
      context.fillRect(at + CITY.roadWidth / 2, 0, 12, CITY.size);
      context.fillRect(0, at - CITY.roadWidth / 2 - 12, CITY.size, 12);
      context.fillRect(0, at + CITY.roadWidth / 2, CITY.size, 12);
    }

    // Buildings.
    for (const b of state.buildings) {
      context.fillStyle = b.color;
      context.globalAlpha = b.shade;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.globalAlpha = 1;
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x, b.y + b.h - 8, b.w, 8);
    }

    // Shops.
    for (const shop of state.shops) {
      context.fillStyle = '#f2c230';
      context.beginPath();
      context.arc(shop.x, shop.y, 16, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#141a24';
      context.font = `bold 20px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('$', shop.x, shop.y + 1);
    }

    // Hidden packages.
    for (const pkg of state.packages) {
      if (pkg.collected) continue;
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300 + pkg.x);
      context.fillStyle = `rgba(242, 194, 48, ${pulse})`;
      context.beginPath();
      context.arc(pkg.x, pkg.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#141a24';
      context.beginPath();
      context.arc(pkg.x, pkg.y, 4, 0, Math.PI * 2);
      context.fill();
    }

    // Pickups.
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      const color = pickup.kind === 'health' ? PALETTE.pickupHealth : pickup.kind === 'ammo' ? PALETTE.pickupAmmo : pickup.kind === 'smg' ? '#c94fd6' : PALETTE.pickupCash;
      context.fillStyle = color;
      context.beginPath();
      context.arc(pickup.x, pickup.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#141a24';
      context.font = `bold 13px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(pickup.kind === 'health' ? '+' : pickup.kind === 'cash' ? '$' : 'A', pickup.x, pickup.y + 1);
    }

    // Taxi fare markers.
    if (state.fare) {
      const fare = state.fare;
      const spot = fare.phase === 'wait' ? fare.pickup : fare.dest;
      context.fillStyle = '#7ddc8a';
      context.beginPath();
      context.arc(spot.x, spot.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#141a24';
      context.font = `bold 15px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(fare.phase === 'wait' ? '?' : '$', spot.x, spot.y + 1);
    }

    // Mission target marker.
    if (target) {
      const bob = Math.sin(performance.now() / 240) * 4;
      context.fillStyle = '#f2c230';
      context.beginPath();
      context.arc(target.x, target.y + bob, 14, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#141a24';
      context.font = `bold 16px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('!', target.x, target.y + bob + 1);
    }

    // Traffic, police, the player's car.
    for (const car of state.cars) if (car.kind === 'traffic') drawCarShape(car);
    for (const cop of state.police) drawCarShape(cop);
    for (const car of state.cars) if (car.kind === 'player') drawCarShape(car);

    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.hp <= 0) continue;
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.arc(ped.x, ped.y - 2, 4, 0, Math.PI * 2);
      context.fill();
    }

    // Bullets.
    context.fillStyle = '#ffe08a';
    for (const bullet of state.bullets) {
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      context.fill();
    }

    // The player on foot.
    if (state.player.inCar === null) {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(player.x, player.y, 14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.playerOutline;
      context.lineWidth = 3;
      context.stroke();
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(player.x, player.y);
      context.lineTo(player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20);
      context.stroke();
    }

    // Day / night tint over the world.
    const dayTime = (state.time % DAY_LENGTH) / DAY_LENGTH;
    let tint = null;
    if (dayTime >= 0.45 && dayTime < 0.55) tint = PALETTE.duskTint;
    else if (dayTime >= 0.55 && dayTime < 0.95) tint = PALETTE.nightTint;
    else if (dayTime >= 0.05 && dayTime < 0.45) tint = PALETTE.dayTint;
    if (tint) {
      context.fillStyle = tint;
      context.fillRect(camX, camY, canvas.width / view.scale, canvas.height / view.scale);
    }
    context.restore();
    return { camX, camY };
  }

  function drawMinimap(state, target) {
    const x0 = 16;
    const y0 = canvas.height - MINIMAP - 16;
    const scale = MINIMAP / CITY.size;
    context.fillStyle = 'rgba(10, 14, 22, 0.82)';
    roundRect(x0 - 6, y0 - 6, MINIMAP + 12, MINIMAP + 12, 8);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(x0, y0, MINIMAP, MINIMAP);
    context.clip();
    for (const district of DISTRICTS) {
      context.fillStyle = district.ground;
      context.fillRect(x0 + district.x * scale, y0 + district.y * scale, district.w * scale, district.h * scale);
    }
    context.fillStyle = PALETTE.road;
    for (let at = CITY.firstRoad; at < CITY.size; at += CITY.roadGap) {
      context.fillRect(x0 + (at - 2) * scale, y0, 4 * scale, MINIMAP);
      context.fillRect(x0, y0 + (at - 2) * scale, MINIMAP, 4 * scale);
    }
    for (const pkg of state.packages) {
      if (pkg.collected) continue;
      context.fillStyle = '#f2c230';
      context.fillRect(x0 + pkg.x * scale - 1, y0 + pkg.y * scale - 1, 3, 3);
    }
    if (target) {
      context.fillStyle = '#f2c230';
      context.beginPath();
      context.arc(x0 + target.x * scale, y0 + target.y * scale, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const cop of state.police) {
      context.fillStyle = '#6aa8ff';
      context.beginPath();
      context.arc(x0 + cop.x * scale, y0 + cop.y * scale, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x0 + state.player.x * scale, y0 + state.player.y * scale, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHud(state, mission) {
    const player = state.player;
    const w = canvas.width;
    // Health bar + cash, top left.
    context.fillStyle = 'rgba(10, 14, 22, 0.7)';
    roundRect(14, 14, 230, 54, 8);
    context.fill();
    context.fillStyle = '#2c3646';
    context.fillRect(28, 26, 150, 14);
    context.fillStyle = player.hp > 30 ? '#4dca6a' : '#e5534b';
    context.fillRect(28, 26, 150 * Math.max(0, player.hp) / 100, 14);
    text(`HP ${Math.max(0, Math.round(player.hp))}`, 186, 40, 15, PALETTE.text, 'left', 'middle');
    text(cashLabel(player.cash), 28, 62, 20, '#7ddc8a', 'left', 'middle');
    // Wanted stars, top right.
    context.fillStyle = 'rgba(10, 14, 22, 0.7)';
    roundRect(w - 210, 14, 196, 40, 8);
    context.fill();
    text(starRow(state.wanted, 5), w - 28, 44, 26, PALETTE.star, 'right', 'middle');
    // Weapon + ammo, bottom centre.
    const weapon = WEAPONS[player.weapon];
    const ammo = player.weapon === 'fists' ? '∞' : String(player.ammo[player.weapon] || 0);
    text(`${weapon.name}  •  ${ammoLabel(ammo)}`, w / 2, canvas.height - 24, 20, PALETTE.text, 'center', 'middle');
    // Mission banner, top centre.
    if (mission) {
      context.fillStyle = 'rgba(10, 14, 22, 0.7)';
      const lines = [`${mission.giver}: ${mission.title}`, mission.brief];
      const bw = 520;
      roundRect(w / 2 - bw / 2, 14, bw, 58, 8);
      context.fill();
      text(lines[0], w / 2, 36, 17, PALETTE.star, 'center', 'middle');
      text(lines[1], w / 2, 58, 14, PALETTE.muted, 'center', 'middle');
    }
    // Toast message.
    if (state.messageTimer > 0 && state.message) {
      context.fillStyle = 'rgba(10, 14, 22, 0.78)';
      const mw = Math.min(560, context.measureText(state.message).width + 36);
      roundRect(w / 2 - mw / 2, canvas.height - 84, mw, 36, 8);
      context.fill();
      text(state.message, w / 2, canvas.height - 66, 16, PALETTE.text, 'center', 'middle');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (canvas.width - PANEL.width) / 2;
    const y = (canvas.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, canvas.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], canvas.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, canvas.width / 2, y + height - 38, 22, PALETTE.star, 'center');
  }

  const TITLE_LINES = [
    'A sun-soaked coastal city. Six missions. One score to settle.',
    'WASD or arrows to move and drive • E to steal a car • Mouse to aim, click to fire',
    '1 / 2 / 3 to switch weapon • P to pause • Your save lives in this browser',
    '',
  ];

  /** Paint one frame: the world, then the HUD, then a panel for the screen the game is on.
   * Returns the camera ({camX, camY, scale}) so the caller can turn pointer positions into
   * world coordinates for aiming. */
  function draw(state, screen, extras) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const mission = MISSIONS[state.mission.index] || null;
    const cam = drawWorld(state, extras ? extras.target : null);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR', TITLE_LINES, 'Press Space or click to start');
      return { camX: cam.camX, camY: cam.camY, scale: view.scale };
    }
    drawHud(state, mission);
    drawMinimap(state, extras ? extras.target : null);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Flatlined', [`You went down with $${state.player.cash} in your pocket.`, 'Leo will not be pleased.'], 'Press Space to try again');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('Busted', [`The Solmar PD caught you with $${state.player.cash}.`, 'The story ends in a cell.'], 'Press Space to try again');
    }
    return { camX: cam.camX, camY: cam.camY, scale: view.scale };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
