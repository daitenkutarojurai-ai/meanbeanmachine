// The player's progress: trophies, currencies, chests, skins, quests. Saved locally.
import { ARENAS, type Arena, arenaFor } from './arenas.ts';
import {
  CHESTS,
  CHEST_CYCLE,
  type ChestType,
  FREE_CHEST_MS,
  QUEST_POOL,
  type QuestKind,
  SKINS,
  type ShopOffer,
  TROPHY_ROAD,
  skipCost,
} from './rewards.ts';

export interface ChestSlot {
  type: ChestType;
  /** When unlocking finishes; null while still locked. */
  readyAt: number | null;
}

export interface QuestState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface Profile {
  name: string;
  xp: number;
  trophies: number;
  bestTrophies: number;
  coins: number;
  gems: number;
  chests: (ChestSlot | null)[];
  chestCycle: number;
  freeChestAt: number;
  skins: string[];
  skin: string;
  quests: QuestState[];
  questDay: string;
  roadClaimed: number[];
  shopDay: string;
  shopBought: string[];
  stats: { played: number; wins: number; losses: number; bestChain: number; refugees: number; popped: number; bestScore: number; streak: number; bestStreak: number };
  seenArena: number;
  /** Battles played in each arena, which decides when its boss shows up. */
  arenaBattles: Record<string, number>;
  lastOpponent: string;
}

const KEY = 'bm.profile.v2';

const today = (): string => new Date().toISOString().slice(0, 10);

function fresh(): Profile {
  return {
    name: '',
    xp: 0,
    trophies: 0,
    bestTrophies: 0,
    coins: 100,
    gems: 20,
    chests: [{ type: 'wood', readyAt: null }, null, null, null],
    chestCycle: 0,
    freeChestAt: 0,
    skins: ['classic'],
    skin: 'classic',
    quests: [],
    questDay: '',
    roadClaimed: [],
    shopDay: '',
    shopBought: [],
    stats: { played: 0, wins: 0, losses: 0, bestChain: 0, refugees: 0, popped: 0, bestScore: 0, streak: 0, bestStreak: 0 },
    seenArena: 0,
    arenaBattles: {},
    lastOpponent: '',
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...fresh(), ...JSON.parse(raw) } as Profile;
      p.stats = { ...fresh().stats, ...p.stats };
      // Adventure is gone: today's "clear a stage" quest becomes the boss quest.
      p.quests = p.quests.map((q) => (q.id === 'adv1' ? { ...q, id: 'boss1', progress: q.claimed ? 1 : 0 } : q));
      return p;
    }
  } catch {
    // Storage blocked: play with a fresh profile this session.
  }
  return fresh();
}

export const profile: Profile = load();
const listeners = new Set<() => void>();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Ignore: progress just won't persist.
  }
  for (const fn of [...listeners]) fn();
}

export function onProfileChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ------------------------------------------------------------------ levels

export const xpToNext = (level: number): number => 60 + level * 40;

export function levelInfo(xp = profile.xp): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: xpToNext(level) };
}

export const arena = (): Arena => arenaFor(profile.trophies);

// ------------------------------------------------------------------ daily things

/** Rolls new quests at the start of each day. */
export function refreshDaily(): void {
  const d = today();
  if (profile.questDay !== d) {
    let h = 0;
    for (const ch of d) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    const pool = [...QUEST_POOL];
    const picked: QuestState[] = [];
    while (picked.length < 3 && pool.length) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      const q = pool.splice(h % pool.length, 1)[0];
      if (picked.some((p) => QUEST_POOL.find((x) => x.id === p.id)?.kind === q.kind)) continue;
      picked.push({ id: q.id, progress: 0, claimed: false });
    }
    profile.quests = picked;
    profile.questDay = d;
  }
  if (profile.shopDay !== d) {
    profile.shopDay = d;
    profile.shopBought = [];
  }
  save();
}

export function claimQuest(id: string): { coins: number; gems: number } | null {
  const q = profile.quests.find((x) => x.id === id);
  const def = QUEST_POOL.find((x) => x.id === id);
  if (!q || !def || q.claimed || q.progress < def.goal) return null;
  q.claimed = true;
  profile.coins += def.coins ?? 0;
  profile.gems += def.gems ?? 0;
  profile.xp += 10;
  save();
  return { coins: def.coins ?? 0, gems: def.gems ?? 0 };
}

function bumpQuest(kind: QuestKind, value: number, mode: 'add' | 'max'): void {
  for (const q of profile.quests) {
    const def = QUEST_POOL.find((x) => x.id === q.id);
    if (!def || def.kind !== kind || q.claimed) continue;
    q.progress = mode === 'add' ? Math.min(def.goal, q.progress + value) : Math.max(q.progress, Math.min(def.goal, value));
  }
}

// ------------------------------------------------------------------ battles

export interface BattleStats {
  won: boolean;
  score: number;
  maxChain: number;
  refugeesSent: number;
  popped: number;
  ranked: boolean;
  opponentTrophies?: number;
  boss?: boolean;
}

export interface BattleRewards {
  trophies: number;
  coins: number;
  xp: number;
  chest: ChestType | null;
  slotsFull: boolean;
  newArena: Arena | null;
  levelUp: number | null;
  questsDone: string[];
  boss: boolean;
}

export function recordBattle(s: BattleStats): BattleRewards {
  const beforeArena = arena();
  const beforeLevel = levelInfo().level;
  const st = profile.stats;
  st.played++;
  st.bestChain = Math.max(st.bestChain, s.maxChain);
  st.refugees += s.refugeesSent;
  st.popped += s.popped;
  st.bestScore = Math.max(st.bestScore, s.score);
  const before = profile.quests.map((q) => q.progress);
  bumpQuest('play', 1, 'add');
  bumpQuest('chain', s.maxChain, 'max');
  bumpQuest('send', s.refugeesSent, 'add');
  bumpQuest('pop', s.popped, 'add');
  bumpQuest('score', s.score, 'max');

  let trophies = 0;
  let coins = 0;
  let xp = 0;
  let chest: ChestType | null = null;
  let slotsFull = false;
  if (s.won) {
    st.wins++;
    st.streak++;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    bumpQuest('win', 1, 'add');
    if (s.boss) bumpQuest('boss', 1, 'add');
    xp = 20;
    coins = 8 + beforeArena.index * 3 + Math.min(st.streak, 5) * 2;
    if (s.ranked) {
      const diff = (s.opponentTrophies ?? profile.trophies) - profile.trophies;
      trophies = Math.max(24, Math.min(36, Math.round(30 + diff / 25))) + (s.boss ? 15 : 0);
      const slot = profile.chests.findIndex((c) => !c);
      if (slot >= 0) {
        chest = s.boss ? (beforeArena.index >= 6 ? 'magic' : 'gold') : CHEST_CYCLE[profile.chestCycle % CHEST_CYCLE.length];
        if (!s.boss) profile.chestCycle++;
        profile.chests[slot] = { type: chest, readyAt: null };
      } else slotsFull = true;
    }
  } else {
    st.losses++;
    st.streak = 0;
    xp = 8;
    coins = 2;
    if (s.ranked) {
      const floor = beforeArena.trophies;
      trophies = -Math.min(Math.max(0, profile.trophies - floor), 18);
    }
  }
  if (s.ranked) profile.arenaBattles[beforeArena.id] = (profile.arenaBattles[beforeArena.id] ?? 0) + 1;
  profile.trophies += trophies;
  profile.bestTrophies = Math.max(profile.bestTrophies, profile.trophies);
  profile.coins += coins;
  profile.xp += xp;
  const afterArena = arena();
  const level = levelInfo().level;
  const questsDone = profile.quests
    .filter((q, i) => {
      const def = QUEST_POOL.find((x) => x.id === q.id)!;
      return before[i] < def.goal && q.progress >= def.goal;
    })
    .map((q) => q.id);
  save();
  return {
    trophies,
    coins,
    xp,
    chest,
    slotsFull,
    newArena: afterArena.index > beforeArena.index ? afterArena : null,
    levelUp: level > beforeLevel ? level : null,
    questsDone,
    boss: !!s.boss,
  };
}

// ------------------------------------------------------------------ chests

export function chestState(slot: ChestSlot, now = Date.now()): 'locked' | 'unlocking' | 'ready' {
  if (slot.readyAt === null) return 'locked';
  return now >= slot.readyAt ? 'ready' : 'unlocking';
}

export const isUnlocking = (): boolean => profile.chests.some((c) => c && chestState(c) === 'unlocking');

export function startUnlock(i: number): boolean {
  const c = profile.chests[i];
  if (!c || c.readyAt !== null || isUnlocking()) return false;
  c.readyAt = Date.now() + CHESTS[c.type].unlockMs;
  save();
  return true;
}

export function chestSkipCost(i: number): number {
  const c = profile.chests[i];
  if (!c) return 0;
  const left = c.readyAt === null ? CHESTS[c.type].unlockMs : Math.max(0, c.readyAt - Date.now());
  return skipCost(left);
}

export function skipChest(i: number): boolean {
  const cost = chestSkipCost(i);
  const c = profile.chests[i];
  if (!c || profile.gems < cost) return false;
  profile.gems -= cost;
  c.readyAt = Date.now();
  save();
  return true;
}

export interface Loot {
  type: ChestType;
  coins: number;
  gems: number;
  skin: string | null;
  xp: number;
}

const roll = (lo: number, hi: number): number => Math.round(lo + Math.random() * (hi - lo));

export function rollLoot(type: ChestType): Loot {
  const def = CHESTS[type];
  const scale = 1 + arena().index * 0.15;
  const coins = Math.round(roll(def.coins[0], def.coins[1]) * scale);
  const gems = Math.random() < def.gemChance ? roll(def.gems[0], def.gems[1]) : 0;
  let skin: string | null = null;
  if (Math.random() < def.skinChance) {
    const locked = SKINS.filter((s) => !profile.skins.includes(s.id) && s.price);
    if (locked.length) skin = locked[Math.floor(Math.random() * locked.length)].id;
  }
  return { type, coins, gems, skin, xp: def.xp };
}

export function grantLoot(l: Loot): void {
  profile.coins += l.coins;
  profile.gems += l.gems;
  profile.xp += l.xp;
  if (l.skin && !profile.skins.includes(l.skin)) profile.skins.push(l.skin);
  save();
}

export function openChest(i: number): Loot | null {
  const c = profile.chests[i];
  if (!c || chestState(c) !== 'ready') return null;
  profile.chests[i] = null;
  const loot = rollLoot(c.type);
  grantLoot(loot);
  return loot;
}

export const freeChestReady = (): boolean => Date.now() >= profile.freeChestAt;

export function openFreeChest(): Loot | null {
  if (!freeChestReady()) return null;
  profile.freeChestAt = Date.now() + FREE_CHEST_MS;
  const loot = rollLoot('wood');
  grantLoot(loot);
  return loot;
}

// ------------------------------------------------------------------ trophy road and shop

export function claimRoad(i: number): Loot | { skin: string } | null {
  const r = TROPHY_ROAD[i];
  if (!r || profile.roadClaimed.includes(i) || profile.bestTrophies < r.trophies) return null;
  profile.roadClaimed.push(i);
  if (r.chest) {
    const loot = rollLoot(r.chest);
    grantLoot(loot);
    return loot;
  }
  profile.coins += r.coins ?? 0;
  profile.gems += r.gems ?? 0;
  if (r.skin && !profile.skins.includes(r.skin)) profile.skins.push(r.skin);
  save();
  return r.skin ? { skin: r.skin } : { type: 'wood', coins: r.coins ?? 0, gems: r.gems ?? 0, skin: null, xp: 0 };
}

export const roadUnclaimed = (): number => TROPHY_ROAD.filter((r, i) => profile.bestTrophies >= r.trophies && !profile.roadClaimed.includes(i)).length;

export function canAfford(price: { coins?: number; gems?: number }): boolean {
  return profile.coins >= (price.coins ?? 0) && profile.gems >= (price.gems ?? 0);
}

export function buy(offer: ShopOffer): Loot | { skin: string } | { coins: number } | null {
  if (profile.shopBought.includes(offer.id) || !canAfford(offer.price)) return null;
  profile.coins -= offer.price.coins ?? 0;
  profile.gems -= offer.price.gems ?? 0;
  profile.shopBought.push(offer.id);
  if (offer.kind === 'skin' && offer.skin) {
    if (!profile.skins.includes(offer.skin)) profile.skins.push(offer.skin);
    save();
    return { skin: offer.skin };
  }
  if (offer.kind === 'chest' && offer.chest) {
    const loot = rollLoot(offer.chest);
    grantLoot(loot);
    return loot;
  }
  profile.coins += offer.coins ?? 0;
  save();
  return { coins: offer.coins ?? 0 };
}

export function equipSkin(id: string): void {
  if (!profile.skins.includes(id)) return;
  profile.skin = id;
  save();
}

/** Gems spent to buy a skin straight from the collection. */
export function buySkin(id: string): boolean {
  const s = SKINS.find((x) => x.id === id);
  if (!s?.price || profile.skins.includes(id) || !canAfford(s.price)) return false;
  profile.coins -= s.price.coins ?? 0;
  profile.gems -= s.price.gems ?? 0;
  profile.skins.push(id);
  save();
  return true;
}

export { ARENAS };
