// Everything you can earn. All rewards are cosmetic or currency: the rules of a match
// never change, so a new player and a veteran play the same game.

export type ChestType = 'wood' | 'silver' | 'gold' | 'magic' | 'legend';

export interface ChestDef {
  name: string;
  unlockMs: number;
  coins: [number, number];
  gems: [number, number];
  gemChance: number;
  skinChance: number;
  xp: number;
  colors: [string, string, string];
}

export const CHESTS: Record<ChestType, ChestDef> = {
  wood: { name: 'Wooden Chest', unlockMs: 30_000, coins: [20, 40], gems: [0, 0], gemChance: 0, skinChance: 0, xp: 4, colors: ['#c98a4a', '#8a5426', '#5a3214'] },
  silver: { name: 'Silver Chest', unlockMs: 3 * 60_000, coins: [45, 80], gems: [1, 3], gemChance: 0.25, skinChance: 0.03, xp: 8, colors: ['#e2e8f4', '#9aa6be', '#5a6680'] },
  gold: { name: 'Golden Chest', unlockMs: 10 * 60_000, coins: [120, 200], gems: [3, 8], gemChance: 0.6, skinChance: 0.12, xp: 20, colors: ['#ffe066', '#f0a818', '#9a5a08'] },
  magic: { name: 'Magical Chest', unlockMs: 30 * 60_000, coins: [300, 480], gems: [10, 20], gemChance: 1, skinChance: 0.4, xp: 45, colors: ['#e09aff', '#9a3ae0', '#4a1280'] },
  legend: { name: 'Legendary Chest', unlockMs: 60 * 60_000, coins: [700, 1000], gems: [25, 40], gemChance: 1, skinChance: 1, xp: 90, colors: ['#ffd27a', '#ff6a3a', '#8a1a3a'] },
};

/** The order chests drop from wins, like a deck of cards that loops. */
export const CHEST_CYCLE: ChestType[] = ['silver', 'silver', 'gold', 'silver', 'silver', 'gold', 'silver', 'magic', 'silver', 'gold', 'silver', 'silver', 'gold', 'silver', 'legend', 'gold'];

export const FREE_CHEST_MS = 2 * 60 * 60_000;

/** Gems to open a chest right now: about one gem per 6 minutes left. */
export const skipCost = (msLeft: number): number => Math.max(1, Math.ceil(msLeft / 360_000));

export interface SkinDef {
  id: string;
  name: string;
  tagline: string;
  body: [string, string, string];
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price?: { coins?: number; gems?: number };
}

export const SKINS: SkinDef[] = [
  { id: 'classic', name: 'Classic Sprout', tagline: 'The one and only.', body: ['#8ef59a', '#3fc95a', '#167a34'], rarity: 'common' },
  { id: 'sunny', name: 'Sunny Sprout', tagline: 'Always looks on the bright side.', body: ['#fff28a', '#ffc928', '#b8700a'], rarity: 'common', price: { coins: 600 } },
  { id: 'frost', name: 'Frosty Sprout', tagline: 'Cool under pressure. Literally.', body: ['#d8f6ff', '#7fd4ff', '#2a78b8'], rarity: 'rare', price: { coins: 1500 } },
  { id: 'ninja', name: 'Ninja Sprout', tagline: 'Silent. Swift. Slightly squishy.', body: ['#6a7cff', '#3442c8', '#141c6a'], rarity: 'rare', price: { coins: 2200 } },
  { id: 'pirate', name: 'Captain Sprout', tagline: 'Sails the seven seas of beans.', body: ['#ff8a7a', '#e2423a', '#821a1a'], rarity: 'epic', price: { gems: 120 } },
  { id: 'astro', name: 'Astro Sprout', tagline: 'One small hop for a bean.', body: ['#f2f4ff', '#c4cae6', '#6a7290'], rarity: 'epic', price: { gems: 160 } },
  { id: 'lava', name: 'Blaze Sprout', tagline: 'Too hot to roast.', body: ['#ffd06a', '#ff6a2a', '#9a1a0a'], rarity: 'legendary', price: { gems: 300 } },
  { id: 'royal', name: 'King Sprout', tagline: 'Ruler of Beanbury.', body: ['#e2a8ff', '#a454f0', '#4a1a8a'], rarity: 'legendary', price: { gems: 400 } },
];

export const skinById = (id: string): SkinDef => SKINS.find((s) => s.id === id) ?? SKINS[0];

export interface RoadReward {
  trophies: number;
  coins?: number;
  gems?: number;
  chest?: ChestType;
  skin?: string;
}

export const TROPHY_ROAD: RoadReward[] = [
  { trophies: 60, coins: 100 },
  { trophies: 150, chest: 'silver' },
  { trophies: 250, gems: 10 },
  { trophies: 300, chest: 'gold' },
  { trophies: 450, coins: 300 },
  { trophies: 600, skin: 'sunny' },
  { trophies: 800, gems: 20 },
  { trophies: 1000, chest: 'magic' },
  { trophies: 1200, coins: 600 },
  { trophies: 1400, gems: 30 },
  { trophies: 1600, skin: 'frost' },
  { trophies: 1800, chest: 'gold' },
  { trophies: 2100, coins: 1000 },
  { trophies: 2300, chest: 'magic' },
  { trophies: 2600, gems: 50 },
  { trophies: 2800, skin: 'ninja' },
  { trophies: 3100, chest: 'legend' },
  { trophies: 3400, coins: 2000 },
  { trophies: 3700, gems: 80 },
  { trophies: 4000, chest: 'legend' },
  { trophies: 4300, skin: 'pirate' },
  { trophies: 4600, skin: 'royal' },
];

export type QuestKind = 'win' | 'play' | 'chain' | 'send' | 'pop' | 'score' | 'boss';

export interface QuestDef {
  id: string;
  kind: QuestKind;
  goal: number;
  text: string;
  coins?: number;
  gems?: number;
}

export const QUEST_POOL: QuestDef[] = [
  { id: 'win2', kind: 'win', goal: 2, text: 'Win 2 battles', coins: 80 },
  { id: 'win4', kind: 'win', goal: 4, text: 'Win 4 battles', gems: 8 },
  { id: 'play3', kind: 'play', goal: 3, text: 'Play 3 battles', coins: 50 },
  { id: 'chain3', kind: 'chain', goal: 3, text: 'Make a 3-chain', coins: 60 },
  { id: 'chain4', kind: 'chain', goal: 4, text: 'Make a 4-chain', gems: 6 },
  { id: 'send30', kind: 'send', goal: 30, text: 'Send 30 refugee beans', coins: 70 },
  { id: 'pop120', kind: 'pop', goal: 120, text: 'Pop 120 beans', coins: 60 },
  { id: 'score8k', kind: 'score', goal: 8000, text: 'Score 8,000 in one battle', coins: 60 },
  { id: 'boss1', kind: 'boss', goal: 1, text: 'Beat an arena boss', gems: 5 },
];

export interface ShopOffer {
  id: string;
  kind: 'skin' | 'coins' | 'chest';
  skin?: string;
  chest?: ChestType;
  coins?: number;
  price: { coins?: number; gems?: number };
}

/** Today's shop, the same for everyone on the same day. */
export function dailyOffers(day: string, owned: string[]): ShopOffer[] {
  let h = 0;
  for (const ch of day) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const pick = <T>(arr: T[]): T => arr[(h = (Math.imul(h, 1103515245) + 12345) >>> 0) % arr.length];
  const skins = SKINS.filter((s) => s.price && !owned.includes(s.id));
  const offers: ShopOffer[] = [{ id: 'free', kind: 'coins', coins: 30, price: {} }];
  if (skins.length) {
    const s = pick(skins);
    offers.push({ id: `skin-${s.id}`, kind: 'skin', skin: s.id, price: s.price! });
  }
  offers.push({ id: 'chest-gold', kind: 'chest', chest: pick<ChestType>(['gold', 'gold', 'magic']), price: { gems: 40 } });
  offers.push({ id: 'coins-500', kind: 'coins', coins: 500, price: { gems: 30 } });
  offers.push({ id: 'coins-1200', kind: 'coins', coins: 1200, price: { gems: 65 } });
  return offers;
}
