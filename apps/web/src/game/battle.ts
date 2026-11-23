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
import { type Track, audio } from '../audio.ts';
import type { Binding } from '../input.ts';
import { type Expression, portrait } from '../render/portraits.ts';
import type { Banner, BoardView, Panel } from '../render/renderer.ts';
import { progress, saveProgress } from '../storage.ts';
import { pad, showMenu } from '../ui.ts';
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
  bg: [string, string];
  /** Which player's face fills the centre window, or null for none. */
  portraitOf: 0 | 1 | null;
  info?: string;
  /** Attract mode: computer vs computer, any button leaves. */
  demo?: boolean;
  onExit: (result: BattleResult | null) => void;
}

type State = 'intro' | 'play' | 'roundEnd' | 'matchEnd';

/** Sounds worth hearing from the computer's board too. */
const SHARED_SFX = new Set(['pop', 'garbageDrop']);

export function playEventSounds(events: SimEvent[], local: boolean): void {
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
        break;
      case 'chainEnd':
        if (e.garbage > 0) name = 'garbageSend';
        break;
      case 'garbageDrop':
        name = 'garbageDrop';
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
    this.app.renderer.effects.reset();
    this.newRound();
    audio.music(opts.music);
    this.offMenu = app.input.onMenu((a) => {
      if (opts.demo) {
        opts.onExit(null);
        return;
      }
      if ((a === 'pause' || a === 'back' || a === 'confirm') && this.state === 'play' && !this.paused) {
        if (a !== 'confirm') this.pause();
      } else if (a === 'confirm' && this.state === 'matchEnd' && this.timer > 40) {
        this.finish();
      }
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
  }

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    const menu = showMenu({
      title: 'PAUSED',
      items: [
        { label: 'RESUME', action: () => this.resume() },
        { label: 'QUIT', action: () => this.quit() },
      ],
      onBack: () => this.resume(),
    });
    this.pauseMenu = menu;
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

  private tick(): void {
    this.frame++;
    this.timer++;
    const effects = this.app.renderer.effects;
    effects.update(this.views);
    this.happy = this.happy.map((h) => Math.max(0, h - 1));

    if (this.state === 'intro') {
      if (this.timer === 1) audio.sfx('ready');
      if (this.timer === 70) {
        audio.sfx('go');
        this.match.start();
        this.state = 'play';
        this.timer = 0;
      }
      return;
    }

    if (this.state === 'play') {
      const inputs = this.opts.players.map((p, i) => {
        if (p.human) return this.app.input.mask(p.binding ?? null, p.pad ?? null, !!p.touch);
        return this.ais[i]!.input(this.match.sims[i], this.match.sims[1 - i]);
      });
      this.match.step(inputs);
      this.match.events.forEach((evs, i) => {
        effects.handle(i, evs, this.views);
        playEventSounds(evs, this.opts.players[i].human);
        for (const e of evs) if (e.type === 'chainEnd' && e.chain >= 3) this.happy[i] = 90;
      });
      this.views.forEach((v) => {
        v.pending = v.sim.pending;
        if (!v.sim.alive && v.deadAt === undefined) v.deadAt = this.frame;
      });
      this.updateMusic();
      if (this.match.result) this.endRound();
      return;
    }

    if (this.state === 'roundEnd' && this.timer > 150) {
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

  private endRound(): void {
    const r = this.match.result!;
    this.state = 'roundEnd';
    this.timer = 0;
    const humanIdx = this.opts.players.findIndex((p) => p.human);
    if (this.opts.demo) return;
    if ('winner' in r && r.winner >= 0) {
      this.wins[r.winner]++;
      const humanWon = this.opts.players[r.winner].human;
      audio.sfx(humanWon || humanIdx < 0 ? 'win' : 'lose');
      if (humanIdx >= 0 && this.opts.players.filter((p) => p.human).length === 1) {
        if (humanWon) progress.wins++;
        else progress.losses++;
      }
    }
    for (let i = 0; i < 2; i++) if (this.opts.players[i].human) progress.bestChain = Math.max(progress.bestChain, this.match.sims[i].maxChain);
    saveProgress();
  }

  private updateMusic(): void {
    const human = this.opts.players.findIndex((p) => p.human);
    if (human < 0) return;
    const beans = countBeans(this.match.sims[human].field);
    if (beans >= 54) audio.music('danger');
    else if (beans < 48) audio.music(this.opts.music);
  }

  render(): void {
    const sims = this.match.sims;
    const panels: Panel[] = this.opts.players.map((p, i) => {
      const step = this.app.renderer.effects.stepText[i];
      return {
        label: p.label,
        value: step && step.life > 0 ? step.text : pad(sims[i].score),
        color: i === 0 ? '#80c0ff' : '#ff9090',
      };
    });
    const info: string[] = [];
    if (this.opts.info) info.push(this.opts.info);
    if (this.opts.games > 1) info.push(`WINS ${this.wins[0]}-${this.wins[1]}`);

    const banners: Banner[] = [];
    if (this.state === 'intro') {
      banners.push({ text: this.timer < 50 ? 'READY' : 'GO!', color: this.timer < 50 ? '#ffe040' : '#60ff80' });
      if (this.round > 0 && this.timer < 50) banners[0].sub = `ROUND ${this.round + 1}`;
    } else if (this.state === 'roundEnd' || this.state === 'matchEnd') {
      const r = this.match.result!;
      const winner = 'winner' in r ? r.winner : -1;
      const humans = this.opts.players.filter((p) => p.human).length;
      sims.forEach((_, i) => {
        let text: string;
        if (winner < 0) text = 'DRAW';
        else if (humans === 1) text = this.opts.players[i].human ? (winner === i ? 'YOU WIN!' : 'YOU LOSE') : '';
        else text = winner === i ? 'WIN!' : 'LOSE';
        if (text) banners.push({ text, board: i, color: winner === i ? '#60ff80' : '#ff6070' });
      });
      if (this.state === 'matchEnd') {
        const mw = this.wins[0] > this.wins[1] ? 0 : 1;
        banners.push({ text: `${this.opts.players[mw].label} WINS`, sub: 'PRESS START', color: '#ffe040' });
      }
    }

    const po = this.opts.portraitOf;
    const face =
      po === null
        ? null
        : portrait(this.opts.players[po].character, moodOf(sims[po], sims[1 - po], this.happy[po]));

    this.app.renderer.draw({
      layout: 'versus',
      boards: this.views,
      frame: this.frame,
      bg: this.opts.bg,
      portrait: face,
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
