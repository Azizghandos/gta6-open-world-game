// SOLMAR — tuning for an open-world crime game in the spirit of GTA 6.
// One place for every number, colour and name. The city is a fixed 3200x3200
// grid; the renderer shows a 1280x720 window of it through a camera that
// follows the player. All names, story, art and sound are original.

// Logical view the renderer scales to the browser window.
export const VIEW = { width: 1280, height: 720 };

// The city, in world pixels. Streets run on a grid; blocks sit between them.
export const WORLD = { size: 3200, roadHalf: 45, sidewalk: 16 };
export const STREETS = [350, 750, 1150, 1550, 1950, 2350, 2750];

// Fixed simulation step: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

// One in-game hour lasts this many real seconds; the clock drives day/night.
export const HOUR_SECONDS = 45;

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  runSpeed: 265,
  accel: 1500,
  friction: 8,
  maxHp: 100,
  maxArmor: 100,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 170,
  turnRate: 2.5,
  grip: 6.5,
  radius: 17,
  maxHp: 100,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.45, range: 34, spread: 0, auto: false, ammo: Infinity },
  pistol: { name: 'P9 Pistol', damage: 26, rate: 0.34, range: 460, spread: 0.035, auto: false, ammo: 120 },
  smg: { name: 'VK-9 SMG', damage: 17, rate: 0.085, range: 420, spread: 0.09, auto: true, ammo: 240 },
};

export const BULLET_SPEED = 950;

// Wanted heat (0-1000) maps to stars at these thresholds.
export const WANTED_STARS = [0, 80, 220, 400, 620, 850];
export const HEAT = {
  stealCar: 70,
  stealSeen: 130,
  hitPed: 45,
  killPed: 160,
  killCop: 220,
  shoot: 22,
  decayPerSec: 7,
  decayHiddenBonus: 14,
};

// Cash.
export const PRICES = {
  pistol: 400,
  pistolAmmo: 60,
  smg: 1200,
  smgAmmo: 150,
  armor: 250,
  spray: 150,
  package: 150,
  hospitalCut: 0.1,
};

export const SAVE_KEY = 'solmar.save.v1';

export const PALETTE = {
  grass: '#4d8a4a',
  grassDark: '#3f7a3e',
  parkGrass: '#57a04e',
  sand: '#d9c48a',
  water: '#2b6cb0',
  waterDeep: '#1e4f8a',
  road: '#33373d',
  roadLine: '#c8b45a',
  sidewalk: '#8d8f92',
  curb: '#6e7073',
  buildingRoof: '#7a6f66',
  downtownRoof: '#5d6b7a',
  houseRoof: '#a8574a',
  warehouseRoof: '#6b7a6b',
  text: '#f2f4f6',
  muted: '#9aa3ad',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
  police: '#3d7bfd',
};

export const DISTRICTS = [
  { name: 'Downtown Solmar', x: 1150, y: 750, w: 1200, h: 1200 },
  { name: 'Old Town', x: 350, y: 350, w: 800, h: 800 },
  { name: 'Marina Beach', x: 2750, y: 350, w: 450, h: 2400 },
  { name: 'The Docks', x: 350, y: 2350, w: 800, h: 800 },
  { name: 'Palm Heights', x: 1150, y: 2350, w: 1200, h: 800 },
];

// Fixed places the player can use, on the road grid (world coordinates).
export const PLACES = {
  safehouse: { name: 'Safehouse', x: 350, y: 350, icon: 'H' },
  hospital: { name: 'Solmar General', x: 2350, y: 350, icon: '+' },
  policeHq: { name: 'Police HQ', x: 2350, y: 2350, icon: 'P' },
  gunShop: { name: "Ironworks Arms", x: 1550, y: 750, icon: 'G' },
  sprayShop: { name: "Spray 'n Go", x: 750, y: 1950, icon: 'S' },
  diner: { name: "Rosa's Diner", x: 750, y: 1150, icon: 'D' },
  bank: { name: 'Solmar National Bank', x: 1550, y: 1150, icon: '$' },
  docks: { name: 'The Docks', x: 350, y: 2750, icon: 'A' },
  chopShop: { name: 'Chop Shop', x: 1950, y: 2750, icon: 'C' },
  beachHotel: { name: 'Palms Hotel', x: 2750, y: 750, icon: 'B' },
  park: { name: 'Central Park', x: 1350, y: 1350, icon: 'T' },
};

export const CAR_MODELS = [
  { name: 'sedan', len: 52, wid: 26, colors: ['#c0392b', '#2e86c1', '#7d3c98', '#b7950b', '#5d6d7e', '#1abc9c'] },
  { name: 'coupe', len: 48, wid: 24, colors: ['#e74c3c', '#f39c12', '#8e44ad', '#16a085'] },
  { name: 'sports', len: 50, wid: 25, colors: ['#ff2d55', '#ffd60a', '#0a84ff', '#ff9f0a'] },
  { name: 'taxi', len: 52, wid: 26, colors: ['#f7c948'] },
  { name: 'van', len: 60, wid: 28, colors: ['#95a5a6', '#5d6d7e', '#a67c52'] },
  { name: 'truck', len: 66, wid: 30, colors: ['#7f8c8d', '#6c3483'] },
  { name: 'police', len: 54, wid: 26, colors: ['#1c2b39'] },
];

// How many traffic cars and pedestrians the city keeps alive near the player.
export const POPULATION = { traffic: 26, peds: 34, maxCops: 6 };

export const CONTROLS = [
  ['W A S D / Arrows', 'Move on foot · drive the car'],
  ['Shift', 'Run'],
  ['Mouse', 'Aim · click to shoot'],
  ['E', 'Enter / exit a car'],
  ['Space', 'Handbrake (in a car)'],
  ['1 / 2 / 3', 'Fists · Pistol · SMG'],
  ['R', 'Reload'],
  ['T', 'Taxi jobs on / off (in a car)'],
  ['M', 'Mute sound'],
  ['P / Esc', 'Pause'],
];
