import { COLS, DEATH_X, GARBAGE, Phase, type PlayerSim, ROT_DX, ROT_DY, ROWS, VISIBLE_TOP, idx } from '@mbm/engine';
import type { Character } from '../game/characters.ts';
import { Effects, type FxBoard } from './fx.ts';
import type { Hero } from './hero.ts';
import { type EyeStyle, bridge, jelly, jellyAt } from './jelly.ts';
import { type Box, type Layout, computeLayout } from './layout.ts';
import { type Expression, portrait } from './portraits.ts';
import { type SceneKind, drawStage } from './stage.ts';
import { BODY, DISPLAY, gradientText, text } from './text.ts';

export interface BoardView {
  sim: PlayerSim;
  pending: number;
  deadAt?: number;
  shake: number;
  mood?: 'win' | 'lose';
}

export type Foe = { kind: 'robot'; character: Character; expr: Expression; name: string } | { kind: 'hero'; hero: Hero; name: string };

export type Tone = 'gold' | 'green' | 'red' | 'blue';

export interface Banner {
  text: string;
  sub?: string;
  tone?: Tone;
  board?: number;
  age?: number;
  style?: 'drop' | 'zoom' | 'bounce';
}

export interface Panel {
  label: string;
  value?: string;
  score?: number;
  color?: string;
  badge?: string;
}

export interface BattleScene {
  scene: SceneKind;
  boards: BoardView[];
  hero?: Hero | null;
  heroName?: string;
  foe?: Foe | null;
  panels: Panel[];
  info: string[];
  banners: Banner[];
  dim?: boolean;
  frame: number;
}

const TONES: Record<Tone, [string, string]> = {
  gold: ['#fff27a', '#ffa21a'],
  green: ['#d4ffb8', '#2ed158'],
  red: ['#ffc8d0', '#ff2e52'],
  blue: ['#cfe8ff', '#3a8aff'],
};

const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

export class BattleRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly effects = new Effects();
  layout: Layout = computeLayout(1280, 720, 2);
  /** Device pixels per layout unit. */
  scale = 1;
  private ox = 0;
  private oy = 0;
  private dpr = 1;
  private shown = new Map<number, number>();
  private nextAnim = new Map<number, { key: string; t: number }>();
  private boardCount = 2;
  private lastSize = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d')!;
  }

  resetHud(): void {
    this.shown.clear();
    this.nextAnim.clear();
  }

  /** Matches the canvas to its CSS size at full device resolution. */
  fit(boards: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    const key = `${cw}x${ch}@${dpr}:${boards}`;
    if (key === this.lastSize) return;
    this.lastSize = key;
    this.dpr = dpr;
    this.boardCount = boards;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.layout = computeLayout(cw, ch, boards);
    const l = this.layout;
    this.scale = Math.min(this.canvas.width / l.vw, this.canvas.height / l.vh);
    this.ox = (this.canvas.width - l.vw * this.scale) / 2;
    this.oy = (this.canvas.height - l.vh * this.scale) / 2;
  }

  /** Converts a page position to layout units (for touch controls). */
  toLayout(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [((clientX - r.left) * this.dpr - this.ox) / this.scale, ((clientY - r.top) * this.dpr - this.oy) / this.scale];
  }

  fxBoards(views: BoardView[]): FxBoard[] {
    return views.map((v, i) => {
      const b = this.layout.boards[i];
      return { x: b.x, y: b.y, cell: b.cell, get shake() { return v.shake; }, set shake(s: number) { v.shake = s; } };
    });
  }

  draw(s: BattleScene): void {
    this.fit(s.boards.length || this.boardCount);
    const g = this.g;
    const t = s.frame / 60;
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawStage(g, s.scene, this.canvas.width, this.canvas.height, t);
    const fx = this.effects;
    const sx = fx.shake > 0 ? Math.sin(s.frame * 1.9) * fx.shake : 0;
    const sy = fx.shake > 0 ? Math.cos(s.frame * 2.3) * fx.shake : 0;
    g.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale);
    const l = this.layout;
    this.characters(s);
    s.boards.forEach((b, i) => this.board(b, i, l.boards[i], s.frame));
    s.boards.forEach((b, i) => {
      const n = l.next[i];
      if (n) this.nextBox(b.sim, i, n);
    });
    s.panels.forEach((p, i) => this.panel(p, i));
    s.info.forEach((line, i) => {
      if (line) text(g, line, l.info.x, l.info.y + i * 34, { size: 24, color: '#ffe6b0' });
    });
    fx.draw(g, this.scale);
    if (s.hero?.bubble) {
      // Speech bubbles sit above the boards.
      const h = l.hero;
      g.save();
      s.hero.draw(g, h.x, h.y, h.size);
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${fx.flash})`;
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (s.dim) {
      g.fillStyle = 'rgba(6,4,20,0.55)';
      g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    g.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    for (const b of s.banners) this.banner(b);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ------------------------------------------------------------- people

  private characters(s: BattleScene): void {
    const g = this.g;
    const l = this.layout;
    if (s.hero) {
      const h = l.hero;
      // A soft spotlight under the hero.
      const glow = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.size * 0.9);
      glow.addColorStop(0, 'rgba(255,255,255,0.18)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.ellipse(h.x, h.y, h.size * 0.9, h.size * 0.28, 0, 0, Math.PI * 2);
      g.fill();
      if (!s.hero.bubble) s.hero.draw(g, h.x, h.y, h.size);
      if (s.heroName) text(g, s.heroName, h.x, h.y + 28, { size: 22, color: '#ffffff' });
    }
    if (s.foe) {
      const f = l.foe;
      this.card(f.x, f.y, f.size, f.size);
      g.save();
      g.beginPath();
      g.roundRect(f.x + 6, f.y + 6, f.size - 12, f.size - 12, 16);
      g.clip();
      if (s.foe.kind === 'robot') {
        const img = portrait(s.foe.character, s.foe.expr, (f.size - 12) * this.scale);
        const bob = s.foe.expr === 'ko' ? 0 : Math.sin(s.frame / 20) * 2;
        g.drawImage(img, f.x + 6, f.y + 6 + bob, f.size - 12, f.size - 12);
      } else {
        g.fillStyle = '#2a3a8a';
        g.fillRect(f.x, f.y, f.size, f.size);
        s.foe.hero.draw(g, f.x + f.size / 2, f.y + f.size * 0.92, f.size * 0.62);
      }
      g.restore();
      const plateY = f.y + f.size + 6;
      g.fillStyle = 'rgba(10,8,30,0.78)';
      g.beginPath();
      g.roundRect(f.x - 6, plateY, f.size + 12, 34, 12);
      g.fill();
      text(g, s.foe.name, f.x + f.size / 2, plateY + 17, { size: Math.min(24, (f.size * 1.6) / Math.max(6, s.foe.name.length)), color: '#ffffff' });
    }
  }

  private card(x: number, y: number, w: number, h: number): void {
    const g = this.g;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 6;
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, '#8ab4ff');
    grad.addColorStop(1, '#3a5ad0');
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(x, y, w, h, 20);
    g.fill();
    g.restore();
    g.strokeStyle = '#1a1c4a';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(x, y, w, h, 20);
    g.stroke();
  }

  // ------------------------------------------------------------- HUD

  private panel(p: Panel, i: number): void {
    const g = this.g;
    const box = this.layout.panels[i];
    if (!box) return;
    const h = 78;
    g.fillStyle = 'rgba(10,8,34,0.72)';
    g.beginPath();
    g.roundRect(box.x, box.y, box.w, h, 18);
    g.fill();
    g.strokeStyle = p.color ?? '#8ab4ff';
    g.lineWidth = 3;
    g.stroke();
    text(g, p.label, box.x + box.w / 2, box.y + 22, { size: 20, color: p.color ?? '#a8c8ff', font: BODY, weight: 900, stroke: null });
    text(g, this.value(p, i), box.x + box.w / 2, box.y + 54, { size: 30, color: '#ffffff' });
  }

  private value(p: Panel, i: number): string {
    if (p.value !== undefined) return p.value;
    const target = p.score ?? 0;
    let shown = this.shown.get(i) ?? target;
    if (shown > target) shown = target;
    if (shown < target) shown = Math.min(target, shown + Math.max(1, Math.ceil((target - shown) * 0.2)));
    this.shown.set(i, shown);
    return Math.floor(shown).toLocaleString('en-US');
  }

  private nextBox(sim: PlayerSim, board: number, n: Box): void {
    const g = this.g;
    const w = n.cell + 20;
    const h = n.cell * 2 + 46;
    g.fillStyle = 'rgba(10,8,34,0.72)';
    g.beginPath();
    g.roundRect(n.x, n.y, w, h, 16);
    g.fill();
    g.strokeStyle = 'rgba(160,190,255,0.6)';
    g.lineWidth = 2.5;
    g.stroke();
    text(g, 'NEXT', n.x + w / 2, n.y + 15, { size: 16, color: '#ffe066', font: BODY, weight: 900, stroke: null });
    if (!sim.alive) return;
    const [pivot, child] = sim.nextPair;
    const key = `${sim.piecesPlaced}:${pivot}${child}`;
    let a = this.nextAnim.get(board);
    if (!a || a.key !== key) {
      a = { key, t: a ? 0 : 99 };
      this.nextAnim.set(board, a);
    }
    a.t++;
    const off = a.t < 12 ? (1 - a.t / 12) ** 2 * n.cell * 1.2 : 0;
    g.save();
    g.beginPath();
    g.rect(n.x, n.y + 26, w, h - 30);
    g.clip();
    const px = n.cell * this.scale;
    g.drawImage(jellyAt(child, px), n.x + 10, n.y + 30 + off, n.cell, n.cell);
    g.drawImage(jellyAt(pivot, px), n.x + 10, n.y + 30 + n.cell + off, n.cell, n.cell);
    g.restore();
  }

  // ------------------------------------------------------------- the board

  private danger(sim: PlayerSim): boolean {
    for (let x = 0; x < COLS; x++) {
      for (let y = VISIBLE_TOP; y < ROWS; y++) {
        if (sim.field[idx(x, y)]) {
          if (ROWS - y >= (x === DEATH_X ? 9 : 11)) return true;
          break;
        }
      }
    }
    return false;
  }

  private board(v: BoardView, index: number, b: Box, frame: number): void {
    const g = this.g;
    const sim = v.sim;
    const c = b.cell;
    const W = c * COLS;
    const H = c * (ROWS - VISIBLE_TOP);
    const bx = b.x + (v.shake > 0 ? Math.sin(frame * 1.7) * v.shake : 0);
    const by = b.y;
    const danger = sim.alive && !v.mood && this.danger(sim);
    const px = c * this.scale;

    // Frame: glass well with a soft glow.
    g.save();
    g.shadowColor = danger ? 'rgba(255,40,70,0.8)' : 'rgba(0,0,0,0.5)';
    g.shadowBlur = danger ? 20 + Math.sin(frame * 0.2) * 10 : 24;
    g.shadowOffsetY = danger ? 0 : 8;
    g.fillStyle = 'rgba(12,14,40,0.82)';
    g.beginPath();
    g.roundRect(bx - 8, by - 8, W + 16, H + 16, c * 0.38);
    g.fill();
    g.restore();
    const rim = g.createLinearGradient(0, by - 8, 0, by + H + 8);
    rim.addColorStop(0, danger ? '#ff8a9a' : '#b8ccff');
    rim.addColorStop(1, danger ? '#a0102a' : '#3a4a9a');
    g.strokeStyle = rim;
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(bx - 8, by - 8, W + 16, H + 16, c * 0.38);
    g.stroke();
    g.save();
    g.beginPath();
    g.roundRect(bx - 4, by - 4, W + 8, H + 8, c * 0.3);
    g.clip();
    for (let x = 0; x < COLS; x += 2) {
      g.fillStyle = 'rgba(255,255,255,0.03)';
      g.fillRect(bx + x * c, by, c, H);
    }
    // The X: a bean here when the next pair is due ends the game.
    const xx = bx + DEATH_X * c + c / 2;
    const xy = by + c / 2;
    g.strokeStyle = danger && frame % 30 < 15 ? 'rgba(255,70,90,0.9)' : 'rgba(255,70,90,0.35)';
    g.lineWidth = c * 0.09;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(xx - c * 0.22, xy - c * 0.22);
    g.lineTo(xx + c * 0.22, xy + c * 0.22);
    g.moveTo(xx + c * 0.22, xy - c * 0.22);
    g.lineTo(xx - c * 0.22, xy + c * 0.22);
    g.stroke();

    const dead = v.deadAt !== undefined;
    const since = dead ? frame - v.deadAt! : 0;
    const covered = new Set<number>();
    for (const f of sim.fallers) if (!f.landed || f.squash > 0) covered.add(idx(f.x, f.toY));
    const popping = sim.phase === Phase.Flash ? new Set(sim.popping) : null;
    const blinkOn = popping !== null && Math.floor(frame / 3) % 2 === 0;
    const mood: EyeStyle = v.mood === 'win' ? 'happy' : v.mood === 'lose' || dead ? 'closed' : danger ? 'up' : 'open';
    const cellX = (x: number): number => bx + x * c;
    const cellY = (y: number): number => by + (y - VISIBLE_TOP) * c;

    if (!dead) {
      // Jelly joints between same-coloured neighbours, under the beans.
      for (let y = VISIBLE_TOP; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = idx(x, y);
          const col = sim.field[i];
          if (!col || col === GARBAGE || covered.has(i)) continue;
          const lift = v.mood === 'win' ? 0 : 0;
          if (x + 1 < COLS && sim.field[i + 1] === col && !covered.has(i + 1)) bridge(g, col, cellX(x), cellY(y) - lift, c, true);
          if (y + 1 < ROWS && sim.field[i + COLS] === col && !covered.has(i + COLS)) bridge(g, col, cellX(x), cellY(y), c, false);
        }
      }
    }

    for (let y = VISIBLE_TOP; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = idx(x, y);
        const col = sim.field[i];
        if (!col || covered.has(i)) continue;
        const isPop = popping?.has(i) ?? false;
        let eyes: EyeStyle = mood;
        if (isPop) eyes = 'wide';
        else if (mood === 'open') {
          const h = hash(i + index * 97);
          if ((frame + (h % 997)) % (170 + (h % 150)) < 7) eyes = 'blink';
        }
        let x0 = cellX(x);
        let y0 = cellY(y);
        if (isPop) x0 += Math.sin(frame * 1.5 + i) * c * 0.04;
        if (v.mood === 'win') y0 -= Math.max(0, Math.sin(frame * 0.25 + x * 0.9) * c * 0.12);
        const sprite = jelly(col, px, eyes, isPop && blinkOn);
        if (dead) {
          const h = hash(i * 7 + 3);
          const dir = h % 2 ? 1 : -1;
          const drop = since * since * c * 0.0045 * (1 + (h % 5) * 0.1) - Math.min(since, 8) * c * 0.04;
          g.save();
          g.translate(x0 + c / 2 + dir * since * c * (0.012 + (h % 3) * 0.008), y0 + c / 2 + Math.max(-c * 0.3, drop));
          g.rotate(dir * since * 0.04 * (1 + (h % 4) * 0.3));
          g.drawImage(sprite, -c / 2, -c / 2, c, c);
          g.restore();
        } else {
          g.drawImage(sprite, x0, y0, c, c);
        }
      }
    }

    for (const f of sim.fallers) {
      if (f.landed && f.squash <= 0) continue;
      const fx = cellX(f.x);
      const fy = by + (f.pos / 0x10000 / 16 - VISIBLE_TOP) * c;
      if (f.landed) {
        const k = [0.72, 0.84, 1.05, 0.93, 1.02, 0.98, 1][Math.floor((14 - f.squash) / 2)] ?? 1;
        const hh = c * k;
        const ww = c * (2 - k);
        g.drawImage(jelly(f.cell, px, k < 0.86 ? 'closed' : 'open'), fx - (ww - c) / 2, fy + c - hh, ww, hh);
      } else {
        g.drawImage(jelly(f.cell, px, f.cell === GARBAGE ? 'open' : 'wide'), fx, fy, c, c);
      }
    }

    const p = sim.piece;
    if (p && sim.phase === Phase.Control) {
      const baseX = cellX(p.x) + (p.slide / 16) * c;
      const baseY = cellY(p.y) - (p.sub < 0x8000 ? c / 2 : 0);
      const tt = p.rotAnim / 4;
      let a0 = p.rotFrom * 90;
      let a1 = p.rot * 90;
      if (a1 - a0 > 180) a0 += 360;
      if (a0 - a1 > 180) a1 += 360;
      const ang = ((a1 + (a0 - a1) * tt) * Math.PI) / 180;
      const cdx = tt > 0 ? Math.sin(ang) * c : ROT_DX[p.rot] * c;
      const cdy = tt > 0 ? -Math.cos(ang) * c : ROT_DY[p.rot] * c;
      const squash = p.bounce < 4 ? [0.82, 0.9, 0.96, 1][p.bounce] : 1;
      const eyes: EyeStyle = danger ? 'up' : 'open';
      // A soft halo marks the pair you control.
      const halo = g.createRadialGradient(baseX + c / 2, baseY + c / 2, c * 0.2, baseX + c / 2, baseY + c / 2, c * 1.1);
      halo.addColorStop(0, 'rgba(255,255,255,0.12)');
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = halo;
      g.fillRect(baseX - c, baseY - c, c * 3, c * 3);
      this.bean(p.child, baseX + cdx, baseY + cdy, c, squash, false, eyes);
      this.bean(p.pivot, baseX, baseY, c, squash, frame % 40 < 5, eyes);
    }

    // Glass reflection.
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.beginPath();
    g.moveTo(bx + W * 0.1, by);
    g.lineTo(bx + W * 0.35, by);
    g.lineTo(bx - W * 0.1, by + H);
    g.lineTo(bx - W * 0.35, by + H);
    g.fill();
    if (dead) {
      g.fillStyle = `rgba(6,4,20,${Math.min(0.55, since / 70)})`;
      g.fillRect(bx - 8, by - 8, W + 16, H + 16);
    }
    g.restore();
    this.queue(v, index, bx, by, c);
  }

  private bean(color: number, x: number, y: number, c: number, squash: number, flash: boolean, eyes: EyeStyle): void {
    const s = jelly(color, c * this.scale, eyes, flash);
    if (squash === 1) this.g.drawImage(s, x, y, c, c);
    else {
      const h = c * squash;
      const w = c * (2 - squash);
      this.g.drawImage(s, x - (w - c) / 2, y + c - h, w, h);
    }
  }

  /** Incoming refugees: big bean = 6, small = 1, crowned = 30. */
  private queue(v: BoardView, index: number, bx: number, by: number, c: number): void {
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
    const bump = this.effects.queueBump[index] ?? 0;
    let x = bx;
    const y = by - c * 0.95;
    icons.forEach((k, i) => {
      const hop = bump > 0 ? Math.sin((bump / 14) * Math.PI + i * 0.5) * c * 0.2 : 0;
      const s = k === 1 ? c * 0.55 : c * 0.85;
      g.drawImage(jellyAt(GARBAGE, s * this.scale, 'wide'), x, y + (c * 0.85 - s) - hop, s, s);
      if (k === 30) {
        g.fillStyle = '#ffd23a';
        g.strokeStyle = '#8a5a00';
        g.lineWidth = 2;
        g.beginPath();
        const cx = x + s / 2;
        const cy = y - hop - c * 0.05;
        g.moveTo(cx - s * 0.3, cy);
        g.lineTo(cx - s * 0.3, cy - s * 0.25);
        g.lineTo(cx - s * 0.12, cy - s * 0.1);
        g.lineTo(cx, cy - s * 0.3);
        g.lineTo(cx + s * 0.12, cy - s * 0.1);
        g.lineTo(cx + s * 0.3, cy - s * 0.25);
        g.lineTo(cx + s * 0.3, cy);
        g.closePath();
        g.fill();
        g.stroke();
      }
      x += s + c * 0.08;
    });
    if (v.pending >= 6) text(g, `+${v.pending}`, x + c * 0.5, y + c * 0.45, { size: c * 0.42, color: '#ffffff' });
  }

  private banner(b: Banner): void {
    const l = this.layout;
    let cx = l.vw / 2;
    let cy = l.vh / 2 - 20;
    if (b.board !== undefined && l.boards[b.board]) {
      const box = l.boards[b.board];
      cx = box.x + box.cell * 3;
      cy = box.y + box.cell * 6 - 20;
    }
    const age = b.age ?? 99;
    const [top, bottom] = TONES[b.tone ?? 'gold'];
    let scale = 1;
    let dy = 0;
    let alpha = 1;
    if (b.style === 'drop') {
      const t = Math.min(1, age / 12);
      dy = -140 * (1 - t) ** 2 + (t === 1 ? Math.sin(age * 0.15) * 4 : 0);
    } else if (b.style === 'zoom') {
      scale = Math.max(1, 2.4 - age * 0.18);
      alpha = age > 18 ? Math.max(0, 1 - (age - 18) / 10) : 1;
    } else if (b.style === 'bounce') {
      scale = age < 10 ? 1.7 - (age / 10) * 0.7 + Math.sin((age / 10) * Math.PI) * 0.15 : 1;
      dy = age >= 10 ? Math.sin(age * 0.12) * 5 : 0;
    }
    const size = (b.board !== undefined ? 64 : 84) * scale * (l.mode === 'portrait' && b.board === 1 ? 0.6 : 1);
    const g = this.g;
    g.globalAlpha = alpha;
    gradientText(g, b.text, cx, cy + dy, size, top, bottom, DISPLAY);
    g.globalAlpha = 1;
    if (b.sub && age > 6) text(g, b.sub, cx, cy + dy + size * 0.75, { size: 26, color: '#ffffff', font: BODY, weight: 900 });
  }
}
