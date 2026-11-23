/**
 * The game's own random number generator (Random / RandomBound in the disassembly):
 * seed = seed * 41, then the two 16-bit halves are summed to make the output word.
 */
export const DEFAULT_SEED = 0x2a6d365a;

export class Rng {
  seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0 || DEFAULT_SEED;
  }

  /** Returns the 16-bit output word. */
  next(): number {
    const s = this.seed >>> 0 || DEFAULT_SEED;
    const mixed = Math.imul(s, 41) >>> 0;
    const lo = mixed & 0xffff;
    const sum = (lo + (mixed >>> 16)) & 0xffff;
    this.seed = ((sum << 16) | lo) >>> 0;
    return sum;
  }

  /** Uniform integer in [0, bound). */
  bound(bound: number): number {
    return (this.next() * bound) >>> 16;
  }
}

export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || DEFAULT_SEED;
}

/** Derives an independent seed for a sub-stream (e.g. one player's refugee drops). */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) || DEFAULT_SEED;
}
