// Glossy vector beans, rendered once per pixel size and cached.
import { GARBAGE } from '@mbm/engine';

export type EyeStyle = 'open' | 'blink' | 'closed' | 'wide' | 'up' | 'happy' | 'sleepy';

export interface BeanColors {
  light: string;
  base: string;
  dark: string;
  rim: string;
}

export const JELLY: Record<number, BeanColors> = {
  1: { light: '#ffb0b6', base: '#ff4d5e', dark: '#b0142e', rim: '#ff8a94' },
  2: { light: '#fff6b0', base: '#ffcb2e', dark: '#c47f00', rim: '#ffe37a' },
  3: { light: '#c2f9b4', base: '#3ed760', dark: '#12822f', rim: '#86f095' },
  4: { light: '#e8c4ff', base: '#a95cf0', dark: '#5418a0', rim: '#cfa2ff' },
  5: { light: '#b4e2ff', base: '#319dff', dark: '#0b4cad', rim: '#82c8ff' },
  [GARBAGE]: { light: '#ffffff', base: '#cdd3e6', dark: '#7a84a8', rim: '#e8ecf6' },
};

export const beanCss = (c: number): string => JELLY[c]?.base ?? '#fff';

const cache = new Map<string, HTMLCanvasElement>();
let cachedSize = 0;

function eyes(g: CanvasRenderingContext2D, s: number, style: EyeStyle, ink: string, lid: string): void {
  const ey = s * 0.47;
  const rx = s * 0.115;
  const ry = s * 0.14;
  for (const ex of [s * 0.34, s * 0.66]) {
    if (style === 'closed' || style === 'happy') {
      g.strokeStyle = ink;
      g.lineWidth = s * 0.045;
      g.lineCap = 'round';
      g.beginPath();
      if (style === 'closed') g.arc(ex, ey - s * 0.02, rx * 0.8, Math.PI * 0.15, Math.PI * 0.85);
      else g.arc(ex, ey + s * 0.05, rx * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
      continue;
    }
    const wide = style === 'wide' ? 1.12 : 1;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(ex, ey, rx * wide, ry * wide, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = s * 0.015;
    g.stroke();
    const pr = style === 'wide' ? s * 0.045 : s * 0.068;
    const py = style === 'up' ? ey - ry * 0.45 : ey + ry * 0.18;
    const px = ex + rx * 0.12;
    g.fillStyle = ink;
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.38, 0, Math.PI * 2);
    g.fill();
    if (style === 'blink' || style === 'sleepy') {
      // Eyelid slides down over the top of the eye.
      g.save();
      g.beginPath();
      g.ellipse(ex, ey, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = lid;
      g.fillRect(ex - rx * 1.2, ey - ry * 1.2, rx * 2.4, ry * (style === 'blink' ? 1.9 : 1.15));
      g.restore();
      g.strokeStyle = ink;
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(ex - rx, ey + ry * (style === 'blink' ? 0.7 : -0.05));
      g.lineTo(ex + rx, ey + ry * (style === 'blink' ? 0.7 : -0.05));
      g.stroke();
    }
  }
}

function mouth(g: CanvasRenderingContext2D, s: number, style: EyeStyle, ink: string): void {
  const mx = s * 0.5;
  const my = s * 0.7;
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = s * 0.035;
  g.lineCap = 'round';
  g.beginPath();
  if (style === 'wide') {
    g.ellipse(mx, my + s * 0.01, s * 0.045, s * 0.055, 0, 0, Math.PI * 2);
    g.fill();
  } else if (style === 'happy') {
    g.arc(mx, my - s * 0.02, s * 0.08, 0.1, Math.PI - 0.1);
    g.closePath();
    g.fill();
  } else if (style === 'up') {
    g.moveTo(mx - s * 0.06, my + s * 0.01);
    g.quadraticCurveTo(mx - s * 0.03, my - s * 0.02, mx, my + s * 0.01);
    g.quadraticCurveTo(mx + s * 0.03, my + s * 0.04, mx + s * 0.06, my + s * 0.01);
    g.stroke();
  } else if (style !== 'sleepy') {
    g.arc(mx, my - s * 0.03, s * 0.055, Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
  }
}

function render(color: number, s: number, eyesStyle: EyeStyle, flash: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d')!;
  const col = JELLY[color];
  const garbage = color === GARBAGE;
  const inset = s * 0.055;
  const w = s - inset * 2;
  const path = new Path2D();
  path.roundRect(inset, inset, w, w, s * 0.4);
  // Soft drop shadow.
  g.save();
  g.translate(0, s * 0.03);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fill(path);
  g.restore();
  const grad = g.createRadialGradient(s * 0.38, s * 0.3, s * 0.05, s * 0.5, s * 0.5, s * 0.62);
  grad.addColorStop(0, col.light);
  grad.addColorStop(0.45, col.base);
  grad.addColorStop(1, col.dark);
  g.globalAlpha = garbage ? 0.94 : 1;
  g.fillStyle = grad;
  g.fill(path);
  g.globalAlpha = 1;
  // Light bouncing up inside the bottom edge.
  g.save();
  g.clip(path);
  g.strokeStyle = col.rim;
  g.globalAlpha = 0.55;
  g.lineWidth = s * 0.06;
  g.beginPath();
  g.ellipse(s * 0.5, s * 0.5, w * 0.42, w * 0.42, 0, Math.PI * 0.2, Math.PI * 0.8);
  g.stroke();
  g.restore();
  g.globalAlpha = 1;
  g.strokeStyle = col.dark;
  g.lineWidth = Math.max(1, s * 0.035);
  g.stroke(path);
  // Glossy highlight.
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.ellipse(s * 0.33, s * 0.22, s * 0.15, s * 0.075, -0.45, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(s * 0.68, s * 0.2, s * 0.035, 0, Math.PI * 2);
  g.fill();
  eyes(g, s, eyesStyle, garbage ? '#3a4260' : '#1a1024', col.base);
  mouth(g, s, eyesStyle, garbage ? '#3a4260' : '#1a1024');
  if (flash) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,0.72)';
    g.fillRect(0, 0, s, s);
  }
  return c;
}

/** A bean sprite `size` device pixels square. */
export function jelly(color: number, size: number, eyesStyle: EyeStyle = 'open', flash = false): HTMLCanvasElement {
  const s = Math.max(8, Math.round(size));
  if (s !== cachedSize) {
    cache.clear();
    cachedSize = s;
  }
  const e = color === GARBAGE && (eyesStyle === 'open' || eyesStyle === 'up') ? 'sleepy' : eyesStyle;
  const key = `${color}:${e}:${flash ? 1 : 0}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = render(color, s, e, flash);
    cache.set(key, sprite);
  }
  return sprite;
}

/** Sprites at other sizes (menus, NEXT box) keep their own small cache. */
const extra = new Map<string, HTMLCanvasElement>();
export function jellyAt(color: number, size: number, eyesStyle: EyeStyle = 'open'): HTMLCanvasElement {
  const s = Math.max(8, Math.round(size));
  const key = `${color}:${s}:${eyesStyle}`;
  let sprite = extra.get(key);
  if (!sprite) {
    if (extra.size > 300) extra.clear();
    sprite = render(color, s, eyesStyle, false);
    extra.set(key, sprite);
  }
  return sprite;
}

/** The jelly joint between two touching beans of one colour, drawn under them. */
export function bridge(g: CanvasRenderingContext2D, color: number, x: number, y: number, cell: number, horizontal: boolean): void {
  const col = JELLY[color];
  const thick = cell * 0.62;
  g.fillStyle = col.base;
  if (horizontal) {
    const grad = g.createLinearGradient(0, y + cell / 2 - thick / 2, 0, y + cell / 2 + thick / 2);
    grad.addColorStop(0, col.light);
    grad.addColorStop(0.5, col.base);
    grad.addColorStop(1, col.dark);
    g.fillStyle = grad;
    g.fillRect(x + cell / 2, y + cell / 2 - thick / 2, cell, thick);
  } else {
    const grad = g.createLinearGradient(x + cell / 2 - thick / 2, 0, x + cell / 2 + thick / 2, 0);
    grad.addColorStop(0, col.light);
    grad.addColorStop(0.5, col.base);
    grad.addColorStop(1, col.dark);
    g.fillStyle = grad;
    g.fillRect(x + cell / 2 - thick / 2, y + cell / 2, thick, cell);
  }
}
