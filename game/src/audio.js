// SOLMARA — Streets of the Sun. Synthesised sound: WebAudio only, no files,
// no network. Everything is an oscillator or a filtered noise burst.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineOn = false;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.sirenPhase = 0;
    this.sirenTimer = 0;
  }

  // Must be called from a user gesture at least once; safe to call often.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // audio is garnish; never break the game
    }
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch {
      // audio is garnish; never break the game
    }
  }

  click() {
    this._tone(880, 0.06, 'square', 0.12);
  }
  pickup() {
    this._tone(660, 0.09, 'sine', 0.2);
    setTimeout(() => this._tone(990, 0.12, 'sine', 0.2), 90);
  }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'triangle', 0.22), i * 110));
  }
  punch() {
    this._tone(160, 0.12, 'sine', 0.35, 65);
    this._noise(0.08, 0.2, 900);
  }
  shot() {
    this._noise(0.14, 0.5, 2600);
    this._tone(220, 0.08, 'square', 0.2, 60);
  }
  honk() {
    this._tone(370, 0.22, 'square', 0.16);
    this._tone(466, 0.22, 'square', 0.12);
  }
  steal() {
    this._tone(300, 0.1, 'sawtooth', 0.18, 520);
  }
  busted() {
    [392, 311, 233].forEach((f, i) => setTimeout(() => this._tone(f, 0.25, 'sawtooth', 0.2), i * 160));
  }

  // Continuous engine hum; call every frame with speed 0..1 (0 = off).
  engine(speed01) {
    if (!this.ctx || this.muted) {
      this._stopEngine();
      return;
    }
    try {
      if (!this.engineOn) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        this.engineOsc.type = 'sawtooth';
        this.engineOsc2.type = 'square';
        this.engineOsc.frequency.value = 70;
        this.engineOsc2.frequency.value = 35;
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(filter);
        this.engineOsc2.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        this.engineOsc2.start();
        this.engineOn = true;
      }
      const target = speed01 <= 0.02 ? 0 : 0.05 + speed01 * 0.09;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(60 + speed01 * 160, this.ctx.currentTime, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(30 + speed01 * 80, this.ctx.currentTime, 0.08);
    } catch {
      this._stopEngine();
    }
  }

  _stopEngine() {
    if (!this.engineOn) return;
    try {
      this.engineOsc.stop();
      this.engineOsc2.stop();
    } catch {
      // already stopped
    }
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineOn = false;
  }

  // Two-tone police siren; call every frame with on/off.
  siren(on, dt) {
    if (!this.ctx || this.muted || !on) {
      if (this.sirenOn) {
        try {
          this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        } catch {
          // ignore
        }
        this.sirenOn = false;
      }
      return;
    }
    try {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.42) {
        this.sirenTimer = 0;
        this.sirenPhase = 1 - this.sirenPhase;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenPhase ? 950 : 700, this.ctx.currentTime, 0.03);
      }
      this.sirenOn = true;
    } catch {
      this.sirenOsc = null;
      this.sirenOn = false;
    }
  }
}
