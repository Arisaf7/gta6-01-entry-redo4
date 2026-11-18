// SOLMARA — Streets of the Sun. The story: five jobs from Mama Rosa.
// Dario Reyes came home to Solmara owing money; Rosa gives him a way out,
// one job at a time. Each mission is a list of steps: go somewhere, press E
// to do the thing, or take down the people shooting at you.
import { CONFIG } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'The First Errand',
    briefing: "Mama Rosa runs the garage on the corner, and she runs this whole side of Solmara. She needs a package from the bank across town. Take a car, drive to the bank, grab it, and bring it home. Don't make a scene.",
    reward: 500,
    steps: [
      { kind: 'interact', x: CONFIG.BANK.x, y: CONFIG.BANK.y, r: 130, label: 'Collect the package at the Bank' },
      { kind: 'interact', x: CONFIG.GARAGE.x, y: CONFIG.GARAGE.y, r: CONFIG.GARAGE.r, label: 'Deliver the package to Rosa\'s Garage' },
    ],
  },
  {
    id: 2,
    title: 'Hotel Pickup',
    briefing: 'A guest at the Hotel Solmara owes Rosa money and keeps "forgetting". Go collect it. He will not hand it over quietly, and the law may notice. Drop the cash at the docks, pier two, where the boys are waiting.',
    reward: 800,
    steps: [
      { kind: 'interact', x: CONFIG.HOTEL.x, y: CONFIG.HOTEL.y, r: 130, label: 'Collect the cash at the Hotel Solmara' },
      { kind: 'interact', x: 3400, y: 1450, r: 120, label: 'Deliver the cash to the docks' },
    ],
    onCollectWanted: 1,
  },
  {
    id: 3,
    title: 'Beach Drop',
    briefing: 'The package has to reach the beach before sundown, and the police are already looking for your face. Keep your head down, stay off the main roads if you can, and make the drop by the lifeguard hut.',
    reward: 1200,
    startWanted: 2,
    steps: [
      { kind: 'interact', x: 1800, y: 3350, r: 130, label: 'Make the drop at the beach' },
    ],
  },
  {
    id: 4,
    title: 'Dockside Ambush',
    briefing: 'It was a setup. The buyers at the docks brought guns instead of money. Rosa says the deal is still on if you walk out of there alive — take down all four of them, then grab the crate and get out.',
    reward: 2000,
    ammoBonus: 24,
    steps: [
      { kind: 'goto', x: 3400, y: 900, r: 160, label: 'Reach the docks' },
      { kind: 'eliminate', count: 4, spawn: { x: 3400, y: 900 }, label: 'Take down the ambushers (0/4)' },
      { kind: 'interact', x: 3400, y: 900, r: 130, label: 'Grab the crate' },
    ],
  },
  {
    id: 5,
    title: 'The Big Score',
    briefing: "One last job and Dario is free. The bank vault, midday, in and out. Rosa's crew has the door; you carry the money. Every cop in Solmara will be on you the moment the alarm sounds — so drive like the whole city is yours. Because tonight, it is.",
    reward: 5000,
    steps: [
      { kind: 'interact', x: CONFIG.BANK.x, y: CONFIG.BANK.y, r: 130, label: 'Rob the bank vault' },
      { kind: 'goto', x: CONFIG.GARAGE.x, y: CONFIG.GARAGE.y, r: CONFIG.GARAGE.r, label: 'Escape to Rosa\'s Garage' },
    ],
    onRobWanted: 4,
  },
];

export class MissionManager {
  constructor() {
    this.index = 0; // 0-based mission index
    this.step = 0;
    this.kills = 0;
    this.attackersSpawned = false;
    this.started = false;
  }

  get done() {
    return this.index >= MISSIONS.length;
  }

  current() {
    return MISSIONS[this.index] || null;
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }

  objectiveText() {
    if (this.done) return 'Solmara is yours, Dario.';
    const step = this.currentStep();
    if (!step) return '';
    if (step.kind === 'eliminate') {
      return `Take down the ambushers (${this.kills}/${step.count})`;
    }
    return step.label;
  }

  marker() {
    const step = this.currentStep();
    if (!step || step.kind === 'eliminate') {
      if (step && step.kind === 'eliminate') return { x: step.spawn.x, y: step.spawn.y, r: 160 };
      return null;
    }
    return { x: step.x, y: step.y, r: step.r };
  }

  // Called when a mission becomes active (first start, or after a restart).
  beginMission(world) {
    const m = this.current();
    if (!m) return;
    this.started = true;
    this.attackersSpawned = false;
    this.kills = 0;
    if (m.startWanted) world.police.setWanted(m.startWanted);
  }

  // Called when the player presses E. Returns true if the press did a
  // mission thing (so the world should not also treat it as entering a car).
  onInteract(world) {
    const step = this.currentStep();
    if (!step || step.kind !== 'interact') return false;
    const d = Math.hypot(world.player.x - step.x, world.player.y - step.y);
    if (d > step.r) return false;
    const m = this.current();
    if (m.onCollectWanted) world.police.addWanted(m.onCollectWanted);
    if (m.onRobWanted) world.police.setWanted(m.onRobWanted);
    world.audio.pickup();
    this._advance(world);
    return true;
  }

  onAttackerKilled(world) {
    const step = this.currentStep();
    if (!step || step.kind !== 'eliminate') return;
    this.kills += 1;
    if (this.kills >= step.count) this._advance(world);
  }

  update(dt, world) {
    if (this.done) return;
    const step = this.currentStep();
    if (!step) return;
    if (step.kind === 'goto') {
      const d = Math.hypot(world.player.x - step.x, world.player.y - step.y);
      if (d <= step.r) this._advance(world);
      return;
    }
    if (step.kind === 'eliminate' && !this.attackersSpawned) {
      this.attackersSpawned = true;
      world.spawnAttackers(step.spawn.x, step.spawn.y, step.count);
    }
  }

  _advance(world) {
    const m = this.current();
    this.step += 1;
    if (this.step >= m.steps.length) {
      // Mission complete: pay out, then move to the next mission.
      world.player.money += m.reward;
      if (m.ammoBonus) world.player.ammo += m.ammoBonus;
      world.floatText(world.player.x, world.player.y - 30, `+$${m.reward.toLocaleString('en-US')}`, '#e8c85a');
      world.audio.missionDone();
      world.events.push('mission-complete');
      this.index += 1;
      this.step = 0;
      this.kills = 0;
      this.attackersSpawned = false;
      if (this.done) {
        world.events.push('win');
      } else {
        this.beginMission(world);
      }
    } else {
      world.events.push('objective');
      world.audio.pickup();
    }
  }

  reset() {
    this.index = 0;
    this.step = 0;
    this.kills = 0;
    this.attackersSpawned = false;
    this.started = false;
  }
}
