/**
 * All sounds are synthesized with the Web Audio API — no asset files, so
 * nothing can 404. The context is created lazily on the first user gesture.
 */

const STORAGE_KEY = 'hardwood-heat:audio';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private crowdLevel = 0.0;
  private crowdTarget = 0.12;
  muted = false;
  volume = 0.8;
  private lastPlay = new Map<string, number>();

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw) as { muted?: boolean; volume?: number };
        this.muted = !!v.muted;
        if (typeof v.volume === 'number') this.volume = v.volume;
      }
    } catch { /* storage unavailable */ }
  }

  /** Must be called from a user gesture handler. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);
    this.applyVolume();
    // shared noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startCrowd();
  }

  private persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: this.muted, volume: this.volume })); } catch { /* ignore */ }
  }

  private applyVolume() {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
  }

  setMuted(m: boolean) { this.muted = m; this.applyVolume(); this.persist(); }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  setVolume(v: number) { this.volume = v; this.applyVolume(); this.persist(); }

  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    if ((this.lastPlay.get(key) ?? 0) + ms > now) return false;
    this.lastPlay.set(key, now);
    return true;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noiseSrc(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }

  // ------------------------------------------------------------------ crowd

  private startCrowd() {
    const ctx = this.ctx; const src = this.noiseSrc();
    if (!ctx || !src || !this.master) return;
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 700;
    this.crowdFilter.Q.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    // slow murmur modulation
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.31;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(this.crowdGain.gain);
    src.connect(this.crowdFilter).connect(lp).connect(this.crowdGain).connect(this.master);
    src.start();
    lfo.start();
  }

  /** Called every frame. */
  update(dt: number) {
    if (!this.ctx || !this.crowdGain || !this.crowdFilter) return;
    this.crowdTarget = Math.max(0.1, this.crowdTarget - dt * 0.12);
    this.crowdLevel += (this.crowdTarget - this.crowdLevel) * Math.min(1, dt * 3);
    this.crowdGain.gain.setTargetAtTime(this.crowdLevel * 0.5, this.ctx.currentTime, 0.1);
    this.crowdFilter.frequency.setTargetAtTime(600 + this.crowdLevel * 900, this.ctx.currentTime, 0.2);
  }

  crowdRoar(amount: number) {
    this.crowdTarget = Math.min(0.75, this.crowdTarget + amount);
  }

  setCrowdBase(level: number) { this.crowdTarget = level; }

  // ------------------------------------------------------------------ effects

  bounce(strength = 1) {
    const ctx = this.ctx; if (!ctx || !this.sfx || !this.throttle('bounce', 45)) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = ctx.createGain();
    this.env(g, t, 0.5 * strength, 0.004, 0.14);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.2);
    // slap of the ball on hardwood
    const n = this.noiseSrc(); if (!n) return;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.5;
    const ng = ctx.createGain();
    this.env(ng, t, 0.22 * strength, 0.002, 0.05);
    n.connect(f).connect(ng).connect(this.sfx);
    n.start(t, Math.random()); n.stop(t + 0.08);
  }

  squeak() {
    const ctx = this.ctx; if (!ctx || !this.sfx || !this.throttle('squeak', 160)) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = 1800 + Math.random() * 900;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 1.35, t + 0.05);
    o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.11);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = base * 1.1; f.Q.value = 8;
    const g = ctx.createGain();
    this.env(g, t, 0.06, 0.01, 0.1);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.14);
  }

  whoosh(power = 1) {
    const ctx = this.ctx; const n = this.noiseSrc(); if (!ctx || !n || !this.sfx) return;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
    const g = ctx.createGain();
    this.env(g, t, 0.18 * power, 0.06, 0.25);
    n.connect(f).connect(g).connect(this.sfx);
    n.start(t, Math.random()); n.stop(t + 0.4);
  }

  swish() {
    const ctx = this.ctx; const n = this.noiseSrc(); if (!ctx || !n || !this.sfx) return;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 5200; f2.gain.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    n.connect(f).connect(f2).connect(g).connect(this.sfx);
    n.start(t, Math.random()); n.stop(t + 0.42);
  }

  rim(strength = 1) {
    const ctx = this.ctx; if (!ctx || !this.sfx || !this.throttle('rim', 70)) return;
    const t = ctx.currentTime;
    // metallic: inharmonic partials with fast decay
    for (const [freq, amp] of [[520, 0.22], [1310, 0.14], [2270, 0.09], [3480, 0.05]] as const) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq * (0.98 + Math.random() * 0.04);
      const g = ctx.createGain();
      this.env(g, t, amp * strength, 0.002, 0.3 + (freq < 1000 ? 0.25 : 0));
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + 0.7);
    }
    const n = this.noiseSrc(); if (!n) return;
    const ng = ctx.createGain();
    this.env(ng, t, 0.2 * strength, 0.001, 0.04);
    n.connect(ng).connect(this.sfx);
    n.start(t, Math.random()); n.stop(t + 0.06);
  }

  board() {
    const ctx = this.ctx; if (!ctx || !this.sfx || !this.throttle('board', 80)) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    this.env(g, t, 0.3, 0.002, 0.12);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.2);
  }

  dunk() {
    this.rim(1.6);
    const ctx = this.ctx; if (!ctx || !this.sfx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const g = ctx.createGain();
    this.env(g, t, 0.6, 0.005, 0.35);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.4);
  }

  whistle() {
    const ctx = this.ctx; if (!ctx || !this.sfx || !this.throttle('whistle', 300)) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 2950;
    const trem = ctx.createOscillator();
    trem.frequency.value = 32;
    const tg = ctx.createGain(); tg.gain.value = 120;
    trem.connect(tg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
    g.gain.setValueAtTime(0.13, t + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    o.connect(g).connect(this.sfx);
    o.start(t); trem.start(t); o.stop(t + 0.4); trem.stop(t + 0.4);
  }

  buzzer() {
    const ctx = this.ctx; if (!ctx || !this.sfx || !this.throttle('buzzer', 600)) return;
    const t = ctx.currentTime;
    for (const freq of [220, 223, 330]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      g.gain.setValueAtTime(0.08, t + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
      o.connect(f).connect(g).connect(this.sfx);
      o.start(t); o.stop(t + 1.2);
    }
  }

  steal() {
    const ctx = this.ctx; if (!ctx || !this.sfx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
    const g = ctx.createGain();
    this.env(g, t, 0.12, 0.005, 0.15);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.2);
  }

  ui(kind: 'move' | 'select' | 'back' = 'move') {
    const ctx = this.ctx; if (!ctx || !this.sfx || !this.throttle('ui' + kind, 40)) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    const f0 = kind === 'select' ? 660 : kind === 'back' ? 330 : 520;
    o.frequency.setValueAtTime(f0, t);
    if (kind === 'select') o.frequency.setValueAtTime(990, t + 0.05);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    const g = ctx.createGain();
    this.env(g, t, 0.05, 0.003, kind === 'select' ? 0.14 : 0.06);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.2);
  }

  /** Short rising sting for perfect releases. */
  perfect() {
    const ctx = this.ctx; if (!ctx || !this.sfx) return;
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      this.env(g, t + i * 0.06, 0.07, 0.005, 0.18);
      o.connect(g).connect(this.sfx!);
      o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.3);
    });
  }
}

export const Sound = new AudioManagerImpl();
