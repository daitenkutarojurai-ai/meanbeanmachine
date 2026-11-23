import { audio } from '../audio.ts';
import type { Character } from '../game/characters.ts';
import { ICONS, el, fmt, heroCanvas, overlay, robotCanvas, svg } from './components.ts';

/** The face-off before a battle: you on top, them below, a big VS between. */
export function vsSplash(me: { name: string; skin: string; trophies: number }, foe: { name: string; character: Character; trophies: number }, onDone: () => void): void {
  const { canvas } = heroCanvas({ skin: me.skin, size: 220, mood: 'idle', scale: 0.62 });
  const bot = robotCanvas(foe.character, 'happy', 220);
  const who = (name: string, trophies: number): HTMLElement => el('div', { class: 'who' }, el('b', { class: 'outline' }, name), el('span', { class: 'outline' }, svg(ICONS.trophy), fmt(trophies)));
  const node = el(
    'div',
    { class: 'vs-splash' },
    el('div', { class: 'vs-side top' }, canvas, who(me.name, me.trophies)),
    el('div', { class: 'vs-mark outline' }, 'VS'),
    el('div', { class: 'vs-side bottom' }, who(foe.name, foe.trophies), bot),
  );
  bot.style.borderRadius = '28px';
  bot.style.border = '4px solid #1a1230';
  overlay().append(node);
  audio.sfx('ready');
  setTimeout(() => audio.sfx('go'), 1200);
  setTimeout(() => {
    node.remove();
    onDone();
  }, 2100);
}
