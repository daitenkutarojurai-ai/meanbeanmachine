import type { Character, Portrait } from '../game/characters.ts';
import { type Ctx, ctx2d, ellipse, ellipseOutlined, line, makeCanvas, rect, rectOutlined, triangle } from './pixels.ts';

export type Expression = 'idle' | 'happy' | 'worried' | 'ko';

const SIZE = 64;
const cache = new Map<string, HTMLCanvasElement>();

export function portrait(ch: Character, expr: Expression = 'idle'): HTMLCanvasElement {
  const key = `${ch.id}:${expr}`;
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(SIZE, SIZE);
    drawPortrait(ctx2d(c), ch.portrait, expr);
    cache.set(key, c);
  }
  return c;
}

function drawPortrait(g: Ctx, p: Portrait, expr: Expression): void {
  // Backdrop: diagonal stripes in the character's colour.
  rect(g, 0, 0, SIZE, SIZE, p.bg);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = -SIZE; i < SIZE; i += 8) {
    g.beginPath();
    g.moveTo(i, SIZE);
    g.lineTo(i + 4, SIZE);
    g.lineTo(i + 4 + SIZE, 0);
    g.lineTo(i + SIZE, 0);
    g.fill();
  }
  const o = p.dark;

  // Shoulders.
  if (p.head !== 'bean') {
    ellipseOutlined(g, 32, 66, 26, 12, p.dark, '#000');
    rect(g, 26, 52, 12, 8, p.dark);
  }

  behind(g, p);

  switch (p.head) {
    case 'round':
    case 'cat':
    case 'mouse':
      ellipseOutlined(g, 32, 34, 20, 18, p.body, o);
      ellipse(g, 26, 26, 8, 5, p.light);
      break;
    case 'square':
      rectOutlined(g, 12, 15, 40, 36, p.body, o);
      rect(g, 14, 17, 36, 4, p.light);
      for (const [x, y] of [[15, 47], [47, 47], [15, 23], [47, 23]]) rect(g, x, y, 2, 2, o);
      break;
    case 'dome':
      ellipseOutlined(g, 32, 30, 19, 17, p.body, o);
      rectOutlined(g, 13, 30, 38, 18, p.body, o);
      ellipse(g, 26, 22, 7, 4, p.light);
      break;
    case 'tall':
      rectOutlined(g, 18, 12, 28, 42, p.body, o);
      rect(g, 20, 14, 6, 38, p.light);
      break;
    case 'wide':
      ellipseOutlined(g, 32, 40, 27, 14, p.body, o);
      ellipseOutlined(g, 32, 34, 24, 10, p.light, o);
      rect(g, 8, 40, 48, 2, p.dark);
      break;
    case 'kettle':
      triangle(g, 50, 36, 62, 24, 52, 44, p.body);
      ellipseOutlined(g, 32, 38, 21, 16, p.body, o);
      rectOutlined(g, 22, 18, 20, 6, p.light, o);
      ellipseOutlined(g, 32, 16, 4, 3, p.dark, '#000');
      ellipse(g, 24, 30, 6, 4, p.light);
      break;
    case 'helmet':
      ellipseOutlined(g, 32, 28, 20, 16, p.body, o);
      rectOutlined(g, 12, 28, 40, 24, p.body, o);
      rect(g, 31, 12, 2, 40, p.light);
      break;
    case 'dragon':
      rectOutlined(g, 38, 34, 22, 14, p.body, o);
      ellipseOutlined(g, 28, 32, 19, 18, p.body, o);
      rect(g, 52, 37, 2, 2, '#000');
      rect(g, 40, 46, 20, 2, p.dark);
      ellipse(g, 22, 24, 7, 4, p.light);
      break;
    case 'bean':
      rectOutlined(g, 12, 14, 40, 44, p.body, o);
      ellipse(g, 32, 14, 20, 4, p.body);
      ellipse(g, 32, 58, 20, 4, p.body);
      ellipse(g, 22, 22, 7, 5, p.light);
      break;
    case 'boss':
      // Lab coat, wild white hair, bald dome.
      triangle(g, 6, 64, 32, 50, 58, 64, '#f0f0f0');
      triangle(g, 26, 64, 32, 52, 38, 64, '#a02020');
      ellipse(g, 14, 30, 9, 13, '#f4f4f4');
      ellipse(g, 50, 30, 9, 13, '#f4f4f4');
      ellipseOutlined(g, 32, 32, 17, 20, p.body, o);
      ellipse(g, 28, 20, 8, 5, p.light);
      break;
  }

  front(g, p, expr);
  eyes(g, p, expr);
  mouth(g, p, expr);

  if (expr === 'worried') {
    ellipse(g, 52, 18, 2, 3, '#a0e0ff');
    rect(g, 52, 14, 1, 2, '#a0e0ff');
  }
  if (expr === 'ko') {
    g.fillStyle = 'rgba(0,0,30,0.35)';
    g.fillRect(0, 0, SIZE, SIZE);
  }
}

function behind(g: Ctx, p: Portrait): void {
  if (p.extra === 'ears' && p.head === 'mouse') {
    ellipseOutlined(g, 13, 16, 9, 9, p.body, p.dark);
    ellipseOutlined(g, 51, 16, 9, 9, p.body, p.dark);
    ellipse(g, 13, 16, 5, 5, '#f0a0b0');
    ellipse(g, 51, 16, 5, 5, '#f0a0b0');
  }
  if (p.extra === 'ears' && p.head === 'cat') {
    triangle(g, 12, 24, 16, 4, 28, 18, p.body);
    triangle(g, 52, 24, 48, 4, 36, 18, p.body);
    triangle(g, 16, 20, 18, 9, 25, 17, p.eye);
    triangle(g, 48, 20, 46, 9, 39, 17, p.eye);
  }
  if (p.extra === 'spikes') {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.05 + i * 0.15);
      const bx = 32 + Math.cos(a) * 17;
      const by = 34 + Math.sin(a) * 15;
      triangle(g, bx - 4, by + 2, 32 + Math.cos(a) * 30, 34 + Math.sin(a) * 28, bx + 4, by - 2, p.light);
    }
  }
  if (p.extra === 'horns') {
    triangle(g, 14, 22, 6, 2, 22, 16, '#f0e0b0');
    triangle(g, 38, 16, 46, 0, 44, 20, '#f0e0b0');
  }
}

function front(g: Ctx, p: Portrait, expr: Expression): void {
  switch (p.extra) {
    case 'antenna':
      line(g, 32, 14, 32, 4, p.dark, 2);
      ellipse(g, 32, 4, 3, 3, expr === 'ko' ? '#555' : p.eye);
      break;
    case 'pirate':
      triangle(g, 6, 20, 32, 2, 58, 20, '#1a1a24');
      rect(g, 10, 16, 44, 4, '#1a1a24');
      ellipse(g, 32, 12, 3, 3, '#f0f0f0');
      break;
    case 'plume':
      ellipse(g, 32, 8, 5, 8, '#e02838');
      ellipse(g, 36, 4, 4, 5, '#ff6070');
      break;
    case 'fuse':
      line(g, 32, 16, 40, 6, '#c8a060', 2);
      if (expr !== 'ko') {
        ellipse(g, 41, 5, 3, 3, '#ffd040');
        ellipse(g, 41, 5, 1.5, 1.5, '#ffffff');
      }
      break;
    case 'drill':
      triangle(g, 22, 13, 32, -6, 42, 13, '#c0c4cc');
      line(g, 26, 8, 38, 6, '#6a6e78');
      line(g, 28, 2, 36, 1, '#6a6e78');
      break;
    case 'sprout':
      line(g, 32, 12, 32, 4, '#2a7a30', 2);
      ellipse(g, 26, 4, 6, 3, '#6ae070');
      ellipse(g, 38, 6, 5, 3, '#4cc35a');
      break;
    case 'bow':
      triangle(g, 32, 12, 18, 4, 18, 18, '#ffe040');
      triangle(g, 32, 12, 46, 4, 46, 18, '#ffe040');
      ellipse(g, 32, 12, 3, 3, '#ffa020');
      break;
    case 'whistle':
      rect(g, 8, 18, 6, 4, p.dark);
      ellipse(g, 6, 12, 4, 3, 'rgba(255,255,255,0.7)');
      ellipse(g, 3, 6, 3, 2, 'rgba(255,255,255,0.5)');
      break;
  }
  if (p.head === 'boss') {
    rectOutlined(g, 18, 14, 28, 6, '#5a3a2a', '#000');
  }
}

function eyes(g: Ctx, p: Portrait, expr: Expression): void {
  const y = p.head === 'tall' ? 26 : p.head === 'wide' ? 34 : p.head === 'bean' ? 28 : 30;
  const lx = 24;
  const rx = 40;
  if (expr === 'ko') {
    for (const cx of p.eyes === 'mono' ? [32] : [lx, rx]) {
      line(g, cx - 3, y - 3, cx + 3, y + 3, '#000', 2);
      line(g, cx - 3, y + 3, cx + 3, y - 3, '#000', 2);
    }
    return;
  }
  const happy = expr === 'happy';
  switch (p.eyes) {
    case 'dots':
      for (const cx of [lx, rx]) {
        if (happy) {
          line(g, cx - 3, y + 1, cx, y - 2, p.eye, 2);
          line(g, cx, y - 2, cx + 3, y + 1, p.eye, 2);
        } else rectOutlined(g, cx - 2, y - 2, 5, expr === 'worried' ? 3 : 5, p.eye, '#000');
      }
      break;
    case 'visor':
      rectOutlined(g, 14, y - 3, 36, 7, '#101018', '#000');
      rect(g, happy ? 16 : 18, y - 1, happy ? 32 : 28, expr === 'worried' ? 1 : 3, p.eye);
      break;
    case 'mono':
      ellipseOutlined(g, 32, y, 7, 7, '#fff', '#000');
      ellipse(g, 32, y, 4, expr === 'worried' ? 2 : 4, p.eye);
      ellipse(g, 32, y, 1.5, 1.5, '#000');
      rect(g, 14, y - 6, 36, 2, '#1a1a24');
      ellipseOutlined(g, 20, y, 4, 3, '#1a1a24', '#000');
      break;
    case 'big':
      for (const cx of [lx, rx]) {
        if (happy) {
          line(g, cx - 4, y + 2, cx, y - 2, '#000', 2);
          line(g, cx, y - 2, cx + 4, y + 2, '#000', 2);
        } else {
          ellipseOutlined(g, cx, y, 5, 6, '#fff', '#000');
          ellipse(g, cx + 1, y + 1, 2.5, expr === 'worried' ? 2 : 3, p.eye);
          rect(g, cx + 1, y - 1, 1, 1, '#fff');
        }
      }
      break;
    case 'slit':
      for (const [cx, dir] of [[lx, 1], [rx, -1]] as const) {
        const tilt = happy ? 0 : expr === 'worried' ? -2 : 2;
        line(g, cx - 4, y - tilt * dir, cx + 4, y + tilt * dir, p.eye, 3);
      }
      break;
    case 'goggles':
      for (const cx of [lx, rx]) {
        ellipseOutlined(g, cx, y, 6, 6, '#3a3a44', '#000');
        ellipse(g, cx, y, 4, 4, p.eye);
        if (happy) rect(g, cx - 3, y, 7, 4, '#3a3a44');
        else if (expr === 'worried') ellipse(g, cx, y, 1.5, 1.5, '#fff');
        else rect(g, cx - 2, y - 2, 2, 2, '#fff');
      }
      rect(g, 29, y - 1, 6, 2, '#3a3a44');
      break;
  }
}

function mouth(g: Ctx, p: Portrait, expr: Expression): void {
  const y = p.head === 'tall' ? 42 : p.head === 'wide' ? 44 : p.head === 'bean' ? 42 : 43;
  const cx = p.head === 'dragon' ? 34 : 32;
  if (expr === 'ko') {
    ellipseOutlined(g, cx, y, 3, 3, '#200', '#000');
    return;
  }
  if (expr === 'worried') {
    for (let i = 0; i < 4; i++) rect(g, cx - 8 + i * 4, y + (i % 2), 4, 2, '#000');
    return;
  }
  const happy = expr === 'happy';
  switch (p.mouth) {
    case 'grill':
      rectOutlined(g, cx - 8, y - 2, 16, happy ? 7 : 5, '#202028', '#000');
      for (let x = cx - 6; x < cx + 8; x += 3) rect(g, x, y - 1, 1, happy ? 5 : 3, p.eye);
      break;
    case 'smile':
      for (let i = -6; i <= 6; i++) rect(g, cx + i, y + Math.round((36 - i * i) / (happy ? 8 : 14)), 1, 2, '#000');
      if (happy) ellipse(g, cx, y + 3, 4, 2, '#c03040');
      break;
    case 'teeth':
      rectOutlined(g, cx - 7, y - 2, 14, happy ? 6 : 4, '#fff', '#000');
      for (let x = cx - 4; x < cx + 7; x += 4) rect(g, x, y - 2, 1, happy ? 6 : 4, '#000');
      break;
    case 'flat':
      rect(g, cx - 6, y, 12, 2, '#000');
      if (happy) rect(g, cx + 4, y - 2, 2, 2, '#000');
      break;
    case 'fangs':
      rect(g, cx - 8, y, 16, 2, '#000');
      if (happy) rect(g, cx - 6, y + 2, 12, 2, '#400');
      triangle(g, cx - 6, y + 1, cx - 2, y + 1, cx - 4, y + 6, '#fff');
      triangle(g, cx + 2, y + 1, cx + 6, y + 1, cx + 4, y + 6, '#fff');
      break;
    case 'moustache':
      if (happy) ellipseOutlined(g, cx, y + 4, 5, 3, '#400', '#000');
      ellipse(g, cx - 7, y, 8, 3, '#e8e8e8');
      ellipse(g, cx + 7, y, 8, 3, '#e8e8e8');
      rect(g, cx - 15, y - 2, 2, 2, '#e8e8e8');
      rect(g, cx + 13, y - 2, 2, 2, '#e8e8e8');
      break;
  }
}
