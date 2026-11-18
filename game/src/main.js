// SOLMARA — Streets of the Sun. Entry point: the state machine
// title -> briefing -> play -> pause -> game over / win -> restart,
// plus the deterministic ?shot= modes used for screenshots.
import { CONFIG } from './config.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { saveGame, loadSave, clearSave, hasSave } from './save.js';

const canvas = document.getElementById('game');
canvas.width = CONFIG.VIEW_W;
canvas.height = CONFIG.VIEW_H;

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot'); // start | play | action | end
const seed = Number(params.get('seed') || '1') || 1;
// Screenshot mode: hide the HTML caption under the canvas so the frame is
// exactly the 1280x720 game.
if (shotMode) {
  const note = document.getElementById('note');
  if (note) note.style.display = 'none';
}

const world = new World(seed);
const input = new Input(canvas);
input.attach();
const renderer = new Renderer(canvas);

let screen = 'title';
world.hasSave = hasSave();
world.endReason = null;

function applySave(data) {
  world.missions.index = Math.min(data.mission, 4);
  world.missions.step = 0;
  world.missions.kills = 0;
  world.missions.attackersSpawned = false;
  world.player.money = data.money || 0;
  world.player.health = data.health || CONFIG.PLAYER_HEALTH;
  world.player.ammo = data.ammo || CONFIG.PISTOL_AMMO_START;
  world.player.x = data.x || CONFIG.GARAGE.x;
  world.player.y = data.y || CONFIG.GARAGE.y + 115;
  world.player.car = null;
  world.police.setWanted(data.wanted || 0);
  world.missions.beginMission(world);
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
}

function startNewGame() {
  world.startRun();
  world.hasSave = false;
  screen = 'briefing';
}

function continueGame() {
  const data = loadSave();
  if (!data) return;
  world.startRun();
  applySave(data);
  screen = 'play';
}

function toTitle() {
  world.hasSave = hasSave();
  world.endReason = null;
  screen = 'title';
}

// --- Deterministic screenshot staging (?shot=...&seed=...) ---
function stageShot(mode) {
  world.startRun();
  if (mode === 'start') {
    screen = 'title';
    return;
  }
  if (mode === 'play') {
    // Dario driving east on the road past the garage, heading for the bank.
    const car = world.traffic.parked[world.traffic.parked.length - 2];
    world.traffic.parked = world.traffic.parked.filter((c) => c !== car);
    car.x = 700;
    car.y = 478; // eastbound lane of the road at y=450
    car.angle = 0;
    car.speed = 260;
    world.player.enterCar(car, world);
    world.player.money = 500;
    for (let i = 0; i < 45; i++) world.update(1 / 60, { mx: 0, my: -1, run: false, enter: false, punch: false, shoot: false, honk: false, aim: { x: 640, y: 360 }, aimWorldX: 900, aimWorldY: 478 });
    screen = 'play';
    return;
  }
  if (mode === 'action') {
    // The dockside ambush: Dario on foot, outnumbered, wanted, police closing.
    world.missions.index = 3;
    world.missions.step = 1;
    world.missions.beginMission(world);
    world.missions.attackersSpawned = false;
    world.player.x = 3230;
    world.player.y = 900;
    world.player.ammo = 24;
    world.player.money = 2500;
    world.police.setWanted(3);
    for (let i = 0; i < 30; i++) world.update(1 / 60, { mx: 0, my: 0, run: false, enter: false, punch: false, shoot: false, honk: false, aim: { x: 640, y: 360 }, aimWorldX: 3400, aimWorldY: 900 });
    screen = 'play';
    return;
  }
  if (mode === 'end') {
    world.missions.index = 5;
    world.player.money = 9500;
    screen = 'win';
  }
}

// Debug / automation hooks (used by the CDP play-test, harmless in play).
// The state is mirrored into a hidden DOM node as well as window, because
// some automation bridges evaluate in a different JS compartment than the
// page's own scripts and cannot see window globals; the DOM is shared.
const stateNode = document.createElement('div');
stateNode.id = 'solmara-state';
stateNode.style.display = 'none';
document.body.appendChild(stateNode);

function getState() {
  const p = world.player;
  return {
    screen,
    mission: world.missions.index + 1,
    missionDone: world.missions.done,
    objective: world.missions.objectiveText(),
    money: p.money,
    wanted: world.police.wanted,
    health: Math.round(p.health),
    ammo: p.ammo,
    x: Math.round(p.x),
    y: Math.round(p.y),
    angle: p.angle,
    inCar: !!p.car,
    carSpeed: p.car ? Math.round(p.car.speed) : 0,
    attackers: world.attackers.length,
    policeCars: world.police.cars.length,
    officers: world.police.officers.length,
    bullets: world.shots.bullets.length,
    dead: p.dead,
    endReason: world.endReason,
  };
}

window.__solmara = { getState, world };

if (shotMode) {
  stageShot(shotMode);
} else {
  world.startRun();
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  const ui = input.takeUiActions();
  if (ui.mute) {
    world.audio.ensure();
    world.audio.setMuted(!world.audio.muted);
  }
  if (screen === 'title') {
    if (ui.confirm) {
      world.audio.ensure();
      world.audio.click();
      startNewGame();
    } else if (ui.continueGame && world.hasSave) {
      world.audio.ensure();
      world.audio.click();
      continueGame();
    }
  } else if (screen === 'briefing') {
    if (ui.confirm) {
      world.audio.ensure();
      world.audio.click();
      screen = 'play';
    }
  } else if (screen === 'play') {
    if (ui.pause) {
      screen = 'pause';
    } else {
      const act = input.takePlayerActions();
      // Convert the mouse aim from screen space to world space.
      const vx = world.camera.x - CONFIG.VIEW_W / 2;
      const vy = world.camera.y - CONFIG.VIEW_H / 2;
      act.aimWorldX = vx + act.aim.x;
      act.aimWorldY = vy + act.aim.y;
      world.update(dt, act);
      // Drain world events.
      for (const ev of world.events) {
        if (ev === 'wasted') {
          world.endReason = 'wasted';
          screen = 'gameover';
          clearSave();
        } else if (ev === 'busted') {
          world.endReason = 'busted';
          screen = 'gameover';
          clearSave();
        } else if (ev === 'win') {
          screen = 'win';
          clearSave();
        } else if (ev === 'mission-complete') {
          saveGame(world);
          world.hasSave = true;
        }
      }
      world.events = [];
    }
  } else if (screen === 'pause') {
    if (ui.pause) {
      screen = 'play';
    } else if (ui.quit) {
      saveGame(world);
      toTitle();
    }
  } else if (screen === 'gameover' || screen === 'win') {
    if (ui.confirm) {
      world.audio.ensure();
      world.audio.click();
      toTitle();
    }
  }
  input.endFrame();
  renderer.draw(world, screen, dt);
  stateNode.textContent = JSON.stringify(getState());
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
