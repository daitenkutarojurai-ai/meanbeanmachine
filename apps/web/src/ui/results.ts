import { audio } from '../audio.ts';
import type { BattleOutcome } from '../game/battle.ts';
import { type BattleRewards, levelInfo, profile } from '../meta/profile.ts';
import { CHESTS, QUEST_POOL } from '../meta/rewards.ts';
import { LINES, pick } from '../render/hero.ts';
import { ICONS, button, chestSvg, countUp, el, fmt, heroCanvas, modal, svg } from './components.ts';

/** After a ranked battle: the verdict, trophies, coins, XP and any chest won. */
export function showResults(outcome: BattleOutcome, rewards: BattleRewards, opponent: string, onDone: () => void): void {
  const won = outcome.won;
  const { canvas, hero } = heroCanvas({ skin: profile.skin, size: 200, mood: won ? 'cheer' : 'sad', scale: 0.62 });
  canvas.className = 'result-hero';
  hero.say(pick(won ? LINES.win : LINES.lose), 3);
  const trophyNum = el('span', {}, fmt(profile.trophies - rewards.trophies));
  const delta = el('b', { style: `color:${rewards.trophies >= 0 ? '#7ef08a' : '#ff8a96'}` }, `${rewards.trophies >= 0 ? '+' : ''}${rewards.trophies}`);
  const info = levelInfo();
  const xpFill = el('i', { style: `width:${Math.round(((info.into - rewards.xp < 0 ? 0 : info.into - rewards.xp) / info.need) * 100)}%` });
  const rows: (Node | string)[] = [
    el('div', { class: `ribbon ${won ? 'win' : 'lose'} outline` }, won ? 'VICTORY!' : 'DEFEAT'),
    el('p', { class: 'center muted' }, `vs ${opponent} · best chain ${outcome.stats.maxChain} · ${fmt(outcome.stats.score)} pts`),
    canvas,
    el('div', { class: 'reward-row' },
      el('div', { class: 'reward', style: 'animation-delay:.1s' }, svg(ICONS.trophy), el('div', { class: 'row' }, trophyNum, delta), el('small', {}, 'Trophies')),
      el('div', { class: 'reward', style: 'animation-delay:.25s' }, svg(ICONS.coin), `+${rewards.coins}`, el('small', {}, 'Coins')),
      el('div', { class: 'reward', style: 'animation-delay:.4s' }, svg(ICONS.star), `+${rewards.xp}`, el('small', {}, 'XP')),
    ),
    el('div', { class: 'xpbar', style: 'height:14px' }, xpFill),
  ];
  if (rewards.chest) rows.push(el('div', { class: 'card center stack', style: 'animation:pop .5s .5s both' }, el('div', { html: chestSvg(rewards.chest), style: 'width:110px;margin:0 auto' }), el('b', { class: 'display' }, `${CHESTS[rewards.chest].name} won!`)));
  else if (rewards.slotsFull && won) rows.push(el('p', { class: 'center', style: 'color:#ffe36a' }, 'Chest slots full: open a chest to earn more!'));
  if (rewards.levelUp) rows.push(el('p', { class: 'center display outline', style: 'font-size:24px;color:#9af0ff' }, `Level up! You're level ${rewards.levelUp}`));
  if (rewards.newArena) rows.push(el('p', { class: 'center display outline', style: 'font-size:24px;color:#ffe36a' }, `New arena unlocked: ${rewards.newArena.name}!`));
  for (const q of rewards.questsDone) rows.push(el('p', { class: 'center', style: 'color:#7ef08a' }, `Quest complete: ${QUEST_POOL.find((x) => x.id === q)?.text}`));
  rows.push(button('OK', { cls: 'btn-gold btn-xl', onClick: () => m.close() }));
  const m = modal('', rows, { onClose: onDone, closable: false });
  setTimeout(() => {
    countUp(trophyNum, profile.trophies - rewards.trophies, profile.trophies, 1000);
    xpFill.style.width = `${Math.round((info.into / info.need) * 100)}%`;
    if (rewards.levelUp || rewards.newArena) audio.sfx('levelUp');
  }, 500);
}
