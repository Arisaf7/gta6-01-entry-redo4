// SOLMARA — Streets of the Sun. The world: owns the city, traffic, police,
// missions, player and shots, and steps them all. The parked cars and the
// traffic layout are generated ONCE in the constructor; startRun() only
// resets the player, the missions and the clock — it never re-rolls them,
// so restarting a run keeps the same streets and the same parked cars.
import { CONFIG, clamp, angleTo } from './config.js';
import { RNG } from './random.js';
import { buildCity } from './city.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Player } from './player.js';
import { Shots } from './shots.js';
import { AudioSys } from './audio.js';

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.city = buildCity(this.rng);
    this.traffic = new Traffic(this.city, this.rng);
    this.traffic.spawnInitial();
    this.police = new Police(this.city, this.rng);
    this.missions = new MissionManager();
    this.player = new Player(this.city);
    this.shots = new Shots();
    this.audio = new AudioSys();
    this.attackers = [];
    this.particles = [];
    this.floatTexts = [];
    this.events = []; // consumed by main.js each frame: 'mission-complete', 'win', 'wasted', 'objective'
    this.time = 0;
    this.camera = { x: this.player.x, y: this.player.y };
  }

  // Begin a fresh run. The streets, parked cars and traffic stay exactly
  // as they are — only the player, the story and the clock reset.
  startRun() {
    // Dario starts in the garage forecourt, south of the garage building
    // (the building itself is solid — never spawn inside it).
    this.player.reset(CONFIG.GARAGE.x, CONFIG.GARAGE.y + 115);
    this.police.clear();
    this.missions.reset();
    this.attackers = [];
    this.shots.clear();
    this.particles = [];
    this.floatTexts = [];
    this.events = [];
    this.time = 0;
    this.missions.beginMission(this);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
  }

  // Mission 4: armed ambushers appear at the docks.
  spawnAttackers(x, y, count) {
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(60, 170);
      this.attackers.push({
        x: clamp(x + Math.cos(a) * d, 40, CONFIG.WORLD - 40),
        y: clamp(y + Math.sin(a) * d, 40, CONFIG.WORLD - 40),
        angle: 0,
        speed: 90,
        hp: 60,
        shootCd: this.rng.range(0.4, 1.4),
        skin: '#8a5a3c',
        shirt: '#2e2b29',
        armed: true,
        dead: false,
      });
    }
  }

  onAttackerDown(p) {
    this.player.ammo += 6;
    this.floatText(p.x, p.y - 20, '+6 ammo', '#e8e4da');
    this.missions.onAttackerKilled(this);
  }

  addParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(40, 180);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: this.rng.range(0.25, 0.6), color });
    }
  }

  floatText(x, y, text, color) {
    this.floatTexts.push({ x, y, text, color, life: 1.6 });
  }

  damagePlayer(n, cause) {
    if (this.player.dead) return;
    // In a car the bodywork takes most of it.
    this.player.damage(this.player.car ? Math.ceil(n / 2) : n, this, cause);
  }

  // E on foot: a mission interaction wins over entering a car.
  tryInteractOrEnter() {
    if (this.missions.onInteract(this)) return;
    const car = this.traffic.nearestCar(this.player.x, this.player.y, 70);
    if (car) {
      if (car.owner === 'traffic') {
        // Stealing a car with a driver inside is a crime.
        this.police.addWanted(1);
        this.audio.steal();
        this.floatText(this.player.x, this.player.y - 26, 'Car stolen! +1 ★', '#e8c85a');
      }
      // Remove it from its old list and make it the player's car.
      this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
      this.traffic.parked = this.traffic.parked.filter((c) => c !== car);
      this.player.enterCar(car, this);
    }
  }

  tryExitCar() {
    const car = this.player.car;
    this.player.exitCar(this);
    if (car) {
      // The car stays where it was left and becomes a parked car again, so
      // Dario can get back into it later.
      car.owner = 'parked';
      this.traffic.parked.push(car);
    }
  }

  playerPunch() {
    const p = this.player;
    this.audio.punch();
    const reach = 46;
    const fx = p.x + Math.cos(p.angle) * 26;
    const fy = p.y + Math.sin(p.angle) * 26;
    // Punch an attacker, an officer, or a bystander in front of Dario.
    for (const a of this.attackers) {
      if (!a.dead && Math.hypot(a.x - fx, a.y - fy) < reach) {
        a.hp -= CONFIG.PUNCH_DAMAGE;
        this.addParticles(a.x, a.y, 6, '#e8e4da');
        if (a.hp <= 0) {
          a.dead = true;
          this.onAttackerDown(a);
        }
        return;
      }
    }
    for (const o of this.police.officers) {
      if (Math.hypot(o.x - fx, o.y - fy) < reach) {
        o.hp -= CONFIG.PUNCH_DAMAGE;
        this.addParticles(o.x, o.y, 6, '#e8e4da');
        if (o.hp <= 0) o.gone = true;
        this.police.addWanted(1);
        return;
      }
    }
    for (const ped of this.traffic.peds) {
      if (Math.hypot(ped.x - fx, ped.y - fy) < reach) {
        ped.hp -= CONFIG.PUNCH_DAMAGE;
        this.addParticles(ped.x, ped.y, 6, '#e8e4da');
        this.traffic.scare(ped.x, ped.y, 260);
        this.police.addWanted(1);
        if (ped.hp <= 0) ped.gone = true;
        return;
      }
    }
  }

  playerShoot(aimX, aimY) {
    const p = this.player;
    const angle = angleTo(p.x, p.y, aimX, aimY);
    p.angle = angle;
    this.shots.fire(p.x, p.y, angle, 'player');
    this.audio.shot();
    // A gunshot in earshot of anyone is a crime.
    const witness =
      this.traffic.peds.some((ped) => Math.hypot(ped.x - p.x, ped.y - p.y) < 600) ||
      this.police.officers.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 600) ||
      this.police.cars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 600) ||
      this.attackers.some((a) => !a.dead && Math.hypot(a.x - p.x, a.y - p.y) < 600);
    if (witness) this.police.addWanted(1);
    this.traffic.scare(p.x, p.y, 420);
  }

  update(dt, act) {
    this.time += dt;
    this.player.update(dt, act, this);
    this.traffic.update(dt, this);
    this.police.update(dt, this);
    this.missions.update(dt, this);
    this.shots.update(dt, this);
    // Attackers: close in and shoot at Dario.
    for (const a of this.attackers) {
      if (a.dead) continue;
      const p = this.player;
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      a.angle = angleTo(a.x, a.y, p.x, p.y);
      a.shootCd -= dt;
      if (d > 260) {
        a.x += Math.cos(a.angle) * a.speed * dt;
        a.y += Math.sin(a.angle) * a.speed * dt;
      } else if (a.shootCd <= 0 && !p.dead) {
        a.shootCd = 1.15;
        this.shots.fire(a.x, a.y, a.angle + (this.rng.next() - 0.5) * 0.22, 'attacker');
        this.audio.shot();
      }
    }
    this.attackers = this.attackers.filter((a) => !a.dead);
    this.traffic.peds = this.traffic.peds.filter((p) => !p.gone);
    // Particles and floating text.
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2.4 * dt;
      pt.vy *= 1 - 2.4 * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const ft of this.floatTexts) {
      ft.y -= 26 * dt;
      ft.life -= dt;
    }
    this.floatTexts = this.floatTexts.filter((ft) => ft.life > 0);
    // Camera follows the player with a soft lag.
    const tx = clamp(this.player.x, CONFIG.VIEW_W / 2, CONFIG.WORLD - CONFIG.VIEW_W / 2);
    const ty = clamp(this.player.y, CONFIG.VIEW_H / 2, CONFIG.WORLD - CONFIG.VIEW_H / 2);
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);
    // Continuous audio: engine hum while driving, siren while wanted.
    this.audio.engine(this.player.car ? Math.abs(this.player.car.speed) / CONFIG.CAR_MAX_SPEED : 0);
    const policeNear = this.police.cars.some((c) => Math.hypot(c.x - this.player.x, c.y - this.player.y) < 700);
    this.audio.siren(this.police.wanted > 0 && policeNear, dt);
    if (this.police.busted) {
      this.events.push('busted');
      this.police.busted = false;
      this.player.dead = true;
      this.audio.busted();
    }
  }
}
