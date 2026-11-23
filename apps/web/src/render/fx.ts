import { CELL_PX, type SimEvent, VISIBLE_TOP } from '@mbm/engine';
import { BEAN_COLOR_CSS, beanSprite, starSprite } from './beans.ts';
import { fancyText } from './font.ts';
import { type Ctx, rect } from './pixels.ts';

export const FIELD_W = 6 * CELL_PX;
export const FIELD_H = 12 * CELL_PX;

/** What effects need to know about a board on screen. */
export interface FxBoard {
  fx: number;
  fy: number;
  shake: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
}

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  life: number;
  color: string;
}

interface PopAnim {
  x: number;
  y: number;
  color: number;
  t: number;
}

interface ChainText {
  x: number;
  y: number;
  chain: number;
  t: number;
  big: string;
  small: string;
}

interface Orb {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  size: number;
  target: number;
}

const CHAIN_FILLS: [string, string][] = [
  ['#ffffff', '#c0d8ff'],
  ['#fff27a', '#ffb020'],
  ['#ffd27a', '#ff6a20'],
  ['#ff9ab0', '#ff3050'],
  ['#f0a8ff', '#a040ff'],
  ['#a8f0ff', '#2080ff'],
  ['#b8ffb0', '#20c040'],
];

/** Short-lived eye candy driven by simulation events. */
export class Effects {
  private particles: Particle[] = [];
  private stars: Star[] = [];
  private rings: Ring[] = [];
  private pops: PopAnim[] = [];
  private chains: ChainText[] = [];
  private orbs: Orb[] = [];
  private popCells: ({ x: number; y: number; color: number }[] | null)[] = [];
  /** White screen flash on big chains, 0..1. */
  flash = 0;
  /** Whole-screen shake in pixels. */
  shake = 0;
  /** "base x bonus" readout per board while a chain is resolving. */
  stepText: { text: string; life: number }[] = [];
  /** Frames left of the refugee-queue bounce per board. */
  queueBump: number[] = [];

  reset(): void {
    this.particles = [];
    this.stars = [];
    this.rings = [];
    this.pops = [];
    this.chains = [];
    this.orbs = [];
    this.popCells = [];
    this.stepText = [];
    this.queueBump = [];
    this.flash = 0;
    this.shake = 0;
  }

  handle(board: number, events: SimEvent[], views: FxBoard[]): void {
    const v = views[board];
    if (!v) return;
    for (const e of events) {
      switch (e.type) {
        case 'pop': {
          let sx = 0;
          let sy = 0;
          for (const c of e.cells) {
            sx += v.fx + c.x * CELL_PX + 8;
            sy += v.fy + (c.y - VISIBLE_TOP) * CELL_PX + 8;
          }
          const n = e.cells.length || 1;
          this.popCells[board] = e.cells;
          this.stepText[board] = { text: `${e.score.base}*${e.score.bonus || 1}`, life: 70 };
          if (e.chain >= 2) {
            this.chains.push({
              x: Math.min(Math.max(sx / n, v.fx + 26), v.fx + FIELD_W - 26),
              y: Math.max(v.fy + 24, sy / n - 10),
              chain: e.chain,
              t: 0,
              big: String(e.chain),
              small: 'CHAIN!',
            });
          }
          if (e.chain >= 3) v.shake = Math.max(v.shake, 2 + e.chain * 0.6);
          if (e.chain >= 4) {
            this.flash = Math.min(0.55, 0.15 + e.chain * 0.06);
            this.shake = Math.max(this.shake, Math.min(6, e.chain - 1));
          }
          break;
        }
        case 'popped': {
          const cells = this.popCells[board];
          if (cells) this.burst(v, cells);
          this.popCells[board] = null;
          break;
        }
        case 'chainEnd':
          if (e.garbage > 0 && views.length > 1) {
            const target = 1 - board;
            const tv = views[target];
            this.orbs.push({
              x0: v.fx + FIELD_W / 2,
              y0: v.fy + FIELD_H / 3,
              x1: tv.fx + 20,
              y1: tv.fy - 8,
              t: 0,
              dur: 30,
              size: Math.min(9, 3 + Math.floor(Math.log2(e.garbage + 1))),
              target,
            });
          }
          break;
        case 'garbageDrop':
          if (e.count >= 6) v.shake = Math.max(v.shake, Math.min(10, 2 + e.count / 4));
          for (let i = 0; i < Math.min(12, e.count); i++) {
            this.particles.push({
              x: v.fx + Math.random() * FIELD_W,
              y: v.fy + 2,
              vx: (Math.random() - 0.5) * 0.6,
              vy: 0.3 + Math.random() * 0.4,
              life: 24,
              max: 24,
              color: 'rgba(220,226,240,0.8)',
              size: 2,
              gravity: 0,
            });
          }
          break;
        case 'allClear':
          this.chains.push({ x: v.fx + FIELD_W / 2, y: v.fy + FIELD_H / 2 - 20, chain: 7, t: 0, big: 'ALL', small: 'CLEAR!' });
          this.confetti(v);
          break;
      }
    }
  }

  private burst(v: FxBoard, cells: { x: number; y: number; color: number }[]): void {
    for (const c of cells) {
      const cx = v.fx + c.x * CELL_PX + 8;
      const cy = v.fy + (c.y - VISIBLE_TOP) * CELL_PX + 8;
      const col = BEAN_COLOR_CSS[c.color] ?? '#fff';
      this.pops.push({ x: cx, y: cy, color: c.color, t: 0 });
      this.rings.push({ x: cx, y: cy, r: 3, life: 14, color: col });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.random() * 0.8;
        const sp = 0.9 + Math.random() * 1.4;
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.4, life: 30, max: 30, color: col, size: 2 + (Math.random() < 0.4 ? 1 : 0), gravity: 0.13 });
      }
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2;
        this.stars.push({ x: cx, y: cy, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6 - 0.6, life: 22, color: k ? '#fff8c0' : col });
      }
    }
  }

  confetti(v: FxBoard): void {
    const cols = ['#ff4060', '#ffd040', '#40d060', '#40a0ff', '#c060ff', '#ffffff'];
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        x: v.fx + Math.random() * FIELD_W,
        y: v.fy - 10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.4 + Math.random() * 0.8,
        life: 140,
        max: 140,
        color: cols[i % cols.length],
        size: 2,
        gravity: 0.01,
      });
    }
  }

  update(views: FxBoard[]): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.stars) {
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.94;
      s.vy *= 0.94;
      s.life--;
    }
    this.stars = this.stars.filter((s) => s.life > 0);
    for (const r of this.rings) {
      r.r += 1.6;
      r.life--;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const p of this.pops) p.t++;
    this.pops = this.pops.filter((p) => p.t < 10);
    for (const c of this.chains) c.t++;
    this.chains = this.chains.filter((c) => c.t < 70);
    for (const o of this.orbs) {
      o.t++;
      if (o.t % 2 === 0) {
        const [x, y] = this.orbPos(o);
        this.stars.push({ x, y, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, life: 14, color: '#fff2a0' });
      }
      if (o.t === o.dur) {
        this.queueBump[o.target] = 12;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          this.stars.push({ x: o.x1, y: o.y1, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 16, color: '#ffffff' });
        }
      }
    }
    this.orbs = this.orbs.filter((o) => o.t <= o.dur);
    for (const s of this.stepText) if (s) s.life--;
    this.queueBump = this.queueBump.map((q) => Math.max(0, (q ?? 0) - 1));
    for (const v of views) if (v.shake > 0) v.shake = Math.max(0, v.shake - 0.5);
    this.flash = Math.max(0, this.flash - 0.04);
    this.shake = Math.max(0, this.shake - 0.4);
  }

  private orbPos(o: Orb): [number, number] {
    const t = Math.min(1, o.t / o.dur);
    const e = t * t * (3 - 2 * t);
    return [o.x0 + (o.x1 - o.x0) * e, o.y0 + (o.y1 - o.y0) * e - Math.sin(t * Math.PI) * 46];
  }

  draw(g: Ctx, frame: number): void {
    for (const p of this.pops) {
      const k = 1 + p.t * 0.06;
      const a = 1 - p.t / 10;
      const s = Math.round(16 * k);
      g.globalAlpha = a;
      g.drawImage(beanSprite(p.color, 0, p.t < 4, 'wide'), Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    g.globalAlpha = 1;
    for (const r of this.rings) {
      g.globalAlpha = r.life / 14;
      g.strokeStyle = r.life > 8 ? '#ffffff' : r.color;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (const p of this.particles) {
      g.globalAlpha = Math.min(1, p.life / 12);
      rect(g, p.x, p.y, p.size, p.size, p.color);
    }
    g.globalAlpha = 1;
    for (const s of this.stars) {
      g.globalAlpha = Math.min(1, s.life / 8);
      g.drawImage(starSprite(s.color), Math.round(s.x - 3), Math.round(s.y - 3));
    }
    g.globalAlpha = 1;
    for (const o of this.orbs) {
      const [x, y] = this.orbPos(o);
      g.fillStyle = 'rgba(255,240,160,0.3)';
      g.beginPath();
      g.arc(x, y, o.size + 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff6c8';
      g.beginPath();
      g.arc(x, y, o.size, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(x - o.size / 3), Math.round(y - o.size / 3), 2, 2);
    }
    for (const c of this.chains) this.drawChain(g, c, frame);
  }

  private drawChain(g: Ctx, c: ChainText, frame: number): void {
    const fill = CHAIN_FILLS[Math.min(c.chain - 1, CHAIN_FILLS.length - 1)];
    const cycle = c.chain >= 5 ? CHAIN_FILLS[(Math.floor(frame / 4) % 6) + 1] : fill;
    // Pop in big, settle, then drift up and fade.
    const pop = c.t < 8 ? 1.8 - (c.t / 8) * 0.8 + Math.sin((c.t / 8) * Math.PI) * 0.2 : 1;
    const y = c.y - Math.max(0, c.t - 30) * 0.4;
    g.globalAlpha = c.t > 55 ? (70 - c.t) / 15 : 1;
    const bigScale = c.big.length > 1 ? 2 : 3;
    const big = fancyText(c.big, bigScale, cycle[0], cycle[1]);
    const small = fancyText(c.small, 1, '#ffffff', fill[0]);
    const bw = Math.round(big.width * pop);
    const bh = Math.round(big.height * pop);
    g.drawImage(big, Math.round(c.x - bw / 2), Math.round(y - bh / 2 - 4), bw, bh);
    g.drawImage(small, Math.round(c.x - small.width / 2), Math.round(y + bh / 2 - 4));
    g.globalAlpha = 1;
  }
}
