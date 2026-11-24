import { AI_PRESETS, type AiProfile } from '@mbm/engine';
import { CAST, type Character, type Extra, type Eyes, type Head, type Mouth, characterById } from '../game/characters.ts';
import type { SceneKind } from '../render/stage.ts';

export interface Arena {
  id: string;
  index: number;
  name: string;
  trophies: number;
  scene: SceneKind;
  /** The arena's boss: one of the story robots. Shows up every few battles. */
  boss: string;
  /** Three regular robots met here. */
  minions: Character[];
  /** Computer skill range here, 0 (clumsy) to 1 (expert). */
  skill: [number, number];
  /** VS handicap level used for battles here (0-based). */
  level: number;
  colors: [string, string];
}

/** How many battles in an arena between boss fights. */
export const BOSS_EVERY = 4;

interface ArenaDef {
  id: string;
  name: string;
  trophies: number;
  scene: SceneKind;
  boss: string;
  minions: [string, string, string];
  skill: [number, number];
  level: number;
  colors: [string, string];
  /** Robot body colours for this arena's minions: [body, light, dark, eye glow]. */
  palette: [string, string, string, string][];
}

const DEFS: ArenaDef[] = [
  { id: 'meadow', name: 'Beanbury Meadow', trophies: 0, scene: 'meadow', boss: 'rusty', minions: ['Lawnbot', 'Sprinklor', 'Weedwhacker'], skill: [0, 0.1], level: 1, colors: ['#5fd36b', '#1f8a3e'], palette: [['#6ac46a', '#a8f0a0', '#2a6a2a', '#ffe060'], ['#e0c050', '#fff0a0', '#7a5a10', '#40c0ff'], ['#c86a4a', '#f0a888', '#5a2a1a', '#a0ff60']] },
  { id: 'junkyard', name: 'Rusty Junkyard', trophies: 150, scene: 'junkyard', boss: 'pip', minions: ['Scrapjaw', 'Tin Tim', 'Binbot'], skill: [0.06, 0.18], level: 1, colors: ['#ffb05a', '#b4501f'], palette: [['#a07050', '#d8a888', '#4a2a18', '#ff8040'], ['#8a8a96', '#c8c8d4', '#3a3a46', '#ffd040'], ['#6a8a5a', '#a8c898', '#2a3a20', '#ff6060']] },
  { id: 'steam', name: 'Steamworks', trophies: 350, scene: 'steam', boss: 'kettle', minions: ['Valvo', 'Pipewrench', 'Boilerboy'], skill: [0.14, 0.27], level: 1, colors: ['#5ad0d8', '#1d6c7a'], palette: [['#b08a40', '#e8c878', '#5a4010', '#60e0ff'], ['#4a8a96', '#88c8d4', '#1a3a46', '#ffb040'], ['#9a5a3a', '#d89878', '#4a2010', '#a0f0ff']] },
  { id: 'disco', name: 'Disco Inferno', trophies: 600, scene: 'disco', boss: 'mecha', minions: ['DJ Wattage', 'Glitterbot', 'Funkotron'], skill: [0.22, 0.36], level: 1, colors: ['#ff6ad5', '#7a2bc0'], palette: [['#c050e0', '#f0a0ff', '#5a1a7a', '#60fff0'], ['#3ab0f0', '#a0e0ff', '#14507a', '#ff60c0'], ['#f0c030', '#fff0a0', '#7a5a00', '#ff40a0']] },
  { id: 'sea', name: 'Pirate Cove', trophies: 900, scene: 'sea', boss: 'cogbeard', minions: ['Barnacle Bot', 'Anchorhead', 'Sharkbyte'], skill: [0.3, 0.44], level: 1, colors: ['#5aa8ff', '#1d3c8a'], palette: [['#4a7aa8', '#88b8e0', '#1a3a5a', '#ffe060'], ['#8a6a4a', '#c8a888', '#3a2a1a', '#60e0ff'], ['#6a7a8a', '#a8b8c8', '#2a3440', '#ff5050']] },
  { id: 'frost', name: 'Frosty Peaks', trophies: 1250, scene: 'frost', boss: 'vroomba', minions: ['Chillbot', 'Snowplow Sam', 'Icicle-9'], skill: [0.38, 0.52], level: 2, colors: ['#bfe8ff', '#3a78c0'], palette: [['#a8d8f0', '#e8f8ff', '#3a6a8a', '#40a0ff'], ['#e0e8f4', '#ffffff', '#6a7a90', '#ff6080'], ['#5a8ac8', '#a0c8f0', '#1a3a6a', '#a0ffff']] },
  { id: 'city', name: 'Neon City', trophies: 1650, scene: 'city', boss: 'kaboomer', minions: ['Neon Ned', 'Trafficone', 'Hoverbus'], skill: [0.45, 0.59], level: 2, colors: ['#7a8cff', '#2a1e6a'], palette: [['#3a3a5a', '#7a7aa8', '#14142a', '#40ffd0'], ['#f07030', '#ffb080', '#7a2a08', '#ffffff'], ['#d0c040', '#fff080', '#6a5a08', '#ff40ff']] },
  { id: 'mine', name: 'Crystal Mine', trophies: 2100, scene: 'mine', boss: 'drillbert', minions: ['Pickaxe Pete', 'Cartwheel', 'Gemcrusher'], skill: [0.52, 0.66], level: 2, colors: ['#5af0ff', '#3a2a7a'], palette: [['#8a6a4a', '#c8a888', '#3a2a1a', '#80ffff'], ['#5a5a6a', '#9a9aaa', '#22222a', '#ff80ff'], ['#7a4aa8', '#b888e0', '#30184a', '#80ff80']] },
  { id: 'candy', name: 'Candy Factory', trophies: 2600, scene: 'candy', boss: 'spikester', minions: ['Gumdrop-3', 'Lollipopper', 'Wafer Unit'], skill: [0.6, 0.73], level: 2, colors: ['#ff9ad0', '#c03a8a'], palette: [['#ff8ac0', '#ffd0e8', '#a02a6a', '#ffffff'], ['#8ad0ff', '#d0f0ff', '#2a6aa0', '#ff4080'], ['#c8a060', '#f0d8a8', '#6a4a20', '#ff60a0']] },
  { id: 'castle', name: 'Dusk Castle', trophies: 3150, scene: 'castle', boss: 'circuit', minions: ['Squire Bolt', 'Drawbridge', 'Catapult Kid'], skill: [0.67, 0.8], level: 2, colors: ['#ff9a6a', '#5a2a7a'], palette: [['#9aa2b4', '#d8e0f0', '#3a404e', '#40c0ff'], ['#7a5a3a', '#b89878', '#3a2a14', '#ffd040'], ['#6a3a7a', '#a878b8', '#2a1434', '#ff8040']] },
  { id: 'lava', name: 'Lava Forge', trophies: 3750, scene: 'lava', boss: 'wyrm', minions: ['Magmaw', 'Ember Bot', 'Slagger'], skill: [0.74, 0.87], level: 2, colors: ['#ff7a3a', '#8a1a0a'], palette: [['#5a2a1a', '#a8584a', '#200a04', '#ffb030'], ['#3a3a3a', '#7a7a7a', '#141414', '#ff5020'], ['#a83a1a', '#e8784a', '#4a1004', '#ffe060']] },
  { id: 'rooftop', name: 'Moon Rooftops', trophies: 4400, scene: 'rooftop', boss: 'shade', minions: ['Chimney Sweep', 'Gargoyle-X', 'Moonwalker'], skill: [0.82, 0.94], level: 2, colors: ['#a8b8ff', '#1a1a4a'], palette: [['#2a2a3e', '#5a5a7e', '#0e0e18', '#a0ff80'], ['#6a6a7a', '#a8a8b8', '#2a2a34', '#ffe060'], ['#3a4a7a', '#7a8ab8', '#141c34', '#ff80c0']] },
  { id: 'lab', name: "Grimgear's Lab", trophies: 5100, scene: 'lab', boss: 'grimgear', minions: ['Test Unit 7', 'Beakerbot', 'Clone #42'], skill: [0.88, 1], level: 2, colors: ['#c87aff', '#3a0a6a'], palette: [['#e8e8f0', '#ffffff', '#6a6a7a', '#40ff90'], ['#5a3a8a', '#9a78c8', '#24143a', '#40ff90'], ['#3a8a6a', '#78c8a8', '#143a2a', '#ff40ff']] },
];

const HEADS: Head[] = ['round', 'square', 'dome', 'tall', 'wide', 'kettle', 'helmet', 'cat', 'mouse', 'dragon'];
const EYES: Eyes[] = ['dots', 'visor', 'mono', 'big', 'slit', 'goggles'];
const EXTRAS: Extra[] = ['antenna', 'spikes', 'horns', 'plume', 'fuse', 'drill', 'bow', 'none', 'antenna'];
const MOUTHS: Mouth[] = ['grill', 'smile', 'teeth', 'flat', 'fangs'];

const TAUNTS = ['Beep boop. Prepare to be sorted.', 'My circuits say you lose.', 'Grimgear sent me. Nothing personal.', 'Calculating your defeat... done!', 'Ooh, a bean! Into the machine with you!'];
const DEFEATS = ['Error... error...', 'Rebooting... in shame.', 'You win this time, bean.', 'My warranty did not cover this.'];

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A regular robot built from parts, so every arena has its own crowd. */
function minion(def: ArenaDef, name: string, i: number): Character {
  const h = hash(`${def.id}:${name}`);
  const [body, light, dark, eye] = def.palette[i % def.palette.length];
  const head = HEADS[h % HEADS.length];
  let extra = EXTRAS[(h >>> 4) % EXTRAS.length];
  if (head === 'cat' || head === 'mouse') extra = 'ears';
  return {
    id: `${def.id}-${i}`,
    name,
    title: `${def.name} regular`,
    taunt: TAUNTS[(h >>> 8) % TAUNTS.length],
    reply: '',
    defeat: DEFEATS[(h >>> 12) % DEFEATS.length],
    portrait: { head, eyes: EYES[(h >>> 16) % EYES.length], extra, mouth: MOUTHS[(h >>> 20) % MOUTHS.length], body, light, dark, eye, bg: def.colors[1] },
    ai: AI_PRESETS.normal,
    stage: def.colors,
    scene: def.scene,
  };
}

export const ARENAS: Arena[] = DEFS.map((d, index) => ({
  id: d.id,
  index,
  name: d.name,
  trophies: d.trophies,
  scene: d.scene,
  boss: d.boss,
  minions: d.minions.map((n, i) => minion(d, n, i)),
  skill: d.skill,
  level: d.level,
  colors: d.colors,
}));

export const bossOf = (a: Arena): Character => characterById(a.boss) ?? CAST[0];

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
