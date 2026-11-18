// SOLMARA — Streets of the Sun. Keyboard + mouse input.
//
// The split that matters: UI actions and gameplay actions read DISJOINT key
// sets, and each set is consumed by its own method. The UI layer only ever
// looks at Enter / Escape / P / M / C / Q, so gameplay keys (E, F, Space,
// WASD) can never be eaten by a menu while the player is on foot or driving.
const UI_KEYS = new Set(['Enter', 'Escape', 'KeyP', 'KeyM', 'KeyC', 'KeyQ']);
const PLAYER_EDGE_KEYS = new Set(['KeyE', 'KeyF', 'Space']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set(); // currently held, by e.code
    this.pressed = new Set(); // edge presses since last endFrame, by e.code
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._onKeyDown = (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    };
    this._onKeyUp = (e) => this.held.delete(e.code);
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    this._onMouseUp = () => {
      this.mouse.down = false;
    };
    this._onBlur = () => {
      this.held.clear();
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
  }

  // UI-only actions. Consumes ONLY UI keys; gameplay keys are untouched.
  takeUiActions() {
    const p = this.pressed;
    const actions = {
      confirm: p.has('Enter') || this.mouse.clicked,
      back: p.has('Escape'),
      pause: p.has('KeyP') || p.has('Escape'),
      mute: p.has('KeyM'),
      continueGame: p.has('KeyC'),
      quit: p.has('KeyQ'),
    };
    for (const k of UI_KEYS) p.delete(k);
    this.mouse.clicked = false;
    return actions;
  }

  // Gameplay actions. Consumes ONLY gameplay edge keys; UI keys untouched.
  // mx/my: -1..1 movement vector (WASD or arrows). aim: mouse position in
  // screen space; the caller converts it to world space with the camera.
  takePlayerActions() {
    const h = this.held;
    let mx = 0;
    let my = 0;
    if (h.has('KeyA') || h.has('ArrowLeft')) mx -= 1;
    if (h.has('KeyD') || h.has('ArrowRight')) mx += 1;
    if (h.has('KeyW') || h.has('ArrowUp')) my -= 1;
    if (h.has('KeyS') || h.has('ArrowDown')) my += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const actions = {
      mx,
      my,
      run: h.has('ShiftLeft') || h.has('ShiftRight'),
      enter: this.pressed.has('KeyE'),
      punch: this.pressed.has('KeyF'),
      shoot: this.pressed.has('Space') || this.mouse.down,
      honk: this.pressed.has('KeyH'),
      aim: { x: this.mouse.x, y: this.mouse.y },
    };
    for (const k of PLAYER_EDGE_KEYS) this.pressed.delete(k);
    return actions;
  }

  // Clear any leftover edge presses at the end of the frame.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
