import type { Difficulty } from '@mbm/engine';
import type { App } from '../app.ts';
import { audio } from '../audio.ts';
import { type BattleOutcome, BattleSession, trackFor } from '../game/battle.ts';
import { CAST, characterById } from '../game/characters.ts';
import { ExerciseSession } from '../game/exercise.ts';
import { OnlineFlow } from '../game/online.ts';
import { aiForSkill, nextArena } from '../meta/arenas.ts';
import { arena, profile, recordAdventureClear, recordBattle, save } from '../meta/profile.ts';
import { progress, saveProgress } from '../storage.ts';
import { ICONS, button, el, heroCanvas, modal, robotCanvas, svg, toast } from './components.ts';
import { showResults } from './results.ts';
import { vsSplash } from './vs.ts';

export interface HomeLike {
  render(): void;
  show(): void;
}

const ADVENTURE_KEY = 'bm.tutorialSeen';

export class Flows {
  private readonly app: App;
  private readonly home: HomeLike;

  constructor(app: App, home: HomeLike) {
    this.app = app;
    this.home = home;
  }

  private me(): { name: string; skin: string } {
    return { name: profile.name || 'You', skin: profile.skin };
  }

  private back(): void {
    this.app.leave();
    audio.music('title');
    this.home.render();
    this.home.show();
  }

  /** First battle ever: a 10-second primer on the rules and controls. */
  private tutorial(then: () => void): void {
    let seen = false;
    try {
      seen = localStorage.getItem(ADVENTURE_KEY) === '1';
    } catch {
      seen = true;
    }
    if (seen) return then();
    const touch = this.app.controls === 'gestures';
    const m = modal('How to play', [
      el('p', {}, 'Beans fall in pairs. Join 4 or more of one colour to pop them.'),
      el('p', {}, 'Pops that make more pops are CHAINS. Chains drop refugee beans on your rival!'),
      el('p', { style: 'color:#ffb0b8' }, 'If the beans reach the X at the top of the third column, you lose.'),
      el('div', { class: 'card dark stack' },
        touch ? el('p', {}, '👆 Drag left/right to move · Tap right side to turn ↻ · Tap left side to turn ↺ · Drag down to drop') : el('p', {}, '⌨️ ← → move · ↓ drop · X or ↑ turn ↻ · Z turn ↺ · Esc pause'),
      ),
      button("Let's pop!", { cls: 'btn-green btn-xl', onClick: () => m.close() }),
    ], {
      onClose: () => {
        try {
          localStorage.setItem(ADVENTURE_KEY, '1');
        } catch {
          // Ignore.
        }
        then();
      },
    });
  }

  ranked(): void {
    this.tutorial(() => this.rankedNow());
  }

  private rankedNow(): void {
    const a = arena();
    const next = nextArena(a);
    const span = next ? next.trophies - a.trophies : 600;
    const t = Math.max(0, Math.min(1, (profile.trophies - a.trophies) / span));
    // The first few battles are gentle so new players win while learning.
    const rookie = profile.stats.played < 3;
    const skill = rookie ? 0 : a.skill[0] + (a.skill[1] - a.skill[0]) * (t * 0.7 + Math.random() * 0.3);
    const ai = aiForSkill(skill);
    if (rookie) Object.assign(ai, { thinkFrames: 60, tapInterval: 14, mistakeRate: 0.5, softDrop: false });
    const foe = characterById(a.opponents[Math.floor(Math.random() * a.opponents.length)]);
    const foeTrophies = Math.max(0, profile.trophies + Math.round((Math.random() - 0.5) * 80));
    const me = this.me();
    vsSplash({ ...me, trophies: profile.trophies }, { name: foe.name, character: foe, trophies: foeTrophies }, () => {
      this.app.play(
        new BattleSession(this.app, {
          kind: 'versus',
          levels: [a.level, a.level],
          games: 1,
          music: trackFor(Math.min(11, a.index), 13),
          scene: a.scene,
          me,
          opponent: { kind: 'robot', character: foe, ai, name: foe.name },
          info: a.name,
          onExit: (r) => this.afterRanked(r, foe.name, foeTrophies),
        }),
      );
    });
  }

  private afterRanked(r: BattleOutcome | null, foe: string, foeTrophies: number): void {
    this.back();
    if (!r) return;
    const rewards = recordBattle({ won: r.won, ...r.stats, ranked: true, opponentTrophies: foeTrophies });
    this.home.render();
    showResults(r, rewards, foe, () => this.home.render());
  }

  /** Adventure: the story of Sprout versus Professor Grimgear. */
  adventure(stage: number, difficulty: Difficulty): void {
    const foe = CAST[stage];
    const { canvas, hero } = heroCanvas({ skin: profile.skin, size: 120, scale: 0.6 });
    canvas.style.cssText = 'width:120px;height:120px;flex:none';
    const bot = robotCanvas(foe, 'happy', 120);
    bot.style.cssText = 'width:110px;height:110px;flex:none;border-radius:20px;border:3px solid #1a1230';
    setTimeout(() => hero.say(foe.reply, 3.5), 1600);
    const m = modal(`Stage ${stage + 1}: ${foe.name}`, [
      el('p', { class: 'center muted' }, foe.title),
      el('div', { class: 'row' }, bot, el('div', { class: 'card grow' }, foe.taunt)),
      el('div', { class: 'row', style: 'flex-direction:row-reverse' }, canvas, el('div', { class: 'card dark grow' }, foe.reply)),
      button('Battle!', { cls: 'btn-gold btn-xl', icon: ICONS.swords, onClick: () => {
        m.close();
        this.adventureBattle(stage, difficulty);
      } }),
    ]);
  }

  private adventureBattle(stage: number, difficulty: Difficulty): void {
    const foe = CAST[stage];
    this.app.play(
      new BattleSession(this.app, {
        kind: 'scenario',
        stage,
        difficulty,
        games: 1,
        music: trackFor(stage, CAST.length),
        scene: foe.scene,
        me: this.me(),
        opponent: { kind: 'robot', character: foe, ai: foe.ai, name: foe.name },
        info: `Stage ${stage + 1}`,
        onExit: (r) => {
          this.back();
          if (!r) return;
          if (r.won) this.adventureWon(stage, difficulty);
          else {
            const m = modal('So close!', [
              el('p', { class: 'center' }, `${foe.name} wins this round.`),
              button('Try again', { cls: 'btn-gold', onClick: () => {
                m.close();
                this.adventureBattle(stage, difficulty);
              } }),
              button('Back', { cls: 'btn-blue', onClick: () => m.close() }),
            ]);
          }
        },
      }),
    );
  }

  private adventureWon(stage: number, difficulty: Difficulty): void {
    const foe = CAST[stage];
    const first = stage >= progress.scenario[difficulty] && stage < CAST.length;
    const coins = first ? 40 + stage * 15 : 10;
    const gems = first && (stage % 4 === 3 || stage === CAST.length - 1) ? (stage === CAST.length - 1 ? 30 : 8) : 0;
    profile.coins += coins;
    profile.gems += gems;
    save();
    recordAdventureClear();
    if (first) {
      progress.scenario[difficulty] = Math.min(CAST.length, stage + 1);
      saveProgress();
    }
    const last = stage === CAST.length - 1;
    const bot = robotCanvas(foe, 'ko', 110);
    bot.style.cssText = 'width:100px;height:100px;flex:none;border-radius:20px;border:3px solid #1a1230';
    const m = modal(last ? 'Beanbury is free!' : 'Stage cleared!', [
      el('div', { class: 'row' }, bot, el('div', { class: 'card grow' }, foe.defeat)),
      last ? el('p', { class: 'center' }, 'The Bean Machine sputters and falls silent. Every robot powers down, and the beans of Beanbury roll home.') : '',
      el('div', { class: 'reward-row' }, el('div', { class: 'reward' }, svg(ICONS.coin), `+${coins}`), gems ? el('div', { class: 'reward' }, svg(ICONS.gem), `+${gems}`) : ''),
      !last ? button('Next stage', { cls: 'btn-gold', onClick: () => {
        m.close();
        this.adventure(stage + 1, difficulty);
      } }) : '',
      button('Back', { cls: 'btn-blue', onClick: () => m.close() }),
    ], { onClose: () => this.home.render() });
  }

  practice(level: number): void {
    this.app.play(
      new ExerciseSession(this.app, level, profile.skin, (score, best) => {
        this.back();
        if (best) toast(`New record: ${score.toLocaleString('en-US')}!`);
      }),
    );
  }

  local2p(levels: [number, number], games: number): void {
    this.app.play(
      new BattleSession(this.app, {
        kind: 'versus',
        levels,
        games,
        music: 'battle',
        scene: 'meadow',
        me: { name: 'Player 1', skin: profile.skin },
        opponent: { kind: 'local', name: 'Player 2', skin: profile.skin === 'ninja' ? 'pirate' : 'ninja' },
        onExit: (r) => {
          this.back();
          if (r) toast(`${r.wins[0] > r.wins[1] ? 'Player 1' : 'Player 2'} wins ${Math.max(...r.wins)}–${Math.min(...r.wins)}!`);
        },
      }),
    );
  }

  online(start: 'menu' | 'quick' = 'menu'): void {
    new OnlineFlow(this.app, this.me(), () => this.back(), start);
  }

  /** Attract mode: two robots play while the menu sits idle. */
  demo(): void {
    const a = CAST[Math.floor(Math.random() * CAST.length)];
    const b = CAST[(CAST.indexOf(a) + 3 + Math.floor(Math.random() * 6)) % CAST.length];
    this.app.play(
      new BattleSession(this.app, {
        kind: 'versus',
        levels: [1, 1],
        games: 1,
        music: 'battle',
        scene: b.scene,
        me: { name: a.name, skin: profile.skin },
        opponent: { kind: 'robot', character: b, ai: { ...b.ai, thinkFrames: 8, tapInterval: 4, softDrop: true, chainTarget: 3 }, name: b.name },
        demo: true,
        onExit: () => this.back(),
      }),
    );
  }
}
