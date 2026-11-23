// Game audio: FM-style music, sound effects and chain shouts, all synthesised.
import { type CompiledSong, SONGS, type SongName, compile } from './audio/songs.ts';
import { Synth, type VoiceSpec } from './audio/synth.ts';

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
  | 'back'
  | 'ready'
  | 'go'
  | 'levelUp'
  | 'allClear'
  | 'tick'
  | 'heartbeat';

export type Track = 'title' | 'battle' | 'battle2' | 'battle3' | 'danger' | 'boss' | 'story' | null;
export type Speaker = 'hero' | 'robot' | 'rival';

const compiled = new Map<SongName, CompiledSong>();
const song = (name: SongName): CompiledSong => {
  let c = compiled.get(name);
  if (!c) {
    c = compile(SONGS[name]);
    compiled.set(name, c);
  }
  return c;
};

/** Schedules one song step by step on a synth. Shared by live playback and offline checks. */
export function scheduleStep(synth: Synth, c: CompiledSong, step: number, t: number): void {
  const { def } = c;
  const dur = 60 / def.bpm / 4;
  const i = step % c.steps;
  const bus = synth.music;
  const lead = c.lead[i];
  if (lead && def.vol.lead > 0) synth.play(def.lead, bus, t, lead.midi, lead.len * dur * 0.92, def.vol.lead, true);
  if (def.vol.arp > 0) for (const n of c.arp[i]) synth.play(def.arp, bus, t, n.midi, n.len * dur * 0.9, def.vol.arp);
  const bass = c.bass[i];
  if (bass) synth.play(def.bass, bus, t, bass.midi, bass.len * dur * 0.9, def.vol.bass);
  const d = c.drums[i];
  const v = def.vol.drums;
  if (v > 0 && d !== '.') {
    if (d.includes('k')) synth.kick(bus, t, v);
    if (d.includes('s')) synth.snare(bus, t, v * 0.8);
    if (d.includes('h')) synth.hat(bus, t, v * 0.22);
    if (d.includes('o')) synth.hat(bus, t, v * 0.25, true);
    if (d.includes('c')) synth.crash(bus, t, v * 0.25);
  }
}

const POP_SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private track: Track = null;
  private playing: { c: CompiledSong; loop: boolean } | null = null;
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
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.synth = new Synth(this.ctx);
      this.applyVolumes();
      if (this.track) this.start(this.track, true);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = sfx;
    this.musicVol = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.synth) return;
    this.synth.sfx.gain.value = this.sfxVol;
    this.synth.music.gain.value = this.musicVol * 0.85;
  }

  music(track: Track): void {
    if (track === this.track && this.playing) return;
    this.track = track;
    if (!track) this.stop();
    else this.start(track, true);
  }

  /** One-shot tune (win/lose). Music resumes when the next `music()` call arrives. */
  jingle(name: 'win' | 'lose'): void {
    this.track = null;
    this.start(name, false);
  }

  private start(name: SongName, loop: boolean): void {
    this.stop();
    this.playing = { c: song(name), loop };
    this.step = 0;
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.pump(), 25);
  }

  private stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.playing = null;
  }

  private pump(): void {
    if (!this.ctx || !this.synth || !this.playing) return;
    const { c, loop } = this.playing;
    const dur = 60 / c.def.bpm / 4;
    // After the tab sleeps, pick up from now instead of rushing to catch up.
    if (this.nextTime < this.ctx.currentTime - 0.25) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      if (!loop && this.step >= c.steps) {
        this.stop();
        return;
      }
      scheduleStep(this.synth, c, this.step, this.nextTime);
      this.nextTime += dur;
      this.step++;
    }
  }

  sfx(name: Sfx, arg = 1): void {
    if (name === 'win' || name === 'lose') return this.jingle(name);
    const s = this.synth;
    if (!this.ctx || !s) return;
    const t = this.ctx.currentTime + 0.005;
    const bus = s.sfx;
    switch (name) {
      case 'move':
        s.sweep(0.125, bus, t, 1500, 1300, 0.025, 0.035);
        break;
      case 'rotate':
        s.sweep(0.25, bus, t, 700, 1400, 0.055, 0.04);
        break;
      case 'land':
        s.sweep('sine', bus, t, 230, 70, 0.1, 0.2);
        s.noiseHit(bus, t, 0.04, 0.05, 'lowpass', 500);
        break;
      case 'pop': {
        const f = 523 * 2 ** (POP_SCALE[Math.min(arg - 1, POP_SCALE.length - 1)] / 12);
        s.fm({ ratio: 2, index: 4, indexEnd: 0.4, indexTime: 0.15, attack: 0.002, decay: 0.18, sustain: 0.15, release: 0.12 }, bus, t, f, 0.12, 0.16, true);
        s.sweep('sine', bus, t, f * 0.5, f * 1.6, 0.09, 0.12);
        s.noiseHit(bus, t, 0.12, 0.08, 'highpass', 5000);
        break;
      }
      case 'garbageSend':
        s.noiseHit(bus, t, 0.4, 0.14, 'bandpass', 300, 1.2, 3500);
        [0, 4, 7, 12].forEach((k, i) => s.sweep(0.25, bus, t + i * 0.035, 880 * 2 ** (k / 12), 880 * 2 ** (k / 12), 0.06, 0.03, true));
        s.sweep(0.5, bus, t + 0.45, 990, 990, 0.07, 0.035);
        s.sweep(0.5, bus, t + 0.56, 990, 990, 0.07, 0.035);
        break;
      case 'garbageDrop': {
        const n = Math.min(5, 2 + Math.floor(arg / 8));
        for (let i = 0; i < n; i++) {
          s.sweep('sine', bus, t + i * 0.07, 130 - i * 8, 38, 0.2, 0.28);
          s.noiseHit(bus, t + i * 0.07, 0.12, 0.1, 'lowpass', 420);
        }
        break;
      }
      case 'menu':
        s.sweep(0.25, bus, t, 1250, 1250, 0.03, 0.03);
        break;
      case 'select':
        s.sweep(0.25, bus, t, 880, 880, 0.05, 0.035);
        s.sweep(0.25, bus, t + 0.05, 1760, 1760, 0.08, 0.035, true);
        break;
      case 'back':
        s.sweep(0.25, bus, t, 900, 500, 0.08, 0.035);
        break;
      case 'ready':
        s.fm({ ratio: 1, index: 1, indexEnd: 3, indexTime: 0.05, attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.1, chorus: 7 }, bus, t, 392, 0.18, 0.12);
        s.fm({ ratio: 1, index: 1, indexEnd: 3, indexTime: 0.05, attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.1, chorus: 7 }, bus, t, 494, 0.18, 0.09);
        break;
      case 'go':
        for (const f of [523, 659, 784, 1047]) s.fm({ ratio: 1, index: 1, indexEnd: 3.5, indexTime: 0.05, attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2, chorus: 7 }, bus, t, f, 0.3, 0.08, true);
        s.crash(bus, t, 0.08);
        break;
      case 'levelUp':
        [0, 4, 7, 12, 16, 19].forEach((k, i) => s.sweep(0.125, bus, t + i * 0.04, 660 * 2 ** (k / 12), 660 * 2 ** (k / 12), 0.07, 0.035, true));
        break;
      case 'allClear':
        [0, 4, 7, 12, 16, 19, 24].forEach((k, i) =>
          s.fm({ ratio: 3.5, index: 2.5, indexEnd: 0.3, indexTime: 0.4, attack: 0.002, decay: 0.5, sustain: 0.2, release: 0.3 }, bus, t + i * 0.06, 784 * 2 ** (k / 12), 0.2, 0.08, true),
        );
        break;
      case 'tick':
        s.sweep(0.5, bus, t, 2000, 2000, 0.02, 0.03);
        break;
      case 'heartbeat':
        s.sweep('sine', bus, t, 90, 45, 0.12, 0.3);
        s.sweep('sine', bus, t + 0.18, 85, 42, 0.12, 0.22);
        break;
    }
  }

  /** A shout for chains of 2 or more; bigger chains, bigger shouts. */
  voice(chain: number, who: Speaker): void {
    const s = this.synth;
    if (!this.ctx || !s || chain < 2) return;
    const t = this.ctx.currentTime + 0.01;
    const base = who === 'hero' ? 330 : who === 'rival' ? 240 : 150;
    const robot = who === 'robot';
    const shout = (v: Partial<VoiceSpec> & Pick<VoiceSpec, 'vowels' | 'dur'>, at = 0, up = 0): void =>
      s.voice(s.sfx, t + at, { pitch: base * 2 ** (up / 12), glide: 3, vol: 0.55, breath: 0.7, robot, ...v });
    switch (Math.min(chain, 6)) {
      case 2:
        shout({ vowels: [['u', 1]], dur: 0.15 });
        break;
      case 3:
        shout({ vowels: [['a', 1]], dur: 0.22, glide: 4 }, 0, 2);
        break;
      case 4:
        shout({ vowels: [['o', 1]], dur: 0.13 }, 0, 2);
        shout({ vowels: [['i', 0.3], ['a', 1]], dur: 0.24, glide: 5, breath: 0 }, 0.15, 5);
        break;
      case 5:
        shout({ vowels: [['i', 0.3], ['a', 1]], dur: 0.16, breath: 0 }, 0, 4);
        shout({ vowels: [['a', 1]], dur: 0.28, glide: 6 }, 0.18, 7);
        break;
      default:
        shout({ vowels: [['i', 0.3], ['e', 0.5], ['a', 2.5]], dur: 0.62, glide: 8, breath: 0 }, 0, 6);
        break;
    }
  }
}

export const audio = new AudioEngine();
