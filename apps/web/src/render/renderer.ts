import { CELL_PX, COLS, DEATH_X, GARBAGE, Phase, type PlayerSim, ROT_DX, ROT_DY, ROWS, VISIBLE_TOP, idx } from '@mbm/engine';
import type { Character } from '../game/characters.ts';
import { CONNECT_DOWN, CONNECT_LEFT, CONNECT_RIGHT, CONNECT_UP, type EyeStyle, beanSprite } from './beans.ts';
import { drawText, fancyText } from './font.ts';
import { Effects, FIELD_H, FIELD_W } from './fx.ts';
import { type Ctx, ctx2d, rect } from './pixels.ts';
import { type Expression, portrait } from './portraits.ts';
import { type SceneKind, drawScene } from './scenes.ts';

export { FIELD_H, FIELD_W };
export const W = 320;
export const H = 224;

export interface BoardView {
  sim: PlayerSim;
  fx: number;
  fy: number;
  /** Refugees to show in the queue above the well. */
  pending: number;
  deadAt?: number;
  shake: number;
  mood?: 'win' | 'lose';
}

export type Tone = 'gold' | 'green' | 'red' | 'blue';

export interface Banner {
  text: string;
  sub?: string;
  tone?: Tone;
  /** Board index to centre on; omitted = whole screen. */
  board?: number;
  /** Frames since the banner appeared, for its entrance animation. */
  age?: number;
  style?: 'drop' | 'zoom' | 'bounce';
}

export interface Panel {
  label: string;
  /** Shown as-is when set (e.g. the "40*8" chain readout). */
  value?: string;
  /** Otherwise a score that counts up smoothly. */
  score?: number;
  color?: string;
}

export interface Face {
  character: Character;
  expr: Expression;
  name?: string;
}

export interface Scene {
  layout: 'versus' | 'solo' | 'none';
  boards: BoardView[];
  frame: number;
  scene: SceneKind;
  face?: Face | null;
  faceLeft?: Face | null;
  panels: Panel[];
  info: string[];
  banners: Banner[];
  dim?: boolean;
}

const TONES: Record<Tone, [string, string]> = {
  gold: ['#fff27a', '#ff9c1a'],
  green: ['#c8ffb8', '#22c44a'],
  red: ['#ffc4cc', '#ff2e4c'],
  blue: ['#c8e8ff', '#3a88ff'],
};

const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

export class Renderer {
  readonly g: Ctx;
  readonly effects = new Effects();
  private shown = new Map<number, number>();
  private nextAnim = new Map<number, { key: string; t: number }>();

  constructor(canvas: HTMLCanvasElement) {
    this.g = ctx2d(canvas);
  }

  /** Forget per-match animation state (score counters, NEXT slides). */
  resetHud(): void {
    this.shown.clear();
    this.nextAnim.clear();
  }

  draw(scene: Scene): void {
    const g = this.g;
    drawScene(g, scene.scene, scene.frame);
    const fx = this.effects;
    const sx = fx.shake > 0 ? Math.round(Math.sin(scene.frame * 1.9) * fx.shake) : 0;
    const sy = fx.shake > 0 ? Math.round(Math.cos(scene.frame * 2.3) * fx.shake) : 0;
    g.save();
    g.translate(sx, sy);
    if (scene.layout === 'versus') this.versusHud(scene);
    else if (scene.layout === 'solo') this.soloHud(scene);
    scene.boards.forEach((b, i) => this.board(b, i, scene.frame));
    fx.draw(g, scene.frame);
    g.restore();
    if (fx.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${fx.flash})`;
      g.fillRect(0, 0, W, H);
    }
    if (scene.dim) {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, 0, W, H);
    }
    for (const b of scene.banners) this.banner(scene, b);
  }

  // ------------------------------------------------------------- frames and HUD

  private metalBox(x: number, y: number, w: number, h: number): void {
    const g = this.g;
    rect(g, x - 4, y - 4, w + 8, h + 8, '#05040c');
    rect(g, x - 3, y - 3, w + 6, h + 6, '#6a7090');
    rect(g, x - 3, y - 3, w + 6, 1, '#c8d0e8');
    rect(g, x - 3, y - 3, 1, h + 6, '#a8b0cc');
    rect(g, x - 3, y + h + 2, w + 6, 1, '#2c3046');
    rect(g, x + w + 2, y - 3, 1, h + 6, '#3a3e56');
    rect(g, x - 1, y - 1, w + 2, h + 2, '#12142a');
    for (const [rx, ry] of [[x - 2, y - 2], [x + w, y - 2], [x - 2, y + h], [x + w, y + h]]) {
      rect(g, rx, ry, 2, 2, '#eef2ff');
      rect(g, rx + 1, ry + 1, 1, 1, '#4a4e66');
    }
  }

  private panelBg(x: number, y: number, w: number, h: number): void {
    const g = this.g;
    g.fillStyle = 'rgba(6,4,18,0.62)';
    g.fillRect(x + 1, y, w - 2, h);
    g.fillRect(x, y + 1, w, h - 2);
  }

  private versusHud(scene: Scene): void {
    const g = this.g;
    this.panelBg(117, 1, 86, 50);
    drawText(g, 'NEXT', 160, 4, { color: '#ffe060', align: 'center' });
    scene.boards.forEach((b, i) => this.nextBox(b.sim, i, i === 0 ? 125 : 177, 15));
    if (scene.face) this.face(scene.face, 128, 56, scene.frame);
    let y = 136;
    this.panelBg(115, y - 3, 90, 88);
    scene.panels.forEach((p, i) => {
      drawText(g, p.label, 160, y, { color: p.color ?? '#a0c8ff', align: 'center' });
      drawText(g, this.panelValue(p, i), 160, y + 10, { align: 'center' });
      y += 23;
    });
    for (const line of scene.info) {
      if (line) drawText(g, line, 160, y, { color: '#ffd0a0', align: 'center' });
      y += 10;
    }
  }

  private soloHud(scene: Scene): void {
    const g = this.g;
    if (scene.faceLeft) this.face(scene.faceLeft, 24, 22, scene.frame);
    this.panelBg(214, 6, 70, 196);
    drawText(g, 'NEXT', 248, 10, { color: '#ffe060', align: 'center' });
    if (scene.boards[0]) this.nextBox(scene.boards[0].sim, 0, 240, 21);
    let y = 70;
    scene.panels.forEach((p, i) => {
      drawText(g, p.label, 248, y, { color: p.color ?? '#a0c8ff', align: 'center' });
      drawText(g, this.panelValue(p, i), 248, y + 10, { align: 'center' });
      y += 26;
    });
    let iy = 112;
    this.panelBg(22, iy - 4, 68, scene.info.length * 10 + 6);
    for (const line of scene.info) {
      drawText(g, line, 56, iy, { color: '#ffd0a0', align: 'center' });
      iy += 10;
    }
  }

  private panelValue(p: Panel, i: number): string {
    if (p.value !== undefined) return p.value;
    const target = p.score ?? 0;
    let shown = this.shown.get(i) ?? target;
    if (shown > target) shown = target;
    if (shown < target) shown = Math.min(target, shown + Math.max(1, Math.ceil((target - shown) * 0.22)));
    this.shown.set(i, shown);
    return String(Math.floor(shown)).padStart(8, '0');
  }

  private face(f: Face, x: number, y: number, frame: number): void {
    const g = this.g;
    this.metalBox(x, y, 64, 64);
    const calm = f.expr === 'idle' || f.expr === 'worried';
    const blink = calm && (frame + hash(f.character.id.length * 31)) % 230 < 7;
    const bob = f.expr === 'ko' ? 0 : Math.round(Math.sin(frame / (f.expr === 'worried' ? 6 : 22)) * (f.expr === 'worried' ? 1 : 1.2));
    const jitter = f.expr === 'worried' && frame % 40 < 4 ? (frame % 2 ? 1 : -1) : 0;
    g.save();
    g.beginPath();
    g.rect(x, y, 64, 64);
    g.clip();
    g.drawImage(portrait(f.character, blink ? 'blink' : f.expr), x + jitter, y + bob);
    g.restore();
    if (f.name) {
      const label = f.name.toUpperCase().slice(0, 14);
      this.panelBg(x - 6, y + 66, 76, 11);
      drawText(g, label, x + 32, y + 68, { color: '#ffffff', align: 'center' });
    }
  }

  private nextBox(sim: PlayerSim, board: number, x: number, y: number): void {
    const g = this.g;
    this.metalBox(x, y, 18, 34);
    g.fillStyle = 'rgba(10,12,30,0.9)';
    g.fillRect(x, y, 18, 34);
    if (!sim.alive) return;
    const [pivot, child] = sim.nextPair;
    const key = `${sim.piecesPlaced}:${pivot}${child}`;
    let a = this.nextAnim.get(board);
    if (!a || a.key !== key) {
      a = { key, t: a ? 0 : 99 };
      this.nextAnim.set(board, a);
    }
    a.t++;
    const off = a.t < 9 ? Math.round((1 - a.t / 9) ** 2 * 20) : 0;
    g.save();
    g.beginPath();
    g.rect(x, y, 18, 34);
    g.clip();
    g.drawImage(beanSprite(child), x + 1, y + 1 + off);
    g.drawImage(beanSprite(pivot), x + 1, y + 17 + off);
    g.restore();
  }

  // ------------------------------------------------------------- the well

  private danger(sim: PlayerSim): boolean {
    for (let x = 0; x < COLS; x++) {
      for (let y = VISIBLE_TOP; y < ROWS; y++) {
        if (sim.field[idx(x, y)]) {
          const h = ROWS - y;
          if (h >= (x === DEATH_X ? 9 : 11)) return true;
          break;
        }
      }
    }
    return false;
  }

  private board(v: BoardView, index: number, frame: number): void {
    const g = this.g;
    const sim = v.sim;
    const bx = v.shake > 0 ? Math.round(Math.sin(frame * 1.7) * v.shake) : 0;
    const fx = v.fx + bx;
    const fy = v.fy;
    const danger = sim.alive && !v.mood && this.danger(sim);

    this.metalBox(fx, fy, FIELD_W, FIELD_H);
    const glass = g.createLinearGradient(0, fy, 0, fy + FIELD_H);
    glass.addColorStop(0, 'rgba(22,26,56,0.93)');
    glass.addColorStop(1, 'rgba(8,8,22,0.95)');
    g.fillStyle = glass;
    g.fillRect(fx, fy, FIELD_W, FIELD_H);
    for (let cy = 1; cy < 12; cy++) for (let cx = 1; cx < COLS; cx++) rect(g, fx + cx * CELL_PX, fy + cy * CELL_PX, 1, 1, 'rgba(255,255,255,0.07)');
    // The X: a bean here when the next pair is due ends the game.
    const xx = fx + DEATH_X * CELL_PX;
    g.fillStyle = danger && frame % 30 < 15 ? 'rgba(255,60,80,0.75)' : 'rgba(255,60,80,0.3)';
    for (let k = 2; k < 14; k++) {
      g.fillRect(xx + k, fy + k, 1, 1);
      g.fillRect(xx + 15 - k, fy + k, 1, 1);
    }

    g.save();
    g.beginPath();
    g.rect(fx, fy, FIELD_W, FIELD_H);
    g.clip();

    const dead = v.deadAt !== undefined;
    const since = dead ? frame - v.deadAt! : 0;
    const covered = new Set<number>();
    for (const f of sim.fallers) if (!f.landed || f.squash > 0) covered.add(idx(f.x, f.toY));
    const popping = sim.phase === Phase.Flash ? new Set(sim.popping) : null;
    const blinkOn = popping !== null && Math.floor(frame / 3) % 2 === 0;
    const mood: EyeStyle = v.mood === 'win' ? 'happy' : v.mood === 'lose' || dead ? 'closed' : danger ? 'up' : 'open';

    for (let y = VISIBLE_TOP; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = idx(x, y);
        const c = sim.field[i];
        if (!c || covered.has(i)) continue;
        const isPop = popping?.has(i) ?? false;
        const conn = c === GARBAGE || dead ? 0 : this.connections(sim, x, y, c, covered);
        let eyes: EyeStyle = mood;
        if (isPop) eyes = 'wide';
        else if (mood === 'open') {
          const h = hash(i + index * 97);
          if ((frame + (h % 997)) % (170 + (h % 150)) < 6) eyes = 'blink';
        }
        let px = fx + x * CELL_PX;
        let py = fy + (y - VISIBLE_TOP) * CELL_PX;
        if (isPop) px += frame % 4 < 2 ? 1 : -1;
        if (v.mood === 'win') py -= Math.max(0, Math.round(Math.sin(frame * 0.25 + x * 0.9) * 2));
        const sprite = beanSprite(c, conn, isPop && blinkOn, eyes);
        if (dead) {
          const h = hash(i * 7 + 3);
          const dir = h % 2 ? 1 : -1;
          const drop = since * since * 0.07 * (1 + (h % 5) * 0.1) - Math.min(since, 8) * 0.6;
          g.save();
          g.translate(px + 8 + dir * since * (0.2 + (h % 3) * 0.15), py + 8 + Math.max(-4, drop));
          g.rotate(dir * since * 0.04 * (1 + (h % 4) * 0.3));
          g.drawImage(sprite, -8, -8);
          g.restore();
        } else {
          g.drawImage(sprite, Math.round(px), Math.round(py));
        }
      }
    }

    for (const f of sim.fallers) {
      if (f.landed && f.squash <= 0) continue;
      const px = fx + f.x * CELL_PX;
      const py = fy + f.pos / 0x10000 - VISIBLE_TOP * CELL_PX;
      if (f.landed) {
        const k = [0.7, 0.82, 1.04, 0.92, 1.02, 0.97, 1][Math.floor((14 - f.squash) / 2)] ?? 1;
        const h = Math.round(16 * k);
        const w = Math.round(16 * (2 - k));
        g.drawImage(beanSprite(f.cell, 0, false, k < 0.85 ? 'closed' : 'open'), px - Math.floor((w - 16) / 2), Math.round(py) + 16 - h, w, h);
      } else {
        g.drawImage(beanSprite(f.cell, 0, false, f.cell === GARBAGE ? 'open' : 'wide'), px, Math.round(py));
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
      const eyes: EyeStyle = danger ? 'up' : 'open';
      this.bean(p.child, baseX + cdx, baseY + cdy, squash, false, eyes);
      this.bean(p.pivot, baseX, baseY, squash, pivotFlash, eyes);
    }

    // A soft reflection across the glass.
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.beginPath();
    g.moveTo(fx + 8, fy);
    g.lineTo(fx + 30, fy);
    g.lineTo(fx - 10, fy + FIELD_H);
    g.lineTo(fx - 32, fy + FIELD_H);
    g.fill();
    if (dead) {
      g.fillStyle = `rgba(0,0,10,${Math.min(0.55, since / 80)})`;
      g.fillRect(fx, fy, FIELD_W, FIELD_H);
    }
    g.restore();

    if (danger) {
      const a = 0.35 + Math.sin(frame * 0.2) * 0.25;
      g.strokeStyle = `rgba(255,50,70,${a})`;
      g.lineWidth = 2;
      g.strokeRect(fx - 2, fy - 2, FIELD_W + 4, FIELD_H + 4);
    }
    this.queue(v, index, fx);
  }

  private bean(color: number, x: number, y: number, squash: number, flash: boolean, eyes: EyeStyle): void {
    const s = beanSprite(color, 0, flash, eyes);
    if (squash === 1) this.g.drawImage(s, Math.round(x), Math.round(y));
    else {
      const h = Math.round(16 * squash);
      const w = Math.round(16 * (2 - squash));
      this.g.drawImage(s, Math.round(x) - Math.floor((w - 16) / 2), Math.round(y) + 16 - h, w, h);
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
  private queue(v: BoardView, index: number, fx: number): void {
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
    const sprite = beanSprite(GARBAGE, 0, bump > 8, 'wide');
    let x = fx + 2;
    const y = v.fy - 16;
    icons.forEach((k, i) => {
      const hop = bump > 0 ? Math.round(Math.sin((bump / 12) * Math.PI + i * 0.5) * 3) : 0;
      if (k === 1) {
        g.drawImage(sprite, x, y + 6 - hop, 10, 10);
        x += 11;
      } else {
        g.drawImage(sprite, x, y - hop, 16, 16);
        if (k === 30) {
          rect(g, x + 5, y - 1 - hop, 6, 3, '#ffd040');
          rect(g, x + 4, y - 3 - hop, 2, 2, '#ffd040');
          rect(g, x + 7, y - 3 - hop, 2, 2, '#ffd040');
          rect(g, x + 10, y - 3 - hop, 2, 2, '#ffd040');
        }
        x += 16;
      }
    });
  }

  private banner(scene: Scene, b: Banner): void {
    let cx = W / 2;
    let cy = H / 2 - 14;
    if (b.board !== undefined && scene.boards[b.board]) {
      const v = scene.boards[b.board];
      cx = v.fx + FIELD_W / 2;
      cy = v.fy + FIELD_H / 2 - 14;
    }
    const age = b.age ?? 99;
    const [top, bottom] = TONES[b.tone ?? 'gold'];
    const img = fancyText(b.text, 2, top, bottom);
    let scale = 1;
    let dy = 0;
    let alpha = 1;
    if (b.style === 'drop') {
      const t = Math.min(1, age / 12);
      dy = -50 * (1 - t) ** 2 + (t === 1 ? Math.round(Math.sin(age * 0.15) * 1.5) : 0);
    } else if (b.style === 'zoom') {
      scale = Math.max(1, 2.6 - age * 0.2);
      alpha = age > 18 ? Math.max(0, 1 - (age - 18) / 10) : 1;
    } else if (b.style === 'bounce') {
      scale = age < 10 ? 1.7 - (age / 10) * 0.7 + Math.sin((age / 10) * Math.PI) * 0.15 : 1;
      dy = age >= 10 ? Math.round(Math.sin(age * 0.12) * 2) : 0;
    }
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const g = this.g;
    g.globalAlpha = alpha;
    g.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2 + dy), w, h);
    g.globalAlpha = 1;
    if (b.sub && age > 6) drawText(g, b.sub, cx, cy + h / 2 + 6 + dy, { color: '#ffffff', outline: '#000', align: 'center' });
  }
}
