import { IN_CCW, IN_CW, IN_DOWN, IN_LEFT, IN_RIGHT } from '@mbm/engine';
import type { BattleRenderer } from './render/battleRenderer.ts';

/**
 * Phone controls on the play area: drag sideways to slide the pair one column per
 * cell dragged, tap the right half to turn clockwise (left half: counter-clockwise),
 * drag down to drop faster. Gestures become the same button presses a pad makes.
 */
export class TouchControls {
  enabled = false;
  private queue: number[] = [];
  private soft = false;
  private active: { id: number; x0: number; y0: number; ax: number; t0: number; moved: boolean } | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: BattleRenderer;

  constructor(canvas: HTMLCanvasElement, renderer: BattleRenderer) {
    this.canvas = canvas;
    this.renderer = renderer;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', () => this.cancel());
  }

  /** One cell of the player's board in CSS pixels. */
  private cellPx(): number {
    const b = this.renderer.layout.boards[0];
    return ((b?.cell ?? 50) * this.renderer.scale) / Math.min(window.devicePixelRatio || 1, 2.5);
  }

  private tap(mask: number): void {
    if (this.queue.length < 24) this.queue.push(mask, 0);
  }

  private down(e: PointerEvent): void {
    if (!this.enabled || this.active) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.active = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ax: e.clientX, t0: performance.now(), moved: false };
  }

  private move(e: PointerEvent): void {
    const a = this.active;
    if (!a || a.id !== e.pointerId) return;
    const step = this.cellPx() * 0.75;
    while (e.clientX - a.ax > step) {
      this.tap(IN_RIGHT);
      a.ax += step;
      a.moved = true;
    }
    while (a.ax - e.clientX > step) {
      this.tap(IN_LEFT);
      a.ax -= step;
      a.moved = true;
    }
    const dy = e.clientY - a.y0;
    if (dy > this.cellPx() * 0.9 && dy > Math.abs(e.clientX - a.x0)) {
      this.soft = true;
      a.moved = true;
    }
  }

  private up(e: PointerEvent): void {
    const a = this.active;
    if (!a || a.id !== e.pointerId) return;
    if (!a.moved && performance.now() - a.t0 < 320) {
      const r = this.canvas.getBoundingClientRect();
      this.tap(e.clientX > r.left + r.width / 2 ? IN_CW : IN_CCW);
    }
    this.cancel();
  }

  private cancel(): void {
    this.active = null;
    this.soft = false;
  }

  /** The mask for this frame; call once per simulated frame. */
  frame(): number {
    if (!this.enabled) return 0;
    return (this.queue.shift() ?? 0) | (this.soft ? IN_DOWN : 0);
  }

  reset(): void {
    this.queue = [];
    this.cancel();
  }
}
