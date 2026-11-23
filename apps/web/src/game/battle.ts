import {
  AiController,
  type AiProfile,
  type Difficulty,
  Match,
  type PlayerSim,
  type SimEvent,
  VISIBLE_TOP,
  countBeans,
  deriveSeed,
  gamesToWin,
  randomSeed,
  scenarioConfigs,
  versusConfigs,
} from '@mbm/engine';
import { type App, FixedStepper, type Session } from '../app.ts';
import { type Speaker, type Track, audio } from '../audio.ts';
import type { Binding } from '../input.ts';
import type { Expression } from '../render/portraits.ts';
import type { Banner, BoardView, Panel } from '../render/renderer.ts';
import type { SceneKind } from '../render/scenes.ts';
import { progress, saveProgress } from '../storage.ts';
import { showMenu } from '../ui.ts';
import type { Character } from './characters.ts';

export interface Combatant {
  label: string;
  character: Character;
  human: boolean;
  binding?: Binding | null;
  pad?: number | null;
  touch?: boolean;
  ai?: AiProfile;
}

export interface BattleResult {
  winner: number;
  wins: [number, number];
}

export interface BattleOptions {
  kind: 'versus' | 'scenario';
  players: [Combatant, Combatant];
  levels?: [number, number];
  stage?: number;
  difficulty?: Difficulty;
  games: number;
  music: Exclude<Track, null>;
  scene: SceneKind;
  /** Which player's face fills the centre window, or null for none. */
  portraitOf: 0 | 1 | null;
  info?: string;
  /** Attract mode: computer vs computer, any button leaves. */
  demo?: boolean;
  onExit: (result: BattleResult | null) => void;
}

type State = 'intro' | 'play' | 'roundEnd' | 'matchEnd';

/** Battle music for an opponent: it gets more intense as the story goes on. */
export function trackFor(castIndex: number, castSize: number): Exclude<Track, null> {
  if (castIndex >= castSize - 1) return 'boss';
  return castIndex < 4 ? 'battle' : castIndex < 8 ? 'battle2' : 'battle3';
}

/** Sounds worth hearing from the computer's board too. */
const SHARED_SFX = new Set(['pop', 'garbageDrop']);

export function playEventSounds(events: SimEvent[], local: boolean, speaker: Speaker): void {
  for (const e of events) {
    let name: Parameters<typeof audio.sfx>[0] | null = null;
    let arg = 1;
    switch (e.type) {
      case 'move':
        name = 'move';
        break;
      case 'rotate':
        name = 'rotate';
        break;
      case 'land':
        name = 'land';
        break;
      case 'pop':
        name = 'pop';
        arg = e.chain;
        audio.voice(e.chain, speaker);
        break;
      case 'chainEnd':
        if (e.garbage > 0) name = 'garbageSend';
        break;
      case 'garbageDrop':
        name = 'garbageDrop';
        arg = e.count;
        break;
      case 'levelUp':
        name = 'levelUp';
        break;
      case 'allClear':
        name = 'allClear';
        break;
    }
    if (name && (local || SHARED_SFX.has(name))) audio.sfx(name, arg);
  }
}

/** Height of the third column, where the game is lost. */
export function deathColumnHeight(sim: PlayerSim): number {
  for (let y = VISIBLE_TOP; y < 14; y++) if (sim.field[y * 6 + 2]) return 14 - y;
  return 0;
}

/** Expression for a board's owner: knocked out, sweating, gloating or calm. */
export function moodOf(sim: PlayerSim, other: PlayerSim | null, happyTimer: number): Expression {
  if (!sim.alive) return 'ko';
  if (other && !other.alive) return 'happy';
  if (happyTimer > 0) return 'happy';
  let tall = 0;
  for (let x = 0; x < 6; x++) {
    let h = 0;
    for (let y = VISIBLE_TOP; y < 14; y++) if (sim.field[y * 6 + x]) h = Math.max(h, 14 - y);
    tall = Math.max(tall, h);
  }
  if (tall >= 9 || sim.pending >= 12) return 'worried';
  return 'idle';
}

export class BattleSession implements Session {
  readonly kind = 'battle';
  private match!: Match;
  private views: BoardView[] = [];
  private ais: (AiController | null)[] = [];
  private state: State = 'intro';
  private timer = 0;
  private frame = 0;
  private round = 0;
  private wins: [number, number] = [0, 0];
  private paused = false;
  private pauseMenu: { close(): void } | null = null;
  private stepper = new FixedStepper();
  private happy = [0, 0];
  private seed = randomSeed();
  private offMenu: () => void;
  private onVis = (): void => {
    if (document.hidden && this.state === 'play') this.pause();
  };
  private readonly app: App;
  private readonly opts: BattleOptions;

  constructor(app: App, opts: BattleOptions) {
    this.app = app;
    this.opts = opts;
    this.newRound();
    this.offMenu = app.input.onMenu((a) => {
      if (opts.demo) {
        opts.onExit(null);
        return;
      }
      if ((a === 'pause' || a === 'back') && this.state === 'play' && !this.paused) this.pause();
      else if (a === 'confirm' && this.state === 'matchEnd' && this.timer > 40) this.finish();
    });
    document.addEventListener('visibilitychange', this.onVis);
  }

  private newRound(): void {
    const seed = deriveSeed(this.seed, this.round);
    const configs =
      this.opts.kind === 'scenario'
        ? scenarioConfigs(seed, this.opts.stage ?? 0, this.opts.difficulty ?? 'normal')
        : versusConfigs(seed, this.opts.levels ?? [1, 1]);
    this.match = new Match(configs);
    this.views = this.match.sims.map((sim, i) => ({ sim, fx: i === 0 ? 16 : 208, fy: 16, pending: 0, shake: 0 }));
    this.ais = this.opts.players.map((p, i) => (p.human ? null : new AiController(p.ai!, deriveSeed(seed, 100 + i))));
    this.state = 'intro';
    this.timer = 0;
    this.app.renderer.effects.reset();
    this.app.renderer.resetHud();
    audio.music(this.opts.music);
  }

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pauseMenu = showMenu({
      title: 'PAUSED',
      items: [
        { label: 'RESUME', action: () => this.resume() },
        { label: 'QUIT', action: () => this.quit() },
      ],
      onBack: () => this.resume(),
    });
  }

  private resume(): void {
    this.pauseMenu?.close();
    this.pauseMenu = null;
    this.paused = false;
    this.stepper.reset();
  }

  private quit(): void {
    this.pauseMenu?.close();
    this.opts.onExit(null);
  }

  private finish(): void {
    const winner = this.wins[0] > this.wins[1] ? 0 : 1;
    this.opts.onExit({ winner, wins: [...this.wins] as [number, number] });
  }

  update(now: number): void {
    if (this.paused) {
      this.stepper.reset();
      return;
    }
    this.stepper.run(now, () => this.tick());
  }

  private speaker(i: number): Speaker {
    if (!this.opts.players[i].human) return 'robot';
    return i === 0 ? 'hero' : 'rival';
  }

  private tick(): void {
    this.frame++;
    this.timer++;
    const effects = this.app.renderer.effects;
    effects.update(this.views);
    this.happy = this.happy.map((h) => Math.max(0, h - 1));

    if (this.state === 'intro') {
      if (this.timer === 1) audio.sfx('ready');
      if (this.timer === 56) {
        audio.sfx('go');
        this.match.start();
      }
      if (this.timer >= 56) this.play();
      if (this.timer === 80) this.state = 'play';
      return;
    }

    if (this.state === 'play') {
      this.play();
      return;
    }

    if (this.state === 'roundEnd' && this.timer > 170) {
      const need = gamesToWin(this.opts.games);
      if (this.wins[0] >= need || this.wins[1] >= need) {
        this.state = 'matchEnd';
        this.timer = 0;
      } else {
        this.round++;
        this.newRound();
      }
    } else if (this.state === 'matchEnd' && this.timer > 420) {
      this.finish();
    }
  }

  /** One frame of play (the first frames overlap the GO! banner). */
  private play(): void {
    if (this.match.result) return;
    const effects = this.app.renderer.effects;
    const inputs = this.opts.players.map((p, i) => {
      if (p.human) return this.app.input.mask(p.binding ?? null, p.pad ?? null, !!p.touch);
      return this.ais[i]!.input(this.match.sims[i], this.match.sims[1 - i]);
    });
    this.match.step(inputs);
    this.match.events.forEach((evs, i) => {
      effects.handle(i, evs, this.views);
      playEventSounds(evs, this.opts.players[i].human, this.speaker(i));
      for (const e of evs) if (e.type === 'chainEnd' && e.chain >= 3) this.happy[i] = 90;
    });
    this.views.forEach((v) => {
      v.pending = v.sim.pending;
      if (!v.sim.alive && v.deadAt === undefined) v.deadAt = this.frame;
    });
    this.updateMusic();
    if (this.match.result) this.endRound();
  }

  private endRound(): void {
    const r = this.match.result!;
    this.state = 'roundEnd';
    this.timer = 0;
    const winner = 'winner' in r ? r.winner : -1;
    this.views.forEach((v, i) => (v.mood = winner < 0 ? 'lose' : i === winner ? 'win' : 'lose'));
    if (winner >= 0) this.app.renderer.effects.confetti(this.views[winner]);
    if (this.opts.demo) return;
    const humanIdx = this.opts.players.findIndex((p) => p.human);
    if (winner >= 0) {
      this.wins[winner]++;
      const humanWon = this.opts.players[winner].human;
      audio.jingle(humanWon || humanIdx < 0 ? 'win' : 'lose');
      if (humanIdx >= 0 && this.opts.players.filter((p) => p.human).length === 1) {
        if (humanWon) progress.wins++;
        else progress.losses++;
      }
    } else audio.jingle('lose');
    for (let i = 0; i < 2; i++) if (this.opts.players[i].human) progress.bestChain = Math.max(progress.bestChain, this.match.sims[i].maxChain);
    saveProgress();
  }

  private updateMusic(): void {
    const human = this.opts.players.findIndex((p) => p.human);
    if (human < 0) return;
    const sim = this.match.sims[human];
    const beans = countBeans(sim.field);
    if (beans >= 54) audio.music('danger');
    else if (beans < 48) audio.music(this.opts.music);
    if (deathColumnHeight(sim) >= 10 && this.frame % 48 === 0) audio.sfx('heartbeat');
  }

  render(): void {
    const sims = this.match.sims;
    const fx = this.app.renderer.effects;
    const panels: Panel[] = this.opts.players.map((p, i) => {
      const step = fx.stepText[i];
      return {
        label: p.label,
        value: step && step.life > 0 ? step.text : undefined,
        score: sims[i].score,
        color: i === 0 ? '#80c0ff' : '#ff9090',
      };
    });
    const info: string[] = [];
    if (this.opts.info) info.push(this.opts.info);
    if (this.opts.games > 1) info.push(`WINS ${this.wins[0]}-${this.wins[1]}`);

    const banners: Banner[] = [];
    if (this.state === 'intro') {
      if (this.timer < 56) banners.push({ text: 'READY', style: 'drop', age: this.timer, sub: this.round > 0 ? `ROUND ${this.round + 1}` : undefined });
      else banners.push({ text: 'GO!', style: 'zoom', tone: 'green', age: this.timer - 56 });
    } else if (this.state === 'roundEnd' || this.state === 'matchEnd') {
      const r = this.match.result!;
      const winner = 'winner' in r ? r.winner : -1;
      const humans = this.opts.players.filter((p) => p.human).length;
      const age = this.state === 'roundEnd' ? this.timer : 99;
      sims.forEach((_, i) => {
        let text: string;
        if (winner < 0) text = 'DRAW';
        else if (humans === 1) text = this.opts.players[i].human ? (winner === i ? 'YOU WIN!' : 'YOU LOSE') : '';
        else text = winner === i ? 'WIN!' : 'LOSE';
        if (text) banners.push({ text, board: i, style: 'bounce', age, tone: winner === i ? 'green' : 'red' });
      });
      if (this.state === 'matchEnd') {
        const mw = this.wins[0] > this.wins[1] ? 0 : 1;
        banners.push({ text: `${this.opts.players[mw].label} WINS`, sub: 'PRESS START', style: 'bounce', age: this.timer });
      }
    }

    const po = this.opts.portraitOf;
    const face =
      po === null
        ? null
        : { character: this.opts.players[po].character, expr: moodOf(sims[po], sims[1 - po], this.happy[po]), name: this.opts.players[po].character.name };

    this.app.renderer.draw({
      layout: 'versus',
      boards: this.views,
      frame: this.frame,
      scene: this.opts.scene,
      face,
      panels,
      info,
      banners,
      dim: this.state === 'matchEnd',
    });
  }

  dispose(): void {
    this.offMenu();
    this.pauseMenu?.close();
    document.removeEventListener('visibilitychange', this.onVis);
  }
}
