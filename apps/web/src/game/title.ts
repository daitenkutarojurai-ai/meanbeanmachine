import type { Difficulty } from '@mbm/engine';
import type { App } from '../app.ts';
import { audio } from '../audio.ts';
import { P1_KEYS, P2_KEYS, SOLO_KEYS } from '../input.ts';
import { portrait } from '../render/portraits.ts';
import { progress, saveSettings, settings } from '../storage.ts';
import { el, showLayer, showMenu } from '../ui.ts';
import { MenuBackdrop } from './backdrop.ts';
import { BattleSession } from './battle.ts';
import { CAST, HERO } from './characters.ts';
import { ExerciseSession } from './exercise.ts';
import { OnlineFlow } from './online.ts';
import { Scenario } from './scenario.ts';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'hardest'];

export class Title {
  private readonly app: App;
  private idle = 0;

  constructor(app: App) {
    this.app = app;
    const poke = (): void => {
      clearTimeout(this.idle);
      this.idle = 0;
    };
    app.input.onMenu(poke);
    window.addEventListener('pointerdown', poke);
    if (new URLSearchParams(location.search).has('demo')) this.demo();
    else this.main();
  }

  private backdrop(logo = false): void {
    this.app.setSession(new MenuBackdrop(this.app, { logo }));
  }

  /** Attract mode after the title sits idle, like the cartridge's demo play. */
  private demo(): void {
    const a = CAST[Math.floor(Math.random() * CAST.length)];
    let b = CAST[Math.floor(Math.random() * CAST.length)];
    if (b === a) b = CAST[(CAST.indexOf(a) + 5) % CAST.length];
    this.app.setSession(
      new BattleSession(this.app, {
        kind: 'versus',
        levels: [2, 2],
        games: 1,
        music: 'battle',
        bg: b.stage,
        portraitOf: 1,
        info: 'DEMO',
        demo: true,
        players: [
          { label: a.name.split(' ')[0].toUpperCase(), character: a, human: false, ai: { ...a.ai, thinkFrames: 8, tapInterval: 4, softDrop: true, chainTarget: Math.max(3, a.ai.chainTarget) } },
          { label: b.name.split(' ')[0].toUpperCase(), character: b, human: false, ai: { ...b.ai, thinkFrames: 8, tapInterval: 4, softDrop: true, chainTarget: Math.max(3, b.ai.chainTarget) } },
        ],
        onExit: () => this.main(0),
      }),
    );
  }

  main(focus = 0): void {
    this.backdrop(true);
    audio.music('title');
    clearTimeout(this.idle);
    this.idle = window.setTimeout(() => {
      m.close();
      this.demo();
    }, 30000);
    const m = showMenu({
      dim: false,
      position: 'bottom',
      focus,
      items: [
        { label: 'SCENARIO MODE', action: () => (m.close(), this.scenario()) },
        { label: 'ONLINE BATTLE', action: () => (m.close(), this.online()) },
        { label: '1P VS 2P', action: () => (m.close(), this.versus()) },
        { label: 'VS COMPUTER', action: () => (m.close(), this.freeBattle()) },
        { label: 'EXERCISE', action: () => (m.close(), this.exercise()) },
        { label: 'HOW TO PLAY', action: () => (m.close(), this.howTo()) },
        { label: 'OPTIONS', action: () => (m.close(), this.options()) },
      ],
    });
  }

  private scenario(): void {
    this.backdrop();
    let diff = DIFFICULTIES.indexOf(settings.difficulty);
    const m = showMenu({
      title: 'SCENARIO MODE',
      subtitle: 'DEFEAT PROFESSOR GRIMGEAR AND HIS 12 MACHINES',
      items: [
        {
          label: 'DIFFICULTY',
          value: () => DIFFICULTIES[diff].toUpperCase(),
          change: (d) => {
            diff = (diff + d + 4) % 4;
            settings.difficulty = DIFFICULTIES[diff];
            saveSettings();
            m.refresh();
          },
        },
        { label: 'NEW GAME', action: () => this.startScenario(DIFFICULTIES[diff], 0, m) },
        {
          label: 'CONTINUE',
          value: () => `STAGE ${progress.scenario[DIFFICULTIES[diff]] + 1}`,
          action: () => this.startScenario(DIFFICULTIES[diff], progress.scenario[DIFFICULTIES[diff]], m),
        },
        { label: 'BACK', action: () => (m.close(), this.main(0)) },
      ],
      onBack: () => (m.close(), this.main(0)),
      footer: 'DIFFICULTY SETS HOW FAST THE BEANS FALL, AS IN THE ORIGINAL',
    });
  }

  private startScenario(d: Difficulty, stage: number, m: { close(): void }): void {
    m.close();
    new Scenario(this.app, d, stage, () => this.main(0));
  }

  private versus(): void {
    this.backdrop();
    const levels = settings.levels;
    const m = showMenu({
      title: '1P VS 2P',
      subtitle: 'ONE KEYBOARD OR TWO GAMEPADS',
      items: [
        { label: '1P LEVEL', value: () => String(levels[0] + 1), change: (d) => ((levels[0] = (levels[0] + d + 5) % 5), saveSettings()) },
        { label: '2P LEVEL', value: () => String(levels[1] + 1), change: (d) => ((levels[1] = (levels[1] + d + 5) % 5), saveSettings()) },
        {
          label: 'GAMES',
          value: () => `BEST OF ${settings.games}`,
          change: (d) => ((settings.games = Math.min(15, Math.max(1, settings.games + d * 2))), saveSettings()),
        },
        {
          label: 'START',
          action: () => {
            m.close();
            this.app.setSession(
              new BattleSession(this.app, {
                kind: 'versus',
                levels: [levels[0], levels[1]],
                games: settings.games,
                music: 'battle',
                bg: ['#203050', '#080c18'],
                portraitOf: null,
                players: [
                  { label: '1P', character: HERO, human: true, binding: P1_KEYS, pad: 0 },
                  { label: '2P', character: HERO, human: true, binding: P2_KEYS, pad: 1 },
                ],
                onExit: () => this.versus(),
              }),
            );
          },
        },
        { label: 'BACK', action: () => (m.close(), this.main(2)) },
      ],
      onBack: () => (m.close(), this.main(2)),
      footer: '1P: WASD + F/G   2P: ARROWS + K/L   LEVEL 1 = 4 COLOURS, 4-5 START WITH REFUGEES',
    });
  }

  private freeBattle(): void {
    this.backdrop();
    const unlocked = Math.max(...Object.values(progress.scenario));
    let focus = 0;
    const name = el('h2', {}, '');
    const title = el('p', { class: 'muted' }, '');
    const grid = el('div', { class: 'cast-grid' });
    const buttons = CAST.map((c, i) => {
      const locked = i > unlocked && i > 3;
      const b = el('button', { type: 'button', class: locked ? 'locked' : '' }, el('img', { src: portrait(c).toDataURL(), alt: c.name }));
      b.addEventListener('click', () => {
        focus = i;
        refresh();
        pick();
      });
      b.addEventListener('pointerenter', () => {
        focus = i;
        refresh();
      });
      grid.append(b);
      return { b, locked };
    });
    const refresh = (): void => {
      buttons.forEach(({ b }, i) => b.classList.toggle('focus', i === focus));
      const c = CAST[focus];
      name.textContent = buttons[focus].locked ? '???' : c.name.toUpperCase();
      title.textContent = buttons[focus].locked ? 'BEAT THEM IN SCENARIO MODE' : c.title.toUpperCase();
    };
    const pick = (): void => {
      if (buttons[focus].locked) return;
      layer.close();
      const foe = CAST[focus];
      this.app.setSession(
        new BattleSession(this.app, {
          kind: 'versus',
          levels: [settings.levels[0], settings.levels[0]],
          games: settings.games,
          music: focus === CAST.length - 1 ? 'boss' : 'battle',
          bg: foe.stage,
          portraitOf: 1,
          players: [
            { label: 'YOU', character: HERO, human: true, binding: SOLO_KEYS, pad: 0, touch: this.app.touchEnabled },
            { label: foe.name.split(' ')[0].toUpperCase(), character: foe, human: false, ai: foe.ai },
          ],
          onExit: () => this.freeBattle(),
        }),
      );
    };
    const layer = showLayer([el('div', { class: 'panel' }, el('h2', {}, 'CHOOSE OPPONENT'), el('br'), grid, el('br'), name, title, el('p', { class: 'hint' }, `LEVEL ${settings.levels[0] + 1} · BEST OF ${settings.games} · CHANGE IN 1P VS 2P`))], {
      onBack: () => (layer.close(), this.main(3)),
      onConfirm: pick,
    });
    const off = this.app.input.onMenu((a) => {
      if (!layer.layer.isConnected) return off();
      const cols = 7;
      if (a === 'left') focus = (focus + CAST.length - 1) % CAST.length;
      else if (a === 'right') focus = (focus + 1) % CAST.length;
      else if (a === 'up') focus = Math.max(0, focus - cols);
      else if (a === 'down') focus = Math.min(CAST.length - 1, focus + cols);
      else return;
      audio.sfx('menu');
      refresh();
    });
    refresh();
  }

  private exercise(): void {
    this.backdrop();
    const names = ['EASY', 'NORMAL', 'HARD'];
    const m = showMenu({
      title: 'EXERCISE',
      subtitle: 'ENDLESS PRACTICE. HOW LONG CAN YOU LAST?',
      items: [
        ...names.map((n, i) => ({
          label: n,
          value: () => `BEST ${progress.exerciseBest[i] ?? 0}`,
          action: () => {
            m.close();
            this.app.setSession(new ExerciseSession(this.app, i, () => this.exercise()));
          },
        })),
        { label: 'BACK', action: () => (m.close(), this.main(4)) },
      ],
      onBack: () => (m.close(), this.main(4)),
      footer: 'NORMAL STARTS AT 40000 POINTS, HARD AT 90000 · CLEAR THE BOARD FOR A BONUS',
    });
  }

  private online(): void {
    this.backdrop();
    new OnlineFlow(this.app, () => this.main(1));
  }

  private howTo(): void {
    this.backdrop();
    const rows: [string, string][] = [
      ['MOVE', '← → OR A D'],
      ['DROP', '↓ OR S (1 POINT PER ROW)'],
      ['TURN', 'Z / X, J / K, OR ↑'],
      ['PAUSE', 'ESC OR P'],
    ];
    const layer = showLayer(
      [
        el(
          'div',
          { class: 'panel' },
          el('h2', {}, 'HOW TO PLAY'),
          el('br'),
          el('p', {}, 'Beans fall in pairs. Join 4 or more of one colour and they pop. Beans above fall, and new matches make a CHAIN.'),
          el('br'),
          el('p', {}, 'Chains dump clear REFUGEE BEANS on your rival. Refugees only pop next to a popping group.'),
          el('br'),
          el('p', { class: 'muted' }, 'If the third column fills to the top, you lose.'),
          el('br'),
          ...rows.map(([k, v]) => el('p', { class: 'row' }, el('span', { class: 'ok' }, k), el('span', {}, v))),
          el('br'),
          el('p', { class: 'hint' }, 'NO OFFSETTING: INCOMING REFUGEES ALWAYS LAND, UP TO 30 PER TURN. 70 POINTS = 1 REFUGEE.'),
        ),
      ],
      { onBack: () => (layer.close(), this.main(5)), onConfirm: () => (layer.close(), this.main(5)) },
    );
  }

  private options(): void {
    this.backdrop();
    const pct = (v: number): string => `${Math.round(v * 100)}%`;
    const step = (v: number, d: number): number => Math.round(Math.min(1, Math.max(0, v + d * 0.1)) * 10) / 10;
    const touchModes: ('auto' | 'on' | 'off')[] = ['auto', 'on', 'off'];
    const m = showMenu({
      title: 'OPTIONS',
      items: [
        {
          label: 'SOUND',
          value: () => pct(settings.sfx),
          change: (d) => {
            settings.sfx = step(settings.sfx, d);
            audio.setVolumes(settings.sfx, settings.music);
            audio.sfx('pop', 2);
            saveSettings();
          },
        },
        {
          label: 'MUSIC',
          value: () => pct(settings.music),
          change: (d) => {
            settings.music = step(settings.music, d);
            audio.setVolumes(settings.sfx, settings.music);
            saveSettings();
          },
        },
        {
          label: 'TOUCH PAD',
          value: () => settings.touch.toUpperCase(),
          change: (d) => {
            settings.touch = touchModes[(touchModes.indexOf(settings.touch) + d + 3) % 3];
            saveSettings();
            this.app.updateTouch();
          },
        },
        {
          label: 'RECORD',
          value: () => `${progress.wins}W ${progress.losses}L · ${progress.bestChain} CHAIN`,
          disabled: false,
        },
        { label: 'BACK', action: () => (m.close(), this.main(6)) },
      ],
      onBack: () => (m.close(), this.main(6)),
    });
  }
}
