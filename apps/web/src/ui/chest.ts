import { audio } from '../audio.ts';
import type { Loot } from '../meta/profile.ts';
import { CHESTS, skinById } from '../meta/rewards.ts';
import { LINES, pick } from '../render/hero.ts';
import { ICONS, button, chestSvg, countUp, el, heroCanvas, overlay, svg } from './components.ts';

/** The chest-opening moment: tap the chest, then tap through each reward. */
export function openChestModal(loot: Loot, onDone: () => void): void {
  const def = CHESTS[loot.type];
  const stage = el('div', { class: 'chest-stage' });
  const box = el('div', { class: 'modal', style: 'overflow:hidden' }, el('div', { class: 'rays' }), stage);
  const back = el('div', { class: 'modal-back' }, box);
  overlay().append(back);
  audio.sfx('select');

  const rewards: (() => HTMLElement)[] = [];
  if (loot.coins) rewards.push(() => card(svg(ICONS.coin), loot.coins, 'Coins'));
  if (loot.gems) rewards.push(() => card(svg(ICONS.gem), loot.gems, 'Gems'));
  if (loot.skin) {
    const skin = skinById(loot.skin);
    rewards.push(() => {
      const { canvas, hero } = heroCanvas({ skin: skin.id, size: 110, mood: 'cheer' });
      hero.say(pick(LINES.chest), 2);
      const c = el('div', { class: `loot-card rarity-${skin.rarity}` }, canvas, el('div', { class: 'display outline', style: 'font-size:22px' }, skin.name), el('small', {}, 'NEW SKIN!'));
      return c;
    });
  }
  rewards.push(() => card(svg(ICONS.star), loot.xp, 'XP'));

  const chest = el('div', { class: 'chest-big', html: chestSvg(loot.type) });
  stage.append(el('h2', { class: 'outline' }, def.name), chest, el('p', {}, 'Tap to open!'));
  let i = 0;
  const next = (): void => {
    if (i >= rewards.length) {
      back.remove();
      onDone();
      return;
    }
    audio.sfx(i === 0 ? 'allClear' : 'levelUp');
    for (let k = 0; k < 5; k++) setTimeout(() => audio.sfx('coin', k), 120 + k * 90);
    stage.replaceChildren(rewards[i](), el('p', { class: 'muted' }, i === rewards.length - 1 ? 'Tap to finish' : 'Tap for more'));
    i++;
  };
  chest.addEventListener('click', () => {
    chest.classList.add('opening');
    audio.sfx('chest');
    setTimeout(() => {
      next();
      box.addEventListener('click', next);
    }, 480);
  });
}

function card(icon: HTMLElement, amount: number, label: string): HTMLElement {
  const num = el('div', { class: 'amount outline' }, '0');
  countUp(num, 0, amount, 700, '+');
  return el('div', { class: 'loot-card' }, icon, num, el('div', { class: 'display' }, label));
}

export function lootSummary(loot: Loot): string {
  const bits = [];
  if (loot.coins) bits.push(`${loot.coins} coins`);
  if (loot.gems) bits.push(`${loot.gems} gems`);
  if (loot.skin) bits.push(skinById(loot.skin).name);
  return bits.join(', ');
}

export { button };
