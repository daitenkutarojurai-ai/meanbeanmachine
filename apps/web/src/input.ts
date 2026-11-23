import { IN_CCW, IN_CW, IN_DOWN, IN_LEFT, IN_RIGHT } from '@mbm/engine';

export type GameKey = 'left' | 'right' | 'down' | 'cw' | 'ccw';
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause';

export interface Binding {
  left: string[];
  right: string[];
  down: string[];
  cw: string[];
  ccw: string[];
}

/** One player on the keyboard: arrows or WASD, Z/X or J/K to turn, Up also turns. */
export const SOLO_KEYS: Binding = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  down: ['ArrowDown', 'KeyS'],
  cw: ['KeyX', 'KeyK', 'ArrowUp', 'KeyW'],
  ccw: ['KeyZ', 'KeyJ'],
};

/** Two players sharing a keyboard. */
export const P1_KEYS: Binding = {
  left: ['KeyA'],
  right: ['KeyD'],
  down: ['KeyS'],
  cw: ['KeyG', 'KeyW'],
  ccw: ['KeyF'],
};

export const P2_KEYS: Binding = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  down: ['ArrowDown'],
  cw: ['KeyL', 'ArrowUp', 'Numpad2'],
  ccw: ['KeyK', 'Numpad1'],
};

const MASKS: Record<GameKey, number> = { left: IN_LEFT, right: IN_RIGHT, down: IN_DOWN, cw: IN_CW, ccw: IN_CCW };

export class Input {
  private held = new Set<string>();
  private touchHeld = new Set<GameKey>();
  /** Presses not yet seen by the game, so a tap shorter than a frame still counts. */
  private latched = new Set<string>();
  private touchLatched = new Set<GameKey>();
  private listeners = new Set<(a: MenuAction, e?: KeyboardEvent) => void>();
  private padPrev: number[][] = [];

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat && this.held.has(e.code)) {
        this.emitKey(e);
        return;
      }
      this.held.add(e.code);
      this.latched.add(e.code);
      this.emitKey(e);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.touchHeld.clear();
      this.latched.clear();
      this.touchLatched.clear();
    });
    this.bindTouch();
  }

  onMenu(fn: (a: MenuAction, e?: KeyboardEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(a: MenuAction, e?: KeyboardEvent): void {
    for (const fn of [...this.listeners]) fn(a, e);
  }

  private emitKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      if (e.code === 'Escape') this.emit('back', e);
      return;
    }
    const map: Record<string, MenuAction> = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      Enter: 'confirm',
      Space: 'confirm',
      KeyX: 'confirm',
      Escape: 'back',
      Backspace: 'back',
      KeyP: 'pause',
    };
    const a = map[e.code];
    if (a) this.emit(a, e);
  }

  private bindTouch(): void {
    const root = document.getElementById('touch');
    if (!root) return;
    for (const btn of root.querySelectorAll<HTMLButtonElement>('button[data-key]')) {
      const key = btn.dataset.key as GameKey;
      const down = (e: Event): void => {
        e.preventDefault();
        this.touchHeld.add(key);
        this.touchLatched.add(key);
        btn.classList.add('on');
      };
      const up = (e: Event): void => {
        e.preventDefault();
        this.touchHeld.delete(key);
        btn.classList.remove('on');
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    }
  }

  /** Engine input mask for a player. `pad` is a gamepad index, or null. */
  mask(binding: Binding | null, pad: number | null, touch: boolean): number {
    let m = 0;
    if (binding) {
      for (const k of Object.keys(MASKS) as GameKey[]) {
        if (binding[k].some((code) => this.held.has(code) || this.latched.has(code))) m |= MASKS[k];
        for (const code of binding[k]) this.latched.delete(code);
      }
    }
    if (touch) {
      for (const k of this.touchHeld) m |= MASKS[k];
      for (const k of this.touchLatched) m |= MASKS[k];
      this.touchLatched.clear();
    }
    if (pad !== null) m |= this.padMask(pad);
    return m;
  }

  private padMask(index: number): number {
    const pads = navigator.getGamepads?.() ?? [];
    const p = pads[index];
    if (!p) return 0;
    const b = (i: number): boolean => !!p.buttons[i]?.pressed;
    const ax = p.axes[0] ?? 0;
    const ay = p.axes[1] ?? 0;
    let m = 0;
    if (b(14) || ax < -0.5) m |= IN_LEFT;
    if (b(15) || ax > 0.5) m |= IN_RIGHT;
    if (b(13) || ay > 0.5) m |= IN_DOWN;
    if (b(0) || b(3) || b(12)) m |= IN_CW;
    if (b(1) || b(2)) m |= IN_CCW;
    return m;
  }

  /** Turns gamepad presses into menu actions; call once per frame. */
  pollMenuPads(): void {
    const pads = navigator.getGamepads?.() ?? [];
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p) continue;
      const now = p.buttons.map((b) => (b.pressed ? 1 : 0));
      const prev = this.padPrev[i] ?? [];
      const edge = (k: number): boolean => now[k] === 1 && prev[k] !== 1;
      if (edge(12)) this.emit('up');
      if (edge(13)) this.emit('down');
      if (edge(14)) this.emit('left');
      if (edge(15)) this.emit('right');
      if (edge(0)) this.emit('confirm');
      if (edge(1)) this.emit('back');
      if (edge(9)) this.emit('pause');
      this.padPrev[i] = now;
    }
  }

  connectedPads(): number[] {
    const pads = navigator.getGamepads?.() ?? [];
    const out: number[] = [];
    for (let i = 0; i < pads.length; i++) if (pads[i]) out.push(i);
    return out;
  }
}

export const isTouchDevice = (): boolean => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
