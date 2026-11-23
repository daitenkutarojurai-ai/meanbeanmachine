import { type SimEvent, VISIBLE_TOP } from '@mbm/engine';
import { beanCss, jellyAt } from './jelly.ts';
import { DISPLAY, gradientText } from './text.ts';

/** Where a board sits, in layout units. */
export interface FxBoard {
  x: number;
  y: number;
  cell: number;
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
  glow: boolean;
  spin?: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  grow: number;
  life: number;
  max: number;
  color: string;
}

interface PopAnim {
  x: number;
  y: number;
  color: number;
  t: number;
  cell: number;
}

interface Floater {
  x: number;
  y: number;
  t: number;
  big: string;
  small: string;
  tone: number;
  cell: number;
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

const CHAIN_TONES: [string, string][] = [
  ['#ffffff', '#bcd4ff'],
  ['#fff27a', '#ffae1a'],
  ['#ffd27a', '#ff6a1a'],
  ['#ffa8c0', '#ff2e5a'],
  ['#f2b0ff', '#a33af0'],
  ['#b0f0ff', '#2a84ff'],
  ['#c0ffb4', '#1ec44a'],
];

export class Effects {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private pops: PopAnim[] = [];
  private floaters: Floater[] = [];
  private orbs: Orb[] = [];
  private popCells: ({ x: number; y: number; color: number }[] | null)[] = [];
  flash = 0;
  shake = 0;
  stepText: { text: string; life: number }[] = [];
  queueBump: number[] = [];
  /** Set when an orb lands, so the session can make the target flinch. */
  hits: number[] = [];

  reset(): void {
    this.particles = [];
    this.rings = [];
    this.pops = [];
    this.floaters = [];
    this.orbs = [];
    this.popCells = [];
    this.stepText = [];
    this.queueBump = [];
    this.hits = [];
    this.flash = 0;
    this.shake = 0;
  }

  handle(board: number, events: SimEvent[], boards: FxBoard[]): void {
    const b = boards[board];
    if (!b) return;
    const c = b.cell;
    for (const e of events) {
      switch (e.type) {
        case 'pop': {
          let sx = 0;
          let sy = 0;
          for (const cell of e.cells) {
            sx += b.x + (cell.x + 0.5) * c;
            sy += b.y + (cell.y - VISIBLE_TOP + 0.5) * c;
          }
          const n = e.cells.length || 1;
          this.popCells[board] = e.cells;
          this.stepText[board] = { text: `${e.score.base} × ${e.score.bonus || 1}`, life: 80 };
          if (e.chain >= 2) {
            this.floaters.push({
              x: Math.min(Math.max(sx / n, b.x + c * 1.6), b.x + c * 4.4),
              y: Math.max(b.y + c * 1.2, sy / n - c * 0.5),
              t: 0,
              big: String(e.chain),
              small: 'CHAIN!',
              tone: e.chain,
              cell: c,
            });
          }
          if (e.chain >= 3) b.shake = Math.max(b.shake, c * 0.08 * e.chain);
          if (e.chain >= 4) {
            this.flash = Math.min(0.5, 0.12 + e.chain * 0.06);
            this.shake = Math.max(this.shake, Math.min(14, (e.chain - 2) * 3));
          }
          break;
        }
        case 'popped': {
          const cells = this.popCells[board];
          if (cells) this.burst(b, cells);
          this.popCells[board] = null;
          break;
        }
        case 'chainEnd':
          if (e.garbage > 0 && boards.length > 1) {
            const target = 1 - board;
            const t = boards[target];
            this.orbs.push({
              x0: b.x + c * 3,
              y0: b.y + c * 4,
              x1: t.x + t.cell * 1.2,
              y1: t.y - t.cell * 0.6,
              t: 0,
              dur: 32,
              size: c * Math.min(0.5, 0.18 + Math.log2(e.garbage + 1) * 0.05),
              target,
            });
          }
          break;
        case 'garbageDrop':
          if (e.count >= 6) b.shake = Math.max(b.shake, Math.min(c * 0.3, c * (0.05 + e.count / 120)));
          for (let i = 0; i < Math.min(14, e.count); i++) {
            this.particles.push({ x: b.x + Math.random() * c * 6, y: b.y + 4, vx: (Math.random() - 0.5) * c * 0.02, vy: c * (0.01 + Math.random() * 0.02), life: 26, max: 26, color: 'rgba(230,236,250,0.8)', size: c * 0.06, gravity: 0, glow: false });
          }
          break;
        case 'allClear':
          this.floaters.push({ x: b.x + c * 3, y: b.y + c * 5, t: 0, big: 'ALL', small: 'CLEAR!', tone: 7, cell: c });
          this.confetti(b);
          break;
      }
    }
  }

  private burst(b: FxBoard, cells: { x: number; y: number; color: number }[]): void {
    const c = b.cell;
    for (const cell of cells) {
      const cx = b.x + (cell.x + 0.5) * c;
      const cy = b.y + (cell.y - VISIBLE_TOP + 0.5) * c;
      const col = beanCss(cell.color);
      this.pops.push({ x: cx, y: cy, color: cell.color, t: 0, cell: c });
      this.rings.push({ x: cx, y: cy, r: c * 0.2, grow: c * 0.06, life: 16, max: 16, color: col });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.random() * 0.6;
        const sp = c * (0.03 + Math.random() * 0.05);
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - c * 0.03, life: 34, max: 34, color: col, size: c * (0.07 + Math.random() * 0.06), gravity: c * 0.003, glow: false });
      }
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2;
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * c * 0.05, vy: Math.sin(a) * c * 0.05, life: 24, max: 24, color: '#fff6c0', size: c * 0.08, gravity: 0, glow: true, spin: Math.random() * 6 });
      }
    }
  }

  confetti(b: FxBoard): void {
    const cols = ['#ff4d6a', '#ffcb2e', '#3ed760', '#319dff', '#a95cf0', '#ffffff'];
    const c = b.cell;
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: b.x + Math.random() * c * 6,
        y: b.y - c * (0.5 + Math.random() * 2),
        vx: (Math.random() - 0.5) * c * 0.03,
        vy: c * (0.01 + Math.random() * 0.03),
        life: 160,
        max: 160,
        color: cols[i % cols.length],
        size: c * 0.1,
        gravity: c * 0.0004,
        glow: false,
        spin: Math.random() * 6,
      });
    }
  }

  update(boards: FxBoard[]): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.985;
      if (p.spin !== undefined) p.spin += 0.2;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.r += r.grow;
      r.grow *= 0.9;
      r.life--;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const p of this.pops) p.t++;
    this.pops = this.pops.filter((p) => p.t < 12);
    for (const f of this.floaters) f.t++;
    this.floaters = this.floaters.filter((f) => f.t < 75);
    for (const o of this.orbs) {
      o.t++;
      const [x, y] = this.orbPos(o);
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * o.size * 0.1, vy: (Math.random() - 0.5) * o.size * 0.1, life: 16, max: 16, color: '#fff2a8', size: o.size * 0.35, gravity: 0, glow: true });
      if (o.t === o.dur) {
        this.queueBump[o.target] = 14;
        this.hits.push(o.target);
        this.rings.push({ x: o.x1, y: o.y1, r: o.size, grow: o.size * 0.4, life: 14, max: 14, color: '#fff2a8' });
      }
    }
    this.orbs = this.orbs.filter((o) => o.t <= o.dur);
    for (const s of this.stepText) if (s) s.life--;
    this.queueBump = this.queueBump.map((q) => Math.max(0, (q ?? 0) - 1));
    for (const b of boards) if (b.shake > 0) b.shake = Math.max(0, b.shake * 0.88 - 0.05);
    this.flash = Math.max(0, this.flash - 0.035);
    this.shake = Math.max(0, this.shake * 0.9 - 0.1);
  }

  private orbPos(o: Orb): [number, number] {
    const t = Math.min(1, o.t / o.dur);
    const e = t * t * (3 - 2 * t);
    const lift = Math.hypot(o.x1 - o.x0, o.y1 - o.y0) * 0.3;
    return [o.x0 + (o.x1 - o.x0) * e, o.y0 + (o.y1 - o.y0) * e - Math.sin(t * Math.PI) * lift];
  }

  draw(g: CanvasRenderingContext2D, scale: number): void {
    for (const p of this.pops) {
      const k = 1 + p.t * 0.05;
      const s = p.cell * k;
      g.globalAlpha = 1 - p.t / 12;
      g.drawImage(jellyAt(p.color, s * scale, 'wide'), p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalAlpha = 1;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      g.globalAlpha = r.life / r.max;
      g.strokeStyle = r.life > r.max * 0.6 ? '#ffffff' : r.color;
      g.lineWidth = Math.max(1, r.r * 0.12);
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      g.stroke();
    }
    for (const o of this.orbs) {
      const [x, y] = this.orbPos(o);
      const halo = g.createRadialGradient(x, y, 0, x, y, o.size * 2.2);
      halo.addColorStop(0, 'rgba(255,250,210,0.95)');
      halo.addColorStop(0.4, 'rgba(255,220,120,0.5)');
      halo.addColorStop(1, 'rgba(255,200,80,0)');
      g.globalAlpha = 1;
      g.fillStyle = halo;
      g.beginPath();
      g.arc(x, y, o.size * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    for (const p of this.particles) {
      g.globalAlpha = Math.min(1, p.life / 12);
      if (p.glow) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.translate(p.x, p.y);
        g.rotate(p.spin ?? 0);
        g.fillStyle = p.color;
        const s = p.size;
        g.beginPath();
        g.moveTo(0, -s * 1.6);
        g.lineTo(s * 0.35, -s * 0.35);
        g.lineTo(s * 1.6, 0);
        g.lineTo(s * 0.35, s * 0.35);
        g.lineTo(0, s * 1.6);
        g.lineTo(-s * 0.35, s * 0.35);
        g.lineTo(-s * 1.6, 0);
        g.lineTo(-s * 0.35, -s * 0.35);
        g.closePath();
        g.fill();
        g.restore();
      } else if (p.spin !== undefined) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.spin);
        g.fillStyle = p.color;
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g.restore();
      } else {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    for (const f of this.floaters) this.drawFloater(g, f);
  }

  private drawFloater(g: CanvasRenderingContext2D, f: Floater): void {
    const tone = CHAIN_TONES[Math.min(f.tone - 1, CHAIN_TONES.length - 1)];
    const pop = f.t < 10 ? 1.9 - (f.t / 10) * 0.9 + Math.sin((f.t / 10) * Math.PI) * 0.25 : 1;
    const y = f.y - Math.max(0, f.t - 35) * f.cell * 0.012;
    g.globalAlpha = f.t > 58 ? (75 - f.t) / 17 : 1;
    const big = f.cell * (f.big.length > 1 ? 1.1 : 1.6) * pop;
    gradientText(g, f.big, f.x, y, big, tone[0], tone[1], DISPLAY);
    gradientText(g, f.small, f.x, y + big * 0.62, f.cell * 0.55, '#ffffff', tone[0], DISPLAY);
    g.globalAlpha = 1;
  }
}
