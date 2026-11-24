// Modern arena backdrops: smooth gradients, soft silhouettes, glow and drifting particles.
// Painted at the canvas' real resolution; the static part is cached until a resize.

export type SceneKind = 'meadow' | 'junkyard' | 'steam' | 'disco' | 'sea' | 'frost' | 'city' | 'mine' | 'candy' | 'castle' | 'lava' | 'rooftop' | 'lab';

type LayerKind = 'hills' | 'jagged' | 'city' | 'castle' | 'pipes' | 'volcano' | 'roofs' | 'dunes';
type ParticleKind = 'pollen' | 'dust' | 'steam' | 'sparkle' | 'stars' | 'embers' | 'bubbles' | 'motes' | 'snow';

interface StageDef {
  sky: string[];
  glow?: { x: number; y: number; r: number; color: string; core: string };
  layers: { kind: LayerKind; color: string; base: number; amp: number }[];
  particles: { kind: ParticleKind; color: string; count: number };
  rays?: string;
}

const DEFS: Record<SceneKind, StageDef> = {
  meadow: {
    sky: ['#4fb4ff', '#9fdcff', '#e6f8ff'],
    glow: { x: 0.82, y: 0.16, r: 0.11, color: 'rgba(255,240,170,0.55)', core: '#fff6c8' },
    rays: 'rgba(255,250,210,0.13)',
    layers: [
      { kind: 'hills', color: '#a6e39c', base: 0.66, amp: 0.05 },
      { kind: 'hills', color: '#6cc768', base: 0.76, amp: 0.04 },
      { kind: 'hills', color: '#3fa548', base: 0.88, amp: 0.03 },
    ],
    particles: { kind: 'pollen', color: '255,255,220', count: 26 },
  },
  junkyard: {
    sky: ['#3a1a5a', '#c2486a', '#ffb070'],
    glow: { x: 0.7, y: 0.62, r: 0.16, color: 'rgba(255,200,120,0.5)', core: '#ffd98a' },
    layers: [
      { kind: 'jagged', color: '#6a2a5a', base: 0.68, amp: 0.07 },
      { kind: 'jagged', color: '#3a1434', base: 0.84, amp: 0.05 },
    ],
    particles: { kind: 'dust', color: '255,210,170', count: 24 },
  },
  steam: {
    sky: ['#0e3a44', '#1e6070', '#3a8a90'],
    layers: [
      { kind: 'pipes', color: '#174a54', base: 0.6, amp: 0.3 },
      { kind: 'pipes', color: '#0c2e36', base: 0.82, amp: 0.2 },
    ],
    particles: { kind: 'steam', color: '230,250,250', count: 18 },
  },
  disco: {
    sky: ['#1a0638', '#5a0c6a', '#c0207a'],
    glow: { x: 0.5, y: 0.08, r: 0.06, color: 'rgba(255,255,255,0.35)', core: '#e8ecff' },
    rays: 'rgba(255,120,220,0.10)',
    layers: [{ kind: 'dunes', color: '#2a0838', base: 0.9, amp: 0.01 }],
    particles: { kind: 'sparkle', color: '255,200,250', count: 40 },
  },
  sea: {
    sky: ['#060c2e', '#162a66', '#2e5aa0'],
    glow: { x: 0.78, y: 0.2, r: 0.07, color: 'rgba(220,235,255,0.35)', core: '#f4f6ff' },
    layers: [
      { kind: 'dunes', color: '#123874', base: 0.72, amp: 0.012 },
      { kind: 'dunes', color: '#0c2a5e', base: 0.82, amp: 0.014 },
      { kind: 'dunes', color: '#081e48', base: 0.92, amp: 0.016 },
    ],
    particles: { kind: 'stars', color: '255,255,255', count: 70 },
  },
  frost: {
    sky: ['#6aa8e8', '#b8dcff', '#eef8ff'],
    glow: { x: 0.2, y: 0.18, r: 0.07, color: 'rgba(255,255,255,0.45)', core: '#ffffff' },
    layers: [
      { kind: 'jagged', color: '#c8def4', base: 0.66, amp: 0.12 },
      { kind: 'jagged', color: '#9cc0e4', base: 0.78, amp: 0.08 },
      { kind: 'hills', color: '#f4faff', base: 0.9, amp: 0.025 },
    ],
    particles: { kind: 'snow', color: '255,255,255', count: 60 },
  },
  candy: {
    sky: ['#ff9ad0', '#ffc8e4', '#fff0f8'],
    glow: { x: 0.75, y: 0.2, r: 0.09, color: 'rgba(255,255,220,0.5)', core: '#fff8d8' },
    rays: 'rgba(255,255,255,0.12)',
    layers: [
      { kind: 'pipes', color: '#f070b0', base: 0.7, amp: 0.25 },
      { kind: 'hills', color: '#a86ae0', base: 0.82, amp: 0.04 },
      { kind: 'dunes', color: '#7a3ac0', base: 0.92, amp: 0.012 },
    ],
    particles: { kind: 'sparkle', color: '255,255,255', count: 34 },
  },
  city: {
    sky: ['#0c0a2e', '#3a1a6a', '#d0508a'],
    layers: [
      { kind: 'city', color: '#2a1a5a', base: 0.6, amp: 0.22 },
      { kind: 'city', color: '#140c32', base: 0.8, amp: 0.2 },
    ],
    particles: { kind: 'stars', color: '255,255,255', count: 40 },
  },
  mine: {
    sky: ['#140a1e', '#2a1a3a', '#3a2440'],
    layers: [
      { kind: 'jagged', color: '#1c1028', base: 0.78, amp: 0.08 },
      { kind: 'jagged', color: '#0e0816', base: 0.9, amp: 0.05 },
    ],
    particles: { kind: 'motes', color: '120,240,255', count: 30 },
  },
  castle: {
    sky: ['#24104a', '#8a3a7a', '#ffa070'],
    glow: { x: 0.25, y: 0.62, r: 0.13, color: 'rgba(255,170,120,0.45)', core: '#ffc48a' },
    layers: [
      { kind: 'hills', color: '#4a2060', base: 0.72, amp: 0.05 },
      { kind: 'castle', color: '#22103a', base: 0.8, amp: 0.3 },
    ],
    particles: { kind: 'motes', color: '255,230,140', count: 22 },
  },
  lava: {
    sky: ['#1a0404', '#5a0e06', '#c0300a'],
    layers: [
      { kind: 'volcano', color: '#300808', base: 0.72, amp: 0.3 },
      { kind: 'jagged', color: '#160404', base: 0.88, amp: 0.04 },
    ],
    particles: { kind: 'embers', color: '255,160,60', count: 40 },
  },
  rooftop: {
    sky: ['#04061a', '#121a48', '#2a3a7a'],
    glow: { x: 0.24, y: 0.24, r: 0.11, color: 'rgba(240,240,255,0.3)', core: '#f8f6e8' },
    layers: [{ kind: 'roofs', color: '#080a1e', base: 0.78, amp: 0.2 }],
    particles: { kind: 'stars', color: '255,255,255', count: 90 },
  },
  lab: {
    sky: ['#12061e', '#3a1060', '#6a1a8a'],
    layers: [
      { kind: 'pipes', color: '#24103e', base: 0.65, amp: 0.3 },
      { kind: 'jagged', color: '#140826', base: 0.9, amp: 0.02 },
    ],
    particles: { kind: 'bubbles', color: '160,255,200', count: 26 },
  },
};

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

function paintLayer(g: CanvasRenderingContext2D, w: number, h: number, l: StageDef['layers'][number], r: () => number): void {
  const base = l.base * h;
  g.fillStyle = l.color;
  g.beginPath();
  g.moveTo(0, h);
  switch (l.kind) {
    case 'hills':
    case 'dunes': {
      const waves = l.kind === 'hills' ? 3 : 7;
      const ph = r() * 6.28;
      g.lineTo(0, base);
      for (let x = 0; x <= w; x += 8) {
        const k = x / w;
        g.lineTo(x, base - Math.sin(k * Math.PI * waves + ph) * l.amp * h - Math.sin(k * Math.PI * waves * 2.3 + ph) * l.amp * h * 0.3);
      }
      break;
    }
    case 'jagged': {
      let x = 0;
      g.lineTo(0, base);
      while (x < w) {
        const step = (0.02 + r() * 0.05) * w;
        g.quadraticCurveTo(x + step / 2, base - (0.3 + r()) * l.amp * h * 1.6, x + step, base - r() * l.amp * h * 0.6);
        x += step;
      }
      break;
    }
    case 'city':
    case 'roofs': {
      let x = 0;
      g.lineTo(0, base);
      while (x < w) {
        const bw = (0.04 + r() * 0.06) * w;
        const bh = (0.2 + r() * 0.8) * l.amp * h;
        g.lineTo(x, base - bh);
        if (l.kind === 'roofs' && r() < 0.5) g.lineTo(x + bw / 2, base - bh - bw * 0.35);
        g.lineTo(x + bw, base - bh);
        g.lineTo(x + bw, base - r() * 6);
        x += bw;
      }
      break;
    }
    case 'castle': {
      g.lineTo(0, base);
      const cx = w * 0.62;
      const tw = h * 0.05;
      g.lineTo(cx - tw * 5, base);
      for (const [dx, th] of [[-5, 1.5], [-2, 2.4], [1, 1.8], [4, 2.8]] as const) {
        const x0 = cx + dx * tw;
        g.lineTo(x0, base - th * l.amp * h * 0.4);
        g.lineTo(x0 + tw * 0.5, base - th * l.amp * h * 0.4 - tw * 1.4);
        g.lineTo(x0 + tw, base - th * l.amp * h * 0.4);
        g.lineTo(x0 + tw, base - l.amp * h * 0.3);
      }
      g.lineTo(cx + tw * 6, base);
      break;
    }
    case 'pipes': {
      g.lineTo(0, base);
      let x = 0;
      while (x < w) {
        const pw = (0.03 + r() * 0.03) * w;
        const ph = (0.3 + r() * 0.7) * l.amp * h;
        g.lineTo(x, base - ph);
        g.arcTo(x + pw / 2, base - ph - pw / 2, x + pw, base - ph, pw / 2);
        g.lineTo(x + pw, base);
        x += pw + r() * 0.04 * w;
        g.lineTo(x, base);
      }
      break;
    }
    case 'volcano': {
      g.lineTo(0, base);
      for (const [cx, s] of [[0.2, 1], [0.7, 1.3]] as const) {
        g.lineTo(w * cx - h * 0.4 * s, base);
        g.lineTo(w * cx - h * 0.05 * s, base - l.amp * h * s);
        g.lineTo(w * cx + h * 0.05 * s, base - l.amp * h * s);
        g.lineTo(w * cx + h * 0.4 * s, base);
      }
      break;
    }
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
}

interface Cached {
  key: string;
  canvas: HTMLCanvasElement;
}

let cache: Cached | null = null;

function staticLayer(kind: SceneKind, w: number, h: number): HTMLCanvasElement {
  const key = `${kind}:${w}x${h}`;
  if (cache?.key === key) return cache.canvas;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const d = DEFS[kind];
  const grad = g.createLinearGradient(0, 0, 0, h);
  d.sky.forEach((col, i) => grad.addColorStop(i / (d.sky.length - 1), col));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (d.glow) {
    const m = Math.min(w, h);
    const gx = d.glow.x * w;
    const gy = d.glow.y * h;
    const halo = g.createRadialGradient(gx, gy, 0, gx, gy, d.glow.r * m * 3.5);
    halo.addColorStop(0, d.glow.color);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    g.fillStyle = d.glow.core;
    g.beginPath();
    g.arc(gx, gy, d.glow.r * m, 0, Math.PI * 2);
    g.fill();
  }
  const r = rng(kind.length * 977 + 13);
  for (const l of d.layers) paintLayer(g, w, h, l, r);
  // Soft vignette pulls the eye to the middle.
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,20,0.35)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  cache = { key, canvas: c };
  return c;
}

/** Paints the arena behind everything; `t` is time in seconds. */
export function drawStage(g: CanvasRenderingContext2D, kind: SceneKind, w: number, h: number, t: number): void {
  g.drawImage(staticLayer(kind, w, h), 0, 0);
  const d = DEFS[kind];
  const m = Math.min(w, h);
  if (d.rays) {
    const gx = (d.glow?.x ?? 0.5) * w;
    const gy = (d.glow?.y ?? 0.1) * h;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = d.rays;
    for (let i = 0; i < 10; i++) {
      const a = t * 0.05 + (i / 10) * Math.PI * 2;
      g.beginPath();
      g.moveTo(gx, gy);
      g.arc(gx, gy, m * 1.4, a, a + 0.12);
      g.fill();
    }
    g.restore();
  }
  particles(g, d.particles, w, h, t);
}

function particles(g: CanvasRenderingContext2D, p: StageDef['particles'], w: number, h: number, t: number): void {
  const r = rng(p.count * 31 + p.kind.length);
  const m = Math.min(w, h);
  g.save();
  if (p.kind !== 'steam') g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < p.count; i++) {
    const x0 = r() * w;
    const y0 = r() * h;
    const speed = 0.3 + r();
    const size = (0.002 + r() * 0.004) * m;
    const phase = r() * 100;
    let x = x0;
    let y = y0;
    let a = 0.6;
    switch (p.kind) {
      case 'stars':
        y = y0 * 0.65;
        a = 0.35 + Math.sin(t * (1 + speed) + phase) * 0.35;
        break;
      case 'pollen':
      case 'dust':
      case 'motes':
        x = (x0 + Math.sin(t * 0.3 * speed + phase) * m * 0.04 + t * m * 0.01 * speed) % w;
        y = (y0 - t * m * 0.012 * speed + h * 10) % h;
        a = 0.3 + Math.sin(t * 2 + phase) * 0.25;
        break;
      case 'embers':
      case 'bubbles':
        x = x0 + Math.sin(t * speed + phase) * m * 0.02;
        y = h - ((y0 + t * m * 0.06 * speed) % h);
        a = Math.min(1, (y / h) * 1.2) * 0.8;
        break;
      case 'sparkle':
        a = Math.max(0, Math.sin(t * 3 * speed + phase)) * 0.9;
        break;
      case 'steam':
        x = x0 + Math.sin(t * 0.5 + phase) * m * 0.03;
        y = h - ((y0 + t * m * 0.03 * speed) % (h * 0.8));
        a = 0.12 * Math.min(1, y / h + 0.2);
        g.fillStyle = `rgba(${p.color},${a})`;
        g.beginPath();
        g.arc(x, y, size * 12, 0, Math.PI * 2);
        g.fill();
        continue;
      case 'snow':
        x = x0 + Math.sin(t * speed + phase) * m * 0.02;
        y = (y0 + t * m * 0.04 * speed) % h;
        a = 0.85;
        break;
    }
    g.fillStyle = `rgba(${p.color},${Math.max(0, a)})`;
    g.beginPath();
    g.arc(x, y, size, 0, Math.PI * 2);
    g.fill();
    if (p.kind === 'sparkle' || p.kind === 'stars') {
      g.fillRect(x - size * 3, y - size * 0.25, size * 6, size * 0.5);
      g.fillRect(x - size * 0.25, y - size * 3, size * 0.5, size * 6);
    }
  }
  g.restore();
}
