import { PlayerSim, countBeans, exerciseConfig, randomSeed } from '@mbm/engine';
import { type App, FixedStepper, type Session } from '../app.ts';
import { audio } from '../audio.ts';
import { SOLO_KEYS } from '../input.ts';
import type { Banner, BoardView } from '../render/battleRenderer.ts';
import { LINES, pick } from '../render/hero.ts';
import { progress, saveProgress } from '../storage.ts';
import { ICONS, button, el, modal, svg } from '../ui/components.ts';
import { HeroDirector, playEventSounds } from './battle.ts';

/** Endless practice: no opponent, the level climbs as you clear beans. */
export class ExerciseSession implements Session {
  private sim: PlayerSim;
  private view: BoardView;
  private frame = 0;
  private timer = 0;
  private state: 'intro' | 'play' | 'over' = 'intro';
  private stepper = new FixedStepper();
  private paused = false;
  private pauseModal: { close(): void } | null = null;
  private offMenu: () => void;
  private newBest = false;
  private readonly me: HeroDirector;
  private readonly app: App;
  private readonly choice: number;
  private readonly onExit: (score: number, best: boolean) => void;

  constructor(app: App, choice: number, skin: string, onExit: (score: number, best: boolean) => void) {
    this.app = app;
    this.choice = choice;
    this.onExit = onExit;
    this.me = new HeroDirector(skin);
    this.sim = new PlayerSim(exerciseConfig(randomSeed(), choice * 2));
    this.view = { sim: this.sim, pending: 0, shake: 0 };
    app.renderer.effects.reset();
    app.renderer.resetHud();
    audio.music('battle');
    this.offMenu = app.input.onMenu((a) => {
      if ((a === 'pause' || a === 'back') && this.state === 'play' && !this.paused) this.pause();
    });
    const pauseBtn = el('button', { class: 'hud-btn', type: 'button', title: 'Pause' }, svg(ICONS.pause));
    pauseBtn.addEventListener('click', () => this.pause());
    app.hud.append(pauseBtn);
  }

  private pause(): void {
    if (this.paused || this.state === 'over') return;
    this.paused = true;
    this.pauseModal = modal(
      'Paused',
      [
        button('Resume', { cls: 'btn-green', icon: ICONS.play, onClick: () => this.resume() }),
        button('Quit', { cls: 'btn-red', onClick: () => this.quit() }),
      ],
      { onClose: () => this.resume() },
    );
  }

  private resume(): void {
    const m = this.pauseModal;
    this.pauseModal = null;
    this.paused = false;
    this.stepper.reset();
    m?.close();
  }

  private quit(): void {
    const m = this.pauseModal;
    this.pauseModal = null;
    m?.close();
    this.onExit(this.sim.score, false);
  }

  update(now: number): void {
    if (this.paused) return;
    this.stepper.run(now, () => this.tick());
  }

  private tick(): void {
    this.frame++;
    this.timer++;
    const fx = this.app.renderer.effects;
    const boards = this.app.renderer.fxBoards([this.view]);
    fx.update(boards);
    this.me.frame(this.sim, 1 / 60, this.state === 'over' ? 'lose' : null);
    if (this.state === 'intro') {
      if (this.timer === 1) audio.sfx('ready');
      if (this.timer === 56) {
        audio.sfx('go');
        this.sim.start();
        this.state = 'play';
      }
      return;
    }
    if (this.state === 'over') {
      if (this.timer === 150) this.onExit(this.sim.score, this.newBest);
      return;
    }
    this.sim.step(this.app.input.mask(SOLO_KEYS, 0, this.app.controls === 'buttons') | this.app.touch.frame());
    const events = this.sim.events.splice(0);
    fx.handle(0, events, boards);
    playEventSounds(events, true, 'hero');
    this.me.events(events);
    audio.music(countBeans(this.sim.field) >= 54 ? 'danger' : 'battle');
    if (!this.sim.alive) {
      this.state = 'over';
      this.timer = 0;
      this.view.deadAt = this.frame;
      audio.jingle('lose');
      this.me.hero.say(pick(LINES.lose), 2);
      if (this.sim.score > (progress.exerciseBest[this.choice] ?? 0)) {
        progress.exerciseBest[this.choice] = this.sim.score;
        this.newBest = true;
      }
      progress.bestChain = Math.max(progress.bestChain, this.sim.maxChain);
      saveProgress();
    }
  }

  render(): void {
    const s = this.sim;
    const step = this.app.renderer.effects.stepText[0];
    const banners: Banner[] = [];
    if (this.state === 'intro') banners.push(this.timer < 50 ? { text: 'READY', board: 0, style: 'drop', age: this.timer } : { text: 'GO!', board: 0, style: 'zoom', tone: 'green', age: this.timer - 50 });
    if (this.state === 'over') banners.push({ text: 'GAME OVER', board: 0, tone: 'red', style: 'bounce', age: this.timer, sub: this.newBest ? 'New record!' : undefined });
    this.app.renderer.draw({
      scene: 'meadow',
      boards: [this.view],
      hero: this.me.hero,
      panels: [{ label: 'SCORE', value: step && step.life > 0 ? step.text : undefined, score: s.score, color: '#7ab8ff' }],
      info: [`Level ${s.exerciseLevel + 1}`, `Beans ${s.totalCleared}`, `Best chain ${s.maxChain}`, `Record ${Math.max(progress.exerciseBest[this.choice] ?? 0, s.score).toLocaleString('en-US')}`],
      banners,
      frame: this.frame,
    });
  }

  dispose(): void {
    this.offMenu();
    this.pauseModal?.close();
  }
}
