import type { Difficulty } from '@mbm/engine';
import type { App, Session } from '../app.ts';
import { audio } from '../audio.ts';
import { SOLO_KEYS } from '../input.ts';
import { portrait } from '../render/portraits.ts';
import { progress, saveProgress } from '../storage.ts';
import { el, showLayer, showMenu } from '../ui.ts';
import type { SceneKind } from '../render/scenes.ts';
import { BattleSession, trackFor } from './battle.ts';
import { CAST, type Character, HERO } from './characters.ts';

const faceUrl = (c: Character, expr: Parameters<typeof portrait>[1] = 'idle'): string => portrait(c, expr).toDataURL();

/** A still backdrop behind story screens. */
class Backdrop implements Session {
  readonly kind = 'story';
  private frame = 0;
  private readonly app: App;
  private readonly scene: SceneKind;

  constructor(app: App, scene: SceneKind) {
    this.app = app;
    this.scene = scene;
  }

  update(): void {
    this.frame++;
  }

  render(): void {
    this.app.renderer.draw({ layout: 'none', boards: [], frame: this.frame, scene: this.scene, panels: [], info: [], banners: [], dim: true });
  }

  dispose(): void {}
}

function typewriter(node: HTMLElement, text: string): void {
  let i = 0;
  const id = setInterval(() => {
    i += 2;
    node.textContent = text.slice(0, i);
    if (i >= text.length || !node.isConnected) clearInterval(id);
  }, 30);
}

export class Scenario {
  private stage: number;
  private readonly app: App;
  private readonly difficulty: Difficulty;
  private readonly onQuit: () => void;

  constructor(app: App, difficulty: Difficulty, stage: number, onQuit: () => void) {
    this.app = app;
    this.difficulty = difficulty;
    this.stage = stage;
    this.onQuit = onQuit;
    this.story();
  }

  private story(): void {
    const foe = CAST[this.stage];
    this.app.setSession(new Backdrop(this.app, foe.scene));
    audio.music('story');
    const foeLine = el('p');
    const heroLine = el('p');
    const content = el(
      'div',
      { class: 'panel' },
      el('h2', {}, `STAGE ${this.stage + 1}`),
      el('p', { class: 'muted' }, foe.title.toUpperCase()),
      el('br'),
      el('div', { class: 'dialogue' }, el('img', { src: faceUrl(foe, 'happy'), alt: foe.name }), el('div', {}, el('p', { class: 'name' }, foe.name.toUpperCase()), foeLine)),
      el('br'),
      el('div', { class: 'dialogue right' }, el('img', { src: faceUrl(HERO), alt: HERO.name }), el('div', {}, el('p', { class: 'name' }, HERO.name.toUpperCase()), heroLine)),
      el('br'),
      el('p', { class: 'hint' }, 'PRESS START TO BATTLE · ESC TO QUIT'),
    );
    typewriter(foeLine, foe.taunt);
    setTimeout(() => typewriter(heroLine, foe.reply), 900);
    const layer = showLayer([content], {
      onConfirm: () => {
        layer.close();
        this.battle();
      },
      onBack: () => {
        layer.close();
        this.onQuit();
      },
    });
    content.addEventListener('click', () => {
      layer.close();
      this.battle();
    });
  }

  private battle(): void {
    const foe = CAST[this.stage];
    this.app.setSession(
      new BattleSession(this.app, {
        kind: 'scenario',
        stage: this.stage,
        difficulty: this.difficulty,
        games: 1,
        music: trackFor(this.stage, CAST.length),
        scene: foe.scene,
        portraitOf: 1,
        info: `STAGE ${this.stage + 1}`,
        players: [
          { label: 'SPROUT', character: HERO, human: true, binding: SOLO_KEYS, pad: 0, touch: this.app.touchEnabled },
          { label: foe.name.split(' ')[0].toUpperCase(), character: foe, human: false, ai: foe.ai },
        ],
        onExit: (r) => {
          if (!r) this.onQuit();
          else if (r.winner === 0) this.won();
          else this.lost();
        },
      }),
    );
  }

  private won(): void {
    const foe = CAST[this.stage];
    this.app.setSession(new Backdrop(this.app, foe.scene));
    audio.music('story');
    const next = this.stage + 1;
    progress.scenario[this.difficulty] = Math.max(progress.scenario[this.difficulty], Math.min(next, CAST.length - 1));
    saveProgress();
    const line = el('p');
    const layer = showLayer(
      [
        el(
          'div',
          { class: 'panel' },
          el('h2', {}, 'VICTORY!'),
          el('br'),
          el('div', { class: 'dialogue' }, el('img', { src: faceUrl(foe, 'ko'), alt: foe.name }), el('div', {}, el('p', { class: 'name' }, foe.name.toUpperCase()), line)),
          el('br'),
          el('p', { class: 'hint' }, 'PRESS START'),
        ),
      ],
      {
        onConfirm: () => {
          layer.close();
          if (next >= CAST.length) this.ending();
          else {
            this.stage = next;
            this.story();
          }
        },
        onBack: () => {
          layer.close();
          this.onQuit();
        },
      },
    );
    typewriter(line, foe.defeat);
  }

  private lost(): void {
    const foe = CAST[this.stage];
    this.app.setSession(new Backdrop(this.app, foe.scene));
    audio.music(null);
    let n = 10;
    const count = el('p', { class: 'code' }, String(n));
    const menu = showMenu({
      title: 'CONTINUE?',
      before: [el('img', { class: 'face', src: faceUrl(HERO, 'ko'), alt: 'Sprout' }), count],
      items: [
        { label: 'YES', action: () => done(true) },
        { label: 'NO', action: () => done(false) },
      ],
      onBack: () => done(false),
    });
    const id = setInterval(() => {
      n--;
      count.textContent = String(Math.max(0, n));
      if (n < 0) done(false);
    }, 1000);
    const done = (yes: boolean): void => {
      clearInterval(id);
      menu.close();
      if (yes) this.story();
      else this.onQuit();
    };
  }

  private ending(): void {
    const boss = CAST[CAST.length - 1];
    this.app.setSession(new Backdrop(this.app, 'meadow'));
    audio.music('title');
    audio.sfx('win');
    const layer = showLayer(
      [
        el(
          'div',
          { class: 'panel' },
          el('h1', {}, 'BEANBURY IS FREE!'),
          el('br'),
          el('div', { class: 'row' }, el('img', { class: 'face', src: faceUrl(HERO, 'happy'), alt: 'Sprout' }), el('img', { class: 'face', src: faceUrl(boss, 'ko'), alt: boss.name })),
          el('br'),
          el('p', {}, 'The Bean Machine sputters and falls silent. Every robot powers down, and the beans of Beanbury roll home.'),
          el('br'),
          el('p', { class: 'muted' }, `CLEARED ON ${this.difficulty.toUpperCase()}`),
          el('p', { class: 'hint' }, 'PRESS START'),
        ),
      ],
      {
        onConfirm: () => {
          layer.close();
          this.onQuit();
        },
        onBack: () => {
          layer.close();
          this.onQuit();
        },
      },
    );
  }
}
