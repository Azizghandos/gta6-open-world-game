// SOLMAR — every tuning number, name and colour in one place.
// The city is a fixed 3200x3200 world; the renderer follows the player with a camera, so no
// rule below depends on the screen size. All names, districts, characters and vehicles are
// original: nothing here comes from any commercial game.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city is one square, 3200 units a side, ringed by the sea on its south and west edges. */
export const CITY = { size: 3200, roadGap: 400, roadWidth: 64, firstRoad: 200 };

/** How many of each crowd the city holds. */
export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 34;
export const PACKAGE_COUNT = 10;

/** Seven districts, each a rectangle of the city with its own ground and roof palette. */
export const DISTRICTS = [
  { name: 'Marina Bay', x: 0, y: 0, w: 1100, h: 1000, ground: '#c9b183', roof: '#8a6f4d', accent: '#3e7ca8' },
  { name: 'Old Town', x: 1100, y: 0, w: 1000, h: 1000, ground: '#b7a684', roof: '#7d5a43', accent: '#a8573e' },
  { name: 'Palm Heights', x: 2100, y: 0, w: 1100, h: 1000, ground: '#c2ad7d', roof: '#96794f', accent: '#4d8a5a' },
  { name: 'Portside', x: 0, y: 1000, w: 1100, h: 1100, ground: '#a89a7e', roof: '#6e5b40', accent: '#5a7ba8' },
  { name: 'Downtown', x: 1100, y: 1000, w: 1000, h: 1100, ground: '#b0a284', roof: '#5f6b7d', accent: '#c9a227' },
  { name: 'Solmar Hills', x: 2100, y: 1000, w: 1100, h: 1100, ground: '#bfae8a', roof: '#8a7a52', accent: '#7d5a8a' },
  { name: 'South Beach', x: 0, y: 2100, w: 3200, h: 1100, ground: '#d6c08f', roof: '#a8815a', accent: '#3e9ca8' },
];

/** Nine car models. `police` marks the model the wanted system drives; it is never traffic. */
export const CAR_MODELS = [
  { name: 'Pinto', length: 52, width: 26, topSpeed: 320, accel: 210, grip: 2.6, color: '#c94f43', roof: '#e8d8c8' },
  { name: 'Civic', length: 54, width: 26, topSpeed: 350, accel: 230, grip: 2.8, color: '#4f7dc9', roof: '#dfe8f2' },
  { name: 'Sunny', length: 50, width: 24, topSpeed: 330, accel: 220, grip: 2.7, color: '#e0b13c', roof: '#f2ecd8' },
  { name: 'Van', length: 66, width: 30, topSpeed: 280, accel: 170, grip: 2.2, color: '#7d8a99', roof: '#e8e8e8' },
  { name: 'Taxi', length: 54, width: 26, topSpeed: 360, accel: 240, grip: 2.9, color: '#f2c230', roof: '#2b2b2b' },
  { name: 'Coupe', length: 56, width: 26, topSpeed: 430, accel: 300, grip: 3.4, color: '#8a3ec9', roof: '#1e1e28' },
  { name: 'Pickup', length: 62, width: 28, topSpeed: 340, accel: 210, grip: 2.5, color: '#4d8a5a', roof: '#d8e8d8' },
  { name: 'Sport', length: 58, width: 27, topSpeed: 500, accel: 360, grip: 3.8, color: '#d42a5e', roof: '#14141c' },
  { name: 'Interceptor', length: 56, width: 27, topSpeed: 470, accel: 330, grip: 3.6, color: '#222831', roof: '#e8e8e8', police: true },
];

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  health: 100,
  startCash: 50,
  stealRange: 46,
  interactRange: 70,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 46, rate: 0.32, ammo: Infinity, bulletSpeed: 0, spread: 0 },
  pistol: { name: 'Pistol', damage: 26, range: 520, rate: 0.34, ammo: 24, bulletSpeed: 920, spread: 0.03 },
  smg: { name: 'SMG', damage: 13, range: 430, rate: 0.09, ammo: 90, bulletSpeed: 980, spread: 0.09 },
};

export const WANTED = {
  max: 5,
  decaySeconds: 22,
  policePerStar: 1,
  policeHealth: 110,
  policeRamDamage: 18,
  policeRamCooldown: 1.2,
  bustDistance: 46,
  bustSeconds: 1.0,
  stealHeat: 1,
  shotHeat: 1,
  pedHitHeat: 1,
  pedKillHeat: 2,
};

export const ECONOMY = {
  taxiMin: 40,
  taxiMax: 95,
  cashPickupMin: 10,
  cashPickupMax: 26,
  packageValue: 100,
  healthPrice: 40,
  ammoPrice: 25,
  healthRestore: 35,
  ammoPack: 36,
};

/** Three shops; chunk 2 wires buying to them. */
export const SHOPS = [
  { name: 'Marina Market', x: 420, y: 820, kind: 'market' },
  { name: 'Palm Pharmacy', x: 2620, y: 420, kind: 'pharmacy' },
  { name: 'Downtown Diner', x: 1420, y: 1620, kind: 'diner' },
];

/** Six story missions: Leo Costa sends the driving jobs, Rosa Delgado the quiet ones. */
export const MISSIONS = [
  { id: 'first-wheels', title: 'First Wheels', giver: 'Leo Costa', reward: 100, kind: 'steal',
    brief: 'Leo needs wheels. Take any car on the street and make it yours.' },
  { id: 'the-pickup', title: 'The Pickup', giver: 'Rosa Delgado', reward: 150, kind: 'package',
    brief: 'A package is waiting in Marina Bay. Collect it and bring it back to Rosa.' },
  { id: 'hot-pursuit', title: 'Hot Pursuit', giver: 'Leo Costa', reward: 200, kind: 'evade',
    brief: 'The cops are on you. Shake a 2-star wanted level and live to tell it.' },
  { id: 'the-drop', title: 'The Drop', giver: 'Rosa Delgado', reward: 250, kind: 'deliver',
    brief: 'Carry the drop to Portside while the heat is on. Do not get busted.' },
  { id: 'turbulence', title: 'Turbulence', giver: 'Leo Costa', reward: 300, kind: 'smash',
    brief: 'Two Interceptors need to stop following you. Permanently.' },
  { id: 'kingpins-fall', title: "Kingpin's Fall", giver: 'Rosa Delgado', reward: 500, kind: 'reach',
    brief: "Vince Marlow hides in Solmar Hills. Reach his door and end this." },
];

export const PALETTE = {
  backdrop: '#0d1420',
  road: '#33383f',
  roadLine: '#c9b458',
  sidewalk: '#6e675c',
  sea: '#1d5f7a',
  sand: '#d6c08f',
  player: '#f2c230',
  playerOutline: '#1e1e28',
  ped: '#e8d8c8',
  police: '#222831',
  package: '#f2c230',
  pickupHealth: '#4dca6a',
  pickupAmmo: '#e0b13c',
  pickupCash: '#7ddc8a',
  panel: '#141a24',
  panelEdge: '#2c3646',
  text: '#eef1f5',
  muted: '#9aa3b2',
  star: '#f2c230',
  danger: '#e5534b',
  dayTint: 'rgba(255, 214, 140, 0.10)',
  duskTint: 'rgba(214, 110, 60, 0.16)',
  nightTint: 'rgba(8, 16, 44, 0.42)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';

/** One full day/night cycle, in seconds of play. */
export const DAY_LENGTH = 240;
