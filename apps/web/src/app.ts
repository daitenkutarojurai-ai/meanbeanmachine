import { audio } from './audio.ts';
import { Input, isTouchDevice } from './input.ts';
import { BattleRenderer } from './render/battleRenderer.ts';
import { setBeanSymbols } from './render/jelly.ts';
import { settings } from './storage.ts';
import { TouchControls } from './touch.ts';

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

/** Owns the play canvas, input and the running match; the home screen is plain HTML. */
export class App {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: BattleRenderer;
  readonly input = new Input();
  readonly touch: TouchControls;
  readonly hud: HTMLElement;
  private session: Session | null = null;

  constructor() {
    this.canvas = document.getElementById('screen') as HTMLCanvasElement;
    this.hud = document.getElementById('hud')!;
    this.renderer = new BattleRenderer(this.canvas);
    this.touch = new TouchControls(this.canvas, this.renderer);
    audio.setVolumes(settings.sfx, settings.music);
    setBeanSymbols(settings.symbols);
    const unlock = (): void => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const loop = (now: number): void => {
      this.input.pollMenuPads();
      if (this.session) {
        this.session.update(now);
        this.session.render();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // Background tabs stop animation frames; online matches must keep ticking.
    setInterval(() => {
      if (document.hidden) this.session?.update(performance.now());
    }, 200);
  }

  /** Shows the play canvas and starts a match. */
  play(s: Session): void {
    this.session?.dispose();
    this.hud.replaceChildren();
    document.getElementById('ui')!.hidden = true;
    document.getElementById('game')!.hidden = false;
    this.touch.reset();
    this.touch.enabled = this.controls === 'gestures';
    document.getElementById('touch')!.hidden = this.controls !== 'buttons';
    this.session = s;
  }

  /** Back to the HTML screens. */
  leave(): void {
    this.session?.dispose();
    this.session = null;
    this.hud.replaceChildren();
    this.touch.enabled = false;
    document.getElementById('game')!.hidden = true;
    document.getElementById('touch')!.hidden = true;
    document.getElementById('ui')!.hidden = false;
  }

  get controls(): 'gestures' | 'buttons' | 'off' {
    if (settings.touch === 'off') return 'off';
    if (settings.touch === 'on') return 'buttons';
    return isTouchDevice() ? 'gestures' : 'off';
  }
}
