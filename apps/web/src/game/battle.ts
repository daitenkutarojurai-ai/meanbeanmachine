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
import { P1_KEYS, P2_KEYS, SOLO_KEYS } from '../input.ts';
import type { Banner, BoardView, Foe, Panel } from '../render/battleRenderer.ts';
import { Hero, LINES, pick } from '../render/hero.ts';
import type { Expression } from '../render/portraits.ts';
import type { SceneKind } from '../render/stage.ts';
import { ICONS, button, el, modal, svg } from '../ui/components.ts';
import type { Character } from './characters.ts';

export interface MatchStats {
  score: number;
  maxChain: number;
  refugeesSent: number;
  popped: number;
}

export interface BattleOutcome {
  won: boolean;
  wins: [number, number];
  stats: MatchStats;
}

export type Opponent =
  | { kind: 'robot'; character: Character; ai: AiProfile; name: string }
  | { kind: 'local'; name: string; skin: string };

export interface BattleSetup {
  kind: 'versus' | 'scenario';
  levels?: [number, number];
  stage?: number;
  difficulty?: Difficulty;
  games: number;
  music: Exclude<Track, null>;
  scene: SceneKind;
  me: { name: string; skin: string };
  opponent: Opponent;
  info?: string;
  demo?: boolean;
  onExit: (result: BattleOutcome | null) => void;
}

/** Battle music for a story stage: it gets more intense as the story goes on. */
export function trackFor(castIndex: number, castSize: number): Exclude<Track, null> {
  if (castIndex >= castSize - 1) return 'boss';
  return castIndex < 4 ? 'battle' : castIndex < 8 ? 'battle2' : 'battle3';
}

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

export function deathColumnHeight(sim: PlayerSim): number {
  for (let y = VISIBLE_TOP; y < 14; y++) if (sim.field[y * 6 + 2]) return 14 - y;
  return 0;
}

export function tallest(sim: PlayerSim): number {
  let tall = 0;
  for (let x = 0; x < 6; x++) {
    for (let y = VISIBLE_TOP; y < 14; y++) {
      if (sim.field[y * 6 + x]) {
        tall = Math.max(tall, 14 - y);
        break;
      }
    }
  }
  return tall;
}

/** Expression for a robot opponent. */
export function moodOf(sim: PlayerSim, other: PlayerSim | null, happyTimer: number): Expression {
  if (!sim.alive) return 'ko';
  if (other && !other.alive) return 'happy';
  if (happyTimer > 0) return 'happy';
  if (tallest(sim) >= 9 || sim.pending >= 12) return 'worried';
  return 'idle';
}

/** Keeps Sprout's face in step with his board, and lets him talk about it. */
export class HeroDirector {
  readonly hero: Hero;
  private danger = false;
  private quiet = 0;

  constructor(skin: string) {
    this.hero = new Hero(skin);
  }

  events(evs: SimEvent[]): void {
    for (const e of evs) {
      if (e.type === 'pop' && e.chain >= 2) {
        this.hero.act('hop');
        const lines = e.chain >= 5 ? LINES.chain5 : e.chain === 4 ? LINES.chain4 : e.chain === 3 ? LINES.chain3 : LINES.chain2;
        if (e.chain >= 3 || this.quiet <= 0) {
          this.hero.say(pick(lines), 1.4);
          this.quiet = 4;
        }
      }
    }
  }

  hit(): void {
    this.hero.act('hurt');
    if (Math.random() < 0.4 && this.quiet <= 0) {
      this.hero.say(pick(LINES.hurt), 1.3);
      this.quiet = 3;
    }
  }

  frame(sim: PlayerSim, dt: number, over: 'win' | 'lose' | null): void {
    this.quiet -= dt;
    if (over === 'win') this.hero.setMood('cheer');
    else if (over === 'lose') this.hero.setMood('sad');
    else {
      const d = tallest(sim) >= 9 || sim.pending >= 18;
      if (d && !this.danger && this.quiet <= 0) {
        this.hero.say(pick(LINES.danger), 1.4);
        this.quiet = 5;
      }
      this.danger = d;
      this.hero.setMood(d ? 'worried' : 'idle');
    }
    this.hero.update(dt);
  }
}

type State = 'intro' | 'play' | 'roundEnd' | 'matchEnd';

export class BattleSession implements Session {
  private match!: Match;
  private views: BoardView[] = [];
  private ai: AiController | null = null;
  /** Attract mode lets the computer play your side too. */
  private ai0: AiController | null = null;
  private state: State = 'intro';
  private timer = 0;
  private frame = 0;
  private round = 0;
  private wins: [number, number] = [0, 0];
  private paused = false;
  private pauseModal: { close(): void } | null = null;
  private stepper = new FixedStepper();
  private foeHappy = 0;
  private seed = randomSeed();
  private stats: MatchStats = { score: 0, maxChain: 0, refugeesSent: 0, popped: 0 };
  private readonly me: HeroDirector;
  private readonly rival: HeroDirector | null;
  private offMenu: () => void;
  private onVis = (): void => {
    if (document.hidden && this.state === 'play') this.pause();
  };
  private readonly app: App;
  private readonly setup: BattleSetup;

  constructor(app: App, setup: BattleSetup) {
    this.app = app;
    this.setup = setup;
    this.me = new HeroDirector(setup.me.skin);
    this.rival = setup.opponent.kind === 'local' ? new HeroDirector(setup.opponent.skin) : null;
    this.newRound();
    this.offMenu = app.input.onMenu((a) => {
      if (setup.demo) return setup.onExit(null);
      if ((a === 'pause' || a === 'back') && this.state === 'play' && !this.paused) this.pause();
    });
    document.addEventListener('visibilitychange', this.onVis);
    const pauseBtn = el('button', { class: 'hud-btn', type: 'button', title: 'Pause' }, svg(ICONS.pause));
    pauseBtn.addEventListener('click', () => (setup.demo ? setup.onExit(null) : this.pause()));
    app.hud.append(pauseBtn);
  }

  private get twoHumans(): boolean {
    return this.setup.opponent.kind === 'local';
  }

  private newRound(): void {
    const seed = deriveSeed(this.seed, this.round);
    const s = this.setup;
    const configs = s.kind === 'scenario' ? scenarioConfigs(seed, s.stage ?? 0, s.difficulty ?? 'normal') : versusConfigs(seed, s.levels ?? [1, 1]);
    this.match = new Match(configs);
    this.views = this.match.sims.map((sim) => ({ sim, pending: 0, shake: 0 }));
    this.ai = s.opponent.kind === 'robot' ? new AiController(s.opponent.ai, deriveSeed(seed, 101)) : null;
    this.ai0 = s.demo && s.opponent.kind === 'robot' ? new AiController({ ...s.opponent.ai, chainTarget: 3 }, deriveSeed(seed, 100)) : null;
    this.state = 'intro';
    this.timer = 0;
    this.app.renderer.effects.reset();
    this.app.renderer.resetHud();
    audio.music(s.music);
  }

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pauseModal = modal(
      'Paused',
      [
        button('Resume', { cls: 'btn-green', icon: ICONS.play, onClick: () => this.resume() }),
        button('Quit battle', { cls: 'btn-red', onClick: () => this.quit() }),
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
    this.setup.onExit(null);
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
    const fx = this.app.renderer.effects;
    fx.update(this.app.renderer.fxBoards(this.views));
    for (const target of fx.hits.splice(0)) {
      if (target === 0) this.me.hit();
      else if (this.rival) this.rival.hit();
    }
    this.foeHappy = Math.max(0, this.foeHappy - 1);
    const over = this.state === 'roundEnd' || this.state === 'matchEnd' ? this.match.result : null;
    const winner = over && 'winner' in over ? over.winner : -1;
    this.me.frame(this.match.sims[0], 1 / 60, over ? (winner === 0 ? 'win' : 'lose') : null);
    this.rival?.frame(this.match.sims[1], 1 / 60, over ? (winner === 1 ? 'win' : 'lose') : null);

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
    if (this.state === 'roundEnd' && this.timer > 150) {
      const need = gamesToWin(this.setup.games);
      if (this.setup.demo) {
        this.round++;
        this.newRound();
      } else if (this.wins[0] >= need || this.wins[1] >= need) {
        this.state = 'matchEnd';
        this.timer = 0;
        this.finish();
      } else {
        this.round++;
        this.newRound();
      }
    }
  }

  private play(): void {
    if (this.match.result) return;
    const fx = this.app.renderer.effects;
    const inp = this.app.input;
    const two = this.twoHumans;
    const inputs = [
      this.ai0 ? this.ai0.input(this.match.sims[0], this.match.sims[1]) : inp.mask(two ? P1_KEYS : SOLO_KEYS, 0, this.app.controls === 'buttons') | this.app.touch.frame(),
      two ? inp.mask(P2_KEYS, 1, false) : this.ai!.input(this.match.sims[1], this.match.sims[0]),
    ];
    this.match.step(inputs);
    const boards = this.app.renderer.fxBoards(this.views);
    this.match.events.forEach((evs, i) => {
      fx.handle(i, evs, boards);
      playEventSounds(evs, i === 0 || two, i === 0 ? 'hero' : two ? 'rival' : 'robot');
      if (i === 0) {
        this.me.events(evs);
        for (const e of evs) {
          if (e.type === 'chainEnd') this.stats.refugeesSent += e.garbage;
          if (e.type === 'pop') this.stats.popped += e.score.cleared;
        }
      } else {
        this.rival?.events(evs);
        for (const e of evs) if (e.type === 'chainEnd' && e.chain >= 3) this.foeHappy = 90;
      }
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
    const fx = this.app.renderer.effects;
    if (winner >= 0) fx.confetti(this.app.renderer.fxBoards(this.views)[winner]);
    if (this.setup.demo) return;
    if (winner >= 0) this.wins[winner]++;
    const iWon = winner === 0 || (this.twoHumans && winner === 1);
    audio.jingle(iWon ? 'win' : 'lose');
    this.me.hero.say(pick(winner === 0 ? LINES.win : LINES.lose), 2);
    const s = this.match.sims[0];
    this.stats.score = Math.max(this.stats.score, s.score);
    this.stats.maxChain = Math.max(this.stats.maxChain, s.maxChain);
  }

  private finish(): void {
    setTimeout(() => {
      this.setup.onExit({ won: this.wins[0] > this.wins[1], wins: [...this.wins] as [number, number], stats: { ...this.stats } });
    }, 400);
  }

  private updateMusic(): void {
    const sim = this.match.sims[0];
    const beans = countBeans(sim.field);
    if (beans >= 54) audio.music('danger');
    else if (beans < 48) audio.music(this.setup.music);
    if (deathColumnHeight(sim) >= 10 && this.frame % 48 === 0) audio.sfx('heartbeat');
  }

  render(): void {
    const sims = this.match.sims;
    const fx = this.app.renderer.effects;
    const s = this.setup;
    const names = [s.me.name, s.opponent.name];
    const panels: Panel[] = sims.map((sim, i) => {
      const step = fx.stepText[i];
      return { label: names[i], value: step && step.life > 0 ? step.text : undefined, score: sim.score, color: i === 0 ? '#7ab8ff' : '#ff8a9a' };
    });
    const info: string[] = [];
    if (s.info) info.push(s.info);
    if (s.games > 1) info.push(`${this.wins[0]} – ${this.wins[1]}`);
    const banners: Banner[] = [];
    if (this.state === 'intro') {
      if (this.timer < 56) banners.push({ text: 'READY', style: 'drop', age: this.timer, sub: this.round > 0 ? `Round ${this.round + 1}` : undefined });
      else banners.push({ text: 'GO!', style: 'zoom', tone: 'green', age: this.timer - 56 });
    } else if (this.state === 'roundEnd' || this.state === 'matchEnd') {
      const r = this.match.result!;
      const winner = 'winner' in r ? r.winner : -1;
      sims.forEach((_, i) => {
        const txt = winner < 0 ? 'DRAW' : winner === i ? (i === 0 || this.twoHumans ? 'WIN!' : 'WIN') : 'LOSE';
        banners.push({ text: txt, board: i, style: 'bounce', age: this.timer, tone: winner === i ? 'green' : 'red' });
      });
    }
    let foe: Foe;
    if (s.opponent.kind === 'robot') foe = { kind: 'robot', character: s.opponent.character, expr: moodOf(sims[1], sims[0], this.foeHappy), name: s.opponent.name };
    else foe = { kind: 'hero', hero: this.rival!.hero, name: s.opponent.name };
    this.app.renderer.draw({
      scene: s.scene,
      boards: this.views,
      hero: this.me.hero,
      foe,
      panels,
      info,
      banners,
      frame: this.frame,
    });
  }

  dispose(): void {
    this.offMenu();
    this.pauseModal?.close();
    document.removeEventListener('visibilitychange', this.onVis);
  }
}
