import {
  CHAIN_POWER,
  COLOR_BONUS,
  COLS,
  EMPTY,
  GARBAGE,
  GROUP_BONUS,
  MAX_BONUS,
  POP_SIZE,
  ROWS,
  VISIBLE_TOP,
} from './constants.ts';

export type Field = Uint8Array;

export const idx = (x: number, y: number): number => y * COLS + x;
export const colOf = (i: number): number => i % COLS;
export const rowOf = (i: number): number => (i / COLS) | 0;

export function createField(): Field {
  return new Uint8Array(COLS * ROWS);
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

/** Out-of-bounds cells count as blocked, matching the unsigned compares in the game. */
export function isFree(field: Field, x: number, y: number): boolean {
  return inBounds(x, y) && field[idx(x, y)] === EMPTY;
}

export const isColor = (c: number): boolean => c >= 1 && c <= 5;

export interface Group {
  color: number;
  cells: number[];
}

/** Groups of four or more connected same-colour beans. Only the 12 visible rows connect. */
export function findGroups(field: Field, minSize = POP_SIZE): Group[] {
  const seen = new Uint8Array(COLS * ROWS);
  const groups: Group[] = [];
  const stack: number[] = [];
  for (let y = VISIBLE_TOP; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const start = idx(x, y);
      const color = field[start];
      if (seen[start] || !isColor(color)) continue;
      const cells: number[] = [];
      seen[start] = 1;
      stack.push(start);
      while (stack.length) {
        const i = stack.pop()!;
        cells.push(i);
        const cx = colOf(i);
        const cy = rowOf(i);
        if (cx > 0) visit(i - 1);
        if (cx < COLS - 1) visit(i + 1);
        if (cy > VISIBLE_TOP) visit(i - COLS);
        if (cy < ROWS - 1) visit(i + COLS);
      }
      if (cells.length >= minSize) groups.push({ color, cells });

      function visit(n: number): void {
        if (!seen[n] && field[n] === color) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
  }
  return groups;
}

/** Refugee beans in the visible rows that touch a popping bean. */
export function adjacentGarbage(field: Field, popping: readonly number[]): number[] {
  const hit = new Set<number>();
  for (const i of popping) {
    const x = colOf(i);
    const y = rowOf(i);
    const check = (nx: number, ny: number): void => {
      if (nx < 0 || nx >= COLS || ny < VISIBLE_TOP || ny >= ROWS) return;
      const n = idx(nx, ny);
      if (field[n] === GARBAGE) hit.add(n);
    };
    check(x - 1, y);
    check(x + 1, y);
    check(x, y - 1);
    check(x, y + 1);
  }
  return [...hit];
}

export interface FallMove {
  x: number;
  fromY: number;
  toY: number;
  cell: number;
}

/** Drops every bean in rows 1..13 to rest; row 0 never holds beans. */
export function settle(field: Field): FallMove[] {
  const moves: FallMove[] = [];
  for (let x = 0; x < COLS; x++) {
    let write = ROWS - 1;
    for (let y = ROWS - 1; y >= 1; y--) {
      const c = field[idx(x, y)];
      if (c === EMPTY) continue;
      if (y !== write) {
        field[idx(x, write)] = c;
        field[idx(x, y)] = EMPTY;
        moves.push({ x, fromY: y, toY: write, cell: c });
      }
      write--;
    }
  }
  return moves;
}

/** Empty cells in rows 1..13 of a column (GetGarbageFreeSpace). */
export function freeCells(field: Field, x: number): number {
  let n = 0;
  for (let y = 1; y < ROWS; y++) if (field[idx(x, y)] === EMPTY) n++;
  return n;
}

export function countBeans(field: Field): number {
  let n = 0;
  for (let i = COLS; i < field.length; i++) if (field[i] !== EMPTY) n++;
  return n;
}

/** Height of a column counted from the floor, in rows 1..13. */
export function columnHeight(field: Field, x: number): number {
  for (let y = 1; y < ROWS; y++) if (field[idx(x, y)] !== EMPTY) return ROWS - y;
  return 0;
}

export interface StepScore {
  cleared: number;
  colors: number;
  base: number;
  bonus: number;
  points: number;
}

/**
 * One chain step: (10 x beans cleared) x (chain power + colour bonus + group bonus),
 * bonus capped at 999, and a bonus of 0 counts as x1. `levelMultiplier` is Exercise's level.
 */
export function scoreStep(groups: readonly Group[], chainIndex: number, levelMultiplier = 0): StepScore {
  let cleared = 0;
  let colorMask = 0;
  let groupBonus = 0;
  for (const g of groups) {
    cleared += g.cells.length;
    colorMask |= 1 << g.color;
    groupBonus += GROUP_BONUS[Math.min(g.cells.length, GROUP_BONUS.length - 1)];
  }
  let colors = 0;
  for (let m = colorMask; m; m &= m - 1) colors++;
  const base = Math.min((levelMultiplier + 1) * 10 * cleared, 0xffff);
  const bonus = Math.min(
    CHAIN_POWER[Math.min(chainIndex, CHAIN_POWER.length - 1)] + COLOR_BONUS[colors] + groupBonus,
    MAX_BONUS,
  );
  return { cleared, colors, base, bonus, points: bonus === 0 ? base : base * bonus };
}

/** Resolves a whole chain instantly. Used by the AI and tests. */
export function resolveChain(field: Field): { chain: number; points: number; cleared: number } {
  let chain = 0;
  let points = 0;
  let cleared = 0;
  settle(field);
  for (;;) {
    const groups = findGroups(field);
    if (!groups.length) break;
    const s = scoreStep(groups, chain);
    points += s.points;
    cleared += s.cleared;
    const popping = groups.flatMap((g) => g.cells);
    for (const i of adjacentGarbage(field, popping)) field[i] = EMPTY;
    for (const i of popping) field[i] = EMPTY;
    settle(field);
    chain++;
  }
  return { chain, points, cleared };
}
