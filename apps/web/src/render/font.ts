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

const fancyCache = new Map<string, HTMLCanvasElement>();

/** Big banner text: vertical gradient fill, black outline and drop shadow, cached. */
export function fancyText(text: string, scale: number, top: string, bottom: string): HTMLCanvasElement {
  const s = text.toUpperCase();
  const key = `${s}|${scale}|${top}|${bottom}`;
  let out = fancyCache.get(key);
  if (out) return out;
  const w = textWidth(s, scale) + 6;
  const h = 7 * scale + 6;
  const fill = makeCanvas(w, h);
  const fg = ctx2d(fill);
  drawText(fg, s, 2, 2, { color: '#ffffff', scale, shadow: null });
  fg.globalCompositeOperation = 'source-in';
  const grad = fg.createLinearGradient(0, 2, 0, 2 + 7 * scale);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, top);
  grad.addColorStop(0.56, bottom);
  grad.addColorStop(1, bottom);
  fg.fillStyle = grad;
  fg.fillRect(0, 0, w, h);
  out = makeCanvas(w, h);
  const og = ctx2d(out);
  drawText(og, s, 2 + Math.max(1, scale / 2), 2 + Math.max(1, scale / 2), { color: '#000000', scale, shadow: null });
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    drawText(og, s, 2 + dx, 2 + dy, { color: '#000000', scale, shadow: null });
  }
  og.drawImage(fill, 0, 0);
  if (fancyCache.size > 200) fancyCache.clear();
  fancyCache.set(key, out);
  return out;
}

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
