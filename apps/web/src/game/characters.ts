import type { AiProfile } from '@mbm/engine';

export type Head = 'round' | 'square' | 'dome' | 'tall' | 'wide' | 'kettle' | 'helmet' | 'cat' | 'dragon' | 'mouse' | 'bean' | 'boss';
export type Eyes = 'dots' | 'visor' | 'mono' | 'big' | 'slit' | 'goggles';
export type Extra = 'antenna' | 'ears' | 'spikes' | 'horns' | 'pirate' | 'plume' | 'fuse' | 'drill' | 'sprout' | 'bow' | 'whistle' | 'none';
export type Mouth = 'grill' | 'smile' | 'teeth' | 'flat' | 'fangs' | 'moustache';

export interface Portrait {
  head: Head;
  eyes: Eyes;
  extra: Extra;
  mouth: Mouth;
  body: string;
  light: string;
  dark: string;
  eye: string;
  bg: string;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  /** What they say before the stage. */
  taunt: string;
  /** What Sprout answers. */
  reply: string;
  /** What they say when beaten. */
  defeat: string;
  portrait: Portrait;
  ai: AiProfile;
  /** Background tint for the stage. */
  stage: [string, string];
}

const ai = (
  thinkFrames: number,
  tapInterval: number,
  chainTarget: number,
  mistakeRate: number,
  extra: Partial<AiProfile> = {},
): AiProfile => ({
  thinkFrames,
  tapInterval,
  softDrop: tapInterval <= 6,
  lookahead: chainTarget >= 4,
  chainTarget,
  mistakeRate,
  noise: Math.round(mistakeRate * 200),
  ambition: 0.3 + chainTarget * 0.25,
  ...extra,
});

export const HERO: Character = {
  id: 'sprout',
  name: 'Sprout',
  title: 'Bean of Beanbury',
  taunt: '',
  reply: '',
  defeat: '',
  portrait: { head: 'bean', eyes: 'big', extra: 'sprout', mouth: 'smile', body: '#4cc35a', light: '#a6f08c', dark: '#1f6b34', eye: '#1b1b1b', bg: '#1b3b5a' },
  ai: ai(20, 6, 3, 0.1),
  stage: ['#1b3b5a', '#0c1b2e'],
};

/** Scenario order: thirteen of Professor Grimgear's machines, weakest first. */
export const CAST: Character[] = [
  {
    id: 'rusty',
    name: 'Rusty Bucket',
    title: 'Scrap-Heap Sentry',
    taunt: 'BZZT. YOU BEANS GO IN THE BUCKET. THAT IS THE RULE.',
    reply: 'Your bucket has a hole in it, Rusty!',
    defeat: 'CLANK... BUCKET... EMPTY...',
    portrait: { head: 'square', eyes: 'dots', extra: 'antenna', mouth: 'grill', body: '#b0703a', light: '#e0a060', dark: '#5a3418', eye: '#ffe060', bg: '#4a2a1a' },
    ai: ai(44, 11, 1, 0.35),
    stage: ['#5a3a22', '#26170c'],
  },
  {
    id: 'pip',
    name: 'Pip Squeak',
    title: 'Wind-Up Rodent',
    taunt: 'Squeak squeak! The Professor winds me up and I catch beans!',
    reply: 'Then let\'s see you run out of spring!',
    defeat: 'Squeeeak... need... more... turns...',
    portrait: { head: 'mouse', eyes: 'big', extra: 'ears', mouth: 'teeth', body: '#9aa0b0', light: '#d4d8e4', dark: '#4a4e5c', eye: '#202020', bg: '#3a3050' },
    ai: ai(38, 10, 1, 0.28),
    stage: ['#3a3050', '#18142a'],
  },
  {
    id: 'kettle',
    name: 'Gearwhistle',
    title: 'Steam-Powered Butler',
    taunt: 'Tea time is over, young bean. Kindly step into the roaster.',
    reply: 'No thanks, I take my beans un-roasted!',
    defeat: 'Oh dear... I appear to have boiled dry.',
    portrait: { head: 'kettle', eyes: 'goggles', extra: 'whistle', mouth: 'moustache', body: '#c8c8d0', light: '#f4f4ff', dark: '#5a5a68', eye: '#60c0ff', bg: '#2a4048' },
    ai: ai(32, 9, 2, 0.24),
    stage: ['#2a4048', '#101c20'],
  },
  {
    id: 'mecha',
    name: 'Madame Mecha',
    title: 'Roller-Disco Diva',
    taunt: 'Darling, this rink only has room for ONE star. And it is me.',
    reply: 'Then I\'ll roll right past you!',
    defeat: 'My wheels... my beautiful wheels...',
    portrait: { head: 'dome', eyes: 'visor', extra: 'bow', mouth: 'smile', body: '#e050a0', light: '#ff9ad0', dark: '#701848', eye: '#60fff0', bg: '#4a1a40' },
    ai: ai(28, 8, 2, 0.2),
    stage: ['#4a1a40', '#20081a'],
  },
  {
    id: 'cogbeard',
    name: 'Cap\'n Cogbeard',
    title: 'Clockwork Corsair',
    taunt: 'Arr! Every bean in Beanbury be plunder for the Professor!',
    reply: 'Walk the plank, you rusty pirate!',
    defeat: 'Abandon ship... me gears be sunk...',
    portrait: { head: 'round', eyes: 'mono', extra: 'pirate', mouth: 'teeth', body: '#5a7ab0', light: '#90b0e0', dark: '#203458', eye: '#ff4040', bg: '#1a2a4a' },
    ai: ai(24, 7, 2, 0.16),
    stage: ['#1a2a4a', '#0a1020'],
  },
  {
    id: 'vroomba',
    name: 'Vroomba',
    title: 'The Sucking Menace',
    taunt: 'VRRRRRMMM! ALL BEANS WILL BE TIDIED UP. PERMANENTLY.',
    reply: 'I\'m not dust, I\'m a bean!',
    defeat: 'Bag... full... powering... down...',
    portrait: { head: 'wide', eyes: 'visor', extra: 'none', mouth: 'grill', body: '#40404a', light: '#7a7a88', dark: '#1a1a20', eye: '#40ff60', bg: '#20282a' },
    ai: ai(20, 6, 3, 0.13),
    stage: ['#20282a', '#0a0e10'],
  },
  {
    id: 'kaboomer',
    name: 'Kaboomer',
    title: 'Short-Fused Demolisher',
    taunt: 'Tick tick tick... I\'m gonna blow your beans sky high!',
    reply: 'Better watch that fuse, it\'s getting short!',
    defeat: 'Fizzle... pfft... that\'s it?',
    portrait: { head: 'round', eyes: 'slit', extra: 'fuse', mouth: 'teeth', body: '#30303a', light: '#606070', dark: '#101014', eye: '#ff8020', bg: '#4a2410' },
    ai: ai(18, 6, 3, 0.11),
    stage: ['#4a2410', '#200e04'],
  },
  {
    id: 'drillbert',
    name: 'Drillbert',
    title: 'Deep-Core Digger',
    taunt: 'I dig through rock all day. Your little beans are nothing!',
    reply: 'Dig yourself a hole and stay in it!',
    defeat: 'Drill bit... snapped... going back underground...',
    portrait: { head: 'tall', eyes: 'goggles', extra: 'drill', mouth: 'flat', body: '#d0a020', light: '#ffe070', dark: '#6a4a08', eye: '#ff6040', bg: '#3a2a10' },
    ai: ai(16, 5, 3, 0.09),
    stage: ['#3a2a10', '#181004'],
  },
  {
    id: 'spikester',
    name: 'Spikester',
    title: 'The Prickly Enforcer',
    taunt: 'Come closer, bean. I dare you. Hehehe.',
    reply: 'Spikes don\'t scare me!',
    defeat: 'Ow ow ow... I got myself...',
    portrait: { head: 'round', eyes: 'slit', extra: 'spikes', mouth: 'fangs', body: '#7a40c0', light: '#b080ff', dark: '#341860', eye: '#ffff40', bg: '#28104a' },
    ai: ai(14, 5, 4, 0.08),
    stage: ['#28104a', '#10061e'],
  },
  {
    id: 'circuit',
    name: 'Sir Circuit',
    title: 'Knight of the Motherboard',
    taunt: 'Halt! By order of the Professor, I challenge thee to bean combat!',
    reply: 'En garde, tin can!',
    defeat: 'I yield... thou art a worthy bean.',
    portrait: { head: 'helmet', eyes: 'visor', extra: 'plume', mouth: 'grill', body: '#a0a8b8', light: '#e0e8f8', dark: '#40485a', eye: '#40c0ff', bg: '#202a40' },
    ai: ai(12, 4, 4, 0.06),
    stage: ['#202a40', '#0a0e1a'],
  },
  {
    id: 'wyrm',
    name: 'Wyrmatron',
    title: 'Iron Dragon of the Furnace',
    taunt: 'ROOOAAR! I shall melt your beans into soup!',
    reply: 'Too bad your fire is just hot air!',
    defeat: 'My furnace... has gone... cold...',
    portrait: { head: 'dragon', eyes: 'slit', extra: 'horns', mouth: 'fangs', body: '#c03028', light: '#ff7050', dark: '#581010', eye: '#ffe040', bg: '#401010' },
    ai: ai(10, 4, 5, 0.05),
    stage: ['#401010', '#1a0404'],
  },
  {
    id: 'shade',
    name: 'Shade',
    title: 'The Silent Paw',
    taunt: '...You will not see my chain coming.',
    reply: 'I\'ve been watching every move you make!',
    defeat: '...Impressive. Go, then.',
    portrait: { head: 'cat', eyes: 'slit', extra: 'ears', mouth: 'flat', body: '#28283a', light: '#505070', dark: '#0c0c14', eye: '#80ff60', bg: '#14141e' },
    ai: ai(7, 3, 5, 0.03),
    stage: ['#14141e', '#060608'],
  },
  {
    id: 'grimgear',
    name: 'Prof. Grimgear',
    title: 'Master of the Bean Machine',
    taunt: 'So, the little sprout made it to my lab. My Bean Machine will turn you into a loyal robot like all the rest!',
    reply: 'Not today, Professor! Beanbury goes free!',
    defeat: 'NO! My magnificent machine! This is not the end, bean!',
    portrait: { head: 'boss', eyes: 'goggles', extra: 'none', mouth: 'moustache', body: '#e8c8a8', light: '#fff0e0', dark: '#7a5038', eye: '#ff3030', bg: '#30103a' },
    ai: ai(5, 3, 6, 0.02, { noise: 4, ambition: 1.8 }),
    stage: ['#30103a', '#10041a'],
  },
];

export const ALL_CHARACTERS: Character[] = [HERO, ...CAST];

export const characterById = (id: string): Character => ALL_CHARACTERS.find((c) => c.id === id) ?? HERO;
