import { audio } from './audio.ts';
import { Input, isTouchDevice } from './input.ts';
import { H, Renderer, W } from './render/renderer.ts';
import { settings } from './storage.ts';
import { initUi } from './ui.ts';

export interface Session {
  /** Advance the simulation to `now` (ms). */
  update(now: number): void;
  render(): void;
  dispose(): void;
}

/** Steps a callback at exactly 60 Hz regardless of display refresh rate. */
export class FixedStepper {
  private last = 0;
  private acc = 0;

  run(now: number, step: () => void): void {
    if (!this.last) this.last = now;
    this.acc += Math.min(now - this.last, 250);
    this.last = now;
    let n = 0;
    while (this.acc >= 1000 / 60 && n < 8) {
      step();
      this.acc -= 1000 / 60;
      n++;
    }
    if (n === 8) this.acc = 0;
  }

  reset(): void {
    this.last = 0;
    this.acc = 0;
  }
}

export class App {
  readonly renderer: Renderer;
  readonly input = new Input();
  readonly canvas: HTMLCanvasElement;
  private session: Session | null = null;

  constructor() {
    this.canvas = document.getElementById('screen') as HTMLCanvasElement;
    this.canvas.width = W;
    this.canvas.height = H;
    this.renderer = new Renderer(this.canvas);
    initUi(this.input);
    audio.setVolumes(settings.sfx, settings.music);

    const unlock = (): void => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.updateTouch();

    const loop = (now: number): void => {
      this.input.pollMenuPads();
      this.session?.update(now);
      this.session?.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // Browsers stop animation frames in background tabs; keep online games ticking.
    setInterval(() => {
      if (document.hidden) this.session?.update(performance.now());
    }, 200);
  }

  setSession(s: Session | null): void {
    this.session?.dispose();
    this.session = s;
  }

  resize(): void {
    const touch = !document.getElementById('touch')!.hidden;
    const reserve = touch && innerHeight > innerWidth ? 170 : 0;
    const u = Math.max(1, Math.min((innerWidth - 8) / W, (innerHeight - 8 - reserve) / H));
    // Whole-pixel scaling when there is room keeps the pixel art crisp.
    const scale = u >= 2 ? Math.floor(u) : u;
    document.documentElement.style.setProperty('--u', `${scale}px`);
  }

  updateTouch(): void {
    const on = settings.touch === 'on' || (settings.touch === 'auto' && isTouchDevice());
    document.getElementById('touch')!.hidden = !on;
    this.resize();
  }

  get touchEnabled(): boolean {
    return !document.getElementById('touch')!.hidden;
  }
}
