import type { App } from '../app.ts';
import { audio } from '../audio.ts';
import { type BattleOutcome, BattleSession } from '../game/battle.ts';
import { CAST, type Character } from '../game/characters.ts';
import { ExerciseSession } from '../game/exercise.ts';
import { OnlineFlow, type OnlineStart } from '../game/online.ts';
import { BOSS_EVERY, aiForSkill, bossOf, nextArena } from '../meta/arenas.ts';
import { arena, profile, recordBattle } from '../meta/profile.ts';
import { button, el, modal, toast } from './components.ts';
import { showResults } from './results.ts';
import { vsSplash } from './vs.ts';

export interface HomeLike {
  render(): void;
  show(): void;
}

const TUTORIAL_KEY = 'bm.tutorialSeen';

/** True when the next ranked battle in your arena is against its boss. */
export function nextIsBoss(): boolean {
  if (profile.stats.played < 3) return false;
  return (profile.arenaBattles[arena().id] ?? 0) % BOSS_EVERY === BOSS_EVERY - 1;
}

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
      seen = localStorage.getItem(TUTORIAL_KEY) === '1';
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
          localStorage.setItem(TUTORIAL_KEY, '1');
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
    const boss = nextIsBoss();
    let foe: Character;
    if (boss) {
      foe = bossOf(a);
    } else {
      const pool = a.minions.filter((m) => m.id !== profile.lastOpponent);
      foe = pool[Math.floor(Math.random() * pool.length)];
    }
    profile.lastOpponent = foe.id;
    if (boss && !rookie) Object.assign(ai, aiForSkill(Math.min(1, a.skill[1] + 0.05)));
    const foeTrophies = Math.max(0, profile.trophies + Math.round((Math.random() - 0.5) * 80));
    const me = this.me();
    vsSplash({ ...me, trophies: profile.trophies }, { name: foe.name, character: foe, trophies: foeTrophies, boss }, () => {
      this.app.play(
        new BattleSession(this.app, {
          kind: 'versus',
          levels: [a.level, a.level],
          games: 1,
          music: boss ? 'boss' : (['battle', 'battle2', 'battle3'] as const)[a.index % 3],
          scene: a.scene,
          me,
          opponent: { kind: 'robot', character: foe, ai, name: foe.name },
          info: boss ? 'BOSS BATTLE' : a.name,
          onExit: (r) => this.afterRanked(r, foe.name, foeTrophies, boss),
        }),
      );
    });
  }

  private afterRanked(r: BattleOutcome | null, foe: string, foeTrophies: number, boss: boolean): void {
    this.back();
    if (!r) return;
    const rewards = recordBattle({ won: r.won, ...r.stats, ranked: true, opponentTrophies: foeTrophies, boss });
    this.home.render();
    showResults(r, rewards, foe, () => this.home.render());
  }

  practice(): void {
    this.app.play(
      new ExerciseSession(this.app, 1, profile.skin, (score, best) => {
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

  online(start: OnlineStart = 'menu'): void {
    new OnlineFlow(this.app, this.me(), () => this.back(), () => this.ranked(), start);
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
