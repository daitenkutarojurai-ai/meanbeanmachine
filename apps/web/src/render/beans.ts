import { GARBAGE } from '@mbm/engine';
import { ctx2d, makeCanvas } from './pixels.ts';

/** outline, shadow, base, light, shine */
export const BEAN_PALETTES: Record<number, string[]> = {
  1: ['#4a0610', '#b01828', '#e83848', '#ff8890', '#ffe0e0'],
  2: ['#4a3400', '#c08c00', '#f8d028', '#fff08a', '#fffff4'],
  3: ['#063010', '#168428', '#34c04c', '#94f084', '#e8ffe4'],
  4: ['#28084a', '#6420a4', '#a454e4', '#d8a8ff', '#f8eaff'],
  5: ['#061650', '#1848c0', '#3484f8', '#98ccff', '#e8f4ff'],
  [GARBAGE]: ['#3a4256', '#8a92aa', '#c4ccdc', '#eef2fa', '#ffffff'],
};

export const BEAN_COLOR_CSS: Record<number, string> = {
  1: '#e83848',
  2: '#f8d028',
  3: '#34c04c',
  4: '#a454e4',
  5: '#3484f8',
  [GARBAGE]: '#c4ccdc',
};

export const CONNECT_UP = 1;
export const CONNECT_RIGHT = 2;
export const CONNECT_DOWN = 4;
export const CONNECT_LEFT = 8;

export type EyeStyle = 'open' | 'closed' | 'wide';

function sdRoundBox(px: number, py: number, l: number, t: number, r: number, b: number, rad: number): number {
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  const hx = (r - l) / 2 - rad;
  const hy = (b - t) / 2 - rad;
  const qx = Math.abs(px - cx) - hx;
  const qy = Math.abs(py - cy) - hy;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - rad;
}

function renderBean(color: number, connect: number, flash: boolean, eyes: EyeStyle): HTMLCanvasElement {
  const c = makeCanvas(16, 16);
  const g = ctx2d(c);
  const pal = BEAN_PALETTES[color];
  const garbage = color === GARBAGE;
  const l = connect & CONNECT_LEFT ? -8 : 0.6;
  const r = connect & CONNECT_RIGHT ? 24 : 15.4;
  const t = connect & CONNECT_UP ? -8 : 0.8;
  const b = connect & CONNECT_DOWN ? 24 : 15.6;
  const img = g.createImageData(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = sdRoundBox(px, py, l, t, r, b, 6.2);
      if (d > 0) continue;
      let shade: number;
      if (d > -1.1) shade = 0;
      else {
        const light = (8 - px) * 0.09 + (7 - py) * 0.12;
        const depth = Math.min(1, -d / 5);
        const v = light + depth * 0.35;
        shade = v > 0.62 ? 3 : v > -0.05 ? 2 : 1;
        if ((px - 5) ** 2 / 3 + (py - 4.2) ** 2 / 1.6 < 1) shade = 4;
      }
      let [rr, gg, bb] = hex(pal[shade]);
      if (flash) {
        rr = 255 - (255 - rr) * 0.25;
        gg = 255 - (255 - gg) * 0.25;
        bb = 255 - (255 - bb) * 0.25;
      }
      const o = (y * 16 + x) * 4;
      img.data[o] = rr;
      img.data[o + 1] = gg;
      img.data[o + 2] = bb;
      img.data[o + 3] = garbage ? (shade === 0 ? 235 : 205) : 255;
    }
  }
  g.putImageData(img, 0, 0);

  // Eyes: two white ovals with dark pupils, the bean family trademark.
  const ink = garbage ? '#2a3044' : '#141018';
  if (eyes === 'closed') {
    g.fillStyle = ink;
    g.fillRect(3, 8, 4, 1);
    g.fillRect(9, 8, 4, 1);
  } else {
    g.fillStyle = '#ffffff';
    for (const ex of [3, 9]) {
      g.fillRect(ex + 1, 5, 2, 1);
      g.fillRect(ex, 6, 4, 4);
      g.fillRect(ex + 1, 10, 2, 1);
    }
    g.fillStyle = ink;
    const pupil = eyes === 'wide' ? 1 : 2;
    g.fillRect(5, 7, pupil, pupil + 1);
    g.fillRect(11, 7, pupil, pupil + 1);
  }
  return c;
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const cache = new Map<string, HTMLCanvasElement>();

export function beanSprite(color: number, connect = 0, flash = false, eyes: EyeStyle = 'open'): HTMLCanvasElement {
  const key = `${color}:${connect}:${flash ? 1 : 0}:${eyes}`;
  let s = cache.get(key);
  if (!s) {
    s = renderBean(color, color === GARBAGE ? 0 : connect, flash, eyes);
    cache.set(key, s);
  }
  return s;
}

/** Warm the cache so the first frames don't stutter. */
export function preloadBeans(): void {
  for (const color of [1, 2, 3, 4, 5]) for (let m = 0; m < 16; m++) beanSprite(color, m);
  beanSprite(GARBAGE);
}
