// SOLMARA — Streets of the Sun. Save / load through localStorage.
// A save holds the story progress and Dario's state, nothing else.
const KEY = 'solmara-save-v1';

export function saveGame(world) {
  try {
    const p = world.player;
    const data = {
      version: 1,
      mission: world.missions.index,
      money: p.money,
      health: p.health,
      ammo: p.ammo,
      x: p.x,
      y: p.y,
      wanted: world.police.wanted,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable; nothing to clear
  }
}

export function hasSave() {
  return loadSave() !== null;
}
