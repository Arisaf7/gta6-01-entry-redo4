// SOLMARA — Streets of the Sun. Configuration: city geometry, tuning, palette.
// Everything here is original; the city, characters and story are our own.
export const CONFIG = {
  WORLD: 3600, // city is WORLD x WORLD world units
  GRID: 8, // 8x8 grid of roads
  PITCH: 450, // distance between road centrelines
  ROAD: 110, // road width
  LANE: 28, // lane offset from a road centre (right-hand traffic)
  VIEW_W: 1280,
  VIEW_H: 720,
  // Landmarks (grid block centres: block (gx,gy) centre is (gx*450+225, gy*450+225))
  GARAGE: { x: 225, y: 225, r: 130 }, // Rosa's Garage, block (0,0)
  BANK: { x: 2025, y: 1125 }, // block (4,2)
  HOTEL: { x: 1575, y: 675 }, // block (3,1)
  PARK: { x: 1575, y: 1575 }, // block (3,3)
  DOCKS_X: 3205, // docks: everything east of here
  BEACH_Y: 3150, // beach: everything south of here
  // Player tuning
  WALK_SPEED: 205,
  RUN_SPEED: 285,
  CAR_ACCEL: 300,
  CAR_MAX_SPEED: 430,
  CAR_REVERSE_MAX: 150,
  CAR_TURN: 2.6,
  PLAYER_HEALTH: 100,
  PISTOL_AMMO_START: 12,
  PUNCH_DAMAGE: 34,
  BULLET_DAMAGE: 34,
  BULLET_SPEED: 720,
  // Police tuning
  WANTED_DECAY_SECONDS: 25,
  POLICE_CAR_SPEED: 185,
  POLICE_FOOT_SPEED: 155,
  ARREST_SECONDS: 1.5,
  // Sun-soaked palette
  COLORS: {
    ground: '#c8ab7e',
    block: '#bfa67e',
    road: '#3e3a37',
    roadEdge: '#2e2b29',
    dash: '#e8c85a',
    sidewalk: '#9a8a6d',
    park: '#5da24a',
    parkDark: '#4a8a3a',
    sand: '#ecd9a0',
    water: '#3fa7c4',
    waterDeep: '#2b7f9e',
    buildingRoofs: ['#c96f4a', '#d9a441', '#7fae9c', '#b5533c', '#e0cfa8', '#8a6f9e', '#4f7d8a', '#d97b6c'],
    garage: '#b5533c',
    bank: '#d9c27a',
    hotel: '#7fae9c',
  },
};

export const ROAD_LINES = [];
for (let i = 0; i < CONFIG.GRID; i++) ROAD_LINES.push(i * CONFIG.PITCH);

export function formatMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Smallest signed angle difference from a to b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
