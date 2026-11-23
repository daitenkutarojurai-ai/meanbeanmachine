import { AI_PRESETS, type AiProfile } from '@mbm/engine';
import type { SceneKind } from '../render/stage.ts';

export interface Arena {
  id: string;
  index: number;
  name: string;
  trophies: number;
  scene: SceneKind;
  /** Cast ids of the robots met here. */
  opponents: string[];
  /** Computer skill range here, 0 (clumsy) to 1 (expert). */
  skill: [number, number];
  /** VS handicap level used for battles here (0-based). */
  level: number;
  colors: [string, string];
}

const RAW: Omit<Arena, 'index'>[] = [
  { id: 'meadow', name: 'Beanbury Meadow', trophies: 0, scene: 'meadow', opponents: ['rusty', 'pip'], skill: [0, 0.12], level: 1, colors: ['#5fd36b', '#1f8a3e'] },
  { id: 'junkyard', name: 'Rusty Junkyard', trophies: 300, scene: 'junkyard', opponents: ['rusty', 'pip', 'kettle'], skill: [0.08, 0.25], level: 1, colors: ['#ffb05a', '#b4501f'] },
  { id: 'steam', name: 'Steamworks', trophies: 600, scene: 'steam', opponents: ['kettle', 'mecha'], skill: [0.2, 0.36], level: 1, colors: ['#5ad0d8', '#1d6c7a'] },
  { id: 'disco', name: 'Disco Inferno', trophies: 1000, scene: 'disco', opponents: ['mecha', 'cogbeard'], skill: [0.3, 0.45], level: 1, colors: ['#ff6ad5', '#7a2bc0'] },
  { id: 'sea', name: 'Pirate Cove', trophies: 1400, scene: 'sea', opponents: ['cogbeard', 'vroomba'], skill: [0.4, 0.55], level: 2, colors: ['#5aa8ff', '#1d3c8a'] },
  { id: 'city', name: 'Neon City', trophies: 1800, scene: 'city', opponents: ['vroomba', 'kaboomer'], skill: [0.48, 0.62], level: 2, colors: ['#7a8cff', '#2a1e6a'] },
  { id: 'mine', name: 'Crystal Mine', trophies: 2300, scene: 'mine', opponents: ['kaboomer', 'drillbert'], skill: [0.55, 0.7], level: 2, colors: ['#5af0ff', '#3a2a7a'] },
  { id: 'castle', name: 'Dusk Castle', trophies: 2800, scene: 'castle', opponents: ['spikester', 'circuit'], skill: [0.62, 0.78], level: 2, colors: ['#ff9a6a', '#5a2a7a'] },
  { id: 'lava', name: 'Lava Forge', trophies: 3400, scene: 'lava', opponents: ['circuit', 'wyrm'], skill: [0.7, 0.86], level: 2, colors: ['#ff7a3a', '#8a1a0a'] },
  { id: 'rooftop', name: 'Moon Rooftops', trophies: 4000, scene: 'rooftop', opponents: ['wyrm', 'shade'], skill: [0.78, 0.93], level: 2, colors: ['#a8b8ff', '#1a1a4a'] },
  { id: 'lab', name: "Grimgear's Lab", trophies: 4600, scene: 'lab', opponents: ['shade', 'grimgear'], skill: [0.86, 1], level: 2, colors: ['#c87aff', '#3a0a6a'] },
];

export const ARENAS: Arena[] = RAW.map((a, index) => ({ ...a, index }));

export function arenaFor(trophies: number): Arena {
  let a = ARENAS[0];
  for (const x of ARENAS) if (trophies >= x.trophies) a = x;
  return a;
}

export function nextArena(a: Arena): Arena | null {
  return ARENAS[a.index + 1] ?? null;
}

const LADDER: AiProfile[] = [AI_PRESETS.rookie, AI_PRESETS.easy, AI_PRESETS.normal, AI_PRESETS.hard, AI_PRESETS.expert];

/** Blends the AI presets: 0 is the clumsiest computer, 1 the sharpest. */
export function aiForSkill(skill: number): AiProfile {
  const s = Math.max(0, Math.min(1, skill)) * (LADDER.length - 1);
  const i = Math.min(LADDER.length - 2, Math.floor(s));
  const t = s - i;
  const a = LADDER[i];
  const b = LADDER[i + 1];
  const mix = (x: number, y: number): number => x + (y - x) * t;
  return {
    thinkFrames: Math.round(mix(a.thinkFrames, b.thinkFrames)),
    tapInterval: Math.round(mix(a.tapInterval, b.tapInterval)),
    softDrop: t < 0.5 ? a.softDrop : b.softDrop,
    lookahead: t < 0.5 ? a.lookahead : b.lookahead,
    chainTarget: Math.round(mix(a.chainTarget, b.chainTarget)),
    mistakeRate: mix(a.mistakeRate, b.mistakeRate),
    noise: mix(a.noise, b.noise),
    ambition: mix(a.ambition, b.ambition),
  };
}
