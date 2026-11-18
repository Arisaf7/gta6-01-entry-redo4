// SOLMARA — Streets of the Sun. All drawing: the city, the people, the cars,
// the HUD with its minimap, and the title / briefing / pause / end screens.
// One canvas, no images, no external assets — every pixel is drawn here.
import { CONFIG, ROAD_LINES, formatMoney, clamp } from './config.js';
import { MISSIONS } from './missions.js';

const C = CONFIG.COLORS;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
  }

  // Screen-space helpers.
  _view(world) {
    return {
      x: world.camera.x - CONFIG.VIEW_W / 2,
      y: world.camera.y - CONFIG.VIEW_H / 2,
    };
  }

  draw(world, screen, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const view = this._view(world);
    ctx.clearRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    this._drawGround(ctx, view);
    this._drawRoads(ctx, view);
    this._drawBlocks(ctx, view, world);
    this._drawDocksBeach(ctx, view, world);
    this._drawPark(ctx, view, world);
    this._drawBuildings(ctx, view, world);
    this._drawParkedCars(ctx, view, world);
    this._drawTraffic(ctx, view, world);
    this._drawPeds(ctx, view, world);
    this._drawPolice(ctx, view, world);
    this._drawAttackers(ctx, view, world);
    this._drawPlayer(ctx, view, world);
    this._drawShots(ctx, view, world);
    this._drawParticles(ctx, view, world);
    this._drawFloatTexts(ctx, view, world);
    this._drawMissionMarker(ctx, view, world);
    if (screen === 'play' || screen === 'pause') this._drawHud(ctx, world, screen);
    if (screen === 'title') this._drawTitle(ctx, world);
    if (screen === 'briefing') this._drawBriefing(ctx, world);
    if (screen === 'pause') this._drawPause(ctx, world);
    if (screen === 'gameover') this._drawGameOver(ctx, world);
    if (screen === 'win') this._drawWin(ctx, world);
  }

  _inView(view, x, y, m = 80) {
    return x > view.x - m && x < view.x + CONFIG.VIEW_W + m && y > view.y - m && y < view.y + CONFIG.VIEW_H + m;
  }

  _drawGround(ctx, view) {
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    // Subtle block tint so the grid reads at a glance.
    ctx.fillStyle = C.block;
    for (let gx = 0; gx < 7; gx++) {
      for (let gy = 0; gy < 7; gy++) {
        const x = gx * CONFIG.PITCH + CONFIG.ROAD / 2 - view.x;
        const y = gy * CONFIG.PITCH + CONFIG.ROAD / 2 - view.y;
        ctx.fillRect(x, y, CONFIG.PITCH - CONFIG.ROAD, CONFIG.PITCH - CONFIG.ROAD);
      }
    }
  }

  _drawRoads(ctx, view) {
    const half = CONFIG.ROAD / 2;
    ctx.fillStyle = C.road;
    for (const line of ROAD_LINES) {
      const vx = line - view.x;
      if (vx > -half && vx < CONFIG.VIEW_W + half) {
        ctx.fillRect(vx - half, -view.y, CONFIG.ROAD, CONFIG.WORLD);
      }
      const hy = line - view.y;
      if (hy > -half && hy < CONFIG.VIEW_H + half) {
        ctx.fillRect(-view.x, hy - half, CONFIG.WORLD, CONFIG.ROAD);
      }
    }
    // Centre dashes.
    ctx.fillStyle = C.dash;
    for (const line of ROAD_LINES) {
      const vx = line - view.x;
      if (vx > -10 && vx < CONFIG.VIEW_W + 10) {
        for (let y = 0; y < CONFIG.WORLD; y += 60) {
          const sy = y - view.y;
          if (sy > -30 && sy < CONFIG.VIEW_H + 30) ctx.fillRect(vx - 2, sy, 4, 30);
        }
      }
      const hy = line - view.y;
      if (hy > -10 && hy < CONFIG.VIEW_H + 10) {
        for (let x = 0; x < CONFIG.WORLD; x += 60) {
          const sx = x - view.x;
          if (sx > -30 && sx < CONFIG.VIEW_W + 30) ctx.fillRect(sx, hy - 2, 30, 4);
        }
      }
    }
  }

  _drawBlocks(ctx, view, world) {
    // Sidewalk edging around each block.
    ctx.strokeStyle = C.sidewalk;
    ctx.lineWidth = 10;
    for (let gx = 0; gx < 7; gx++) {
      for (let gy = 0; gy < 7; gy++) {
        const x = gx * CONFIG.PITCH + CONFIG.ROAD / 2 - view.x;
        const y = gy * CONFIG.PITCH + CONFIG.ROAD / 2 - view.y;
        ctx.strokeRect(x, y, CONFIG.PITCH - CONFIG.ROAD, CONFIG.PITCH - CONFIG.ROAD);
      }
    }
  }

  _drawDocksBeach(ctx, view, world) {
    const city = world.city;
    // Dock water (east edge) and beach water (south edge).
    ctx.fillStyle = C.water;
    ctx.fillRect(city.dockWater.x - view.x, -view.y, city.dockWater.w, CONFIG.WORLD);
    ctx.fillStyle = C.waterDeep;
    ctx.fillRect(city.dockWater.x + 120 - view.x, -view.y, 120, CONFIG.WORLD);
    ctx.fillStyle = C.water;
    ctx.fillRect(-view.x, city.beachWater.y - view.y, CONFIG.WORLD, city.beachWater.h);
    // Beach sand.
    ctx.fillStyle = C.sand;
    ctx.fillRect(-view.x, 3205 - view.y, CONFIG.WORLD, 275);
    // Piers.
    ctx.fillStyle = '#8a6f52';
    for (const p of city.piers) {
      ctx.fillRect(p.x - view.x, p.y - view.y, p.w, p.h);
    }
    // Containers.
    for (const c of city.containers) {
      if (!this._inView(view, c.x, c.y, 60)) continue;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x - view.x, c.y - view.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - view.x, c.y - view.y, c.w, c.h);
    }
    // Palms.
    for (const p of city.palms) {
      if (!this._inView(view, p.x, p.y, 40)) continue;
      this._drawTree(ctx, p.x - view.x, p.y - view.y, p.r, '#3f7d4a');
    }
    // "DOCKS" / "BEACH" painted on the ground.
    ctx.fillStyle = 'rgba(46,43,41,0.55)';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('DOCKS', 3300 - view.x, 320 - view.y);
    ctx.fillText('BEACH', 300 - view.x, 3340 - view.y);
  }

  _drawPark(ctx, view, world) {
    const park = world.city.park;
    ctx.fillStyle = C.park;
    ctx.fillRect(park.x - view.x, park.y - view.y, park.w, park.h);
    ctx.fillStyle = C.water;
    const pond = world.city.pond;
    ctx.beginPath();
    ctx.ellipse(pond.x - view.x, pond.y - view.y, pond.rx, pond.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const t of world.city.trees) {
      if (!this._inView(view, t.x, t.y, 40)) continue;
      this._drawTree(ctx, t.x - view.x, t.y - view.y, t.r, '#3f7d4a');
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('SOLMARA PARK', park.x + 40 - view.x, park.y + 40 - view.y);
  }

  _drawTree(ctx, x, y, r, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(x + 3, y + 4, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBuildings(ctx, view, world) {
    for (const b of world.city.buildings) {
      if (!this._inView(view, b.x + b.w / 2, b.y + b.h / 2, 160)) continue;
      const x = b.x - view.x;
      const y = b.y - view.y;
      // Shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 6, y + 8, b.w, b.h);
      // Roof.
      ctx.fillStyle = b.roof;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, b.w, b.h);
      // Windows.
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const cols = Math.max(2, Math.floor(b.w / 42));
      const rows = Math.max(1, Math.floor(b.h / 42));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillRect(x + 12 + i * ((b.w - 24) / cols), y + 12 + j * ((b.h - 24) / rows), 12, 10);
        }
      }
      // Landmark signs.
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      if (b.landmark === 'garage') ctx.fillText("ROSA'S GARAGE", x + b.w / 2, y + b.h / 2 + 7);
      if (b.landmark === 'bank') ctx.fillText('SOLMARA BANK', x + b.w / 2, y + b.h / 2 + 7);
      if (b.landmark === 'hotel') ctx.fillText('HOTEL', x + b.w / 2, y + b.h / 2 - 4);
      if (b.landmark === 'hotel') ctx.fillText('SOLMARA', x + b.w / 2, y + b.h / 2 + 18);
      if (b.landmark === 'hut') ctx.fillText('LIFEGUARD', x + b.w / 2, y + b.h / 2 + 7);
      ctx.textAlign = 'left';
    }
  }

  _drawCar(ctx, x, y, angle, len, wid, color, kind) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    ctx.beginPath();
    ctx.roundRect(-len / 6, -wid / 2 + 3, len / 3, wid - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.8)';
    ctx.fillRect(len / 4, -wid / 2 + 4, 4, wid - 8);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 5);
    ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 5);
    if (kind === 'police') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
      ctx.textAlign = 'left';
      // Light bar.
      const blink = Math.floor(this.time * 4) % 2 === 0;
      ctx.fillStyle = blink ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-8, -wid / 2 - 2, 8, 4);
      ctx.fillStyle = blink ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(0, -wid / 2 - 2, 8, 4);
    }
    if (kind === 'taxi') {
      ctx.fillStyle = '#2e2b29';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  _drawParkedCars(ctx, view, world) {
    for (const c of world.traffic.parked) {
      if (!this._inView(view, c.x, c.y, 60)) continue;
      this._drawCar(ctx, c.x - view.x, c.y - view.y, c.angle, c.len, c.wid, c.color, c.kind);
    }
  }

  _drawTraffic(ctx, view, world) {
    for (const c of world.traffic.cars) {
      if (!this._inView(view, c.x, c.y, 80)) continue;
      this._drawCar(ctx, c.x - view.x, c.y - view.y, c.angle, c.len, c.wid, c.color, c.kind);
    }
  }

  _drawPed(ctx, x, y, angle, skin, shirt, armed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(2, 3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(5, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (armed) {
      ctx.strokeStyle = '#2e2b29';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPeds(ctx, view, world) {
    for (const p of world.traffic.peds) {
      if (!this._inView(view, p.x, p.y, 40)) continue;
      this._drawPed(ctx, p.x - view.x, p.y - view.y, p.angle, p.skin, p.shirt, false);
    }
  }

  _drawPolice(ctx, view, world) {
    for (const c of world.police.cars) {
      if (!this._inView(view, c.x, c.y, 80)) continue;
      this._drawCar(ctx, c.x - view.x, c.y - view.y, c.angle, c.len, c.wid, c.color, c.kind);
    }
    for (const o of world.police.officers) {
      if (!this._inView(view, o.x, o.y, 40)) continue;
      this._drawPed(ctx, o.x - view.x, o.y - view.y, Math.atan2(world.player.y - o.y, world.player.x - o.x), o.skin, o.shirt, false);
      // Arrest progress ring.
      if (o.arrestT > 0) {
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(o.x - view.x, o.y - view.y, 18, -Math.PI / 2, -Math.PI / 2 + (o.arrestT / CONFIG.ARREST_SECONDS) * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  _drawAttackers(ctx, view, world) {
    for (const a of world.attackers) {
      if (!this._inView(view, a.x, a.y, 40)) continue;
      this._drawPed(ctx, a.x - view.x, a.y - view.y, a.angle, a.skin, a.shirt, true);
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(a.x - view.x - 14, a.y - view.y - 22, 28, 5);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(a.x - view.x - 14, a.y - view.y - 22, 28 * Math.max(0, a.hp / 60), 5);
    }
  }

  _drawPlayer(ctx, view, world) {
    const p = world.player;
    if (p.dead) return;
    if (p.car) {
      this._drawCar(ctx, p.car.x - view.x, p.car.y - view.y, p.car.angle, p.car.len, p.car.wid, p.car.color, p.car.kind);
      // Player marker above the car.
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', p.car.x - view.x, p.car.y - view.y - 20);
      ctx.textAlign = 'left';
      return;
    }
    const x = p.x - view.x;
    const y = p.y - view.y;
    if (p.hurtT > 0 && Math.floor(this.time * 12) % 2 === 0) {
      // Flash while hurt.
      ctx.globalAlpha = 0.55;
    }
    // Dario: dark jacket, sun-bleached hair.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(2, 3, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e4a6b';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(5, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2e22';
    ctx.beginPath();
    ctx.arc(3, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    // Pistol in hand.
    ctx.strokeStyle = '#1c2733';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 3);
    ctx.lineTo(18, 3);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Direction tick so the facing reads at a glance.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + Math.cos(p.angle) * 18, y + Math.sin(p.angle) * 18, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawShots(ctx, view, world) {
    ctx.fillStyle = '#ffe9a8';
    for (const b of world.shots.bullets) {
      ctx.beginPath();
      ctx.arc(b.x - view.x, b.y - view.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawParticles(ctx, view, world) {
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 1.8);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - view.x - 2, pt.y - view.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  _drawFloatTexts(ctx, view, world) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const ft of world.floatTexts) {
      ctx.globalAlpha = Math.min(1, ft.life);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x - view.x, ft.y - view.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  _drawMissionMarker(ctx, view, world) {
    const m = world.missions.marker();
    if (!m) return;
    const pulse = 1 + Math.sin(this.time * 4) * 0.12;
    const x = m.x - view.x;
    const y = m.y - view.y;
    ctx.strokeStyle = '#e8c85a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, m.r * 0.32 * pulse + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e8c85a';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    // A beacon line pointing down at the marker.
    ctx.strokeStyle = 'rgba(232,200,90,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - m.r * 0.32 * pulse - 34);
    ctx.lineTo(x, y - m.r * 0.32 * pulse - 14);
    ctx.stroke();
    // Off-screen arrow: point toward the marker when it is not visible.
    if (x < 40 || x > CONFIG.VIEW_W - 40 || y < 40 || y > CONFIG.VIEW_H - 40) {
      const cx = clamp(x, 60, CONFIG.VIEW_W - 60);
      const cy = clamp(y, 60, CONFIG.VIEW_H - 60);
      const a = Math.atan2(y - CONFIG.VIEW_H / 2, x - CONFIG.VIEW_W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#e8c85a';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  _drawHud(ctx, world, screen) {
    const p = world.player;
    // Top-left status panel.
    ctx.fillStyle = 'rgba(20,18,16,0.72)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 250, 104, 10);
    ctx.fill();
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(formatMoney(p.money), 28, 46);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(28, 56, 150, 12);
    ctx.fillStyle = p.health > 40 ? '#5da24a' : '#ff3b30';
    ctx.fillRect(28, 56, 150 * Math.max(0, p.health / 100), 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('HP ' + Math.ceil(p.health), 186, 67);
    // Ammo + wanted stars.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('Ammo ' + p.ammo, 28, 96);
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < world.police.wanted ? '★' : '☆';
    ctx.fillText(stars, 130, 98);
    // Objective banner (top centre).
    const m = world.missions.current();
    if (m) {
      const text = `Mission ${m.id}/5 — ${m.title}: ${world.missions.objectiveText()}`;
      ctx.font = 'bold 16px system-ui, sans-serif';
      const w = ctx.measureText(text).width + 28;
      ctx.fillStyle = 'rgba(20,18,16,0.72)';
      ctx.beginPath();
      ctx.roundRect((CONFIG.VIEW_W - w) / 2, 14, w, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, (CONFIG.VIEW_W - w) / 2 + 14, 37);
    }
    // Speed when driving (bottom right).
    if (p.car) {
      ctx.fillStyle = 'rgba(20,18,16,0.72)';
      ctx.beginPath();
      ctx.roundRect(CONFIG.VIEW_W - 150, CONFIG.VIEW_H - 64, 136, 50, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.24) + ' km/h', CONFIG.VIEW_W - 138, CONFIG.VIEW_H - 30);
    }
    // Controls hint (bottom left).
    ctx.fillStyle = 'rgba(20,18,16,0.55)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD move/drive · E enter car / interact · F punch · Space/click shoot · P pause · M mute', 16, CONFIG.VIEW_H - 14);
    this._drawMinimap(ctx, world);
  }

  _drawMinimap(ctx, world) {
    const size = 200;
    const ox = CONFIG.VIEW_W - size - 14;
    const oy = 14;
    const s = size / CONFIG.WORLD;
    ctx.fillStyle = 'rgba(20,18,16,0.78)';
    ctx.beginPath();
    ctx.roundRect(ox - 6, oy - 6, size + 12, size + 12, 10);
    ctx.fill();
    // City ground + water.
    ctx.fillStyle = '#8a7a5c';
    ctx.fillRect(ox, oy, size, size);
    ctx.fillStyle = '#3fa7c4';
    ctx.fillRect(ox + 3360 * s, oy, (CONFIG.WORLD - 3360) * s, size);
    ctx.fillRect(ox, oy + 3480 * s, size, (CONFIG.WORLD - 3480) * s);
    // Park.
    ctx.fillStyle = '#5da24a';
    const park = world.city.park;
    ctx.fillRect(ox + park.x * s, oy + park.y * s, park.w * s, park.h * s);
    // Roads.
    ctx.strokeStyle = '#3e3a37';
    ctx.lineWidth = 2;
    for (const line of ROAD_LINES) {
      ctx.beginPath();
      ctx.moveTo(ox + line * s, oy);
      ctx.lineTo(ox + line * s, oy + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox, oy + line * s);
      ctx.lineTo(ox + size, oy + line * s);
      ctx.stroke();
    }
    // Mission marker.
    const mk = world.missions.marker();
    if (mk) {
      ctx.fillStyle = '#e8c85a';
      ctx.beginPath();
      ctx.arc(ox + mk.x * s, oy + mk.y * s, 5 + Math.sin(this.time * 4) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#ff3b30';
    for (const c of world.police.cars) {
      ctx.fillRect(ox + c.x * s - 2, oy + c.y * s - 2, 4, 4);
    }
    // Player.
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#2e2b29';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ox + world.player.x * s, oy + world.player.y * s, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('SOLMARA', ox, oy + size + 18);
  }

  _panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(18,16,14,0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = '#e8c85a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawTitle(ctx, world) {
    ctx.fillStyle = 'rgba(10,10,12,0.55)';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    this._panel(ctx, 290, 110, 700, 470);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('SOLMARA', 640, 210);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('STREETS OF THE SUN', 640, 252);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Dario Reyes came home to Solmara owing money.', 640, 300);
    ctx.fillText('Mama Rosa has five jobs for him. The city is watching.', 640, 326);
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — New Game', 640, 392);
    if (world.hasSave) {
      ctx.fillText('C — Continue', 640, 426);
    }
    ctx.fillStyle = '#e8e4da';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('WASD move / drive · E enter car & interact · F punch · Space / click shoot', 640, 478);
    ctx.fillText('Steal cars, dodge the police, finish all five jobs. P pause · M mute', 640, 504);
    ctx.fillStyle = '#9a8a6d';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('An original game. No Rockstar content. Runs entirely offline.', 640, 552);
    ctx.textAlign = 'left';
  }

  _drawBriefing(ctx, world) {
    const m = world.missions.current();
    if (!m) return;
    ctx.fillStyle = 'rgba(10,10,12,0.6)';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    this._panel(ctx, 240, 130, 800, 430);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`MISSION ${m.id} OF 5`, 640, 180);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(m.title, 640, 232);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '19px system-ui, sans-serif';
    this._wrapText(ctx, m.briefing, 640, 280, 700, 28);
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`Reward: ${formatMoney(m.reward)}`, 640, 460);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — Begin the job', 640, 516);
    ctx.textAlign = 'left';
  }

  _wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, yy);
        line = w;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  _drawPause(ctx, world) {
    ctx.fillStyle = 'rgba(10,10,12,0.55)';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    this._panel(ctx, 440, 220, 400, 260);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', 640, 300);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`Mission ${world.missions.index + 1}/5 · ${formatMoney(world.player.money)} · ${world.police.wanted}★ wanted`, 640, 346);
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('P — Resume', 640, 402);
    ctx.fillText('Q — Save & quit to title', 640, 434);
    ctx.textAlign = 'left';
  }

  _drawGameOver(ctx, world) {
    ctx.fillStyle = 'rgba(10,10,12,0.65)';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    this._panel(ctx, 340, 180, 600, 330);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(world.endReason === 'busted' ? 'BUSTED' : 'WASTED', 640, 280);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText(world.endReason === 'busted' ? 'The Solmara police finally caught up with Dario.' : 'Dario went down in the streets of Solmara.', 640, 326);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`Missions done: ${world.missions.index}/5 · Money: ${formatMoney(world.player.money)}`, 640, 372);
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — Back to title', 640, 448);
    ctx.textAlign = 'left';
  }

  _drawWin(ctx, world) {
    ctx.fillStyle = 'rgba(10,10,12,0.6)';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    this._panel(ctx, 290, 150, 700, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('SOLMARA IS YOURS', 640, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('All five jobs done. The bank money is Rosa\'s, the debt is gone,', 640, 302);
    ctx.fillText('and Dario Reyes owns the streets he grew up on.', 640, 330);
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(`Final take: ${formatMoney(world.player.money)}`, 640, 392);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — Back to title', 640, 470);
    ctx.textAlign = 'left';
  }
}
