// Fall-speed tables. Each entry is [speed added to the 16-bit fall accumulator per frame,
// beans to clear before moving to the next entry]. 0xffff means "never".

export type SpeedEntry = readonly [speed: number, threshold: number];

/** unk_9DC4: Scenario. Index = stage base + level-ups - difficulty offset. */
export const SCENARIO_SPEED: readonly SpeedEntry[] = [
  [0x0400, 0x20], [0x0400, 0x20], [0x0500, 0x20], [0x0500, 0x20],
  [0x0600, 0x20], [0x0800, 0x20], [0x0a00, 0x20], [0x0c00, 0x28],
  [0x1000, 0x28], [0x2000, 0x30], [0x3000, 0x30], [0x4000, 0x38],
  [0x4800, 0x38], [0x5000, 0x40], [0x6000, 0x40], [0x8000, 0xffff],
  [0x8000, 0xffff], [0x8000, 0x04], [0x8000, 0x04], [0x8000, 0x04],
  [0xa000, 0x04], [0xc000, 0x04], [0xe000, 0x04], [0xfe00, 0xffff],
];

/** unk_3F84: starting index per scenario stage (1..13). */
export const SCENARIO_STAGE_BASE = [8, 9, 10, 11, 12, 13, 14, 15, 17, 17, 18, 18, 19] as const;

export type Difficulty = 'easy' | 'normal' | 'hard' | 'hardest';
/** byte_FF0104 = COM level x 2, where hardest = 0 and easy = 3. */
export const DIFFICULTY_OFFSET: Record<Difficulty, number> = { easy: 6, normal: 4, hard: 2, hardest: 0 };

/**
 * unk_9E24: 1P vs 2P. Index = (level-ups & 7) | ((level * 4) & 0x18), so levels 1-2,
 * 3-4 and 5 use three sets. Level 5's set starts one entry late, exactly as in the ROM.
 * The last two entries spill over from the Exercise table that follows it.
 */
export const VERSUS_SPEED: readonly SpeedEntry[] = [
  [0x1000, 0x20], [0x1600, 0x20], [0x1a00, 0x20], [0x2000, 0x20],
  [0x2500, 0x20], [0x3000, 0x20], [0x3400, 0x20], [0x4000, 0xffff],
  [0x2000, 0x20], [0x2500, 0x20], [0x3000, 0x20], [0x3400, 0x20],
  [0x4000, 0x20], [0x6000, 0x20], [0x8000, 0xffff], [0x2000, 0x10],
  [0x2500, 0x10], [0x3000, 0x10], [0x3400, 0x10], [0x4000, 0x10],
  [0x6000, 0x10], [0x8000, 0xffff], [0x1000, 0x04], [0x1600, 0x04],
];

/** unk_9E7C: Exercise. Index = EXERCISE_ROW[min(level, 12)] | (level-ups & 7). */
export const EXERCISE_SPEED: readonly SpeedEntry[] = [
  [0x1000, 4], [0x1600, 4], [0x2000, 4], [0x3000, 4], [0x3400, 8], [0x4000, 8], [0x6000, 8], [0x6000, 8],
  [0x2000, 4], [0x2000, 4], [0x3000, 4], [0x3000, 4], [0x3400, 4], [0x3400, 4], [0x4000, 4], [0x4000, 4],
  [0x4000, 4], [0x4000, 4], [0x6000, 4], [0x6000, 4], [0x8000, 4], [0x8000, 4], [0x8000, 4], [0x8000, 4],
  [0x3000, 4], [0x3000, 4], [0x3400, 4], [0x3400, 4], [0x4000, 4], [0x4000, 4], [0x6000, 4], [0x6000, 4],
  [0x6000, 4], [0x6000, 4], [0x8000, 4], [0x8000, 4], [0x8000, 4], [0x8000, 4], [0x8000, 4], [0x8000, 4],
  [0x3400, 4], [0x3400, 4], [0x4000, 4], [0x4000, 4], [0x6000, 4], [0x6000, 4], [0x8000, 4], [0x8000, 4],
  [0x8000, 4], [0x8000, 4], [0xa000, 4], [0xa000, 4], [0xc000, 4], [0xc000, 4], [0xe000, 4], [0xe000, 4],
  [0x8000, 4], [0x8000, 4], [0xa000, 4], [0xa000, 4], [0xc000, 4], [0xc000, 4], [0xe000, 4], [0xfe00, 8],
  [0xfe00, 4], [0xfe00, 4], [0xfe00, 4], [0xfe00, 4], [0xfe00, 4], [0xfe00, 4], [0xfe00, 4], [0xfe00, 4],
  [0x0800, 4], [0x0800, 4], [0x0b00, 4], [0x0b00, 4], [0x0b00, 4], [0x1000, 4], [0x1000, 4], [0x1000, 4],
  [0x0b00, 4], [0x0b00, 4], [0x0b00, 4], [0x0c00, 4], [0x0c00, 4], [0x0d00, 4], [0x1000, 4], [0x1000, 4],
];
export const EXERCISE_ROW = [72, 80, 0, 8, 16, 24, 32, 40, 48, 56, 56, 56, 64] as const;

/** word_3B58: frames of pause after a pair settles, by level. */
export const POST_LOCK_DELAY = [12, 8, 4, 2, 0] as const;
/** unk_9C04: refugee beans waiting at the start of a VS round, by level. */
export const VERSUS_START_GARBAGE = [0, 0, 0, 18, 30] as const;

export type SpeedRule =
  | { kind: 'scenario'; stage: number; difficulty: Difficulty }
  | { kind: 'versus'; level: number }
  | { kind: 'exercise' };

export function speedEntry(rule: SpeedRule, levelups: number, exerciseLevel: number): SpeedEntry {
  switch (rule.kind) {
    case 'scenario': {
      const base = SCENARIO_STAGE_BASE[Math.max(0, Math.min(12, rule.stage))];
      const i = Math.max(0, base + levelups - DIFFICULTY_OFFSET[rule.difficulty]);
      return SCENARIO_SPEED[Math.min(i, SCENARIO_SPEED.length - 1)];
    }
    case 'versus':
      return VERSUS_SPEED[(levelups & 7) | ((rule.level * 4) & 0x18)];
    case 'exercise':
      return EXERCISE_SPEED[EXERCISE_ROW[Math.min(exerciseLevel, 12)] | (levelups & 7)];
  }
}
