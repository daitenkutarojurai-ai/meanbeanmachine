import {
  CELL_PX,
  COLS,
  GARBAGE,
  Phase,
  type PlayerSim,
  ROT_DX,
  ROT_DY,
  ROWS,
  type SimEvent,
  VISIBLE_TOP,
  idx,
} from '@mbm/engine';
import { BEAN_COLOR_CSS, CONNECT_DOWN, CONNECT_LEFT, CONNECT_RIGHT, CONNECT_UP, beanSprite } from './beans.ts';
import { drawText } from './font.ts';
import { type Ctx, ctx2d, rect } from './pixels.ts';

export const W = 320;
export const H = 224;
export const FIELD_W = COLS * CELL_PX;
export const FIELD_H = (ROWS - VISIBLE_TOP) * CELL_PX;

export interface BoardView {
  sim: PlayerSim;
  fx: number;
  fy: number;
  /** Refugees to show in the queue above the well. */
  pending: number;
  deadAt?: number;
  shake: number;
}

export interface Banner {
  text: string;
  sub?: string;
  color?: string;
  /** Board index to centre on; omitted = whole screen. */
  board?: number;
}

export interface Panel {
  label: string;
  value: string;
  color?: string;
}

export interface Scene {
  layout: 'versus' | 'solo' | 'none';
  boards: BoardView[];
  frame: number;
  bg: [string, string];
  portrait?: HTMLCanvasElement | null;
  portraitLeft?: HTMLCanvasElement | null;
  panels: Panel[];
  info: string[];
  banners: Banner[];
  dim?: boolean;
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
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  scale: number;
}

interface Orb {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  size: number;
}

const CHAIN_COLORS = ['#ffffff', '#ffe040', '#ff9030', '#ff4060', '#e060ff', '#60c0ff', '#60ff90'];

/** Short-lived eye candy driven by simulation events. */
export class Effects {
  particles: Particle[] = [];
  popups: Popup[] = [];
  orbs: Orb[] = [];
  /** "base x bonus" readout per board while a chain is resolving. */
  stepText: { text: string; life: number }[] = [];
  private popCells: ({ x: number; y: number; color: number }[] | null)[] = [];

  reset(): void {
    this.particles = [];
    this.popups = [];
    this.orbs = [];
    this.stepText = [];
    this.popCells = [];
  }

  handle(board: number, events: SimEvent[], views: BoardView[]): void {
    const v = views[board];
    if (!v) return;
    for (const e of events) {
      if (e.type === 'pop') {
        let sx = 0;
        let sy = 0;
        for (const c of e.cells) {
          const cx = v.fx + c.x * CELL_PX + 8;
          const cy = v.fy + (c.y - VISIBLE_TOP) * CELL_PX + 8;
          sx += cx;
          sy += cy;
        }
        const n = e.cells.length || 1;
        this.popCells[board] = e.cells;
        this.stepText[board] ={ text: `${e.score.base}*${e.score.bonus || 1}`, life: 70 };
        if (e.chain >= 2) {
          this.popups.push({
            x: Math.min(Math.max(sx / n, v.fx + 30), v.fx + FIELD_W - 30),
            y: sy / n - 8,
            text: `${e.chain} CHAIN!`,
            life: 60,
            scale: 1,
          });
        }
      } else if (e.type === 'popped') {
        const cells = this.popCells[board];
        if (cells) this.burst(v, cells);
        this.popCells[board] = null;
      } else if (e.type === 'chainEnd' && e.garbage > 0 && views.length > 1) {
        const target = views[1 - board];
        this.orbs.push({
          x0: v.fx + FIELD_W / 2,
          y0: v.fy + FIELD_H / 2,
          x1: target.fx + FIELD_W / 2,
          y1: target.fy - 8,
          t: 0,
          dur: 34,
          size: Math.min(10, 3 + Math.floor(Math.log2(e.garbage + 1))),
        });
      } else if (e.type === 'garbageDrop' && e.count >= 12) {
        v.shake = Math.min(12, 4 + e.count / 4);
      }
    }
  }

  burst(v: BoardView, cells: { x: number; y: number; color: number }[]): void {
    for (const c of cells) {
      const cx = v.fx + c.x * CELL_PX + 8;
      const cy = v.fy + (c.y - VISIBLE_TOP) * CELL_PX + 8;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + Math.random();
        const sp = 1 + Math.random() * 1.6;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1.2,
          life: 26 + Math.random() * 10,
          max: 36,
          color: BEAN_COLOR_CSS[c.color] ?? '#fff',
          size: 2 + (Math.random() < 0.4 ? 1 : 0),
        });
      }
    }
  }

  update(views: BoardView[]): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.y -= 0.35;
      p.life--;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    for (const o of this.orbs) o.t++;
    this.orbs = this.orbs.filter((o) => o.t <= o.dur);
    for (const s of this.stepText) if (s) s.life--;
    for (const v of views) if (v.shake > 0) v.shake = Math.max(0, v.shake - 0.6);
  }

  draw(g: Ctx, frame: number): void {
    for (const p of this.particles) {
      g.globalAlpha = Math.min(1, p.life / 12);
      rect(g, p.x, p.y, p.size, p.size, p.color);
    }
    g.globalAlpha = 1;
    for (const o of this.orbs) {
      const t = o.t / o.dur;
      const x = o.x0 + (o.x1 - o.x0) * t;
      const y = o.y0 + (o.y1 - o.y0) * t - Math.sin(t * Math.PI) * 40;
      g.fillStyle = 'rgba(255,240,160,0.35)';
      g.beginPath();
      g.arc(x, y, o.size + 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff8d0';
      g.beginPath();
      g.arc(x, y, o.size, 0, Math.PI * 2);
      g.fill();
    }
    for (const p of this.popups) {
      const col = CHAIN_COLORS[(Math.floor(frame / 3) + p.text.length) % CHAIN_COLORS.length];
      drawText(g, p.text, p.x, p.y, { color: col, outline: '#000', align: 'center', scale: p.scale });
    }
  }
}

export class Renderer {
  readonly g: Ctx;
  readonly effects = new Effects();
  private gearAngle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.g = ctx2d(canvas);
  }

  draw(scene: Scene): void {
    const g = this.g;
    this.gearAngle += 0.004;
    this.background(scene);
    if (scene.layout === 'versus') this.versusHud(scene);
    else if (scene.layout === 'solo') this.soloHud(scene);
    scene.boards.forEach((b) => this.board(b, scene.frame));
    this.effects.draw(g, scene.frame);
    if (scene.dim) {
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, 0, W, H);
    }
    for (const b of scene.banners) this.banner(scene, b);
  }

  // ------------------------------------------------------------- backdrop

  private background(scene: Scene): void {
    const g = this.g;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, scene.bg[0]);
    grad.addColorStop(1, scene.bg[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // Scrolling checker.
    const off = (scene.frame * 0.25) % 32;
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = -32; y < H + 32; y += 32)
      for (let x = -32; x < W + 32; x += 32) {
        g.fillRect(Math.round(x + off), Math.round(y + off), 16, 16);
        g.fillRect(Math.round(x + off + 16), Math.round(y + off + 16), 16, 16);
      }
    // The machine's gears turning in the background.
    this.gear(160, 200, 46, 14, this.gearAngle, 'rgba(0,0,0,0.25)');
    this.gear(110, 120, 26, 10, -this.gearAngle * 1.7, 'rgba(0,0,0,0.18)');
    this.gear(212, 96, 30, 11, -this.gearAngle * 1.5, 'rgba(0,0,0,0.18)');
  }

  private gear(cx: number, cy: number, r: number, teeth: number, a: number, color: string): void {
    const g = this.g;
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const rr = i % 2 ? r : r + 6;
      const a0 = a + (i / (teeth * 2)) * Math.PI * 2;
      const a1 = a + ((i + 1) / (teeth * 2)) * Math.PI * 2;
      g.lineTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
      g.lineTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
    }
    g.closePath();
    g.arc(cx, cy, r * 0.35, 0, Math.PI * 2, true);
    g.fill();
  }

  private frameBox(x: number, y: number, w: number, h: number): void {
    const g = this.g;
    rect(g, x - 3, y - 3, w + 6, h + 6, '#000000');
    rect(g, x - 2, y - 2, w + 4, h + 4, '#8a90a8');
    rect(g, x - 1, y - 1, w + 2, h + 2, '#30344a');
    g.fillStyle = 'rgba(8,8,20,0.88)';
    g.fillRect(x, y, w, h);
  }

  // ------------------------------------------------------------- HUD

  private versusHud(scene: Scene): void {
    const g = this.g;
    drawText(g, 'NEXT', 160, 4, { color: '#ffe060', align: 'center' });
    scene.boards.forEach((b, i) => this.nextBox(b.sim, i === 0 ? 124 : 178, 14));
    if (scene.portrait) {
      this.frameBox(128, 56, 64, 64);
      g.drawImage(scene.portrait, 128, 56);
    }
    let y = 128;
    for (const p of scene.panels) {
      drawText(g, p.label, 160, y, { color: p.color ?? '#a0c8ff', align: 'center' });
      drawText(g, p.value, 160, y + 10, { align: 'center' });
      y += 24;
    }
    for (const line of scene.info) {
      drawText(g, line, 160, y, { color: '#ffd0a0', align: 'center' });
      y += 10;
    }
  }

  private soloHud(scene: Scene): void {
    const g = this.g;
    if (scene.portraitLeft) {
      this.frameBox(24, 24, 64, 64);
      g.drawImage(scene.portraitLeft, 24, 24);
    }
    drawText(g, 'NEXT', 248, 12, { color: '#ffe060', align: 'center' });
    if (scene.boards[0]) this.nextBox(scene.boards[0].sim, 239, 22);
    let y = 74;
    for (const p of scene.panels) {
      drawText(g, p.label, 248, y, { color: p.color ?? '#a0c8ff', align: 'center' });
      drawText(g, p.value, 248, y + 10, { align: 'center' });
      y += 26;
    }
    let iy = 100;
    for (const line of scene.info) {
      drawText(g, line, 56, iy, { color: '#ffd0a0', align: 'center' });
      iy += 10;
    }
  }

  private nextBox(sim: PlayerSim, x: number, y: number): void {
    this.frameBox(x, y, 18, 34);
    if (!sim.alive) return;
    const [pivot, child] = sim.nextPair;
    this.g.drawImage(beanSprite(child), x + 1, y + 1);
    this.g.drawImage(beanSprite(pivot), x + 1, y + 17);
  }

  // ------------------------------------------------------------- the well

  private board(v: BoardView, frame: number): void {
    const g = this.g;
    const sim = v.sim;
    const sx = v.shake > 0 ? Math.round(Math.sin(frame * 1.7) * v.shake) : 0;
    const fx = v.fx + sx;
    const fy = v.fy;
    this.frameBox(fx, fy, FIELD_W, FIELD_H);
    g.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 0; x < COLS; x += 2) g.fillRect(fx + x * CELL_PX, fy, CELL_PX, FIELD_H);
    // The spawn column's danger mark.
    g.fillStyle = 'rgba(255,60,60,0.18)';
    g.fillRect(fx + 2 * CELL_PX + 3, fy + 3, 10, 10);

    g.save();
    g.beginPath();
    g.rect(fx, fy, FIELD_W, FIELD_H);
    g.clip();

    const deadOffset = v.deadAt !== undefined ? Math.min(400, ((frame - v.deadAt) ** 2) * 0.08) : 0;

    // Cells hidden under a moving bean are drawn by the faller instead.
    const covered = new Set<number>();
    for (const f of sim.fallers) if (!f.landed || f.squash > 0) covered.add(idx(f.x, f.toY));
    const popping = sim.phase === Phase.Flash ? new Set(sim.popping) : null;
    const blinkOn = popping !== null && Math.floor(frame / 3) % 2 === 0;

    for (let y = VISIBLE_TOP; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = idx(x, y);
        const c = sim.field[i];
        if (!c || covered.has(i)) continue;
        const flash = popping?.has(i) && blinkOn;
        const conn = c === GARBAGE ? 0 : this.connections(sim, x, y, c, covered);
        const px = fx + x * CELL_PX;
        const py = fy + (y - VISIBLE_TOP) * CELL_PX + deadOffset * (1 + x * 0.15);
        g.drawImage(beanSprite(c, conn, !!flash, flash ? 'wide' : 'open'), px, Math.round(py));
      }
    }

    for (const f of sim.fallers) {
      if (f.landed && f.squash <= 0) continue;
      const px = fx + f.x * CELL_PX;
      const py = fy + f.pos / 0x10000 - VISIBLE_TOP * CELL_PX + deadOffset;
      if (f.landed) {
        const k = [0.72, 0.84, 1, 0.9, 1, 0.94, 1][Math.floor((14 - f.squash) / 2)] ?? 1;
        const h = Math.round(16 * k);
        const w = Math.round(16 * (2 - k));
        g.drawImage(beanSprite(f.cell), px - Math.floor((w - 16) / 2), Math.round(py) + 16 - h, w, h);
      } else {
        g.drawImage(beanSprite(f.cell), px, Math.round(py));
      }
    }

    const p = sim.piece;
    if (p && sim.phase === Phase.Control) {
      const baseX = fx + p.x * CELL_PX + p.slide;
      const baseY = fy + (p.y - VISIBLE_TOP) * CELL_PX - (p.sub < 0x8000 ? 8 : 0);
      const t = p.rotAnim / 4;
      let a0 = p.rotFrom * 90;
      let a1 = p.rot * 90;
      if (a1 - a0 > 180) a0 += 360;
      if (a0 - a1 > 180) a1 += 360;
      const ang = ((a1 + (a0 - a1) * t) * Math.PI) / 180;
      const cdx = t > 0 ? Math.sin(ang) * CELL_PX : ROT_DX[p.rot] * CELL_PX;
      const cdy = t > 0 ? -Math.cos(ang) * CELL_PX : ROT_DY[p.rot] * CELL_PX;
      const pivotFlash = frame % 32 < 4;
      const squash = p.bounce < 4 ? [0.8, 0.88, 0.95, 1][p.bounce] : 1;
      this.bean(p.child, baseX + cdx, baseY + cdy, squash, false);
      this.bean(p.pivot, baseX, baseY, squash, pivotFlash);
    }

    g.restore();
    this.queue(v, fx);
  }

  private bean(color: number, x: number, y: number, squash: number, flash: boolean): void {
    const s = beanSprite(color, 0, flash);
    if (squash === 1) this.g.drawImage(s, Math.round(x), Math.round(y));
    else {
      const h = Math.round(16 * squash);
      this.g.drawImage(s, Math.round(x), Math.round(y) + 16 - h, 16, h);
    }
  }

  private connections(sim: PlayerSim, x: number, y: number, c: number, covered: Set<number>): number {
    const same = (nx: number, ny: number): boolean => {
      if (nx < 0 || nx >= COLS || ny < VISIBLE_TOP || ny >= ROWS) return false;
      const i = idx(nx, ny);
      return sim.field[i] === c && !covered.has(i);
    };
    return (
      (same(x, y - 1) ? CONNECT_UP : 0) |
      (same(x + 1, y) ? CONNECT_RIGHT : 0) |
      (same(x, y + 1) ? CONNECT_DOWN : 0) |
      (same(x - 1, y) ? CONNECT_LEFT : 0)
    );
  }

  /** Refugee queue: a big bean per 6, a small one per 1, a crowned one per 30. */
  private queue(v: BoardView, fx: number): void {
    let n = v.pending;
    if (n <= 0) return;
    const g = this.g;
    const icons: number[] = [];
    while (n >= 30 && icons.length < 6) {
      icons.push(30);
      n -= 30;
    }
    while (n >= 6 && icons.length < 6) {
      icons.push(6);
      n -= 6;
    }
    while (n > 0 && icons.length < 6) {
      icons.push(1);
      n--;
    }
    const sprite = beanSprite(GARBAGE);
    let x = fx + 2;
    const y = v.fy - 16;
    for (const k of icons) {
      if (k === 1) {
        g.drawImage(sprite, x, y + 6, 10, 10);
        x += 11;
      } else {
        g.drawImage(sprite, x, y, 16, 16);
        if (k === 30) {
          rect(g, x + 5, y - 1, 6, 3, '#ffd040');
          rect(g, x + 4, y - 3, 2, 2, '#ffd040');
          rect(g, x + 7, y - 3, 2, 2, '#ffd040');
          rect(g, x + 10, y - 3, 2, 2, '#ffd040');
        }
        x += 16;
      }
    }
  }

  private banner(scene: Scene, b: Banner): void {
    let cx = W / 2;
    let cy = H / 2 - 12;
    if (b.board !== undefined && scene.boards[b.board]) {
      const v = scene.boards[b.board];
      cx = v.fx + FIELD_W / 2;
      cy = v.fy + FIELD_H / 2 - 12;
    }
    const color = b.color ?? '#ffe040';
    drawText(this.g, b.text, cx, cy, { color, outline: '#000', align: 'center', scale: 2 });
    if (b.sub) drawText(this.g, b.sub, cx, cy + 22, { color: '#ffffff', outline: '#000', align: 'center' });
  }
}
