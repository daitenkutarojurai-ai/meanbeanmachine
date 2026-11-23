import { COLOR_ORDER } from './constants.ts';
import { Rng } from './rng.ts';

export const PAIR_LIST_SIZE = 256;

export interface PairLists {
  /** Built from `colors` colours; used in scenario mode and by level-1 players in VS. */
  primary: Uint8Array;
  /** Five-colour list for VS levels 2-5. Its first 8 entries are copied from `primary`. */
  versus: Uint8Array;
}

/**
 * GenPuyoOrder: fill 256 slots by cycling through the colours, then shuffle. Both players
 * draw from the same list, so a match is fair: everyone gets the same pairs in order.
 */
export function generatePairLists(seed: number, colors: number, versusMode: boolean): PairLists {
  const rng = new Rng(seed);
  const primary = new Uint8Array(PAIR_LIST_SIZE);
  for (let i = 0; i < PAIR_LIST_SIZE; i++) primary[i] = COLOR_ORDER[i % colors];
  for (let i = PAIR_LIST_SIZE - 1; i >= 0; i--) {
    const j = rng.next() & 0xff;
    const t = primary[j];
    primary[j] = primary[i];
    primary[i] = t;
  }

  const versus = primary.slice();
  if (versusMode) {
    const n = PAIR_LIST_SIZE - 8;
    for (let k = 0; k < n; k++) versus[8 + k] = COLOR_ORDER[k % 5];
    for (let i = n - 1; i >= 0; i--) {
      const j = rng.bound(n);
      const t = versus[8 + j];
      versus[8 + j] = versus[8 + i];
      versus[8 + i] = t;
    }
  }
  return { primary, versus };
}

/** Reads pairs two entries at a time; the index wraps like the game's byte counter. */
export class PairQueue {
  private index = 0;
  private readonly list: Uint8Array;

  constructor(list: Uint8Array) {
    this.list = list;
  }

  peek(offset = 0): [pivot: number, child: number] {
    const i = (this.index + offset * 2) & 0xff;
    return [this.list[i], this.list[(i + 1) & 0xff]];
  }

  take(): [pivot: number, child: number] {
    const pair = this.peek(0);
    this.index = (this.index + 2) & 0xff;
    return pair;
  }

  get position(): number {
    return this.index;
  }
}

/** Exercise mode draws each bean independently instead of using a list. */
export const EXERCISE_COLOR_ORDER = [1, 2, 3, 4, 5] as const;
