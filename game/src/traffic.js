// SOLMARA — Streets of the Sun. Traffic cars, pedestrians and parked cars.
// Traffic drives the road grid in lanes; pedestrians walk the sidewalks and
// flee from gunfire. Parked cars are generated ONCE at world init and are
// never re-rolled by a restart.
import { CONFIG, ROAD_LINES, clamp } from './config.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c85a', '#7fae9c', '#e8e4da', '#5a4a8a', '#c96f4a', '#4a4a52'];
const PED_COLORS = ['#e8b88a', '#8a5a3c', '#d9a441', '#7fae9c', '#b5533c', '#4f7d8a', '#e0cfa8', '#5a4a8a'];
const PED_SHIRTS = ['#d94f3d', '#3d7dd9', '#e8c85a', '#5da24a', '#e8e4da', '#8a6f9e', '#c96f4a', '#2e2b29'];

function lanePos(angle, roadLine) {
  // Right-hand traffic: heading east -> south lane, south -> west lane, etc.
  const L = CONFIG.LANE;
  if (angle === 0) return { x: null, y: roadLine + L };
  if (angle === Math.PI) return { x: null, y: roadLine - L };
  if (angle === Math.PI / 2) return { x: roadLine - L, y: null };
  return { x: roadLine + L, y: null }; // -PI/2, heading north
}

export class Traffic {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cars = []; // moving traffic
    this.peds = []; // pedestrians
    this.parked = []; // parked cars (generated once)
  }

  spawnInitial() {
    const rng = this.rng;
    // Moving traffic.
    for (let i = 0; i < 26; i++) {
      const horizontal = rng.chance(0.5);
      const line = rng.pick(ROAD_LINES);
      const angle = horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      const along = rng.range(80, CONFIG.WORLD - 80);
      const lane = lanePos(angle, line);
      const car = {
        x: horizontal ? along : lane.x,
        y: horizontal ? lane.y : along,
        angle,
        speed: rng.range(55, 105),
        targetSpeed: rng.range(55, 105),
        color: rng.pick(CAR_COLORS),
        kind: rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'truck']),
        len: 44,
        wid: 22,
        owner: 'traffic',
        driver: null,
      };
      if (car.kind === 'truck') {
        car.len = 58;
      }
      if (car.kind === 'taxi') car.color = '#e8c85a';
      this.cars.push(car);
    }
    // Parked cars along road edges, plus two right outside Rosa's Garage
    // so the player can always get moving for mission 1.
    for (let i = 0; i < 22; i++) {
      const horizontal = rng.chance(0.5);
      const line = rng.pick(ROAD_LINES);
      const along = rng.range(120, CONFIG.WORLD - 120);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = CONFIG.ROAD / 2 + 16;
      const px = horizontal ? along : line + side * off;
      const py = horizontal ? line + side * off : along;
      // Never park a car inside (or pressed against) a building: the player
      // must always be able to drive away in a car they just entered.
      if (this.city.isBlocked(px, py, 26)) continue;
      this.parked.push({
        x: px,
        y: py,
        angle: horizontal ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2,
        speed: 0,
        color: rng.pick(CAR_COLORS),
        kind: 'sedan',
        len: 44,
        wid: 22,
        owner: 'parked',
        driver: null,
        health: 100,
      });
    }
    // Two cars in the garage forecourt, clear of the garage building, so the
    // player can always get moving for mission 1.
    this.parked.push(
      { x: 370, y: 330, angle: 0, speed: 0, color: '#d94f3d', kind: 'sedan', len: 44, wid: 22, owner: 'parked', driver: null, health: 100 },
      { x: 370, y: 370, angle: 0, speed: 0, color: '#3d7dd9', kind: 'sedan', len: 44, wid: 22, owner: 'parked', driver: null, health: 100 },
    );
    // Pedestrians on sidewalks.
    for (let i = 0; i < 42; i++) {
      this.peds.push(this._newPed(rng));
    }
  }

  _newPed(rng) {
    const horizontal = rng.chance(0.5);
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(80, CONFIG.WORLD - 80);
    const side = rng.chance(0.5) ? 1 : -1;
    const off = CONFIG.ROAD / 2 + 14;
    return {
      x: horizontal ? along : line + side * off,
      y: horizontal ? line + side * off : along,
      angle: horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2,
      speed: rng.range(24, 46),
      skin: rng.pick(PED_COLORS),
      shirt: rng.pick(PED_SHIRTS),
      state: 'walk',
      panicT: 0,
      fleeX: 0,
      fleeY: 0,
      hp: 40,
      armed: false,
    };
  }

  // Pedestrians within r of (x,y) run away from it.
  scare(x, y, r) {
    for (const p of this.peds) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d = Math.hypot(dx, dy);
      if (d < r && d > 1) {
        p.state = 'flee';
        p.panicT = 3;
        p.fleeX = dx / d;
        p.fleeY = dy / d;
      }
    }
  }

  nearestCar(x, y, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const c of this.parked) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  nearestPed(x, y, maxDist, armedOnly = false) {
    let best = null;
    let bd = maxDist;
    for (const p of this.peds) {
      if (armedOnly && !p.armed) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  update(dt, world) {
    const rng = this.rng;
    const halfRoad = CONFIG.ROAD / 2;
    // --- Traffic cars: follow lanes, turn at intersections, queue behind. ---
    for (const c of this.cars) {
      // Slow down if a car is ahead in the same lane.
      let blocked = false;
      for (const o of this.cars) {
        if (o === c) continue;
        const dx = o.x - c.x;
        const dy = o.y - c.y;
        const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
        const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
        if (ahead > 0 && ahead < 70 && side < 20) {
          blocked = true;
          break;
        }
      }
      const want = blocked ? 0 : c.targetSpeed;
      c.speed += clamp(want - c.speed, -160 * dt, 120 * dt);
      const step = c.speed * dt;
      let nx = c.x + Math.cos(c.angle) * step;
      let ny = c.y + Math.sin(c.angle) * step;
      // At an intersection centre, maybe turn (never a U-turn).
      const nearX = this.city.nearestRoadLine(nx);
      const nearY = this.city.nearestRoadLine(ny);
      if (Math.abs(nx - nearX) < 18 && Math.abs(ny - nearY) < 18) {
        if (rng.chance(0.32)) {
          const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((a) => Math.abs(a - c.angle) > 0.1 && Math.abs(Math.abs(a - c.angle) - Math.PI) > 0.1);
          const na = rng.pick(options);
          const lane = lanePos(na, na === 0 || na === Math.PI ? nearY : nearX);
          c.angle = na;
          if (na === 0 || na === Math.PI) {
            ny = lane.y;
            nx = nearX;
          } else {
            nx = lane.x;
            ny = nearY;
          }
        } else {
          // Drive straight through: snap onto the lane.
          const lane = lanePos(c.angle, c.angle === 0 || c.angle === Math.PI ? nearY : nearX);
          if (c.angle === 0 || c.angle === Math.PI) ny = lane.y;
          else nx = lane.x;
        }
      }
      // Wrap around the city edges (traffic loops forever).
      if (nx < -60) nx = CONFIG.WORLD + 60;
      if (nx > CONFIG.WORLD + 60) nx = -60;
      if (ny < -60) ny = CONFIG.WORLD + 60;
      if (ny > CONFIG.WORLD + 60) ny = -60;
      c.x = nx;
      c.y = ny;
    }
    // --- Pedestrians: stroll the sidewalks, flee when scared. ---
    for (const p of this.peds) {
      if (p.state === 'flee') {
        p.panicT -= dt;
        if (p.panicT <= 0) p.state = 'walk';
        const sp = 130;
        let nx = p.x + p.fleeX * sp * dt;
        let ny = p.y + p.fleeY * sp * dt;
        if (this.city.isBlocked(nx, ny, 10)) {
          // Bounce off walls by picking a new flee direction.
          const a = rng.range(0, Math.PI * 2);
          p.fleeX = Math.cos(a);
          p.fleeY = Math.sin(a);
          nx = p.x;
          ny = p.y;
        }
        p.x = clamp(nx, 30, CONFIG.WORLD - 30);
        p.y = clamp(ny, 30, CONFIG.WORLD - 30);
        p.angle = Math.atan2(p.fleeY, p.fleeX);
        continue;
      }
      const step = p.speed * dt;
      let nx = p.x + Math.cos(p.angle) * step;
      let ny = p.y + Math.sin(p.angle) * step;
      const nearX = this.city.nearestRoadLine(nx);
      const nearY = this.city.nearestRoadLine(ny);
      if (Math.abs(nx - nearX) < 14 && Math.abs(ny - nearY) < 14 && rng.chance(0.25)) {
        const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((a) => Math.abs(a - p.angle) > 0.1 && Math.abs(Math.abs(a - p.angle) - Math.PI) > 0.1);
        const na = rng.pick(options);
        p.angle = na;
        const off = CONFIG.ROAD / 2 + 14;
        if (na === 0) {
          ny = nearY + off;
          nx = nearX;
        } else if (na === Math.PI) {
          ny = nearY - off;
          nx = nearX;
        } else if (na === Math.PI / 2) {
          nx = nearX - off;
          ny = nearY;
        } else {
          nx = nearX + off;
          ny = nearY;
        }
      }
      if (this.city.isBlocked(nx, ny, 10)) {
        // Turn around rather than walk through a building.
        p.angle += Math.PI;
        continue;
      }
      if (nx < 30 || nx > CONFIG.WORLD - 30 || ny < 30 || ny > CONFIG.WORLD - 30) {
        p.angle += Math.PI;
        continue;
      }
      p.x = nx;
      p.y = ny;
    }
  }
}
