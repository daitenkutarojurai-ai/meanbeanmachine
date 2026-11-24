// Original music. Each section gives a melody (16 steps of a 16th note per bar: a note,
// "-" to hold, "." for rest) and one chord per bar ("Dm7 G" splits a bar). Bass lines,
// arpeggios and drums are generated from the chords in the chosen styles.
import type { FmPatch, Patch, PulsePatch, SawPatch } from './synth.ts';

const fm = (p: FmPatch): Patch => ({ kind: 'fm', p });
const pulse = (p: PulsePatch): Patch => ({ kind: 'pulse', p });
const tri = (p: PulsePatch): Patch => ({ kind: 'tri', p });
const saw = (p: SawPatch): Patch => ({ kind: 'saw', p });

export const PATCHES = {
  bass: fm({ ratio: 1, index: 3.2, indexEnd: 0.7, indexTime: 0.18, attack: 0.004, decay: 0.18, sustain: 0.55, release: 0.06 }),
  slap: fm({ ratio: 1, index: 6.5, indexEnd: 0.6, indexTime: 0.07, attack: 0.002, decay: 0.12, sustain: 0.4, release: 0.05 }),
  softBass: fm({ ratio: 1, index: 1.2, indexEnd: 0.4, indexTime: 0.3, attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.2 }),
  brass: fm({ ratio: 1, index: 1.2, indexEnd: 3.2, indexTime: 0.08, attack: 0.025, decay: 0.2, sustain: 0.75, release: 0.08, vibrato: 0.012, vibratoDelay: 0.2, chorus: 7 }),
  lead: fm({ ratio: 2, index: 2.2, indexEnd: 1.1, indexTime: 0.25, attack: 0.008, decay: 0.15, sustain: 0.7, release: 0.1, vibrato: 0.014, vibratoDelay: 0.15, chorus: 6 }),
  epiano: fm({ ratio: 1, index: 1.8, indexEnd: 0.3, indexTime: 0.6, attack: 0.003, decay: 0.5, sustain: 0.35, release: 0.2, chorus: 5 }),
  bell: fm({ ratio: 3.5, index: 3, indexEnd: 0.4, indexTime: 0.5, attack: 0.002, decay: 0.7, sustain: 0.2, release: 0.4 }),
  organ: fm({ ratio: 2, index: 0.9, indexEnd: 0.9, indexTime: 0.1, attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.08, vibrato: 0.006, chorus: 5 }),
  arp12: pulse({ duty: 0.125, attack: 0.003, decay: 0.07, sustain: 0.35, release: 0.04 }),
  arp25: pulse({ duty: 0.25, attack: 0.003, decay: 0.08, sustain: 0.4, release: 0.05 }),
  lead25: pulse({ duty: 0.25, attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.06, vibrato: 0.012 }),
  pad: pulse({ duty: 0.5, attack: 0.12, decay: 0.4, sustain: 0.55, release: 0.4 }),
  // Modern palette.
  supersaw: saw({ detune: 14, cutoff: 2600, sweep: 3500, q: 1, attack: 0.012, decay: 0.25, sustain: 0.7, release: 0.12, vibrato: 0.008 }),
  softLead: saw({ detune: 9, cutoff: 1800, sweep: 1800, q: 0.7, attack: 0.02, decay: 0.3, sustain: 0.65, release: 0.15, vibrato: 0.01 }),
  brightLead: saw({ detune: 18, cutoff: 3600, sweep: 4000, q: 1.2, attack: 0.008, decay: 0.2, sustain: 0.75, release: 0.1, vibrato: 0.009 }),
  darkLead: saw({ detune: 12, cutoff: 1200, sweep: 2400, q: 2, attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.12, vibrato: 0.01 }),
  pluck: tri({ duty: 0.5, attack: 0.002, decay: 0.12, sustain: 0.15, release: 0.08 }),
  sawBass: saw({ detune: 6, cutoff: 500, sweep: 1400, q: 3, attack: 0.004, decay: 0.16, sustain: 0.5, release: 0.06, sub: 0.6 }),
  subBass: saw({ detune: 3, cutoff: 300, sweep: 500, q: 1, attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.15, sub: 0.9 }),
  sawPad: saw({ detune: 20, cutoff: 1400, sweep: 400, q: 0.5, attack: 0.25, decay: 0.6, sustain: 0.7, release: 0.6 }),
  // Light palette: mallets, bells and round basses that sit back in the mix.
  marimba: fm({ ratio: 4, index: 2.2, indexEnd: 0.08, indexTime: 0.05, attack: 0.002, decay: 0.32, sustain: 0.04, release: 0.25 }),
  kalimba: fm({ ratio: 5, index: 1.4, indexEnd: 0.05, indexTime: 0.04, attack: 0.002, decay: 0.45, sustain: 0.05, release: 0.3 }),
  softBell: fm({ ratio: 3.5, index: 1.5, indexEnd: 0.15, indexTime: 0.35, attack: 0.003, decay: 0.8, sustain: 0.18, release: 0.6 }),
  flute: tri({ duty: 0.5, attack: 0.045, decay: 0.2, sustain: 0.8, release: 0.12, vibrato: 0.01 }),
  keys: fm({ ratio: 1, index: 1.1, indexEnd: 0.2, indexTime: 0.5, attack: 0.004, decay: 0.6, sustain: 0.3, release: 0.25, chorus: 6 }),
  roundBass: fm({ ratio: 1, index: 0.8, indexEnd: 0.25, indexTime: 0.15, attack: 0.006, decay: 0.25, sustain: 0.6, release: 0.08 }),
  warmPad: saw({ detune: 14, cutoff: 800, sweep: 200, q: 0.4, attack: 0.4, decay: 0.8, sustain: 0.7, release: 0.8 }),
} satisfies Record<string, Patch>;

type BassStyle = 'pop' | 'rock' | 'funk' | 'drive' | 'march' | 'soft' | 'lofi' | 'bounce' | 'none';
type ArpStyle = 'up16' | 'up8' | 'stab' | 'pad' | 'broken' | 'lazy' | 'none';
type DrumStyle = 'pop' | 'rock' | 'funk' | 'drive' | 'boss' | 'light' | 'chill' | 'bounce' | 'none';

interface Section {
  chords: string[];
  lead: string;
  bass?: BassStyle;
  arp?: ArpStyle;
  drums?: DrumStyle;
}

export interface SongDef {
  bpm: number;
  loop: boolean;
  lead: Patch;
  arp: Patch;
  bass: Patch;
  vol: { lead: number; arp: number; bass: number; drums: number };
  sections: Record<string, Section>;
  order: string[];
}

export interface NoteEvent {
  midi: number;
  len: number;
}

export interface CompiledSong {
  def: SongDef;
  steps: number;
  lead: (NoteEvent | null)[];
  arp: NoteEvent[][];
  bass: (NoteEvent | null)[];
  drums: string[];
}

const BASS: Record<BassStyle, string> = {
  pop: 'R..R..5.R..R.5o.',
  rock: 'R.R.R.R.R.R.5.o.',
  funk: 'R..R..o..R.R.5o.',
  drive: 'R.R.o.R.R.R.o.R.',
  march: 'R...o...R...o.R.',
  soft: 'R-------5-------',
  lofi: 'R-----R.5-----..',
  bounce: 'R-.R-.5-R-..5-o.',
  none: '................',
};

const DRUMS: Record<DrumStyle, string[]> = {
  pop: ['kh', '.', 'h', '.', 'sh', '.', 'h', '.', 'kh', '.', 'kh', '.', 'sh', '.', 'h', '.'],
  rock: ['kh', '.', 'h', '.', 'sh', '.', 'h', '.', 'kh', '.', 'kh', '.', 'sh', '.', 'h', 'h'],
  funk: ['kh', '.', 'h', 'k', 'sh', '.', 'h', '.', 'h', 'k', 'h', '.', 'sh', '.', 'kh', 'h'],
  drive: ['kh', 'h', 'h', 'h', 'sh', 'h', 'h', 'h', 'kh', 'h', 'kh', 'h', 'sh', 'h', 'h', 'o'],
  boss: ['kh', '.', 'h', '.', 'sh', '.', 'h', 'k', 'kh', '.', 'kh', '.', 'sh', '.', 's', 's'],
  light: ['h', '.', '.', '.', 'h', '.', '.', '.', 'h', '.', '.', '.', 'h', '.', 'h', '.'],
  // x = shaker, r = rim click.
  chill: ['k', '.', 'x', '.', 'r', '.', 'x', '.', '.', 'k', 'x', '.', 'r', '.', 'x', 'x'],
  bounce: ['kx', '.', 'x', '.', 'sx', '.', 'x', 'k', '.', 'x', 'kx', '.', 'sx', '.', 'x', 'r'],
  none: Array(16).fill('.'),
};

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dim: [0, 3, 6],
  sus4: [0, 5, 7],
  aug: [0, 4, 8],
};

export function noteToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

function chord(name: string): { root: number; tones: number[] } {
  const m = /^([A-G])(#|b)?(.*)$/.exec(name);
  if (!m || !(m[3] in QUALITY)) throw new Error(`bad chord ${name}`);
  const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root: (root + 12) % 12, tones: QUALITY[m[3]] };
}

export function compile(def: SongDef): CompiledSong {
  const lead: (NoteEvent | null)[] = [];
  const arp: NoteEvent[][] = [];
  const bass: (NoteEvent | null)[] = [];
  const drums: string[] = [];
  for (const name of def.order) {
    const sec = def.sections[name];
    const tokens = sec.lead.split(/\s+/).filter((t) => t && t !== '|');
    if (tokens.length !== sec.chords.length * 16) throw new Error(`section ${name}: ${tokens.length} steps for ${sec.chords.length} bars`);
    const base = lead.length;
    tokens.forEach((tok, i) => {
      if (tok === '-' || tok === '.') {
        lead[base + i] = null;
        return;
      }
      let len = 1;
      while (tokens[i + len] === '-') len++;
      lead[base + i] = { midi: noteToMidi(tok), len };
    });
    sec.chords.forEach((bar, b) => {
      const parts = bar.split(' ').map(chord);
      const bassPat = BASS[sec.bass ?? 'pop'];
      const drumPat = DRUMS[sec.drums ?? 'pop'];
      for (let s = 0; s < 16; s++) {
        const c = parts[Math.min(parts.length - 1, Math.floor((s * parts.length) / 16))];
        const step = base + b * 16 + s;
        // Bass between E1 and D#2.
        const low = 24 + c.root + (c.root >= 4 ? 0 : 12);
        const ch = bassPat[s];
        if (ch === 'R' || ch === '5' || ch === 'o' || ch === '3') {
          let len = 1;
          while (bassPat[s + len] === '-') len++;
          const off = ch === 'R' ? 0 : ch === '5' ? 7 : ch === 'o' ? 12 : c.tones[1];
          bass[step] = { midi: low + off, len };
        } else bass[step] = null;
        let d = drumPat[s];
        if (b === 0 && s === 0 && (sec.drums === 'rock' || sec.drums === 'drive' || sec.drums === 'boss')) d += 'c';
        drums[step] = d;
        arp[step] = arpAt(sec.arp ?? 'up16', c, s, parts.length);
      }
    });
  }
  return { def, steps: lead.length, lead, arp, bass, drums };
}

function arpAt(style: ArpStyle, c: { root: number; tones: number[] }, s: number, split: number): NoteEvent[] {
  const root = 60 + c.root - (c.root > 7 ? 12 : 0);
  const tones = [...c.tones, ...c.tones.map((t) => t + 12)];
  switch (style) {
    case 'up16': {
      const seq = [0, 1, 2, 3, 4, 3, 2, 1];
      return [{ midi: root + tones[seq[s % 8] % tones.length], len: 1 }];
    }
    case 'up8':
      return s % 2 ? [] : [{ midi: root + tones[[0, 1, 2, 3, 2, 1, 0, 1][(s / 2) % 8] % tones.length], len: 2 }];
    case 'broken':
      return s % 2 ? [] : [{ midi: root + tones[[0, 2, 1, 2][(s / 2) % 4]], len: 2 }];
    case 'lazy':
      return s % 4 === 0 ? [{ midi: root + tones[[0, 2, 1, 3][(s / 4) % 4] % tones.length], len: 3 }] : [];
    case 'stab':
      return s % 4 === 2 ? c.tones.slice(0, 3).map((t) => ({ midi: root + t, len: 1 })) : [];
    case 'pad':
      return s % (16 / split) === 0 ? c.tones.map((t) => ({ midi: root + t - 12, len: 16 / split })) : [];
    case 'none':
      return [];
  }
}

export const SONGS = {
  // Lo-fi and unhurried: the menu should be somewhere you like to sit.
  title: {
    bpm: 86,
    loop: true,
    lead: PATCHES.softBell,
    arp: PATCHES.keys,
    bass: PATCHES.roundBass,
    vol: { lead: 0.15, arp: 0.05, bass: 0.17, drums: 0.24 },
    sections: {
      A: {
        chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
        bass: 'lofi',
        arp: 'lazy',
        drums: 'chill',
        lead: `. . A5 - - - C6 - E6 - - - C6 - - -
               B5 - - - G5 - - - . . E5 - G5 - - -
               . . F5 - A5 - - - C6 - - - D6 - C6 -
               B5 - - - - - G5 - E5 - - - - - - -`,
      },
      A2: {
        chords: ['Fmaj7', 'Em7', 'Dm7 G', 'Cmaj7'],
        bass: 'lofi',
        arp: 'lazy',
        drums: 'chill',
        lead: `. . A5 - - - C6 - E6 - - - G6 - - -
               E6 - D6 - B5 - - - . . G5 - B5 - - -
               A5 - - - F5 - - - G5 - - - B5 - D6 -
               C6 - - - - - - - . . . . . . . .`,
      },
      B: {
        chords: ['Am7', 'Dm7', 'Bbmaj7', 'Csus4 C'],
        bass: 'lofi',
        arp: 'lazy',
        drums: 'chill',
        lead: `E5 - - - . . A5 - C6 - - - . . B5 -
               A5 - - - - - . . F5 - A5 - C6 - - -
               D6 - - - - - C6 - Bb5 - - - A5 - - -
               F5 - - - - - - - E5 - - - - - - -`,
      },
      C: {
        chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
        bass: 'lofi',
        arp: 'lazy',
        drums: 'chill',
        lead: `. . . . . . . . . . . . . . . .
               . . . . . . . . . . . . . . . .
               . . . . . . . . . . . . . . . .
               . . . . . . . . . . . . . . . .`,
      },
    },
    order: ['A', 'A2', 'B', 'A2', 'C'],
  },
  // Bouncy and bright, with gaps in the tune so it never nags.
  battle: {
    bpm: 116,
    loop: true,
    lead: PATCHES.marimba,
    arp: PATCHES.keys,
    bass: PATCHES.roundBass,
    vol: { lead: 0.2, arp: 0.04, bass: 0.18, drums: 0.24 },
    sections: {
      A: {
        chords: ['D', 'Bm7', 'Gmaj7', 'A'],
        bass: 'bounce',
        arp: 'lazy',
        drums: 'bounce',
        lead: `F#5 - A5 - . . D6 - . . A5 - F#5 - . .
               F#5 - D5 - . . B4 - . . D5 - F#5 - A5 -
               B5 - - - A5 - . . F#5 - - - D5 - . .
               E5 - - - C#5 - E5 - A5 - - - . . . .`,
      },
      A2: {
        chords: ['D', 'Bm7', 'Em7', 'A'],
        bass: 'bounce',
        arp: 'lazy',
        drums: 'bounce',
        lead: `F#5 - A5 - . . D6 - . . E6 - F#6 - . .
               D6 - - - B5 - . . A5 - F#5 - . . D5 -
               G5 - - - F#5 - E5 - D5 - - - B4 - . .
               C#5 - E5 - A5 - - - - - - - . . . .`,
      },
      B: {
        chords: ['Gmaj7', 'A', 'F#m7', 'Bm7 A'],
        bass: 'pop',
        arp: 'up8',
        drums: 'chill',
        lead: `. . B5 - D6 - B5 - . . A5 - G5 - . .
               . . C#6 - E6 - C#6 - . . B5 - A5 - . .
               . . A5 - C#6 - A5 - . . E5 - F#5 - . .
               D6 - - - - - . . C#6 - - - E6 - - -`,
      },
    },
    order: ['A', 'A2', 'B', 'A2'],
  },
  battle2: {
    bpm: 112,
    loop: true,
    lead: PATCHES.kalimba,
    arp: PATCHES.keys,
    bass: PATCHES.roundBass,
    vol: { lead: 0.22, arp: 0.045, bass: 0.18, drums: 0.24 },
    sections: {
      A: {
        chords: ['Fmaj7', 'Em7 A7', 'Dm7', 'Gm7 C'],
        bass: 'funk',
        arp: 'stab',
        drums: 'bounce',
        lead: `A5 . C6 . E6 - . C6 - . A5 . G5 - . .
               G5 . B5 . D6 - . B5 - . C#6 . E6 - . .
               F6 - - - E6 - D6 - C6 - - - A5 - . .
               Bb5 - - - G5 - . . E5 - - - C6 - - -`,
      },
      B: {
        chords: ['Bbmaj7', 'C', 'Am7', 'Dm7'],
        bass: 'bounce',
        arp: 'lazy',
        drums: 'chill',
        lead: `D6 - . . F6 - . . D6 - C6 - A5 - . .
               E6 - . . G6 - . . E6 - D6 - C6 - . .
               C6 - - - A5 - - - E5 - G5 - A5 - - -
               F5 - - - - - - - . . . . . . . .`,
      },
    },
    order: ['A', 'A', 'B', 'A', 'B'],
  },
  battle3: {
    bpm: 120,
    loop: true,
    lead: PATCHES.flute,
    arp: PATCHES.pluck,
    bass: PATCHES.roundBass,
    vol: { lead: 0.1, arp: 0.04, bass: 0.18, drums: 0.25 },
    sections: {
      A: {
        chords: ['Am', 'F', 'C', 'G'],
        bass: 'bounce',
        arp: 'up8',
        drums: 'bounce',
        lead: `E5 - - - A5 - - - C6 - B5 - A5 - - -
               F5 - - - A5 - - - C6 - - - . . . .
               G5 - - - E5 - G5 - C6 - - - D6 - E6 -
               D6 - - - - - B5 - G5 - - - . . . .`,
      },
      B: {
        chords: ['Dm', 'Am', 'Bb', 'E'],
        bass: 'pop',
        arp: 'lazy',
        drums: 'chill',
        lead: `F5 - A5 - D6 - - - C6 - A5 - F5 - - -
               E5 - A5 - C6 - - - B5 - A5 - E5 - - -
               D6 - - - F6 - - - D6 - Bb5 - F5 - - -
               G#5 - - - B5 - - - E6 - - - . . . .`,
      },
    },
    order: ['A', 'A', 'B', 'A'],
  },
  // Bosses get weight, not speed.
  boss: {
    bpm: 124,
    loop: true,
    lead: PATCHES.brass,
    arp: PATCHES.marimba,
    bass: PATCHES.roundBass,
    vol: { lead: 0.1, arp: 0.05, bass: 0.2, drums: 0.27 },
    sections: {
      A: {
        chords: ['Cm', 'Ab', 'Fm', 'G'],
        bass: 'march',
        arp: 'up8',
        drums: 'boss',
        lead: `C5 - - - Eb5 - - - G5 - - - Eb5 - D5 -
               C5 - - - Eb5 - - - Ab5 - - - G5 - Eb5 -
               F5 - - - Ab5 - - - C6 - - - Bb5 - Ab5 -
               G5 - - - - - - - B4 - D5 - F5 - G5 -`,
      },
      B: {
        chords: ['Ab', 'Bb', 'Cm', 'G'],
        bass: 'bounce',
        arp: 'lazy',
        drums: 'bounce',
        lead: `Eb5 - C5 - Eb5 - Ab5 - - - G5 - Eb5 - . .
               F5 - D5 - F5 - Bb5 - - - Ab5 - F5 - . .
               G5 - Eb5 - G5 - C6 - - - Bb5 - G5 - . .
               B5 - - - - - - - D6 - - - . . . .`,
      },
    },
    order: ['A', 'A', 'B', 'A'],
  },
  // A nudge that the stack is high, not an alarm.
  danger: {
    bpm: 138,
    loop: true,
    lead: PATCHES.marimba,
    arp: PATCHES.pluck,
    bass: PATCHES.roundBass,
    vol: { lead: 0.16, arp: 0, bass: 0.2, drums: 0.26 },
    sections: {
      A: {
        chords: ['Am', 'Am', 'F', 'E'],
        bass: 'drive',
        arp: 'none',
        drums: 'bounce',
        lead: `A5 - . . E5 - . . A5 - . . C6 - B5 -
               A5 - . . E5 - . . A5 - . . G5 - E5 -
               F5 - . . C6 - . . A5 - . . F5 - A5 -
               G#5 - - - B5 - - - E6 - - - . . . .`,
      },
    },
    order: ['A'],
  },
  story: {
    bpm: 84,
    loop: true,
    lead: PATCHES.softBell,
    arp: PATCHES.warmPad,
    bass: PATCHES.roundBass,
    vol: { lead: 0.16, arp: 0.03, bass: 0.16, drums: 0.18 },
    sections: {
      A: {
        chords: ['F', 'C', 'Dm', 'Bb'],
        bass: 'soft',
        arp: 'pad',
        drums: 'chill',
        lead: `A5 - - - C6 - - - A5 - G5 - F5 - - -
               G5 - - - E5 - - - C5 - D5 - E5 - - -
               F5 - - - A5 - - - D6 - C6 - A5 - - -
               Bb5 - - - A5 - - - G5 - F5 - D5 - - -`,
      },
    },
    order: ['A'],
  },
  win: {
    bpm: 132,
    loop: false,
    lead: PATCHES.marimba,
    arp: PATCHES.keys,
    bass: PATCHES.roundBass,
    vol: { lead: 0.24, arp: 0.05, bass: 0.18, drums: 0.24 },
    sections: {
      A: {
        chords: ['C', 'F G', 'Cmaj7'],
        bass: 'pop',
        arp: 'lazy',
        drums: 'bounce',
        lead: `G5 - C6 - E6 - G6 - - - E6 - G6 - - -
               A6 - - - F6 - A6 - B6 - - - G6 - B6 -
               C7 - - - - - - - - - - - . . . .`,
      },
    },
    order: ['A'],
  },
  lose: {
    bpm: 96,
    loop: false,
    lead: PATCHES.softBell,
    arp: PATCHES.warmPad,
    bass: PATCHES.roundBass,
    vol: { lead: 0.14, arp: 0.03, bass: 0.15, drums: 0 },
    sections: {
      A: {
        chords: ['Am7', 'Dm7 G', 'Cmaj7'],
        bass: 'soft',
        arp: 'pad',
        drums: 'none',
        lead: `E5 - - - D5 - - - C5 - - - B4 - - -
               A4 - - - F4 - - - G4 - - - B4 - - -
               C5 - - - - - - - - - - - . . . .`,
      },
    },
    order: ['A'],
  },
} satisfies Record<string, SongDef>;

export type SongName = keyof typeof SONGS;
