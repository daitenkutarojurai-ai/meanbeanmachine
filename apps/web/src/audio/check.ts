// Developer check: renders music offline and reports loudness, so levels can be balanced
// without ears. Loaded only with ?debug.
import { scheduleStep } from '../audio.ts';
import { SONGS, type SongName, compile } from './songs.ts';
import { Synth } from './synth.ts';

export interface Levels {
  peak: number;
  rmsDb: number;
  quietSeconds: number;
}

async function measure(seconds: number, schedule: (s: Synth) => void): Promise<Levels> {
  const rate = 22050;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  const synth = new Synth(ctx);
  synth.music.gain.value = 0.85 * 0.5;
  synth.sfx.gain.value = 0.8;
  schedule(synth);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  let sum = 0;
  let quiet = 0;
  const win = rate / 4;
  for (let i = 0; i < d.length; i += win) {
    let ws = 0;
    for (let j = i; j < Math.min(d.length, i + win); j++) ws += d[j] * d[j];
    if (Math.sqrt(ws / win) < 0.003) quiet += 0.25;
  }
  for (const v of d) {
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  return { peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / d.length + 1e-12)).toFixed(1), quietSeconds: quiet };
}

export function songLevels(name: SongName, seconds = 12): Promise<Levels> {
  const c = compile(SONGS[name]);
  const dur = 60 / c.def.bpm / 4;
  return measure(seconds, (s) => {
    for (let step = 0, t = 0.05; t < seconds; step++, t += dur) {
      if (!c.def.loop && step >= c.steps) break;
      scheduleStep(s, c, step, t);
    }
  });
}

export function voiceLevels(): Promise<Levels> {
  return measure(4, (s) => {
    s.voice(s.sfx, 0.1, { vowels: [['a', 1]], dur: 0.25, pitch: 330, glide: 4, vol: 0.55, breath: 0.7 });
    s.voice(s.sfx, 1, { vowels: [['i', 0.3], ['e', 0.5], ['a', 2.5]], dur: 0.62, pitch: 150, glide: 8, vol: 0.55, robot: true });
  });
}
