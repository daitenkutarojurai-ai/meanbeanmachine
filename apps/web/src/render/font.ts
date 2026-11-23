import { type Ctx, ctx2d, makeCanvas } from './pixels.ts';

// 5x7 glyphs on a 6x8 grid.
const GLYPHS: Record<string, string> = {
  A: '.###.#...##...#######...##...##...#',
  B: '####.#...##...#####.#...##...#####.',
  C: '.###.#...##....#....#....#...#.###.',
  D: '####.#...##...##...##...##...#####.',
  E: '######....#....####.#....#....#####',
  F: '######....#....####.#....#....#....',
  G: '.###.#...##....#.####...##...#.####',
  H: '#...##...##...#######...##...##...#',
  I: '.###...#....#....#....#....#...###.',
  J: '..###...#....#....#....##..#..##...',
  K: '#...##..#.#.#..##...#.#..#..#.#...#',
  L: '#....#....#....#....#....#....#####',
  M: '#...###.###.#.##.#.##...##...##...#',
  N: '#...##...###..##.#.##..###...##...#',
  O: '.###.#...##...##...##...##...#.###.',
  P: '####.#...##...#####.#....#....#....',
  Q: '.###.#...##...##...##.#.##..#..##.#',
  R: '####.#...##...#####.#.#..#..#.#...#',
  S: '.#####....#.....###.....#....#####.',
  T: '#####..#....#....#....#....#....#..',
  U: '#...##...##...##...##...##...#.###.',
  V: '#...##...##...##...##...#.#.#...#..',
  W: '#...##...##...##.#.##.#.##.#.#.#.#.',
  X: '#...##...#.#.#...#...#.#.#...##...#',
  Y: '#...##...#.#.#...#....#....#....#..',
  Z: '#####....#...#...#...#...#....#####',
  '0': '.###.#...##..###.#.###..##...#.###.',
  '1': '..#...##....#....#....#....#...###.',
  '2': '.###.#...#....#...#...#...#...#####',
  '3': '#####...#...#.....#.....##...#.###.',
  '4': '...#...##..#.#.#..#.#####...#....#.',
  '5': '######....####.....#....##...#.###.',
  '6': '..##..#...#....####.#...##...#.###.',
  '7': '#####....#...#...#...#....#....#...',
  '8': '.###.#...##...#.###.#...##...#.###.',
  '9': '.###.#...##...#.####....#...#..##..',
  '.': '..........................##...##..',
  ',': '.....................##....#...#...',
  '!': '..#....#....#....#....#.........#..',
  '?': '.###.#...#....#...#...#.........#..',
  ':': '......##...##.........##...##......',
  '-': '................###................',
  '+': '.......#....#..#####..#....#.......',
  '*': '.....#...#.#.#...#...#.#.#...#.....',
  '/': '....#....#...#...#...#...#....#....',
  "'": '..#....#...#.......................',
  '"': '.#.#..#.#..........................',
  '(': '...#...#...#....#....#.....#.....#.',
  ')': '.#.....#.....#....#....#...#...#...',
  '%': '##..###..#...#...#...#...#..###..##',
  '#': '.#.#..#.#.#####.#.#.#####.#.#..#.#.',
  '<': '...#...#...#...#.....#.....#.....#.',
  '>': '.#.....#.....#.....#...#...#...#...',
  '=': '..........#####.....#####..........',
  ' ': '',
};

const ORDER = Object.keys(GLYPHS);
const INDEX = new Map(ORDER.map((ch, i) => [ch, i]));
const atlases = new Map<string, HTMLCanvasElement>();

function atlas(color: string): HTMLCanvasElement {
  let c = atlases.get(color);
  if (c) return c;
  c = makeCanvas(ORDER.length * 6, 8);
  const g = ctx2d(c);
  g.fillStyle = color;
  ORDER.forEach((ch, i) => {
    const bits = GLYPHS[ch];
    for (let p = 0; p < bits.length; p++) if (bits[p] === '#') g.fillRect(i * 6 + (p % 5), (p / 5) | 0, 1, 1);
  });
  atlases.set(color, c);
  return c;
}

export interface TextOptions {
  color?: string;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  shadow?: string | null;
  outline?: string | null;
}

export const CHAR_W = 6;

export function textWidth(text: string, scale = 1): number {
  return text.length * CHAR_W * scale - scale;
}

export function drawText(g: Ctx, text: string, x: number, y: number, opts: TextOptions = {}): void {
  const { color = '#ffffff', scale = 1, align = 'left', shadow = '#000000', outline = null } = opts;
  const s = text.toUpperCase();
  let left = x;
  if (align === 'center') left = x - Math.floor(textWidth(s, scale) / 2);
  else if (align === 'right') left = x - textWidth(s, scale);
  left = Math.round(left);
  const top = Math.round(y);
  const prev = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  const pass = (col: string, dx: number, dy: number): void => {
    const a = atlas(col);
    for (let i = 0; i < s.length; i++) {
      const gi = INDEX.get(s[i]);
      if (gi === undefined || s[i] === ' ') continue;
      g.drawImage(a, gi * 6, 0, 5, 7, left + i * CHAR_W * scale + dx, top + dy, 5 * scale, 7 * scale);
    }
  };
  if (outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) pass(outline, dx, dy);
  } else if (shadow) {
    pass(shadow, scale, scale);
  }
  pass(color, 0, 0);
  g.imageSmoothingEnabled = prev;
}
