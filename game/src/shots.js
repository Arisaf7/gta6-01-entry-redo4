// SOLMARA — Streets of the Sun. Bullets: fired by the player, by ambushers
// and by nobody else. They fly straight, spark off buildings and hurt
// whoever they touch.
import { CONFIG } from './config.js';

export class Shots {
  constructor() {
    this.bullets = [];
  }

  fire(x, y, angle, from) {
    this.bullets.push({
      x: x + Math.cos(angle) * 20,
      y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * CONFIG.BULLET_SPEED,
      vy: Math.sin(angle) * CONFIG.BULLET_SPEED,
      life: 0.9,
      from, // 'player' | 'attacker'
      damage: CONFIG.BULLET_DAMAGE,
    });
  }

  clear() {
    this.bullets = [];
  }

  update(dt, world) {
    const city = world.city;
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        b.gone = true;
        continue;
      }
      if (city.isBlocked(b.x, b.y, 1)) {
        world.addParticles(b.x, b.y, 5, '#e8c85a');
        b.gone = true;
        continue;
      }
      if (b.from === 'player') {
        // Hit an attacker, an officer, or a bystander.
        for (const p of world.attackers) {
          if (Math.hypot(p.x - b.x, p.y - b.y) < 16) {
            p.hp -= b.damage;
            world.addParticles(b.x, b.y, 6, '#d94f3d');
            b.gone = true;
            if (p.hp <= 0 && !p.dead) {
              p.dead = true;
              world.onAttackerDown(p);
            }
            break;
          }
        }
        if (b.gone) continue;
        for (const o of world.police.officers) {
          if (Math.hypot(o.x - b.x, o.y - b.y) < 16) {
            o.hp -= b.damage;
            world.addParticles(b.x, b.y, 6, '#d94f3d');
            b.gone = true;
            if (o.hp <= 0) o.gone = true;
            break;
          }
        }
        if (b.gone) continue;
        for (const p of world.traffic.peds) {
          if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
            p.hp -= b.damage;
            world.addParticles(b.x, b.y, 6, '#d94f3d');
            world.traffic.scare(b.x, b.y, 300);
            world.police.addWanted(1);
            b.gone = true;
            if (p.hp <= 0) p.gone = true;
            break;
          }
        }
        if (b.gone) continue;
        // Hit a car (traffic, parked or police).
        for (const c of [...world.traffic.cars, ...world.traffic.parked, ...world.police.cars]) {
          const dx = b.x - c.x;
          const dy = b.y - c.y;
          const along = Math.abs(dx * Math.cos(c.angle) + dy * Math.sin(c.angle));
          const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
          if (along < c.len / 2 + 4 && side < c.wid / 2 + 4) {
            world.addParticles(b.x, b.y, 5, '#e8c85a');
            b.gone = true;
            break;
          }
        }
      } else {
        // Enemy bullet: only the player can be hurt.
        const p = world.player;
        if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < (p.car ? 26 : 15)) {
          world.damagePlayer(p.car ? Math.ceil(b.damage / 4) : b.damage, 'shot');
          world.addParticles(b.x, b.y, 5, '#d94f3d');
          b.gone = true;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.gone);
  }
}
