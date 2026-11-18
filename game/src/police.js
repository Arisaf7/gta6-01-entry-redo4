// SOLMARA — Streets of the Sun. Wanted stars and the Solmara police.
// Police cars chase the player along the road grid; officers chase on foot
// and arrest the player if they stay close for long enough. Wanted level
// decays when the player lies low.
import { CONFIG, ROAD_LINES, clamp, angleDiff } from './config.js';

export class Police {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.wanted = 0; // 0..5 stars
    this.cars = [];
    this.officers = [];
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.busted = false;
  }

  setWanted(n) {
    this.wanted = clamp(Math.round(n), 0, 5);
    this.decayTimer = 0;
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
  }

  clear() {
    this.cars = [];
    this.officers = [];
    this.wanted = 0;
    this.busted = false;
    this.decayTimer = 0;
  }

  _spawnCarNear(px, py) {
    const rng = this.rng;
    // Pick a road point 650-900 away from the player.
    for (let tries = 0; tries < 12; tries++) {
      const horizontal = rng.chance(0.5);
      const line = rng.pick(ROAD_LINES);
      const along = rng.range(100, CONFIG.WORLD - 100);
      const x = horizontal ? along : line;
      const y = horizontal ? line : along;
      const d = Math.hypot(x - px, y - py);
      if (d > 600 && d < 950) {
        const angle = horizontal ? (x < px ? 0 : Math.PI) : y < py ? Math.PI / 2 : -Math.PI / 2;
        this.cars.push({
          x, y, angle,
          speed: 120,
          color: '#1c2733',
          kind: 'police',
          len: 46,
          wid: 22,
          owner: 'police',
          driver: null,
          health: 100,
          siren: true,
        });
        return;
      }
    }
  }

  _spawnOfficerNear(px, py) {
    const rng = this.rng;
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(320, 480);
    let x = px + Math.cos(a) * d;
    let y = py + Math.sin(a) * d;
    x = clamp(x, 40, CONFIG.WORLD - 40);
    y = clamp(y, 40, CONFIG.WORLD - 40);
    if (this.city.isBlocked(x, y, 10)) return;
    this.officers.push({ x, y, speed: CONFIG.POLICE_FOOT_SPEED, arrestT: 0, hp: 100, shirt: '#1c2733', skin: '#e8b88a' });
  }

  update(dt, world) {
    const player = world.player;
    if (this.wanted <= 0) {
      // Stand down: cars drive off, officers walk away.
      this.cars = [];
      this.officers = [];
      return;
    }
    // Wanted decay: lie low with no police close by.
    const anyNear = this.cars.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 420) ||
      this.officers.some((o) => Math.hypot(o.x - player.x, o.y - player.y) < 420);
    if (!anyNear) {
      this.decayTimer += dt;
      if (this.decayTimer > CONFIG.WANTED_DECAY_SECONDS) {
        this.decayTimer = 0;
        this.setWanted(this.wanted - 1);
      }
    } else {
      this.decayTimer = 0;
    }
    // Keep the heat proportional to the wanted level.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const wantCars = Math.min(this.wanted, 4);
      if (this.cars.length < wantCars) this._spawnCarNear(player.x, player.y);
      if (this.wanted >= 2 && this.officers.length < this.wanted - 1 && !player.car) {
        this._spawnOfficerNear(player.x, player.y);
      }
    }
    // --- Police cars: road-grid pursuit, ram the player's car. ---
    for (const c of this.cars) {
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const distP = Math.hypot(dx, dy);
      // At an intersection, pick the road that gets closer to the player.
      const nearX = this.city.nearestRoadLine(c.x);
      const nearY = this.city.nearestRoadLine(c.y);
      const atJunction = Math.abs(c.x - nearX) < 20 && Math.abs(c.y - nearY) < 20;
      if (atJunction) {
        const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter(
          (a) => Math.abs(Math.abs(angleDiff(c.angle, a)) - Math.PI) > 0.1,
        );
        let bestA = c.angle;
        let bestD = Infinity;
        for (const a of options) {
          const tx = c.x + Math.cos(a) * 200;
          const ty = c.y + Math.sin(a) * 200;
          const d = Math.hypot(player.x - tx, player.y - ty);
          if (d < bestD) {
            bestD = d;
            bestA = a;
          }
        }
        if (bestA !== c.angle) {
          c.angle = bestA;
          const lane = CONFIG.LANE;
          if (bestA === 0) {
            c.y = nearY + lane;
            c.x = nearX;
          } else if (bestA === Math.PI) {
            c.y = nearY - lane;
            c.x = nearX;
          } else if (bestA === Math.PI / 2) {
            c.x = nearX - lane;
            c.y = nearY;
          } else {
            c.x = nearX + lane;
            c.y = nearY;
          }
        }
      }
      const target = distP < 260 ? CONFIG.POLICE_CAR_SPEED : CONFIG.POLICE_CAR_SPEED * 0.85;
      c.speed += clamp(target - c.speed, -220 * dt, 200 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      // Ram: bump the player's car and hurt the player a little.
      if (player.car && distP < 46) {
        player.car.speed *= 0.86;
        if (world.time - (c.lastRam || 0) > 0.8) {
          c.lastRam = world.time;
          world.damagePlayer(6, 'rammed by a police cruiser');
        }
      }
      // Despawn if hopelessly far away.
      if (distP > 1600) {
        c.gone = true;
      }
    }
    this.cars = this.cars.filter((c) => !c.gone);
    // --- Officers on foot: chase and arrest. ---
    for (const o of this.officers) {
      const dx = player.x - o.x;
      const dy = player.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 900) {
        o.gone = true;
        continue;
      }
      if (player.car) {
        // Officers cannot catch a car; they hold position and radio in.
        continue;
      }
      const sp = o.speed * dt;
      let nx = o.x + (dx / (d || 1)) * sp;
      let ny = o.y + (dy / (d || 1)) * sp;
      const fixed = this.city.resolveBlocked(nx, ny, 10);
      if (fixed) {
        nx = fixed.x;
        ny = fixed.y;
      }
      o.x = clamp(nx, 30, CONFIG.WORLD - 30);
      o.y = clamp(ny, 30, CONFIG.WORLD - 30);
      if (d < 32) {
        o.arrestT += dt;
        if (o.arrestT >= CONFIG.ARREST_SECONDS) {
          this.busted = true;
        }
      } else {
        o.arrestT = Math.max(0, o.arrestT - dt * 2);
      }
    }
    this.officers = this.officers.filter((o) => !o.gone);
  }
}
