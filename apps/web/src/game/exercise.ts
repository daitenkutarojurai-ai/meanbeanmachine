import { PlayerSim, countBeans, exerciseConfig, randomSeed } from '@mbm/engine';
import { type App, FixedStepper, type Session } from '../app.ts';
import { audio } from '../audio.ts';
import { SOLO_KEYS } from '../input.ts';
import type { Banner, BoardView } from '../render/renderer.ts';
import { progress, saveProgress } from '../storage.ts';
import { pad, showMenu } from '../ui.ts';
import { playEventSounds } from './battle.ts';
import { HERO } from './characters.ts';

const LEVEL_NAMES = ['EASY', 'NORMAL', 'HARD'];

/** Endless solo mode: no opponent, the level climbs every 32 beans cleared. */
export class ExerciseSession implements Session {
  readonly kind = 'battle';
  private sim: PlayerSim;
  private view: BoardView;
  private frame = 0;
  private timer = 0;
  private state: 'intro' | 'play' | 'over' = 'intro';
  private stepper = new FixedStepper();
  private paused = false;
  private menu: { close(): void } | null = null;
  private offMenu: () => void;
  private newBest = false;
  private readonly app: App;
  private readonly choice: number;
  private readonly onExit: () => void;

  constructor(app: App, choice: number, onExit: () => void) {
    this.app = app;
    this.choice = choice;
    this.onExit = onExit;
    this.sim = new PlayerSim(exerciseConfig(randomSeed(), choice * 2));
    this.view = { sim: this.sim, fx: 112, fy: 16, pending: 0, shake: 0 };
    app.renderer.effects.reset();
    app.renderer.resetHud();
    audio.music('battle');
    this.offMenu = app.input.onMenu((a) => {
      if ((a === 'pause' || a === 'back') && this.state === 'play' && !this.paused) this.pause();
      else if (a === 'confirm' && this.state === 'over' && this.timer > 60) this.onExit();
    });
  }

  private pause(): void {
    this.paused = true;
    this.menu = showMenu({
      title: 'PAUSED',
      items: [
        { label: 'RESUME', action: () => this.resume() },
        { label: 'QUIT', action: () => this.onExit() },
      ],
      onBack: () => this.resume(),
    });
  }

  private resume(): void {
    this.menu?.close();
    this.menu = null;
    this.paused = false;
    this.stepper.reset();
  }

  update(now: number): void {
    if (this.paused) return;
    this.stepper.run(now, () => this.tick());
  }

  private tick(): void {
    this.frame++;
    this.timer++;
    const fx = this.app.renderer.effects;
    fx.update([this.view]);
    if (this.state === 'intro') {
      if (this.timer === 1) audio.sfx('ready');
      if (this.timer === 70) {
        audio.sfx('go');
        this.sim.start();
        this.state = 'play';
      }
      return;
    }
    if (this.state !== 'play') return;
    this.sim.step(this.app.input.mask(SOLO_KEYS, 0, this.app.touchEnabled));
    const events = this.sim.events.splice(0);
    fx.handle(0, events, [this.view]);
    playEventSounds(events, true, 'hero');
    audio.music(countBeans(this.sim.field) >= 54 ? 'danger' : 'battle');
    if (!this.sim.alive) {
      this.state = 'over';
      this.timer = 0;
      this.view.deadAt = this.frame;
      audio.sfx('lose');
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
    if (this.state === 'intro')
      banners.push(this.timer < 50 ? { text: 'READY', board: 0, style: 'drop', age: this.timer } : { text: 'GO!', board: 0, style: 'zoom', tone: 'green', age: this.timer - 50 });
    if (this.state === 'over')
      banners.push({ text: 'GAME OVER', board: 0, tone: 'red', style: 'bounce', age: this.timer, sub: this.newBest ? 'NEW RECORD!' : 'PRESS START' });
    this.app.renderer.draw({
      layout: 'solo',
      boards: [this.view],
      frame: this.frame,
      scene: 'meadow',
      faceLeft: { character: HERO, expr: !s.alive ? 'ko' : s.chain >= 2 ? 'happy' : 'idle', name: 'SPROUT' },
      panels: [
        { label: 'SCORE', value: step && step.life > 0 ? step.text : undefined, score: s.score },
        { label: 'LEVEL', value: String(s.exerciseLevel + 1) },
        { label: 'BEANS', value: String(s.totalCleared) },
        { label: 'BEST CHAIN', value: String(s.maxChain) },
        { label: 'RECORD', value: pad(Math.max(progress.exerciseBest[this.choice] ?? 0, s.score)) },
      ],
      info: ['EXERCISE', LEVEL_NAMES[this.choice]],
      banners,
    });
  }

  dispose(): void {
    this.offMenu();
    this.menu?.close();
  }
}
