// All sound is synthesised with WebAudio, so the game ships with no audio files.

export type Sfx =
  | 'move'
  | 'rotate'
  | 'land'
  | 'pop'
  | 'garbageSend'
  | 'garbageDrop'
  | 'lose'
  | 'win'
  | 'menu'
  | 'select'
  | 'ready'
  | 'go'
  | 'levelUp'
  | 'allClear';

export type Track = 'title' | 'battle' | 'danger' | 'boss' | 'story' | null;

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midi(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) return 0;
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const freq = (n: number): number => 440 * 2 ** ((n - 69) / 12);

function seq(s: string): (number | null)[] {
  return s
    .trim()
    .split(/\s+/)
    .filter((t) => t !== '|')
    .map((t) => (t === '.' ? null : midi(t)));
}

interface Song {
  bpm: number;
  lead: (number | null)[];
  bass: (number | null)[];
  drums: boolean;
}

const SONGS: Record<Exclude<Track, null>, Song> = {
  title: {
    bpm: 132,
    lead: seq(`C5 . E5 G5 . E5 C5 . | D5 . F5 A5 . F5 D5 . | E5 . G5 C6 . G5 E5 . | D5 F5 E5 D5 C5 . G4 .
               C5 . E5 G5 . E5 C5 . | D5 . F5 A5 . A5 B5 . | C6 . G5 E5 . D5 E5 . | C5 . . . C5 . . .`),
    bass: seq(`C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | G2 . D3 . G2 . B2 .
               C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | C3 . G3 . G2 . G2 . | C3 . G2 . C3 . . .`),
    drums: true,
  },
  battle: {
    bpm: 150,
    lead: seq(`A4 . C5 E5 D5 C5 B4 . | G4 . B4 D5 C5 B4 A4 . | F4 . A4 C5 B4 A4 G4 . | E4 F4 G4 A4 B4 . E5 .
               A4 . C5 E5 D5 C5 B4 . | G4 . B4 D5 C5 B4 A4 . | F4 . A4 C5 D5 E5 F5 . | E5 . D5 B4 A4 . . .`),
    bass: seq(`A2 A2 A3 A2 A2 A2 A3 A2 | G2 G2 G3 G2 G2 G2 G3 G2 | F2 F2 F3 F2 F2 F2 F3 F2 | E2 E2 E3 E2 E2 E2 G#2 E2
               A2 A2 A3 A2 A2 A2 A3 A2 | G2 G2 G3 G2 G2 G2 G3 G2 | F2 F2 F3 F2 F2 F2 F3 F2 | E2 E2 E3 E2 A2 . A2 .`),
    drums: true,
  },
  danger: {
    bpm: 184,
    lead: seq(`E5 . E5 F5 E5 . D5 . | E5 . E5 F5 E5 . G5 . | F5 . F5 G5 F5 . E5 . | D5 . E5 F5 G#5 . B5 .`),
    bass: seq(`A2 A3 A2 A3 A2 A3 A2 A3 | A2 A3 A2 A3 A2 A3 A2 A3 | D3 D4 D3 D4 D3 D4 D3 D4 | E3 E4 E3 E4 E3 E4 E3 E4`),
    drums: true,
  },
  boss: {
    bpm: 140,
    lead: seq(`D5 . . A4 D5 . F5 E5 | D5 . C5 . A4 . . . | Bb4 . . F4 Bb4 . D5 C5 | Bb4 . A4 . G4 . . .
               D5 . . A4 D5 . F5 G5 | A5 . G5 . F5 . E5 . | F5 . E5 . D5 . C#5 . | D5 . . . A4 . . .`),
    bass: seq(`D2 . D3 . D2 . D3 . | D2 . D3 . C3 . C2 . | Bb1 . Bb2 . Bb1 . Bb2 . | G1 . G2 . A1 . A2 .
               D2 . D3 . D2 . D3 . | F2 . F3 . C3 . C2 . | Bb1 . Bb2 . A1 . A2 . | D2 . A1 . D2 . . .`),
    drums: true,
  },
  story: {
    bpm: 96,
    lead: seq(`E5 . G5 . A5 . G5 E5 | D5 . E5 . C5 . . . | E5 . G5 . A5 . C6 B5 | A5 . G5 . E5 . . .`),
    bass: seq(`C3 . . . G2 . . . | F2 . . . C3 . . . | A2 . . . E2 . . . | F2 . . . G2 . . .`),
    drums: false,
  },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private track: Track = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private sfxVol = 0.8;
  private musicVol = 0.5;

  /** Must run inside a user gesture the first time. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.track) this.startScheduler();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = sfx;
    this.musicVol = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.sfxBus || !this.musicBus) return;
    this.sfxBus.gain.value = this.sfxVol * 0.9;
    this.musicBus.gain.value = this.musicVol * 0.55;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    start: number,
    dur: number,
    vol: number,
    bus: GainNode,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(bus);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  private hiss(start: number, dur: number, vol: number, bus: GainNode, cutoff: number, high = false): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = high ? 'highpass' : 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(start, Math.random() * 0.5, dur + 0.05);
  }

  sfx(name: Sfx, arg = 1): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const bus = this.sfxBus;
    switch (name) {
      case 'move':
        this.tone('square', 520, 520, t, 0.03, 0.05, bus);
        break;
      case 'rotate':
        this.tone('square', 700, 1100, t, 0.05, 0.05, bus);
        break;
      case 'land':
        this.tone('triangle', 180, 70, t, 0.08, 0.25, bus);
        break;
      case 'pop': {
        const base = 392 * 2 ** ((Math.min(arg, 12) - 1) / 6);
        [0, 4, 7, 12].forEach((s, i) => this.tone('square', base * 2 ** (s / 12), base * 2 ** (s / 12), t + i * 0.045, 0.09, 0.07, bus));
        this.hiss(t, 0.12, 0.12, bus, 3000, true);
        break;
      }
      case 'garbageSend':
        this.tone('sawtooth', 300, 1200, t, 0.25, 0.06, bus);
        break;
      case 'garbageDrop':
        this.hiss(t, 0.35, 0.35, bus, 400);
        this.tone('triangle', 90, 40, t, 0.3, 0.3, bus);
        break;
      case 'lose':
        this.tone('square', 600, 80, t, 1.1, 0.08, bus);
        this.tone('square', 450, 60, t + 0.15, 1.0, 0.05, bus);
        break;
      case 'win':
        [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone('square', freq(n), freq(n), t + i * 0.08, 0.2, 0.07, bus));
        break;
      case 'menu':
        this.tone('square', 980, 980, t, 0.03, 0.04, bus);
        break;
      case 'select':
        this.tone('square', 660, 660, t, 0.06, 0.05, bus);
        this.tone('square', 1320, 1320, t + 0.06, 0.1, 0.05, bus);
        break;
      case 'ready':
        this.tone('square', 523, 523, t, 0.15, 0.06, bus);
        break;
      case 'go':
        this.tone('square', 1046, 1046, t, 0.3, 0.07, bus);
        break;
      case 'levelUp':
        this.tone('triangle', 400, 1600, t, 0.3, 0.12, bus);
        break;
      case 'allClear':
        [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => this.tone('triangle', freq(n), freq(n), t + i * 0.05, 0.25, 0.12, bus));
        break;
    }
  }

  music(track: Track): void {
    if (track === this.track) return;
    this.track = track;
    this.step = 0;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (track && this.ctx) this.startScheduler();
  }

  private startScheduler(): void {
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    if (!this.ctx || !this.track || !this.musicBus) return;
    const song = SONGS[this.track];
    const stepDur = 60 / song.bpm / 2;
    // Never try to catch up more than a moment after the tab sleeps.
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.step % song.lead.length;
      const lead = song.lead[i];
      const bass = song.bass[this.step % song.bass.length];
      if (lead) this.tone('square', freq(lead), freq(lead), this.nextTime, stepDur * 0.9, 0.05, this.musicBus);
      if (bass) this.tone('triangle', freq(bass), freq(bass), this.nextTime, stepDur * 0.85, 0.13, this.musicBus);
      if (song.drums) {
        if (this.step % 4 === 0) this.tone('sine', 140, 40, this.nextTime, 0.12, 0.3, this.musicBus);
        if (this.step % 8 === 4) this.hiss(this.nextTime, 0.1, 0.12, this.musicBus, 1800);
        if (this.step % 2 === 1) this.hiss(this.nextTime, 0.03, 0.04, this.musicBus, 7000, true);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
