// SOLMARA — Streets of the Sun. The city of Solmara: an 8x8 road grid over a
// 3600x3600 island, with a park, a garage, a bank, a hotel, docks to the east
// and a beach to the south. All layout is generated once from a seed.
import { CONFIG, ROAD_LINES } from './config.js';

const ROOFS = CONFIG.COLORS.buildingRoofs;

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w + pad && a.x + a.w + pad > b.x - pad && a.y - pad < b.y + b.h + pad && a.y + a.h + pad > b.y - pad;
}

export function buildCity(rng) {
  const halfRoad = CONFIG.ROAD / 2;
  const buildings = [];
  const trees = [];
  const containers = [];
  const palms = [];

  const special = new Set(['0,0', '3,3', '4,2', '3,1']);

  // Ordinary blocks: 1-3 buildings each, placed in block quadrants.
  for (let gx = 0; gx < 7; gx++) {
    for (let gy = 0; gy < 7; gy++) {
      if (special.has(gx + ',' + gy)) continue;
      const bx0 = gx * CONFIG.PITCH + halfRoad + 16;
      const by0 = gy * CONFIG.PITCH + halfRoad + 16;
      const bw = CONFIG.PITCH - CONFIG.ROAD - 32;
      const bh = CONFIG.PITCH - CONFIG.ROAD - 32;
      const quads = [
        { x: bx0, y: by0, w: bw / 2 - 8, h: bh / 2 - 8 },
        { x: bx0 + bw / 2 + 8, y: by0, w: bw / 2 - 8, h: bh / 2 - 8 },
        { x: bx0, y: by0 + bh / 2 + 8, w: bw / 2 - 8, h: bh / 2 - 8 },
        { x: bx0 + bw / 2 + 8, y: by0 + bh / 2 + 8, w: bw / 2 - 8, h: bh / 2 - 8 },
      ];
      // Shuffle quadrants so building placement varies.
      for (let i = quads.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const t = quads[i];
        quads[i] = quads[j];
        quads[j] = t;
      }
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const q = quads[i];
        const w = q.w * rng.range(0.62, 0.95);
        const h = q.h * rng.range(0.62, 0.95);
        buildings.push({
          x: q.x + (q.w - w) / 2,
          y: q.y + (q.h - h) / 2,
          w,
          h,
          roof: rng.pick(ROOFS),
          windows: rng.int(2, 5),
        });
      }
      // A couple of street trees per block corner.
      if (rng.chance(0.7)) {
        trees.push({ x: bx0 + rng.range(0, bw), y: by0 - 8, r: rng.range(9, 14) });
      }
    }
  }

  // Landmark buildings.
  const garage = { x: CONFIG.GARAGE.x - 110, y: CONFIG.GARAGE.y - 70, w: 220, h: 140, roof: CONFIG.COLORS.garage, landmark: 'garage', windows: 3 };
  const bank = { x: CONFIG.BANK.x - 120, y: CONFIG.BANK.y - 85, w: 240, h: 170, roof: CONFIG.COLORS.bank, landmark: 'bank', windows: 4 };
  const hotel = { x: CONFIG.HOTEL.x - 85, y: CONFIG.HOTEL.y - 120, w: 170, h: 240, roof: CONFIG.COLORS.hotel, landmark: 'hotel', windows: 6 };
  buildings.push(garage, bank, hotel);

  // The park (block 3,3): trees, a pond and a lawn. No buildings.
  const park = { x: 3 * CONFIG.PITCH + halfRoad, y: 3 * CONFIG.PITCH + halfRoad, w: CONFIG.PITCH - CONFIG.ROAD, h: CONFIG.PITCH - CONFIG.ROAD };
  for (let i = 0; i < 42; i++) {
    trees.push({
      x: park.x + rng.range(15, park.w - 15),
      y: park.y + rng.range(15, park.h - 15),
      r: rng.range(9, 16),
    });
  }
  const pond = { x: park.x + park.w * 0.58, y: park.y + park.h * 0.6, rx: 62, ry: 42 };

  // The docks (east strip): piers into the water, stacked containers.
  const dockWater = { x: 3360, y: 0, w: 240, h: CONFIG.WORLD };
  const piers = [
    { x: 3205, y: 380, w: 260, h: 70 },
    { x: 3205, y: 1380, w: 260, h: 70 },
    { x: 3205, y: 2380, w: 260, h: 70 },
  ];
  const containerColors = ['#c96f4a', '#4f7d8a', '#d9a441', '#7fae9c', '#b5533c'];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (rng.chance(0.25)) continue;
      containers.push({
        x: 3225 + col * 52,
        y: 620 + row * 190 + rng.range(-8, 8),
        w: 46,
        h: 26,
        color: rng.pick(containerColors),
      });
    }
  }

  // The beach (south strip): sand, palms, a lifeguard hut.
  const beachWater = { x: 0, y: 3480, w: CONFIG.WORLD, h: 120 };
  for (let i = 0; i < 14; i++) {
    palms.push({ x: 120 + i * 250 + rng.range(-40, 40), y: 3260 + rng.range(-20, 60), r: 13 });
  }
  const hut = { x: 1750, y: 3300, w: 70, h: 50, roof: '#e0cfa8', landmark: 'hut', windows: 1 };
  buildings.push(hut);

  const city = {
    buildings,
    trees,
    containers,
    palms,
    park,
    pond,
    piers,
    dockWater,
    beachWater,
    garage,
    bank,
    hotel,
  };

  city.isWater = (x, y) => {
    if (x >= dockWater.x && x <= dockWater.x + dockWater.w) return true;
    if (y >= beachWater.y && y <= beachWater.y + beachWater.h) return true;
    return false;
  };

  city.isBlocked = (x, y, r) => {
    if (x < 20 + r || y < 20 + r || x > CONFIG.WORLD - 20 - r || y > CONFIG.WORLD - 20 - r) return true;
    if (city.isWater(x, y)) return true;
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    for (const c of containers) {
      if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return true;
    }
    return false;
  };

  // Move (x,y) out of a building rect by the smallest push, or null.
  city.resolveBlocked = (x, y, r) => {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
        const pushL = x + r - b.x;
        const pushR = b.x + b.w - (x - r);
        const pushT = y + r - b.y;
        const pushB = b.y + b.h - (y - r);
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) return { x: b.x - r, y };
        if (m === pushR) return { x: b.x + b.w + r, y };
        if (m === pushT) return { x, y: b.y - r };
        return { x, y: b.y + b.h + r };
      }
    }
    return null;
  };

  city.onRoad = (x, y) => {
    for (const line of ROAD_LINES) {
      if (Math.abs(x - line) <= halfRoad || Math.abs(y - line) <= halfRoad) return true;
    }
    return false;
  };

  city.nearestRoadLine = (v) => {
    let best = ROAD_LINES[0];
    let bd = Infinity;
    for (const line of ROAD_LINES) {
      const d = Math.abs(v - line);
      if (d < bd) {
        bd = d;
        best = line;
      }
    }
    return best;
  };

  city.inPark = (x, y) => x >= park.x && x <= park.x + park.w && y >= park.y && y <= park.y + park.h;
  city.inDocks = (x) => x > CONFIG.DOCKS_X;
  city.inBeach = (y) => y > CONFIG.BEACH_Y;

  return city;
}

// A point is inside a rect (with optional padding).
export function pointInRect(x, y, r, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}
export { rectsOverlap };
