// Animated backdrops, one per stage. Static layers are painted once into wide canvases
// and scrolled for parallax; small animated details are drawn each frame.
import { type Ctx, ctx2d, ellipse, makeCanvas, rect, triangle } from './pixels.ts';

export type SceneKind = 'meadow' | 'junkyard' | 'steam' | 'disco' | 'sea' | 'city' | 'mine' | 'castle' | 'lava' | 'rooftop' | 'lab';

const W = 320;
const H = 224;
const LW = 640;

interface Layer {
  canvas: HTMLCanvasElement;
  speed: number;
}

interface Built {
  sky: HTMLCanvasElement;
  layers: Layer[];
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sky(stops: [number, string][]): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  const grad = g.createLinearGradient(0, 0, 0, H);
  for (const [at, col] of stops) grad.addColorStop(at, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  return c;
}

function layer(speed: number, paint: (g: Ctx, r: () => number) => void, seed: number): Layer {
  const canvas = makeCanvas(LW, H);
  paint(ctx2d(canvas), rng(seed));
  return { canvas, speed };
}

/** A seamless rolling silhouette across the layer width. */
function hills(g: Ctx, base: number, amp: number, color: string, r: () => number, waves = 3): void {
  const k = [1, 2, 3, 5].slice(0, waves).map((m) => ({ m, p: r() * Math.PI * 2, a: amp / (m * 0.8) }));
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= LW; x += 4) {
    let y = base;
    for (const w of k) y -= Math.sin((x / LW) * Math.PI * 2 * w.m + w.p) * w.a;
    g.lineTo(x, Math.round(y));
  }
  g.lineTo(LW, H);
  g.fill();
}

function skyline(g: Ctx, base: number, color: string, lit: string, r: () => number, minH: number, maxH: number): void {
  let x = 0;
  while (x < LW) {
    const w = 14 + Math.floor(r() * 24);
    const h = minH + Math.floor(r() * (maxH - minH));
    rect(g, x, base - h, w - 1, h + 40, color);
    if (r() < 0.3) rect(g, x + w / 2 - 1, base - h - 6, 2, 6, color);
    for (let wy = base - h + 4; wy < base - 4; wy += 6)
      for (let wx = x + 3; wx < x + w - 4; wx += 5) if (r() < 0.35) rect(g, wx, wy, 2, 3, lit);
    x += w;
  }
}

function cloud(g: Ctx, x: number, y: number, s: number, color: string): void {
  ellipse(g, x, y, 10 * s, 5 * s, color);
  ellipse(g, x + 9 * s, y - 3 * s, 8 * s, 6 * s, color);
  ellipse(g, x + 18 * s, y, 9 * s, 5 * s, color);
}

export function gear(g: Ctx, cx: number, cy: number, r: number, teeth: number, a: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const rr = i % 2 ? r : r + Math.max(3, r * 0.18);
    const a0 = a + (i / (teeth * 2)) * Math.PI * 2;
    const a1 = a + ((i + 1) / (teeth * 2)) * Math.PI * 2;
    g.lineTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
    g.lineTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
  }
  g.closePath();
  g.arc(cx, cy, r * 0.35, 0, Math.PI * 2, true);
  g.fill();
}

function stars(g: Ctx, r: () => number, n: number, maxY: number): void {
  for (let i = 0; i < n; i++) rect(g, Math.floor(r() * LW), Math.floor(r() * maxY), 1, 1, r() < 0.2 ? '#ffffff' : '#9aa0d0');
}

const BUILDERS: Record<SceneKind, () => Built> = {
  meadow: () => ({
    sky: sky([[0, '#3a96f4'], [0.6, '#a8dcff'], [1, '#d8f4ff']]),
    layers: [
      layer(0.08, (g, r) => {
        for (let i = 0; i < 7; i++) cloud(g, r() * LW, 14 + r() * 50, 0.8 + r() * 0.8, 'rgba(255,255,255,0.85)');
      }, 1),
      layer(0.15, (g, r) => hills(g, 150, 18, '#86d47e', r), 2),
      layer(0.3, (g, r) => {
        hills(g, 182, 12, '#4fae4c', r);
        for (let i = 0; i < 9; i++) {
          const x = Math.floor(r() * LW);
          const y = 168 + Math.floor(r() * 18);
          const col = ['#ec3c4c', '#f8cc28', '#3a8cfa', '#a656e6'][i % 4];
          ellipse(g, x + 6, y, 7, 7, col);
          rect(g, x, y, 13, 9, col);
          rect(g, x + 5, y + 3, 3, 6, '#3a2010');
          rect(g, x + 2, y - 1, 2, 2, '#ffffff');
        }
        for (let i = 0; i < 60; i++) rect(g, r() * LW, 192 + r() * 30, 1, 1, ['#fff', '#ffe060', '#ff90b0'][i % 3]);
      }, 3),
    ],
  }),
  junkyard: () => ({
    sky: sky([[0, '#2a1240'], [0.45, '#a83a50'], [0.75, '#ff9a4a'], [1, '#ffcf7a']]),
    layers: [
      layer(0.12, (g, r) => {
        hills(g, 165, 26, '#5a1e42', r, 4);
        // A crane.
        rect(g, 420, 60, 5, 110, '#5a1e42');
        rect(g, 380, 60, 110, 4, '#5a1e42');
        rect(g, 470, 64, 1, 40, '#5a1e42');
        for (let i = 0; i < 20; i++) rect(g, r() * LW, 120 + r() * 40, 4 + r() * 10, 3 + r() * 6, '#5a1e42');
      }, 4),
      layer(0.3, (g, r) => {
        hills(g, 195, 16, '#2a0e22', r, 4);
        for (let i = 0; i < 10; i++) {
          const x = r() * LW;
          const y = 180 + r() * 20;
          ellipse(g, x, y, 7, 7, '#1a0814');
          ellipse(g, x, y, 3, 3, '#2a0e22');
        }
      }, 5),
    ],
  }),
  steam: () => ({
    sky: sky([[0, '#0a2228'], [1, '#1c4650']]),
    layers: [
      layer(0.1, (g, r) => {
        for (let x = 6; x < LW; x += 22 + Math.floor(r() * 18)) {
          rect(g, x, 0, 8, H, '#21505a');
          rect(g, x + 1, 0, 2, H, '#2e6872');
          for (let y = 20 + r() * 30; y < H; y += 40 + r() * 30) rect(g, x - 2, y, 12, 4, '#183e46');
        }
        for (let y = 30; y < H; y += 46) rect(g, 0, y, LW, 6, '#1a444c');
      }, 6),
      layer(0.3, (g, r) => {
        for (let x = 0; x < LW; x += 90) {
          rect(g, x + 10, 150, 26, 80, '#10303a');
          rect(g, x + 12, 150, 4, 80, '#1c4852');
          ellipse(g, x + 60, 180, 11, 11, '#10303a');
          ellipse(g, x + 60, 180, 8, 8, '#c8d8d0');
          rect(g, x + 36, 196, 60, 8, '#10303a');
          if (r() < 0.5) rect(g, x + 70, 120, 6, 60, '#10303a');
        }
      }, 7),
    ],
  }),
  disco: () => ({
    sky: sky([[0, '#12061e'], [1, '#3a0a4a']]),
    layers: [
      layer(0.1, (g, r) => {
        for (let i = 0; i < 40; i++) rect(g, r() * LW, r() * 150, 2, 2, ['#ff60c0', '#60e0ff', '#ffe060'][i % 3]);
      }, 8),
    ],
  }),
  sea: () => ({
    sky: sky([[0, '#060a24'], [0.65, '#1a2a60'], [1, '#26407a']]),
    layers: [
      layer(0.04, (g, r) => stars(g, r, 120, 130), 9),
      layer(0.12, (g) => {
        // A distant ship.
        rect(g, 100, 146, 70, 8, '#0a1028');
        triangle(g, 96, 146, 104, 146, 104, 154, '#0a1028');
        rect(g, 128, 96, 2, 50, '#0a1028');
        triangle(g, 130, 100, 130, 140, 156, 138, '#0a1028');
        triangle(g, 128, 104, 128, 140, 108, 138, '#0a1028');
      }, 10),
    ],
  }),
  city: () => ({
    sky: sky([[0, '#06061c'], [0.7, '#2a1a4a'], [1, '#4a2a5a']]),
    layers: [
      layer(0.04, (g, r) => stars(g, r, 80, 100), 11),
      layer(0.12, (g, r) => skyline(g, 175, '#1c1640', '#4a4070', r, 30, 80), 12),
      layer(0.28, (g, r) => skyline(g, 205, '#0c0a1e', '#ffd870', r, 20, 70), 13),
    ],
  }),
  mine: () => ({
    sky: sky([[0, '#140a06'], [1, '#2e1c10']]),
    layers: [
      layer(0.1, (g, r) => {
        for (let x = 0; x < LW; x += 10 + r() * 14) triangle(g, x, 0, x + 12, 0, x + 6, 10 + r() * 30, '#0e0604');
        hills(g, 200, 10, '#1c1008', r, 3);
      }, 14),
      layer(0.3, (g, r) => {
        rect(g, 0, 206, LW, 2, '#6a5040');
        rect(g, 0, 212, LW, 2, '#6a5040');
        for (let x = 0; x < LW; x += 12) rect(g, x, 204, 4, 12, '#3a2414');
        for (let i = 0; i < 6; i++) {
          const x = 30 + r() * (LW - 60);
          rect(g, x, 186, 34, 16, '#24140a');
          ellipse(g, x + 8, 204, 4, 4, '#140a04');
          ellipse(g, x + 26, 204, 4, 4, '#140a04');
        }
      }, 15),
    ],
  }),
  castle: () => ({
    sky: sky([[0, '#1a0a3a'], [0.55, '#6a2a6a'], [1, '#e0805a']]),
    layers: [
      layer(0.08, (g, r) => hills(g, 160, 24, '#2c1444', r, 3), 16),
      layer(0.2, (g) => {
        const c = '#140a24';
        rect(g, 140, 110, 120, 80, c);
        for (let x = 140; x < 260; x += 10) rect(g, x, 104, 6, 6, c);
        for (const tx of [130, 190, 256]) {
          rect(g, tx, 70, 20, 120, c);
          triangle(g, tx - 4, 70, tx + 24, 70, tx + 10, 40, c);
          rect(g, tx + 8, 90, 4, 6, '#ffcc66');
        }
        for (const [wx, wy] of [[160, 130], [220, 130], [175, 150], [235, 150]]) rect(g, wx, wy, 4, 7, '#ffcc66');
        hills(g, 196, 6, '#0c0618', rng(17), 2);
      }, 17),
    ],
  }),
  lava: () => ({
    sky: sky([[0, '#140202'], [0.55, '#4a0a04'], [1, '#a02a08']]),
    layers: [
      layer(0.08, (g) => {
        triangle(g, 60, 190, 160, 80, 260, 190, '#200606');
        triangle(g, 140, 82, 160, 80, 180, 82, '#ff6a10');
        triangle(g, 330, 190, 440, 100, 560, 190, '#200606');
      }, 18),
      layer(0.25, (g, r) => hills(g, 200, 8, '#100202', r, 3), 19),
    ],
  }),
  rooftop: () => ({
    sky: sky([[0, '#03030c'], [1, '#16163e']]),
    layers: [
      layer(0.02, (g, r) => {
        stars(g, r, 160, 160);
        ellipse(g, 120, 62, 30, 30, '#f4f0d8');
        ellipse(g, 110, 56, 5, 4, '#dcd6b8');
        ellipse(g, 128, 72, 7, 5, '#dcd6b8');
        ellipse(g, 132, 52, 3, 3, '#dcd6b8');
      }, 20),
      layer(0.25, (g, r) => {
        let x = 0;
        while (x < LW) {
          const w = 30 + r() * 40;
          const h = 20 + r() * 40;
          rect(g, x, 224 - h, w, h, '#07070e');
          if (r() < 0.5) {
            rect(g, x + w / 2, 224 - h - 18, 1, 18, '#07070e');
            rect(g, x + w / 2 - 5, 224 - h - 14, 11, 1, '#07070e');
          }
          if (r() < 0.4) {
            rect(g, x + 4, 224 - h - 12, 12, 12, '#07070e');
            rect(g, x + 6, 224 - h - 16, 8, 4, '#07070e');
          }
          x += w;
        }
      }, 21),
    ],
  }),
  lab: () => ({
    sky: sky([[0, '#10061e'], [1, '#2a1048']]),
    layers: [
      layer(0.08, (g, r) => {
        for (let y = 40; y < 200; y += 50) {
          rect(g, 0, y, LW, 3, '#1e0c34');
          for (let x = 4; x < LW; x += 14 + r() * 10) {
            const h = 8 + r() * 10;
            rect(g, x, y - h, 7, h, ['#2a5040', '#40305a', '#5a3040'][Math.floor(r() * 3)]);
          }
        }
      }, 22),
    ],
  }),
};

const built = new Map<SceneKind, Built>();

function ensure(kind: SceneKind): Built {
  let b = built.get(kind);
  if (!b) {
    b = BUILDERS[kind]();
    built.set(kind, b);
  }
  return b;
}

export function drawScene(g: Ctx, kind: SceneKind, frame: number): void {
  const b = ensure(kind);
  g.drawImage(b.sky, 0, 0);
  // Animated bits that sit behind the parallax layers.
  behind(g, kind, frame);
  for (const l of b.layers) {
    const off = Math.floor((frame * l.speed) % LW);
    g.drawImage(l.canvas, -off, 0);
    g.drawImage(l.canvas, LW - off, 0);
  }
  front(g, kind, frame);
}

function behind(g: Ctx, kind: SceneKind, f: number): void {
  switch (kind) {
    case 'meadow': {
      const cx = 268;
      const cy = 36;
      g.fillStyle = 'rgba(255,250,200,0.35)';
      for (let i = 0; i < 12; i++) {
        const a = f * 0.004 + (i / 12) * Math.PI * 2;
        triangle(g, cx, cy, cx + Math.cos(a - 0.08) * 60, cy + Math.sin(a - 0.08) * 60, cx + Math.cos(a + 0.08) * 60, cy + Math.sin(a + 0.08) * 60, 'rgba(255,250,200,0.25)');
      }
      ellipse(g, cx, cy, 16, 16, '#fff4a8');
      ellipse(g, cx, cy, 12, 12, '#fffbd8');
      break;
    }
    case 'junkyard':
      ellipse(g, 230, 162, 40, 40, 'rgba(255,220,120,0.9)');
      break;
    case 'sea':
      ellipse(g, 250, 44, 18, 18, 'rgba(255,250,220,0.15)');
      ellipse(g, 250, 44, 12, 12, '#f8f4dc');
      twinkle(g, f, 30, 130, 7);
      break;
    case 'city':
      ellipse(g, 60, 40, 10, 10, '#f0ecd8');
      for (const [x0, sp] of [[90, 0.011], [230, -0.008]] as const) {
        const a = -Math.PI / 2 + Math.sin(f * sp) * 0.7;
        g.fillStyle = 'rgba(200,220,255,0.08)';
        g.beginPath();
        g.moveTo(x0, 224);
        g.lineTo(x0 + Math.cos(a - 0.06) * 300, 224 + Math.sin(a - 0.06) * 300);
        g.lineTo(x0 + Math.cos(a + 0.06) * 300, 224 + Math.sin(a + 0.06) * 300);
        g.fill();
      }
      break;
    case 'disco': {
      for (let i = 0; i < 5; i++) {
        const a = Math.PI / 2 + Math.sin(f * 0.012 + i * 1.3) * 0.9;
        const col = ['rgba(255,80,200,0.10)', 'rgba(80,220,255,0.10)', 'rgba(255,230,80,0.10)'][i % 3];
        triangle(g, 160, 18, 160 + Math.cos(a - 0.1) * 320, 18 + Math.sin(a - 0.1) * 320, 160 + Math.cos(a + 0.1) * 320, 18 + Math.sin(a + 0.1) * 320, col);
      }
      ellipse(g, 160, 18, 11, 11, '#a0a8c0');
      for (let y = 8; y < 29; y += 3)
        for (let x = 150; x < 171; x += 3) if ((x * 7 + y * 13 + Math.floor(f / 6)) % 5 === 0) rect(g, x, y, 2, 2, '#ffffff');
      for (let x = 0; x < W; x += 16)
        for (let y = 196; y < H; y += 8) {
          const k = (x / 16 + (y - 196) / 8 + Math.floor(f / 15)) % 4;
          rect(g, x, y, 15, 7, ['#ff3aa0', '#3ad0ff', '#ffe03a', '#7a3aff'][k]);
        }
      break;
    }
    case 'castle':
      for (let i = 0; i < 4; i++) {
        const x = (f * (0.4 + i * 0.1) + i * 90) % 360 - 20;
        const y = 50 + Math.sin(f * 0.05 + i) * 10 + i * 12;
        const flap = Math.floor(f / 6 + i) % 2 ? 2 : -1;
        rect(g, x, y, 1, 1, '#120818');
        rect(g, x - 3, y + flap, 3, 1, '#120818');
        rect(g, x + 1, y + flap, 3, 1, '#120818');
      }
      break;
    case 'rooftop':
      twinkle(g, f, 40, 160, 3);
      if (f % 600 < 30) {
        const t = (f % 600) / 30;
        const x = 300 - t * 160;
        const y = 20 + t * 60;
        for (let k = 0; k < 10; k++) rect(g, x + k * 3, y - k * 1.1, 2, 1, `rgba(255,255,255,${1 - k / 10})`);
      }
      break;
    case 'lab':
      gear(g, 160, 200, 46, 14, f * 0.004, 'rgba(0,0,0,0.3)');
      gear(g, 110, 120, 26, 10, -f * 0.007, 'rgba(0,0,0,0.25)');
      gear(g, 212, 96, 30, 11, -f * 0.006, 'rgba(0,0,0,0.25)');
      break;
    default:
      break;
  }
}

function front(g: Ctx, kind: SceneKind, f: number): void {
  switch (kind) {
    case 'junkyard':
      gear(g, 300, 196, 14, 9, f * 0.01, '#1a0814');
      break;
    case 'steam':
      for (let k = 0; k < 8; k++) {
        const vent = [20, 130, 200, 300][k % 4];
        const phase = (f * 0.6 + k * 31) % 140;
        const a = Math.max(0, 0.32 - phase / 440);
        ellipse(g, vent + Math.sin(phase * 0.05 + k) * 6, 200 - phase, 5 + phase * 0.08, 4 + phase * 0.06, `rgba(220,240,240,${a})`);
      }
      if (Math.floor(f / 30) % 2) {
        rect(g, 6, 60, 3, 3, '#ff4040');
        rect(g, 312, 110, 3, 3, '#ff4040');
      }
      break;
    case 'sea':
      for (let row = 0; row < 5; row++) {
        const y = 160 + row * 13;
        rect(g, 0, y, W, 13, ['#0e2a52', '#123260', '#163a6c', '#1a4278', '#1e4a84'][row]);
        for (let x = -20; x < W + 20; x += 24) {
          const wx = x + ((f * (0.2 + row * 0.15)) % 24);
          rect(g, wx, y + Math.round(Math.sin(f * 0.04 + x) * 1.5), 8, 1, 'rgba(200,230,255,0.35)');
        }
      }
      rect(g, 238, 160, 24, 2, 'rgba(255,250,220,0.3)');
      break;
    case 'city':
      for (let i = 0; i < 6; i++) {
        const on = Math.floor(f / 50 + i * 7) % 3 === 0;
        if (on) rect(g, 20 + i * 52, 160 + (i % 3) * 12, 2, 3, '#ffd870');
      }
      break;
    case 'mine':
      for (let i = 0; i < 7; i++) {
        const x = 12 + i * 48;
        const y = 196 - (i % 3) * 6;
        const glow = 0.5 + Math.sin(f * 0.05 + i) * 0.3;
        const col = i % 2 ? `rgba(80,240,255,${glow})` : `rgba(200,120,255,${glow})`;
        triangle(g, x, y, x + 4, y - 12, x + 8, y, col);
        triangle(g, x + 5, y, x + 8, y - 8, x + 11, y, col);
      }
      for (const lx of [70, 250]) {
        const flick = 0.25 + Math.random() * 0.06;
        ellipse(g, lx, 40, 14, 14, `rgba(255,190,90,${flick})`);
        rect(g, lx - 2, 36, 4, 6, '#ffcc66');
      }
      break;
    case 'castle':
      for (const tx of [130, 190, 256]) {
        const wave = Math.floor(f / 8) % 3;
        rect(g, tx + 10, 30, 1, 12, '#140a24');
        triangle(g, tx + 11, 30, tx + 11, 36, tx + 19 + wave, 33, '#c03040');
      }
      break;
    case 'lava': {
      for (let x = 0; x < W; x += 2) {
        const y = 208 + Math.round(Math.sin(x * 0.08 + f * 0.05) * 2);
        rect(g, x, y, 2, H - y, '#ff6a10');
        if ((x + f) % 23 === 0) rect(g, x, y - 1, 2, 2, '#ffd040');
      }
      for (let k = 0; k < 14; k++) {
        const phase = (f * 0.7 + k * 41) % 200;
        rect(g, (k * 53 + Math.sin(phase * 0.05) * 8) % W, 210 - phase, 1, 1, `rgba(255,${150 + (k % 3) * 40},60,${1 - phase / 200})`);
      }
      break;
    }
    case 'lab': {
      for (const tx of [4, 300]) {
        rect(g, tx, 120, 14, 100, 'rgba(120,255,170,0.15)');
        rect(g, tx, 118, 14, 3, '#5a4a7a');
        for (let k = 0; k < 4; k++) {
          const phase = (f * 0.8 + k * 25 + tx) % 100;
          rect(g, tx + 3 + ((k * 5) % 9), 218 - phase, 2, 2, 'rgba(200,255,220,0.7)');
        }
      }
      if (f % 260 < 8) {
        let x = 20;
        let y = 10;
        g.fillStyle = 'rgba(200,180,255,0.8)';
        while (x < 300) {
          const nx = x + 10 + Math.random() * 14;
          const ny = 10 + Math.random() * 10;
          g.fillRect(x, Math.min(y, ny), 1, Math.abs(ny - y) + 1);
          g.fillRect(Math.min(x, nx), ny, Math.abs(nx - x), 1);
          x = nx;
          y = ny;
        }
      }
      break;
    }
    default:
      break;
  }
}

function twinkle(g: Ctx, f: number, n: number, maxY: number, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(r() * maxY);
    const p = r() * 6.28;
    if (Math.sin(f * 0.05 + p) > 0.6) {
      rect(g, x, y, 1, 1, '#ffffff');
      rect(g, x - 1, y, 3, 1, 'rgba(255,255,255,0.5)');
      rect(g, x, y - 1, 1, 3, 'rgba(255,255,255,0.5)');
    }
  }
}
