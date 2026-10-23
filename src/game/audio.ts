import type { Point } from '@logs/shared';

/** Every sound in the game is synthesized here with Web Audio: no recorded assets. Browsers only
 * allow audio after a user gesture, so the context is created lazily by `unlock()`. */
export type Mix = {
  volume: number;
  music: number;
  effects: number;
  ambience: number;
  muted: boolean;
};
export type Sfx =
  | 'chop'
  | 'mine'
  | 'rustle'
  | 'step'
  | 'hit'
  | 'hurt'
  | 'goblin'
  | 'arrow'
  | 'heal'
  | 'coin'
  | 'reward'
  | 'level'
  | 'quest'
  | 'anvil'
  | 'build'
  | 'death'
  | 'error'
  | 'click'
  | 'chat';
export type Surroundings = { darkness: number; water: number; fire: number; forest: number };
type Voice = {
  gain?: number;
  attack?: number;
  type?: OscillatorType;
  to?: number;
  out?: AudioNode;
};
type Noise = {
  gain?: number;
  attack?: number;
  filter?: BiquadFilterType;
  freq?: number;
  q?: number;
  to?: number;
  out?: AudioNode;
};

const HEARING = 13;
/** Major pentatonic by day, minor by night; chords are scale degrees in semitones from the key. */
const MODES = {
  day: {
    key: 261.63,
    bpm: 76,
    scale: [0, 2, 4, 7, 9],
    chords: [
      [0, 4, 7],
      [9, 12, 16],
      [5, 9, 12],
      [7, 11, 14],
    ],
  },
  night: {
    key: 220,
    bpm: 62,
    scale: [0, 3, 5, 7, 10],
    chords: [
      [0, 3, 7],
      [5, 8, 12],
      [8, 12, 15],
      [7, 10, 14],
    ],
  },
};
const hz = (key: number, semitones: number) => key * 2 ** (semitones / 12);

class SoundEngine {
  private ctx?: AudioContext;
  private master!: GainNode;
  private buses!: Record<'music' | 'effects' | 'ambience', GainNode>;
  private echo!: DelayNode;
  private noiseBuffer!: AudioBuffer;
  private wind?: GainNode;
  private water?: GainNode;
  private mix: Mix = { volume: 70, music: 45, effects: 80, ambience: 60, muted: false };
  private listener: Point | null = null;
  private recent = new Map<Sfx, number>();
  private bar = 0;
  private nextBar = 0;
  private scheduler?: number;
  private surroundings: Surroundings = { darkness: 0, water: 0, fire: 0, forest: 0 };

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = (this.ctx = new AudioCtor());
    this.master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    this.master.connect(limiter).connect(ctx.destination);
    this.buses = { music: ctx.createGain(), effects: ctx.createGain(), ambience: ctx.createGain() };
    for (const bus of Object.values(this.buses)) bus.connect(this.master);
    // A soft feedback echo gives melodies and chimes a sense of open air.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.36;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.echo.connect(feedback).connect(this.echo);
    this.echo.connect(wet).connect(this.buses.music);
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.wind = this.loop(380, 'lowpass', 0.7);
    this.water = this.loop(1100, 'bandpass', 0.6);
    this.applyMix();
    this.nextBar = ctx.currentTime + 0.5;
    this.scheduler = window.setInterval(() => this.compose(), 200);
  }
  setMix(mix: Mix) {
    this.mix = mix;
    this.applyMix();
  }
  private applyMix() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const level = (v: number) => (v / 100) ** 1.6;
    this.master.gain.setTargetAtTime(this.mix.muted ? 0 : level(this.mix.volume), now, 0.05);
    this.buses.music.gain.setTargetAtTime(level(this.mix.music) * 0.5, now, 0.1);
    this.buses.effects.gain.setTargetAtTime(level(this.mix.effects), now, 0.05);
    this.buses.ambience.gain.setTargetAtTime(level(this.mix.ambience) * 0.8, now, 0.1);
  }
  /** Positional sounds are heard relative to the local character. */
  listen(p: Point | null) {
    this.listener = p;
  }
  play(name: Sfx, at?: Point) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.mix.muted) return;
    const now = ctx.currentTime;
    // The same sound fired in the same instant (several hits in one snapshot) plays once.
    if (now - (this.recent.get(name) ?? -1) < 0.045) return;
    this.recent.set(name, now);
    const out = ctx.createGain();
    const pan = ctx.createStereoPanner();
    if (at && this.listener) {
      const dx = at.x - this.listener.x,
        dy = at.y - this.listener.y;
      const d = Math.hypot(dx, dy);
      if (d > HEARING) return;
      out.gain.value = (1 - d / HEARING) ** 1.5;
      // Screen x in isometric view grows with x and shrinks with y.
      pan.pan.value = Math.max(-0.8, Math.min(0.8, (dx - dy) / 10));
    }
    out.connect(pan).connect(this.buses.effects);
    this.effect(name, now, out);
    window.setTimeout(() => out.disconnect(), 4000);
  }
  /** Called every frame by the scene: blends ambience with the hour and the surroundings. */
  ambient(s: Surroundings, delta: number) {
    this.surroundings = s;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime,
      day = 1 - s.darkness,
      dt = delta / 1000;
    this.wind?.gain.setTargetAtTime(0.05 + 0.05 * day + Math.sin(now / 5) * 0.02, now, 0.8);
    this.water?.gain.setTargetAtTime(0.11 * s.water, now, 0.5);
    if (Math.random() < dt * 0.9 * day * (0.3 + s.forest)) this.chirp(now);
    if (Math.random() < dt * 1.6 * s.darkness) this.crickets(now);
    if (Math.random() < dt * 9 * s.fire) this.crackle(now, s.fire);
    if (Math.random() < dt * 0.05 * s.darkness * s.forest) this.owl(now);
  }

  private loop(freq: number, type: BiquadFilterType, q: number) {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(this.buses.ambience);
    source.start();
    return gain;
  }
  private envelope(gain: GainNode, t: number, dur: number, peak: number, attack: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  private tone(freq: number, t: number, dur: number, o: Voice = {}) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const gain = ctx.createGain();
    this.envelope(gain, t, dur, o.gain ?? 0.3, o.attack ?? 0.005);
    osc.connect(gain).connect(o.out ?? this.buses.effects);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  private noise(t: number, dur: number, o: Noise = {}) {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter ?? 'bandpass';
    filter.frequency.setValueAtTime(o.freq ?? 1000, t);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    filter.Q.value = o.q ?? 1;
    const gain = ctx.createGain();
    this.envelope(gain, t, dur, o.gain ?? 0.3, o.attack ?? 0.003);
    source
      .connect(filter)
      .connect(gain)
      .connect(o.out ?? this.buses.effects);
    source.start(t, Math.random() * 1.5);
    source.stop(t + dur + 0.05);
  }
  private effect(name: Sfx, t: number, out: AudioNode) {
    const r = 0.92 + Math.random() * 0.16;
    switch (name) {
      case 'chop':
        this.noise(t, 0.12, { freq: 900 * r, q: 2, gain: 0.5, out });
        this.tone(140 * r, t, 0.14, { gain: 0.45, to: 70, out });
        break;
      case 'mine':
        this.tone(1900 * r, t, 0.18, { type: 'triangle', gain: 0.22, out });
        this.tone(2870 * r, t, 0.12, { type: 'triangle', gain: 0.12, out });
        this.noise(t, 0.06, { filter: 'highpass', freq: 3000, gain: 0.3, out });
        break;
      case 'rustle':
        this.noise(t, 0.22, { filter: 'highpass', freq: 2400 * r, gain: 0.18, attack: 0.04, out });
        this.tone(620 * r, t + 0.05, 0.08, { gain: 0.08, to: 900, out });
        break;
      case 'step':
        this.noise(t, 0.07, { filter: 'lowpass', freq: 500 * r, gain: 0.12, out });
        break;
      case 'hit':
        this.noise(t, 0.12, { freq: 600, to: 2400, q: 0.8, gain: 0.25, attack: 0.02, out });
        this.tone(110 * r, t + 0.06, 0.16, { gain: 0.5, to: 55, out });
        this.noise(t + 0.06, 0.08, { freq: 1800, gain: 0.25, out });
        break;
      case 'hurt':
        this.tone(320 * r, t, 0.22, { type: 'square', gain: 0.08, to: 140, out });
        this.tone(90, t, 0.2, { gain: 0.45, to: 45, out });
        break;
      case 'goblin':
        this.tone(900 * r, t, 0.35, { type: 'sawtooth', gain: 0.07, to: 180, out });
        this.tone(1200 * r, t + 0.05, 0.25, { type: 'square', gain: 0.04, to: 300, out });
        break;
      case 'arrow':
        this.noise(t, 0.25, { freq: 3000, to: 900, q: 3, gain: 0.18, out });
        break;
      case 'heal':
        [784, 988, 1175].forEach((f, i) => this.tone(f, t + i * 0.07, 0.4, { gain: 0.1, out }));
        break;
      case 'coin':
        this.tone(988, t, 0.09, { type: 'square', gain: 0.06, out });
        this.tone(1319, t + 0.08, 0.3, { type: 'square', gain: 0.06, out });
        break;
      case 'reward':
        this.tone(1047, t, 0.25, { type: 'triangle', gain: 0.12, out });
        this.tone(1568, t + 0.09, 0.35, { type: 'triangle', gain: 0.1, out });
        break;
      case 'level':
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          this.tone(f, t + i * 0.09, 0.6, { type: 'triangle', gain: 0.16, out }),
        );
        this.tone(1047, t + 0.45, 1.2, { gain: 0.1, out: this.echo });
        break;
      case 'quest':
        [392, 523, 659, 784].forEach((f, i) =>
          this.tone(f, t + i * 0.11, i === 3 ? 0.9 : 0.25, { type: 'triangle', gain: 0.15, out }),
        );
        break;
      case 'anvil':
        [0, 0.28, 0.56].forEach((d) => {
          this.tone(1450 * r, t + d, 0.6, { type: 'triangle', gain: 0.2, out });
          this.tone(2310 * r, t + d, 0.4, { type: 'sine', gain: 0.1, out });
        });
        break;
      case 'build':
        [0, 0.18, 0.36, 0.62].forEach((d) => {
          this.tone(170 * r, t + d, 0.12, { gain: 0.45, to: 90, out });
          this.noise(t + d, 0.06, { freq: 1200, gain: 0.25, out });
        });
        break;
      case 'death':
        [392, 330, 262, 196].forEach((f, i) =>
          this.tone(f, t + i * 0.16, 0.5, { type: 'triangle', gain: 0.14, out }),
        );
        break;
      case 'error':
        this.tone(180, t, 0.16, { type: 'square', gain: 0.05, out });
        break;
      case 'click':
        this.tone(1500, t, 0.03, { type: 'triangle', gain: 0.07, out });
        break;
      case 'chat':
        this.tone(880, t, 0.12, { gain: 0.1, out });
        this.tone(1320, t + 0.07, 0.18, { gain: 0.08, out });
        break;
    }
  }
  private chirp(t: number) {
    const base = 2600 + Math.random() * 1600,
      notes = 2 + Math.floor(Math.random() * 4);
    const pan = this.ctx!.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.buses.ambience);
    for (let i = 0; i < notes; i++)
      this.tone(base * (1 + Math.random() * 0.25), t + i * 0.11, 0.08, {
        gain: 0.035,
        to: base * 1.4,
        out: pan,
      });
  }
  private crickets(t: number) {
    const f = 4300 + Math.random() * 500;
    for (let i = 0; i < 4; i++)
      this.tone(f, t + i * 0.05, 0.03, {
        gain: 0.012 + this.surroundings.darkness * 0.01,
        out: this.buses.ambience,
      });
  }
  private crackle(t: number, near: number) {
    this.noise(t, 0.03, {
      filter: 'highpass',
      freq: 1800 + Math.random() * 3000,
      gain: 0.08 * near,
      out: this.buses.ambience,
    });
  }
  private owl(t: number) {
    this.tone(420, t, 0.35, { gain: 0.04, to: 390, attack: 0.08, out: this.buses.ambience });
    this.tone(400, t + 0.45, 0.5, { gain: 0.035, to: 360, attack: 0.1, out: this.buses.ambience });
  }
  /** Lookahead scheduler for the generative soundtrack, one bar at a time. */
  private compose() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    while (this.nextBar < ctx.currentTime + 0.6) {
      const mode = this.surroundings.darkness > 0.5 ? MODES.night : MODES.day;
      const beat = 60 / mode.bpm,
        t = this.nextBar,
        chord = mode.chords[this.bar % 4];
      const music = this.buses.music;
      for (const n of chord) {
        // Pads: two detuned triangles under a lowpass, swelling across the bar.
        for (const detune of [-4, 4]) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = hz(mode.key / 2, n);
          osc.detune.value = detune;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 900;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.035, t + beat * 1.5);
          gain.gain.linearRampToValueAtTime(0.0001, t + beat * 4.4);
          osc.connect(filter).connect(gain).connect(music);
          osc.start(t);
          osc.stop(t + beat * 4.5);
        }
      }
      this.tone(hz(mode.key / 4, chord[0]), t, beat * 1.8, {
        gain: 0.12,
        attack: 0.05,
        out: music,
      });
      this.tone(hz(mode.key / 4, chord[0]), t + beat * 2, beat * 1.8, {
        gain: 0.09,
        attack: 0.05,
        out: music,
      });
      // Melody: sparse plucks from the pentatonic scale, echoed.
      for (let i = 0; i < 8; i++) {
        if (Math.random() > (mode === MODES.day ? 0.42 : 0.3)) continue;
        const degree =
          mode.scale[Math.floor(Math.random() * mode.scale.length)] +
          (Math.random() < 0.3 ? 12 : 0);
        const when = t + (i * beat) / 2;
        this.tone(hz(mode.key, degree), when, beat * 1.4, {
          type: 'triangle',
          gain: 0.06,
          attack: 0.01,
          out: music,
        });
        this.tone(hz(mode.key, degree), when, beat * 1.4, { gain: 0.03, out: this.echo });
      }
      this.nextBar += beat * 4;
      this.bar++;
    }
  }
}
export const sound = new SoundEngine();
