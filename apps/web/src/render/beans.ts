import { GARBAGE } from '@mbm/engine';
import { ctx2d, makeCanvas } from './pixels.ts';

/** outline, deep shadow, shadow, base, light, shine, rim */
export const BEAN_PALETTES: Record<number, string[]> = {
  1: ['#3c0410', '#8c1020', '#c41e30', '#ec3c4c', '#ff8a92', '#fff0f0', '#ff6870'],
  2: ['#3c2a00', '#9a6a00', '#d49e00', '#f8cc28', '#fff088', '#fffff6', '#ffe060'],
  3: ['#04280c', '#0e6420', '#1c9a34', '#36c450', '#98f088', '#effff0', '#6ae070'],
  4: ['#22063e', '#4c1888', '#7a34c0', '#a656e6', '#d8aaff', '#fbf0ff', '#c486ff'],
  5: ['#04123e', '#123a9c', '#1e62dc', '#3a8cfa', '#9ccfff', '#f0f8ff', '#6ab2ff'],
  [GARBAGE]: ['#323a50', '#6c7690', '#949eb8', '#c2cade', '#e8eef8', '#ffffff', '#d6dcea'],
};

export const BEAN_COLOR_CSS: Record<number, string> = {
  1: '#ec3c4c',
  2: '#f8cc28',
  3: '#36c450',
  4: '#a656e6',
  5: '#3a8cfa',
  [GARBAGE]: '#c2cade',
};

export const CONNECT_UP = 1;
export const CONNECT_RIGHT = 2;
export const CONNECT_DOWN = 4;
export const CONNECT_LEFT = 8;

export type EyeStyle = 'open' | 'blink' | 'closed' | 'wide' | 'up' | 'happy' | 'sleepy';

function sdRoundBox(px: number, py: number, l: number, t: number, r: number, b: number, rad: number): number {
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  const qx = Math.abs(px - cx) - ((r - l) / 2 - rad);
  const qy = Math.abs(py - cy) - ((b - t) / 2 - rad);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function renderBean(color: number, connect: number, flash: boolean, eyes: EyeStyle): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const g = ctx2d(c);
  const pal = BEAN_PALETTES[color];
  const garbage = color === GARBAGE;
  // Connected sides run off the sprite so neighbours melt into one jelly blob.
  const l = connect & CONNECT_LEFT ? -8 : 0.5;
  const r = connect & CONNECT_RIGHT ? 24 : 15.5;
  const t = connect & CONNECT_UP ? -8 : 0.7;
  const b = connect & CONNECT_DOWN ? 24 : 15.6;
  const img = g.createImageData(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = sdRoundBox(px, py, l, t, r, b, 6.4);
      if (d > 0) continue;
      let shade: number;
      if (d > -1.05) shade = 0;
      else {
        const light = (8 - px) * 0.085 + (6.5 - py) * 0.13;
        const depth = Math.min(1, -d / 5.5);
        const v = light + depth * 0.42;
        shade = v > 0.78 ? 4 : v > 0.12 ? 3 : v > -0.32 ? 2 : 1;
        // Light bouncing back up inside the bottom edge: the jelly look.
        if (d > -2.2 && py > 11 && !(connect & CONNECT_DOWN)) shade = 6;
        if ((px - 4.8) ** 2 / 3.2 + (py - 3.9) ** 2 / 1.5 < 1 && !(connect & CONNECT_UP)) shade = 5;
        if (x === 11 && y === 3 && !(connect & (CONNECT_UP | CONNECT_RIGHT))) shade = 5;
      }
      let [rr, gg, bb] = hex(pal[shade]);
      if (flash) {
        rr = 255 - (255 - rr) * 0.2;
        gg = 255 - (255 - gg) * 0.2;
        bb = 255 - (255 - bb) * 0.2;
      }
      const o = (y * 16 + x) * 4;
      img.data[o] = rr;
      img.data[o + 1] = gg;
      img.data[o + 2] = bb;
      img.data[o + 3] = garbage ? (shade === 0 ? 240 : 215) : 255;
    }
  }
  g.putImageData(img, 0, 0);
  drawEyes(g, eyes, garbage ? '#283048' : '#100c18', pal[2]);
  return c;
}

function drawEyes(g: CanvasRenderingContext2D, eyes: EyeStyle, ink: string, lid: string): void {
  const px = (x: number, y: number, w: number, h: number, col: string): void => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  for (const ex of [3, 9]) {
    switch (eyes) {
      case 'closed':
        px(ex, 8, 1, 1, ink);
        px(ex + 1, 9, 2, 1, ink);
        px(ex + 3, 8, 1, 1, ink);
        break;
      case 'happy':
        px(ex, 8, 1, 1, ink);
        px(ex + 1, 7, 2, 1, ink);
        px(ex + 3, 8, 1, 1, ink);
        break;
      case 'blink':
      case 'sleepy':
        px(ex, 7, 4, 3, '#ffffff');
        px(ex, 6, 4, eyes === 'blink' ? 3 : 2, lid);
        px(ex, eyes === 'blink' ? 9 : 8, 4, 1, ink);
        if (eyes === 'sleepy') px(ex + 1, 9, 2, 1, ink);
        break;
      default: {
        // White, rounded: 4x5 with the corners trimmed.
        px(ex + 1, 5, 2, 1, '#ffffff');
        px(ex, 6, 4, 4, '#ffffff');
        px(ex + 1, 10, 2, 1, '#ffffff');
        if (eyes === 'wide') {
          px(ex + 1, 7, 2, 2, ink);
        } else {
          const py = eyes === 'up' ? 5 : 7;
          px(ex + 2, py, 2, 3, ink);
          px(ex + 2, py, 1, 1, '#ffffff');
        }
      }
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>();

export function beanSprite(color: number, connect = 0, flash = false, eyes: EyeStyle = 'open'): HTMLCanvasElement {
  const e = color === GARBAGE && eyes === 'open' ? 'sleepy' : eyes;
  const key = `${color}:${connect}:${flash ? 1 : 0}:${e}`;
  let s = cache.get(key);
  if (!s) {
    s = renderBean(color, color === GARBAGE ? 0 : connect, flash, e);
    cache.set(key, s);
  }
  return s;
}

/** Warm the cache so the first frames don't stutter. */
export function preloadBeans(): void {
  for (const color of [1, 2, 3, 4, 5]) for (let m = 0; m < 16; m++) beanSprite(color, m);
  beanSprite(GARBAGE);
}

/** A small four-point star for sparkles. */
export function starSprite(color: string): HTMLCanvasElement {
  const key = `star:${color}`;
  let s = cache.get(key);
  if (!s) {
    s = makeCanvas(7, 7);
    const g = ctx2d(s);
    g.fillStyle = color;
    g.fillRect(3, 0, 1, 7);
    g.fillRect(0, 3, 7, 1);
    g.fillRect(2, 2, 3, 3);
    g.fillStyle = '#ffffff';
    g.fillRect(3, 3, 1, 1);
    cache.set(key, s);
  }
  return s;
}
