// SOLMARA — Streets of the Sun. Dario Reyes: on foot and behind the wheel.
// On foot: WASD to move, E to enter a car, F to punch, Space / click to
// shoot. In a car: W/S to drive, A/D to steer, E to get out, H to honk.
import { CONFIG, clamp, angleTo } from './config.js';

export class Player {
  constructor(city) {
    this.city = city;
    this.x = CONFIG.GARAGE.x;
    this.y = CONFIG.GARAGE.y + 115; // forecourt, south of the garage building
    this.angle = -Math.PI / 2;
    this.car = null; // the car Dario is driving, or null when on foot
    this.health = CONFIG.PLAYER_HEALTH;
    this.money = 0;
    this.ammo = CONFIG.PISTOL_AMMO_START;
    this.hasGun = true;
    this.punchCd = 0;
    this.shootCd = 0;
    this.hurtT = 0;
    this.dead = false;
  }

  reset(startX, startY) {
    this.x = startX;
    this.y = startY;
    this.angle = -Math.PI / 2;
    this.car = null;
    this.health = CONFIG.PLAYER_HEALTH;
    this.money = 0;
    this.ammo = CONFIG.PISTOL_AMMO_START;
    this.punchCd = 0;
    this.shootCd = 0;
    this.hurtT = 0;
    this.dead = false;
  }

  get speed() {
    return this.car ? Math.abs(this.car.speed) : 0;
  }

  enterCar(car, world) {
    this.car = car;
    car.owner = 'player';
    if (car.driver) {
      // The driver bails out and runs.
      world.traffic.peds.push({
        x: car.x - 30,
        y: car.y + 30,
        angle: Math.PI,
        speed: 40,
        skin: '#e8b88a',
        shirt: '#d94f3d',
        state: 'flee',
        panicT: 4,
        fleeX: -1,
        fleeY: 0.4,
        hp: 40,
        armed: false,
      });
      car.driver = null;
    }
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
  }

  exitCar(world) {
    const car = this.car;
    if (!car) return;
    car.speed = 0;
    // Step out to the side of the car, clear of buildings.
    const side = { x: car.x - Math.sin(car.angle) * 30, y: car.y + Math.cos(car.angle) * 30 };
    const fixed = this.city.resolveBlocked(side.x, side.y, 12);
    this.x = fixed ? fixed.x : side.x;
    this.y = fixed ? fixed.y : side.y;
    this.angle = car.angle;
    this.car = null;
  }

  damage(n, world, cause) {
    if (this.dead) return;
    this.health -= n;
    this.hurtT = 0.35;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      world.events.push('wasted');
      world.audio.busted();
    }
  }

  update(dt, act, world) {
    if (this.dead) return;
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.car) this._updateDriving(dt, act, world);
    else this._updateOnFoot(dt, act, world);
  }

  _updateOnFoot(dt, act, world) {
    const speed = act.run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED;
    let nx = this.x + act.mx * speed * dt;
    let ny = this.y + act.my * speed * dt;
    // Slide along walls: try each axis on its own.
    if (!this.city.isBlocked(nx, this.y, 12)) this.x = nx;
    else nx = this.x;
    if (!this.city.isBlocked(this.x, ny, 12)) this.y = ny;
    this.x = clamp(this.x, 24, CONFIG.WORLD - 24);
    this.y = clamp(this.y, 24, CONFIG.WORLD - 24);
    // Face where we walk, or where we aim while shooting.
    if (act.shoot && act.aim) {
      this.angle = angleTo(this.x, this.y, act.aimWorldX, act.aimWorldY);
    } else if (act.mx !== 0 || act.my !== 0) {
      this.angle = Math.atan2(act.my, act.mx);
    }
    if (act.enter) world.tryInteractOrEnter();
    if (act.punch && this.punchCd <= 0) {
      this.punchCd = 0.45;
      world.playerPunch();
    }
    if (act.shoot && this.shootCd <= 0 && this.ammo > 0) {
      this.shootCd = 0.28;
      this.ammo -= 1;
      world.playerShoot(act.aimWorldX, act.aimWorldY);
    }
  }

  _updateDriving(dt, act, world) {
    const car = this.car;
    // E gets out; H honks; shooting is on foot only.
    if (act.enter) {
      world.tryExitCar();
      return;
    }
    if (act.honk) world.audio.honk();
    const throttle = -act.my; // W (my=-1) accelerates
    if (throttle > 0) car.speed += CONFIG.CAR_ACCEL * dt;
    else if (throttle < 0) {
      if (car.speed > 5) car.speed -= CONFIG.CAR_ACCEL * 1.4 * dt;
      else car.speed -= CONFIG.CAR_ACCEL * 0.5 * dt;
    } else {
      car.speed -= car.speed * 0.7 * dt;
    }
    car.speed = clamp(car.speed, -CONFIG.CAR_REVERSE_MAX, CONFIG.CAR_MAX_SPEED);
    // Steering scales with speed and flips in reverse; at high speed the
    // steering softens so the car stays controllable instead of twitchy.
    const steer = act.mx;
    const speedRatio = Math.abs(car.speed) / CONFIG.CAR_MAX_SPEED;
    const turnAuthority = clamp(Math.abs(car.speed) / 120, 0, 1) * (1 - speedRatio * 0.55);
    car.angle += steer * CONFIG.CAR_TURN * turnAuthority * Math.sign(car.speed || 1) * dt;
    const step = car.speed * dt;
    let nx = car.x + Math.cos(car.angle) * step;
    let ny = car.y + Math.sin(car.angle) * step;
    if (this.city.isBlocked(nx, ny, 20)) {
      // Slide along the wall instead of stopping dead: try each axis alone.
      if (!this.city.isBlocked(nx, car.y, 20)) {
        car.x = nx;
      } else if (!this.city.isBlocked(car.x, ny, 20)) {
        car.y = ny;
      } else {
        // Bonk: stop against the wall instead of driving through it.
        car.speed *= -0.25;
      }
      nx = car.x;
      ny = car.y;
    } else {
      car.x = nx;
      car.y = ny;
    }
    car.x = clamp(car.x, 24, CONFIG.WORLD - 24);
    car.y = clamp(car.y, 24, CONFIG.WORLD - 24);
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
    // Bump traffic cars aside (simple circle push).
    for (const other of world.traffic.cars) {
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d > 1 && d < 44) {
        const push = (44 - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        other.x += ux * push;
        other.y += uy * push;
        car.speed *= 0.9;
      }
    }
    for (const other of world.traffic.parked) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d > 1 && d < 44) {
        const push = (44 - d) / 2;
        car.x -= (dx / d) * push;
        car.y -= (dy / d) * push;
        car.speed *= 0.85;
      }
    }
  }
}
