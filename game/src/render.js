// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 logical view is scaled to fit the window; the camera follows
// the player through the city. Flat shapes and canvas text: the whole look
// is drawn, no images ship with the game.
import { DISTRICTS, PALETTE, PLACES, VIEW, WEAPONS, WORLD } from './config.js';
import { daylight } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_HELP = 'help';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_SHOP = 'shop';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TAU = Math.PI * 2;

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 190;
  mapCanvas.height = 190;
  const mapCtx = mapCanvas.getContext('2d');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? weight + ' ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
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

  function wrapText(value, maxWidth, size) {
    context.font = `${size}px ${FONT}`;
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (context.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---- world drawing ----
  function drawGround(state) {
    const cam = state.camera;
    const vx0 = cam.x - VIEW.width / 2;
    const vy0 = cam.y - VIEW.height / 2;
    const vx1 = cam.x + VIEW.width / 2;
    const vy1 = cam.y + VIEW.height / 2;
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(vx0, vy0, VIEW.width, VIEW.height);
    // Beach and sea on the east edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(2950, vy0, 160, VIEW.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(3110, vy0, 90, VIEW.height);
    context.fillStyle = PALETTE.waterDeep;
    context.fillRect(3160, vy0, 40, VIEW.height);
    // Animated wave lines.
    context.strokeStyle = 'rgba(255,255,255,0.25)';
    context.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const wy = vy0 + ((state.elapsed * 30 + i * 160) % (VIEW.height + 160)) - 80;
      context.beginPath();
      context.moveTo(3112, wy);
      context.quadraticCurveTo(3140, wy + 12, 3168, wy);
      context.stroke();
    }
    // Central Park.
    drawPark(state);
    // Roads: asphalt, sidewalks, centre dashes, crosswalks.
    drawRoads(state, vx0, vy0, vx1, vy1);
    // District names, faint on the ground.
    context.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      if (cx < vx0 - 200 || cx > vx1 + 200 || cy < vy0 - 100 || cy > vy1 + 100) continue;
      text(d.name.toUpperCase(), cx, cy, 44, 'rgba(255,255,255,0.10)', 'center', 'bold');
    }
  }

  function drawPark(state) {
    const park = state.city.park;
    const pond = state.city.pond;
    context.fillStyle = PALETTE.parkGrass;
    context.fillRect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0);
    context.fillStyle = '#c9b489';
    context.fillRect(park.x0 + 130, park.y0, 18, park.y1 - park.y0);
    context.fillRect(park.x0, park.y0 + 130, park.x1 - park.x0, 18);
    context.fillStyle = PALETTE.water;
    context.beginPath();
    context.ellipse(pond.x, pond.y, pond.r, pond.r * 0.7, 0, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.waterDeep;
    context.beginPath();
    context.ellipse(pond.x, pond.y, pond.r * 0.6, pond.r * 0.42, 0, 0, TAU);
    context.fill();
  }

  function drawRoads(state, vx0, vy0, vx1, vy1) {
    const streets = [350, 750, 1150, 1550, 1950, 2350, 2750];
    // Sidewalks first, then asphalt.
    for (const s of streets) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(s - 61, vy0, 16, vy1 - vy0);
      context.fillRect(s + 45, vy0, 16, vy1 - vy0);
      context.fillRect(vx0, s - 61, vx1 - vx0, 16);
      context.fillRect(vx0, s + 45, vx1 - vx0, 16);
    }
    context.fillStyle = PALETTE.road;
    for (const s of streets) {
      context.fillRect(s - 45, vy0, 90, vy1 - vy0);
      context.fillRect(vx0, s - 45, vx1 - vx0, 90);
    }
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const s of streets) {
      for (let y = Math.floor(vy0 / 70) * 70; y < vy1; y += 70) {
        let blocked = false;
        for (const t of streets) if (Math.abs(y - t) < 70) blocked = true;
        if (!blocked) context.fillRect(s - 2, y, 4, 34);
      }
      for (let x = Math.floor(vx0 / 70) * 70; x < vx1; x += 70) {
        let blocked = false;
        for (const t of streets) if (Math.abs(x - t) < 70) blocked = true;
        if (!blocked) context.fillRect(x, s - 2, 34, 4);
      }
    }
    // Crosswalk stripes at every intersection in view.
    context.fillStyle = 'rgba(255,255,255,0.55)';
    for (const sx of streets) {
      for (const sy of streets) {
        if (sx < vx0 - 80 || sx > vx1 + 80 || sy < vy0 - 80 || sy > vy1 + 80) continue;
        for (let i = -2; i <= 2; i += 1) {
          context.fillRect(sx - 44 + i * 18, sy - 61, 8, 14);
          context.fillRect(sx - 44 + i * 18, sy + 47, 8, 14);
          context.fillRect(sx - 61, sy - 44 + i * 18, 14, 8);
          context.fillRect(sx + 47, sy - 44 + i * 18, 14, 8);
        }
      }
    }
  }

  function drawBuildings(state) {
    const cam = state.camera;
    const vx0 = cam.x - VIEW.width / 2 - 120;
    const vy0 = cam.y - VIEW.height / 2 - 120;
    const vx1 = cam.x + VIEW.width / 2 + 120;
    const vy1 = cam.y + VIEW.height / 2 + 120;
    for (const b of state.city.buildings) {
      if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
      // Sun shadow, offset by height.
      context.fillStyle = 'rgba(0,0,0,0.22)';
      context.fillRect(b.x + b.hgt * 0.22, b.y + b.hgt * 0.3, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Rooftop boxes, placed by the building's own seed.
      const n = 1 + Math.floor(b.seed * 3);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < n; i += 1) {
        const ux = b.x + 12 + ((b.seed * 997 + i * 61) % Math.max(10, b.w - 40));
        const uy = b.y + 12 + ((b.seed * 571 + i * 37) % Math.max(10, b.h - 40));
        context.fillRect(ux, uy, 16, 12);
      }
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 2;
      context.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
    }
    // The pier.
    const pier = state.city.pier;
    context.fillStyle = '#8a6d4b';
    context.fillRect(pier.x, pier.y, pier.w, pier.h);
    context.strokeStyle = '#6b5335';
    context.lineWidth = 2;
    for (let x = pier.x; x < pier.x + pier.w; x += 18) {
      context.beginPath();
      context.moveTo(x, pier.y);
      context.lineTo(x, pier.y + pier.h);
      context.stroke();
    }
  }

  function drawTrees(state) {
    const cam = state.camera;
    const vx0 = cam.x - VIEW.width / 2 - 40;
    const vy0 = cam.y - VIEW.height / 2 - 40;
    const vx1 = cam.x + VIEW.width / 2 + 40;
    const vy1 = cam.y + VIEW.height / 2 + 40;
    for (const t of state.city.trees) {
      if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.beginPath();
      context.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.8, 0, 0, TAU);
      context.fill();
      if (t.palm) {
        context.strokeStyle = '#7a5a34';
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(t.x, t.y + 8);
        context.lineTo(t.x + 3, t.y - 6);
        context.stroke();
        context.fillStyle = '#2f9e44';
      } else {
        context.fillStyle = '#2f7d32';
      }
      context.beginPath();
      context.arc(t.x, t.y - 2, t.r, 0, TAU);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.beginPath();
      context.arc(t.x - 3, t.y - 5, t.r * 0.45, 0, TAU);
      context.fill();
    }
  }

  function drawCar(car, isPlayer, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(3, 5, car.len / 2, car.wid / 2, 0, 0, TAU);
    context.fill();
    // Wheels.
    context.fillStyle = '#111';
    const wl = car.len * 0.32;
    const ww = car.wid / 2 - 2;
    context.fillRect(-wl - 6, -ww - 3, 12, 6);
    context.fillRect(wl - 6, -ww - 3, 12, 6);
    context.fillRect(-wl - 6, ww - 3, 12, 6);
    context.fillRect(wl - 6, ww - 3, 12, 6);
    // Body.
    context.fillStyle = car.color;
    roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 7);
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.45)';
    context.lineWidth = 1.5;
    context.stroke();
    // Cabin glass.
    context.fillStyle = 'rgba(18,30,42,0.9)';
    roundRect(-car.len * 0.2, -car.wid * 0.32, car.len * 0.34, car.wid * 0.64, 4);
    context.fill();
    if (car.model === 'taxi') {
      context.fillStyle = '#111';
      for (let i = 0; i < 6; i += 1) context.fillRect(-car.len / 2 + 4 + i * 8, -2, 4, 4);
      context.fillStyle = '#f7c948';
      context.fillRect(-6, -car.wid / 2 - 5, 12, 5);
    }
    if (car.police) {
      context.fillStyle = '#eef1f5';
      context.fillRect(-car.len * 0.12, -car.wid / 2, car.len * 0.24, car.wid);
      const flash = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = flash ? '#ff2d55' : '#0a84ff';
      context.beginPath();
      context.arc(-4, -car.wid / 2 + 2, 4, 0, TAU);
      context.fill();
      context.fillStyle = flash ? '#0a84ff' : '#ff2d55';
      context.beginPath();
      context.arc(4, -car.wid / 2 + 2, 4, 0, TAU);
      context.fill();
    }
    // Headlights and tail lights.
    context.fillStyle = '#fff8c9';
    context.fillRect(car.len / 2 - 2, -car.wid / 2 + 3, 3, 5);
    context.fillRect(car.len / 2 - 2, car.wid / 2 - 8, 3, 5);
    context.fillStyle = '#e5534b';
    context.fillRect(-car.len / 2 - 1, -car.wid / 2 + 3, 3, 5);
    context.fillRect(-car.len / 2 - 1, car.wid / 2 - 8, 3, 5);
    if (isPlayer) {
      context.strokeStyle = 'rgba(255,255,255,0.85)';
      context.lineWidth = 2;
      roundRect(-car.len / 2 - 4, -car.wid / 2 - 4, car.len + 8, car.wid + 8, 9);
      context.stroke();
    }
    context.restore();
    // Damage smoke is spawned by the world; a wreck shows scorch marks.
    if (car.hp < 45) {
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.ellipse(car.x - Math.cos(car.angle) * 8, car.y - Math.sin(car.angle) * 8, 12, 8, car.angle, 0, TAU);
      context.fill();
    }
  }

  function drawPerson(x, y, angle, bodyColor, shirtColor, opts) {
    const o = opts || {};
    context.save();
    context.translate(x, y);
    if (o.lying) {
      context.rotate(angle + Math.PI / 2);
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath();
      context.ellipse(0, 3, 13, 7, 0, 0, TAU);
      context.fill();
      context.fillStyle = bodyColor;
      context.beginPath();
      context.ellipse(0, 0, 12, 6, 0, 0, TAU);
      context.fill();
      context.restore();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(2, 3, 10, 8, 0, 0, TAU);
    context.fill();
    context.rotate(angle);
    context.fillStyle = shirtColor;
    context.beginPath();
    context.arc(0, 0, 9, 0, TAU);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(11, 0, 4.5, 0, TAU);
    context.fill();
    if (o.gun) {
      context.strokeStyle = '#222';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(6, 0);
      context.lineTo(20, 0);
      context.stroke();
    }
    context.restore();
    if (o.marker) {
      context.fillStyle = o.marker;
      context.beginPath();
      context.moveTo(x, y - 24);
      context.lineTo(x - 6, y - 34);
      context.lineTo(x + 6, y - 34);
      context.closePath();
      context.fill();
    }
  }

  function drawWorld(state) {
    const cam = state.camera;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.save();
    context.translate(-cam.x + VIEW.width / 2 + shakeX, -cam.y + VIEW.height / 2 + shakeY);
    drawGround(state);
    drawBuildings(state);
    drawTrees(state);
    // Lamps.
    for (const lamp of state.city.lamps) {
      if (Math.abs(lamp.x - cam.x) > 700 || Math.abs(lamp.y - cam.y) > 420) continue;
      context.strokeStyle = '#3a3f45';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(lamp.x, lamp.y);
      context.lineTo(lamp.x, lamp.y - 16);
      context.stroke();
      context.fillStyle = '#ffd60a';
      context.beginPath();
      context.arc(lamp.x, lamp.y - 17, 3, 0, TAU);
      context.fill();
    }
    // Pickups and hidden packages.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(state.elapsed * 3 + pk.x) * 3;
      context.fillStyle = pk.kind === 'health' ? '#2ecc71' : '#4fc3f7';
      context.beginPath();
      context.arc(pk.x, pk.y + bob, 12, 0, TAU);
      context.fill();
      context.fillStyle = '#fff';
      text(pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + bob + 5, 15, '#fff', 'center', 'bold');
    }
    for (const pkg of state.packages) {
      if (pkg.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 4 + pkg.x);
      context.fillStyle = `rgba(242,201,76,${pulse})`;
      context.fillRect(pkg.x - 9, pkg.y - 9, 18, 18);
      context.strokeStyle = '#8a6d1a';
      context.lineWidth = 2;
      context.strokeRect(pkg.x - 9, pkg.y - 9, 18, 18);
      text('$', pkg.x, pkg.y + 5, 13, '#5d4a00', 'center', 'bold');
    }
    // Objective beam and marker.
    if (state.objective && state.objective.x) {
      const ox = state.objective.x;
      const oy = state.objective.y;
      const pulse = 0.55 + 0.35 * Math.sin(state.elapsed * 5);
      const grad = context.createLinearGradient(ox, oy - 120, ox, oy);
      grad.addColorStop(0, 'rgba(242,201,76,0)');
      grad.addColorStop(1, `rgba(242,201,76,${pulse})`);
      context.fillStyle = grad;
      context.fillRect(ox - 5, oy - 120, 10, 120);
      context.fillStyle = '#f2c94c';
      context.save();
      context.translate(ox, oy - 26 + Math.sin(state.elapsed * 4) * 5);
      context.rotate(Math.PI / 4);
      context.fillRect(-8, -8, 16, 16);
      context.restore();
    }
    // Cars, peds, enemies, cops, player.
    for (const car of state.cars) {
      if (Math.abs(car.x - cam.x) > 760 || Math.abs(car.y - cam.y) > 480) continue;
      drawCar(car, state.player.car === car, state.elapsed);
    }
    for (const ped of state.peds) {
      if (ped.state === 'dead') {
        drawPerson(ped.x, ped.y, ped.angle, '#888', ped.shirt, { lying: true });
        continue;
      }
      if (Math.abs(ped.x - cam.x) > 700 || Math.abs(ped.y - cam.y) > 420) continue;
      drawPerson(ped.x, ped.y, ped.angle, '#333', ped.shirt, {});
    }
    for (const e of state.enemies) {
      drawPerson(e.x, e.y, e.angle, '#7b2d26', '#c0392b', { gun: true, marker: '#e5534b' });
    }
    for (const cop of state.cops) {
      if (cop.onFoot) {
        drawPerson(cop.x, cop.y, cop.angle, '#1c2b39', '#2c4a6b', { marker: '#3d7bfd' });
      }
    }
    // The player.
    const p = state.player;
    if (p.onFoot) {
      const blink = p.invuln > 0 && Math.floor(state.elapsed * 12) % 2 === 0;
      if (!blink) {
        // A white ring so the player never gets lost in the crowd.
        context.strokeStyle = 'rgba(255,255,255,0.9)';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(p.x, p.y, 15, 0, TAU);
        context.stroke();
        drawPerson(p.x, p.y, p.aimAngle, '#0f766e', '#14b8a6', { gun: state.weapon !== 'fists' });
      }
    }
    // Bullets.
    context.strokeStyle = '#ffe27a';
    context.lineWidth = 2;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Particles.
    for (const part of state.parts) {
      context.globalAlpha = clamp(part.life / part.max, 0, 1);
      context.fillStyle = part.color;
      context.beginPath();
      context.arc(part.x, part.y, part.size, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
    // Night: darken the world, then lamp and headlight glow.
    const day = daylight(state.time);
    if (day < 1) {
      context.fillStyle = `rgba(6,10,34,${(1 - day) * 0.52})`;
      context.fillRect(cam.x - VIEW.width / 2, cam.y - VIEW.height / 2, VIEW.width, VIEW.height);
      const glow = (1 - day) * 0.5;
      for (const lamp of state.city.lamps) {
        if (Math.abs(lamp.x - cam.x) > 700 || Math.abs(lamp.y - cam.y) > 420) continue;
        const g = context.createRadialGradient(lamp.x, lamp.y - 16, 2, lamp.x, lamp.y - 16, 70);
        g.addColorStop(0, `rgba(255,214,110,${glow})`);
        g.addColorStop(1, 'rgba(255,214,110,0)');
        context.fillStyle = g;
        context.beginPath();
        context.arc(lamp.x, lamp.y - 16, 70, 0, TAU);
        context.fill();
      }
      for (const car of state.cars) {
        if (Math.abs(car.x - cam.x) > 760 || Math.abs(car.y - cam.y) > 480) continue;
        const fx = car.x + Math.cos(car.angle) * car.len * 0.5;
        const fy = car.y + Math.sin(car.angle) * car.len * 0.5;
        const g = context.createRadialGradient(fx, fy, 2, fx, fy, 90);
        g.addColorStop(0, `rgba(255,244,180,${glow * 0.8})`);
        g.addColorStop(1, 'rgba(255,244,180,0)');
        context.fillStyle = g;
        context.beginPath();
        context.arc(fx, fy, 90, 0, TAU);
        context.fill();
      }
    }
    context.restore();
  }

  // ---- HUD ----
  function drawBar(x, y, w, h, frac, color, bg) {
    context.fillStyle = bg;
    context.fillRect(x, y, w, h);
    context.fillStyle = color;
    context.fillRect(x, y, w * clamp(frac, 0, 1), h);
    context.strokeStyle = 'rgba(0,0,0,0.5)';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawMinimap(state) {
    const size = 190;
    const rangePx = 1500;
    const scale = size / rangePx;
    const p = state.player;
    mapCtx.setTransform(1, 0, 0, 1, 0, 0);
    mapCtx.fillStyle = '#31424e';
    mapCtx.fillRect(0, 0, size, size);
    const ox = size / 2 - p.x * scale;
    const oy = size / 2 - p.y * scale;
    // Water and sand.
    mapCtx.fillStyle = '#2b6cb0';
    mapCtx.fillRect(3110 * scale + ox, 0, size, size);
    mapCtx.fillStyle = '#d9c48a';
    mapCtx.fillRect(2950 * scale + ox, 0, 160 * scale, size);
    // Park.
    mapCtx.fillStyle = '#3f7a3e';
    const park = state.city.park;
    mapCtx.fillRect(park.x0 * scale + ox, park.y0 * scale + oy, (park.x1 - park.x0) * scale, (park.y1 - park.y0) * scale);
    // Roads.
    mapCtx.strokeStyle = '#8a939c';
    mapCtx.lineWidth = 90 * scale;
    for (const s of [350, 750, 1150, 1550, 1950, 2350, 2750]) {
      mapCtx.beginPath();
      mapCtx.moveTo(s * scale + ox, 0);
      mapCtx.lineTo(s * scale + ox, size);
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(0, s * scale + oy);
      mapCtx.lineTo(size, s * scale + oy);
      mapCtx.stroke();
    }
    // Buildings.
    mapCtx.fillStyle = '#3a444e';
    for (const b of state.city.buildings) {
      mapCtx.fillRect(b.x * scale + ox, b.y * scale + oy, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    }
    // Place markers.
    mapCtx.font = 'bold 9px ' + FONT;
    mapCtx.textAlign = 'center';
    for (const key of Object.keys(PLACES)) {
      const place = PLACES[key];
      mapCtx.fillStyle = '#eef1f5';
      mapCtx.beginPath();
      mapCtx.arc(place.x * scale + ox, place.y * scale + oy, 4, 0, TAU);
      mapCtx.fill();
      mapCtx.fillStyle = '#111';
      mapCtx.fillText(place.icon, place.x * scale + ox, place.y * scale + oy + 3);
    }
    // Objective.
    if (state.objective && state.objective.x) {
      const ox2 = state.objective.x * scale + ox;
      const oy2 = state.objective.y * scale + oy;
      mapCtx.fillStyle = '#f2c94c';
      mapCtx.save();
      mapCtx.translate(ox2, oy2);
      mapCtx.rotate(Math.PI / 4);
      mapCtx.fillRect(-5, -5, 10, 10);
      mapCtx.restore();
    }
    // Cops and enemies.
    for (const cop of state.cops) {
      mapCtx.fillStyle = Math.floor(state.elapsed * 4) % 2 === 0 ? '#3d7bfd' : '#ff2d55';
      mapCtx.beginPath();
      mapCtx.arc(cop.x * scale + ox, cop.y * scale + oy, 4, 0, TAU);
      mapCtx.fill();
    }
    for (const e of state.enemies) {
      mapCtx.fillStyle = '#e5534b';
      mapCtx.beginPath();
      mapCtx.arc(e.x * scale + ox, e.y * scale + oy, 3.5, 0, TAU);
      mapCtx.fill();
    }
    // Taxi fare.
    if (state.taxi.fare) {
      const f = state.taxi.fare;
      const fx = (f.state === 'wait' ? f.x : f.dx) * scale + ox;
      const fy = (f.state === 'wait' ? f.y : f.dy) * scale + oy;
      mapCtx.fillStyle = '#f2c94c';
      mapCtx.beginPath();
      mapCtx.arc(fx, fy, 4, 0, TAU);
      mapCtx.fill();
    }
    // Player arrow.
    mapCtx.save();
    mapCtx.translate(size / 2, size / 2);
    mapCtx.rotate(state.player.angle);
    mapCtx.fillStyle = '#fff';
    mapCtx.beginPath();
    mapCtx.moveTo(9, 0);
    mapCtx.lineTo(-6, -6);
    mapCtx.lineTo(-6, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    // Frame.
    context.save();
    context.translate(VIEW.width - size - 16, 44);
    context.drawImage(mapCanvas, 0, 0);
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 2;
    context.strokeRect(0, 0, size, size);
    context.restore();
  }

  function drawHud(state, extras) {
    const p = state.player;
    // Health and armour.
    drawBar(20, 20, 220, 16, state.hp / 100, state.hp > 30 ? '#2ecc71' : '#e5534b', 'rgba(0,0,0,0.55)');
    drawBar(20, 42, 220, 10, state.armor / 100, '#4fc3f7', 'rgba(0,0,0,0.55)');
    text(`$${state.cash.toLocaleString('en-US')}`, 20, 78, 26, '#f2c94c', 'left', 'bold');
    // Wanted stars over the minimap.
    const stars = state.wanted.stars;
    let starText = '';
    for (let i = 0; i < 5; i += 1) starText += i < stars ? '★' : '☆';
    text(starText, VIEW.width - 216, 36, 30, stars > 0 ? '#ffd60a' : 'rgba(255,255,255,0.35)', 'left', 'bold');
    drawMinimap(state);
    // Clock and district under the minimap.
    const hh = Math.floor(state.time / 60) % 24;
    const mm = Math.floor(state.time % 60);
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    text(clock, VIEW.width - 111, 260, 20, '#f2f4f6', 'center', 'bold');
    if (stars > 0 && state.wanted.hidden) {
      text('HIDDEN', VIEW.width - 111, 284, 16, '#2ecc71', 'center', 'bold');
    }
    // Objective banner.
    if (state.objective && state.objective.text) {
      context.font = `bold 20px ${FONT}`;
      const bw = context.measureText(state.objective.text).width + 36;
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect((VIEW.width - bw) / 2, 14, bw, 34);
      text(state.objective.text, VIEW.width / 2, 38, 20, '#f2c94c', 'center', 'bold');
    }
    // Weapon and speed.
    const w = WEAPONS[state.weapon];
    const ammoText = state.weapon === 'fists' ? '' : `  ${state.ammo[state.weapon].mag} / ${state.ammo[state.weapon].reserve}`;
    text(w.name + ammoText, VIEW.width - 24, VIEW.height - 24, 22, '#f2f4f6', 'right', 'bold');
    if (p.car) {
      const mph = Math.round(Math.abs(p.car.speed) * 0.12);
      text(`${mph} mph`, VIEW.width - 24, VIEW.height - 54, 26, '#f2f4f6', 'right', 'bold');
    }
    // Taxi status.
    if (state.taxi.on) {
      text('TAXI: ON', 20, VIEW.height - 24, 18, '#f2c94c', 'left', 'bold');
    }
    // Toasts.
    let ty = VIEW.height - 60;
    for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
      const toast = state.toasts[i];
      context.globalAlpha = clamp(toast.t, 0, 1);
      text(toast.text, 20, ty, 18, '#fff', 'left', 'bold');
      ty -= 24;
    }
    context.globalAlpha = 1;
    // Crosshair when armed on foot.
    if (p.onFoot && state.weapon !== 'fists' && extras.mouse) {
      const mx = extras.mouse.x;
      const my = extras.mouse.y;
      context.strokeStyle = 'rgba(255,255,255,0.9)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(mx, my, 10, 0, TAU);
      context.stroke();
      context.beginPath();
      context.moveTo(mx - 14, my);
      context.lineTo(mx - 6, my);
      context.moveTo(mx + 6, my);
      context.lineTo(mx + 14, my);
      context.moveTo(mx, my - 14);
      context.lineTo(mx, my - 6);
      context.moveTo(mx, my + 6);
      context.lineTo(mx, my + 14);
      context.stroke();
    }
    // Context prompts.
    if (extras.prompt) {
      context.font = `18px ${FONT}`;
      const pw2 = context.measureText(extras.prompt).width + 30;
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect((VIEW.width - pw2) / 2, VIEW.height - 96, pw2, 30);
      text(extras.prompt, VIEW.width / 2, VIEW.height - 75, 18, '#fff', 'center');
    }
    // Dialogue box.
    if (state.dialog) {
      const lines = state.dialog.lines;
      const current = lines[state.dialog.idx];
      const boxW = 880;
      const boxX = (VIEW.width - boxW) / 2;
      const wrapped = wrapText(current.text, boxW - 60, 20);
      const boxH = 64 + wrapped.length * 26;
      const boxY = VIEW.height - boxH - 24;
      context.fillStyle = 'rgba(10,14,20,0.88)';
      context.fillRect(boxX, boxY, boxW, boxH);
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 2;
      context.strokeRect(boxX, boxY, boxW, boxH);
      text(current.who.toUpperCase(), boxX + 30, boxY + 30, 18, '#f2c94c', 'left', 'bold');
      for (let i = 0; i < wrapped.length; i += 1) {
        text(wrapped[i], boxX + 30, boxY + 58 + i * 26, 20, '#f2f4f6', 'left');
      }
      const blink = Math.floor(state.elapsed * 2) % 2 === 0;
      if (blink) text('ENTER ▸', boxX + boxW - 30, boxY + boxH - 16, 16, '#f2c94c', 'right', 'bold');
    }
    // Mission banner (big centre text, set by main).
    if (extras.banner) {
      context.globalAlpha = clamp(extras.bannerT, 0, 1);
      text(extras.banner, VIEW.width / 2, 200, 54, '#f2c94c', 'center', 'bold');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(10,14,20,0.92)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || '#f2c94c';
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 64, 44, '#f2f4f6', 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 108 + i * 32, 20, '#9aa3ad', 'center');
    }
    if (prompt) text(prompt, VIEW.width / 2, y + height - 28, 20, '#f2c94c', 'center', 'bold');
  }

  function drawTitle(state, extras) {
    // The city keeps living behind the menu.
    drawWorld(state);
    context.fillStyle = 'rgba(6,10,20,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const grad = context.createLinearGradient(0, 150, 0, 300);
    grad.addColorStop(0, '#ffd60a');
    grad.addColorStop(0.55, '#ff7b3d');
    grad.addColorStop(1, '#ff2d78');
    context.font = `bold 130px ${FONT}`;
    context.textAlign = 'center';
    context.fillStyle = grad;
    context.fillText('SOLMAR', VIEW.width / 2, 250);
    context.strokeStyle = 'rgba(0,0,0,0.6)';
    context.lineWidth = 2;
    context.strokeText('SOLMAR', VIEW.width / 2, 250);
    text('AN OPEN-WORLD CRIME STORY', VIEW.width / 2, 292, 26, '#f2f4f6', 'center', 'bold');
    text('Six missions. One city. No rules but yours.', VIEW.width / 2, 324, 18, '#c8cfd6', 'center');
    const items = extras.hasSave
      ? ['Continue', 'New Game', 'How to Play', extras.muted ? 'Sound: Off' : 'Sound: On']
      : ['New Game', 'How to Play', extras.muted ? 'Sound: Off' : 'Sound: On'];
    const startY = 400;
    for (let i = 0; i < items.length; i += 1) {
      const selected = i === extras.menuIndex;
      text((selected ? '▸ ' : '  ') + items[i], VIEW.width / 2, startY + i * 44, 26, selected ? '#f2c94c' : '#f2f4f6', 'center', selected ? 'bold' : '');
    }
    text('WASD move · E enter a car · Mouse aim, click to shoot · M mute', VIEW.width / 2, VIEW.height - 64, 16, '#9aa3ad', 'center');
    text('A fan-made game. Not affiliated with Rockstar Games.', VIEW.width / 2, VIEW.height - 38, 14, '#7c8590', 'center');
  }

  function drawHelp(state) {
    drawWorld(state);
    context.fillStyle = 'rgba(6,10,20,0.72)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('HOW TO PLAY', VIEW.width / 2, 110, 48, '#f2c94c', 'center', 'bold');
    const lines = [
      'You are Leo Costa, a wheelman back in Solmar with debts to pay.',
      'Do Rosa’s six missions to take the city — or just cause chaos.',
      '',
      'W A S D / Arrows — move on foot, drive the car      Shift — run',
      'Mouse — aim      Click — shoot      E — enter / exit a car',
      'Space — handbrake      1 / 2 / 3 — weapons      R — reload',
      'T — taxi jobs on / off (in a car)      M — mute      P / Esc — pause',
      '',
      'Earn cash from missions, taxi fares and hidden packages ($150 each).',
      'Spend it at Ironworks Arms (weapons), Spray ’n Go (repair, lose the cops)',
      'and save at the Safehouse. The cops come in stars: stay hidden to lose them.',
      'Get busted or wasted and you wake up at the station or the hospital.',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, 170 + i * 30, 19, '#e8ecf0', 'center');
    }
    text('Press Esc or Enter to go back', VIEW.width / 2, VIEW.height - 60, 20, '#f2c94c', 'center', 'bold');
  }

  function drawShop(state, extras) {
    drawWorld(state);
    context.fillStyle = 'rgba(6,10,20,0.7)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const items = extras.shopItems || [];
    const width = 620;
    const height = 170 + items.length * 38;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(10,14,20,0.95)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = '#f2c94c';
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(extras.shopTitle || 'Shop', VIEW.width / 2, y + 56, 36, '#f2c94c', 'center', 'bold');
    text(`Cash: $${state.cash.toLocaleString('en-US')}`, VIEW.width / 2, y + 90, 20, '#f2f4f6', 'center');
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const iy = y + 128 + i * 38;
      const afford = state.cash >= item.price;
      text(`${i + 1}. ${item.name}`, x + 40, iy, 20, afford ? '#f2f4f6' : '#7c8590', 'left', i === extras.menuIndex ? 'bold' : '');
      text(item.desc || '', x + 300, iy, 16, '#9aa3ad', 'left');
      text(item.price === 0 ? 'FREE' : `$${item.price}`, x + width - 40, iy, 20, afford ? '#f2c94c' : '#7c8590', 'right', 'bold');
    }
    text('Press 1–' + items.length + ' to buy · Esc to leave', VIEW.width / 2, y + height - 24, 18, '#9aa3ad', 'center');
  }

  function draw(state, screen, extras) {
    extras = extras || {};
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, extras);
      return;
    }
    if (screen === SCREEN_HELP) {
      drawHelp(state);
      return;
    }
    drawWorld(state);
    if (screen === SCREEN_SHOP) {
      drawShop(state, extras);
      return;
    }
    drawHud(state, extras);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(6,10,20,0.6)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('PAUSED', ['The city waits for no one. Except now.'], extras.pausedPrompt || 'P / Esc to resume · H help');
    } else if (screen === SCREEN_BUSTED) {
      context.fillStyle = 'rgba(10,20,60,0.72)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      text('BUSTED', VIEW.width / 2, VIEW.height / 2 - 20, 90, '#7db4ff', 'center', 'bold');
      text('The Solmar PD caught you. You lose some cash.', VIEW.width / 2, VIEW.height / 2 + 40, 22, '#dbe7ff', 'center');
      text('Press Enter to continue', VIEW.width / 2, VIEW.height / 2 + 90, 20, '#f2c94c', 'center');
    } else if (screen === SCREEN_WASTED) {
      context.fillStyle = 'rgba(60,8,8,0.72)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      text('WASTED', VIEW.width / 2, VIEW.height / 2 - 20, 90, '#ff6b5e', 'center', 'bold');
      text('You didn’t make it. The hospital patches you up — for a fee.', VIEW.width / 2, VIEW.height / 2 + 40, 22, '#ffd9d4', 'center');
      text('Press Enter to continue', VIEW.width / 2, VIEW.height / 2 + 90, 20, '#f2c94c', 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
