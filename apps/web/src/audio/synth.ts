// Sound building blocks in the spirit of the Mega Drive: two-operator FM voices (the
// YM2612's character), pulse waves for the PSG, noise drums, and a little formant
// "voice" for chain shouts. Everything is synthesised; no samples.

export interface FmPatch {
  /** Modulator frequency as a multiple of the note. */
  ratio: number;
  /** Modulation depth at the start and end of the note, as multiples of the note frequency. */
  index: number;
  indexEnd: number;
  indexTime: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  vibrato?: number;
  vibratoDelay?: number;
  wave?: OscillatorType;
  /** Second carrier detuned by this many cents for width. */
  chorus?: number;
}

export interface PulsePatch {
  duty: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  vibrato?: number;
}

export type Patch = { kind: 'fm'; p: FmPatch } | { kind: 'pulse'; p: PulsePatch } | { kind: 'tri'; p: PulsePatch };

export const midiToHz = (n: number): number => 440 * 2 ** ((n - 69) / 12);

const VOWELS: Record<string, [number, number, number]> = {
  a: [800, 1150, 2900],
  e: [400, 2000, 2550],
  i: [300, 2300, 3000],
  o: [450, 800, 2830],
  u: [325, 700, 2530],
};

export interface VoiceSpec {
  /** Sequence of vowels with relative durations, e.g. [['o', 1], ['a', 2]]. */
  vowels: [string, number][];
  breath?: number;
  pitch: number;
  /** Pitch change over the shout, in semitones. */
  glide: number;
  dur: number;
  vol: number;
  robot?: boolean;
}

export class Synth {
  readonly ctx: BaseAudioContext;
  readonly music: GainNode;
  readonly sfx: GainNode;
  /** Send for a soft echo on leads and sparkles. */
  readonly echo: GainNode;
  private readonly noise: AudioBuffer;
  private readonly pulses = new Map<number, PeriodicWave>();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    comp.connect(master).connect(ctx.destination);

    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(comp);
    this.sfx.connect(comp);

    // Echo: delay with filtered feedback.
    this.echo = ctx.createGain();
    this.echo.gain.value = 0.22;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.19;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    this.echo.connect(delay);
    delay.connect(tone).connect(fb).connect(delay);
    tone.connect(comp);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  private pulseWave(duty: number): PeriodicWave {
    let w = this.pulses.get(duty);
    if (!w) {
      const n = 48;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        real[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
        imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
      }
      w = this.ctx.createPeriodicWave(real, imag);
      this.pulses.set(duty, w);
    }
    return w;
  }

  /** ADSR on a gain param; returns when the voice can stop. */
  private envelope(g: AudioParam, t: number, dur: number, a: number, d: number, s: number, r: number, vol: number): number {
    const lo = 0.0001;
    const peak = Math.max(lo * 2, vol);
    const sus = Math.max(lo, vol * s);
    const holdEnd = t + Math.max(a + d, dur);
    g.setValueAtTime(lo, t);
    g.exponentialRampToValueAtTime(peak, t + Math.max(0.002, a));
    g.exponentialRampToValueAtTime(sus, t + a + Math.max(0.005, d));
    g.setValueAtTime(sus, holdEnd);
    g.exponentialRampToValueAtTime(lo, holdEnd + Math.max(0.01, r));
    return holdEnd + r + 0.02;
  }

  private vibrato(target: AudioParam, freq: number, t: number, depth: number, delay: number, stop: number): void {
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0, t + delay);
    g.gain.linearRampToValueAtTime(freq * depth, t + delay + 0.15);
    lfo.connect(g).connect(target);
    lfo.start(t);
    lfo.stop(stop);
  }

  play(patch: Patch, dest: AudioNode, t: number, midi: number, dur: number, vol: number, echo = false): void {
    const f = midiToHz(midi);
    if (patch.kind === 'fm') this.fm(patch.p, dest, t, f, dur, vol, echo);
    else this.pulse(patch.p, dest, t, f, dur, vol, patch.kind === 'tri', echo);
  }

  fm(p: FmPatch, dest: AudioNode, t: number, freq: number, dur: number, vol: number, echo = false): void {
    const ctx = this.ctx;
    const amp = ctx.createGain();
    const stop = this.envelope(amp.gain, t, dur, p.attack, p.decay, p.sustain, p.release, vol);
    const mod = ctx.createOscillator();
    mod.frequency.setValueAtTime(freq * p.ratio, t);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(Math.max(1, freq * p.index), t);
    depth.gain.exponentialRampToValueAtTime(Math.max(1, freq * p.indexEnd), t + p.indexTime);
    mod.connect(depth);
    const carriers = p.chorus ? [0, p.chorus] : [0];
    for (const cents of carriers) {
      const car = ctx.createOscillator();
      car.type = p.wave ?? 'sine';
      car.frequency.setValueAtTime(freq, t);
      car.detune.setValueAtTime(cents, t);
      depth.connect(car.frequency);
      if (p.vibrato) this.vibrato(car.frequency, freq, t, p.vibrato, p.vibratoDelay ?? 0.12, stop);
      car.connect(amp);
      car.start(t);
      car.stop(stop);
    }
    amp.connect(dest);
    if (echo) amp.connect(this.echo);
    mod.start(t);
    mod.stop(stop);
  }

  pulse(p: PulsePatch, dest: AudioNode, t: number, freq: number, dur: number, vol: number, triangle = false, echo = false): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    if (triangle) osc.type = 'triangle';
    else osc.setPeriodicWave(this.pulseWave(p.duty));
    osc.frequency.setValueAtTime(freq, t);
    const amp = ctx.createGain();
    const stop = this.envelope(amp.gain, t, dur, p.attack, p.decay, p.sustain, p.release, vol);
    if (p.vibrato) this.vibrato(osc.frequency, freq, t, p.vibrato, 0.15, stop);
    osc.connect(amp).connect(dest);
    if (echo) amp.connect(this.echo);
    osc.start(t);
    osc.stop(stop);
  }

  /** A one-shot tone with a pitch sweep. */
  sweep(type: OscillatorType | number, dest: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number, echo = false): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    if (typeof type === 'number') osc.setPeriodicWave(this.pulseWave(type));
    else osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(dest);
    if (echo) amp.connect(this.echo);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseHit(dest: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 0.7, freqEnd?: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.6, dur + 0.05);
  }

  kick(dest: AudioNode, t: number, vol: number): void {
    this.sweep('sine', dest, t, 160, 42, 0.22, vol);
    this.noiseHit(dest, t, 0.012, vol * 0.5, 'highpass', 1500);
  }

  snare(dest: AudioNode, t: number, vol: number): void {
    this.noiseHit(dest, t, 0.16, vol * 0.75, 'bandpass', 1900, 0.6);
    this.sweep('triangle', dest, t, 220, 160, 0.08, vol * 0.5);
  }

  hat(dest: AudioNode, t: number, vol: number, open = false): void {
    this.noiseHit(dest, t, open ? 0.22 : 0.035, vol, 'highpass', 7500);
  }

  crash(dest: AudioNode, t: number, vol: number): void {
    this.noiseHit(dest, t, 1.3, vol, 'highpass', 3800);
  }

  tom(dest: AudioNode, t: number, vol: number, f = 140): void {
    this.sweep('sine', dest, t, f, f * 0.6, 0.18, vol);
  }

  /** A short shouted syllable: buzz source through three vowel formants. */
  voice(dest: AudioNode, t: number, v: VoiceSpec): void {
    const ctx = this.ctx;
    const src = ctx.createOscillator();
    if (v.robot) src.setPeriodicWave(this.pulseWave(0.3));
    else src.type = 'sawtooth';
    src.frequency.setValueAtTime(v.pitch, t);
    src.frequency.exponentialRampToValueAtTime(v.pitch * 2 ** (v.glide / 12), t + v.dur * 0.8);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = v.robot ? 38 : 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = v.robot ? v.pitch * 0.25 : v.pitch * 0.03;
    lfo.connect(lfoGain).connect(src.frequency);

    const out = ctx.createGain();
    const total = v.vowels.reduce((a, [, w]) => a + w, 0);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(v.vol, t + 0.02);
    out.gain.setValueAtTime(v.vol, t + v.dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);

    [0, 1, 2].forEach((k) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 9 + k * 2;
      let at = t;
      v.vowels.forEach(([vowel, w], idx) => {
        const fq = VOWELS[vowel][k];
        if (idx === 0) bp.frequency.setValueAtTime(fq, at);
        else bp.frequency.linearRampToValueAtTime(fq, at + 0.04);
        at += (v.dur * w) / total;
      });
      const g = ctx.createGain();
      g.gain.value = [1.1, 0.7, 0.35][k];
      src.connect(bp).connect(g).connect(out);
    });
    out.connect(dest);
    if (v.breath) this.noiseHit(dest, t - 0.03, 0.05, v.vol * v.breath, 'bandpass', 1500, 1);
    src.start(t);
    lfo.start(t);
    src.stop(t + v.dur + 0.05);
    lfo.stop(t + v.dur + 0.05);
  }
}
