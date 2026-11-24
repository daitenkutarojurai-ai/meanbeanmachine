import { audio } from '../audio.ts';
import type { Character } from '../game/characters.ts';
import { ARENAS, BOSS_EVERY, bossOf } from '../meta/arenas.ts';
import { arena, buy, buySkin, canAfford, equipSkin, levelInfo, profile, save } from '../meta/profile.ts';
import { CHESTS, SKINS, dailyOffers, skinById } from '../meta/rewards.ts';
import { Hero, LINES, pick } from '../render/hero.ts';
import { canPromptInstall, isInstalled, isIos, promptInstall } from '../pwa.ts';
import { drawStage } from '../render/stage.ts';
import { saveSettings, settings } from '../storage.ts';
import { openChestModal } from './chest.ts';
import { ICONS, button, chestSvg, el, fmt, fmtTime, heroCanvas, modal, price, robotCanvas, svg, toast } from './components.ts';
import type { Home } from './home.ts';

/** A still hero thumbnail, drawn once. */
function heroThumb(skin: string, px = 120): HTMLCanvasElement {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = el('canvas', { width: px * dpr, height: px * dpr });
  const h = new Hero(skin);
  h.update(0.3);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  h.draw(g, px / 2, px * 0.88, px * 0.56);
  return c;
}

// ------------------------------------------------------------------ shop

export function shopTab(home: Home): HTMLElement {
  const offers = dailyOffers(profile.shopDay, profile.skins);
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  const cards = offers.map((o) => {
    const sold = profile.shopBought.includes(o.id);
    let art: HTMLElement;
    let name: string;
    if (o.kind === 'skin') {
      art = heroThumb(o.skin!, 110);
      name = skinById(o.skin!).name;
    } else if (o.kind === 'chest') {
      art = el('div', { html: chestSvg(o.chest!), style: 'width:100px' });
      name = CHESTS[o.chest!].name;
    } else {
      art = el('div', { style: 'display:flex' }, svg(ICONS.coin), o.coins! >= 500 ? svg(ICONS.coin) : '', o.coins! >= 1000 ? svg(ICONS.coin) : '');
      art.querySelectorAll('svg').forEach((s) => (s.style.cssText = 'width:44px;height:44px;margin:0 -6px'));
      name = o.id === 'free' ? 'Daily gift' : `${fmt(o.coins!)} coins`;
    }
    const buyBtn = sold
      ? el('span', { class: 'tag' }, 'SOLD')
      : button('', { cls: o.price.gems ? 'btn-purple btn-sm' : 'btn-green btn-sm', disabled: !canAfford(o.price), onClick: () => {
          const res = buy(o);
          if (!res) return toast('Not enough!');
          if ('type' in res) openChestModal(res, () => home.render());
          else {
            audio.sfx('levelUp');
            toast('skin' in res ? `Unlocked ${skinById(res.skin).name}!` : `+${fmt(res.coins)} coins`);
            home.render();
          }
        } });
    if (!sold) buyBtn.append(price(o.price));
    return el('div', { class: `card offer ${o.kind === 'skin' ? `rarity-${skinById(o.skin!).rarity}` : ''}` }, el('div', { class: 'art' }, art), el('div', { class: 'name outline' }, name), buyBtn);
  });
  return el('div', { class: 'page' }, el('div', { class: 'page-title outline' }, 'Shop'), el('p', { class: 'center muted' }, `New deals in ${fmtTime(tomorrow.getTime() - Date.now())}`), el('div', { class: 'grid2' }, ...cards), el('p', { class: 'center muted', style: 'font-size:13px' }, 'Everything here is cosmetic or currency. Battles are always fair.'));
}

// ------------------------------------------------------------------ skins

export function skinsTab(home: Home): HTMLElement {
  const cards = SKINS.map((s) => {
    const owned = profile.skins.includes(s.id);
    const on = profile.skin === s.id;
    const c = el('button', { class: `card skin-card ${on ? 'equipped' : `rarity-${s.rarity}`} ${owned ? '' : 'locked'}`, type: 'button' }, heroThumb(s.id, 120), el('div', { class: 'name outline' }, s.name), on ? el('span', { class: 'tag' }, 'IN USE') : owned ? el('span', { class: 'tag' }, 'Owned') : s.price ? el('span', { class: 'tag' }, price(s.price)) : el('span', { class: 'tag' }, svg(ICONS.lock)));
    c.addEventListener('click', () => skinDetail(home, s.id));
    return c;
  });
  return el('div', { class: 'page' }, el('div', { class: 'page-title outline' }, 'Skins'), el('p', { class: 'center muted' }, `${profile.skins.length} / ${SKINS.length} collected`), el('div', { class: 'grid3' }, ...cards));
}

function skinDetail(home: Home, id: string): void {
  const s = skinById(id);
  const owned = profile.skins.includes(id);
  const { canvas, hero } = heroCanvas({ skin: id, size: 220, scale: 0.6, mood: 'idle', onTap: (h) => {
    h.act('hop');
    h.say(pick(LINES.tap), 2);
  } });
  canvas.style.cssText = 'width:220px;height:220px;margin:0 auto;display:block';
  setTimeout(() => hero.say(s.tagline, 3), 300);
  hero.act('wave');
  const m = modal(s.name, [
    canvas,
    el('p', { class: 'center' }, el('span', { class: 'tag' }, s.rarity.toUpperCase())),
    owned
      ? button(profile.skin === id ? 'Equipped' : 'Equip', { cls: 'btn-green btn-xl', disabled: profile.skin === id, onClick: () => {
          equipSkin(id);
          m.close();
          home.render();
          toast(`${s.name} ready!`);
        } })
      : s.price
        ? (() => {
            const b = button('Buy ', { cls: s.price.gems ? 'btn-purple btn-xl' : 'btn-gold btn-xl', disabled: !canAfford(s.price), onClick: () => {
              if (buySkin(id)) {
                equipSkin(id);
                audio.sfx('allClear');
                m.close();
                home.render();
                toast(`Unlocked ${s.name}!`);
              }
            } });
            b.append(price(s.price));
            return b;
          })()
        : el('p', { class: 'center muted' }, 'Found in chests and on the Trophy Road.'),
  ]);
}

// ------------------------------------------------------------------ arenas

/** Every arena on the trophy ladder, with the robots and the boss you meet there. */
export function arenasTab(home: Home): HTMLElement {
  const here = arena();
  const cards = ARENAS.map((x) => {
    const locked = profile.bestTrophies < x.trophies && x.index > here.index;
    const current = x.id === here.id;
    const scene = el('canvas', { class: 'arena-thumb' });
    scene.width = 360;
    scene.height = 140;
    drawStage(scene.getContext('2d')!, x.scene, 360, 140, 1.5);
    const boss = bossOf(x);
    const face = (c: Character, big: boolean): HTMLElement => {
      const cv = robotCanvas(c, 'idle', big ? 84 : 56);
      return el('div', { class: `arena-face${big ? ' boss' : ''}${locked ? ' locked' : ''}` }, cv, el('small', { class: 'outline' }, locked && big ? '???' : c.name));
    };
    const played = profile.arenaBattles[x.id] ?? 0;
    const status = current
      ? el('span', { class: 'tag hot' }, 'You are here')
      : locked
        ? el('span', { class: 'tag locked' }, svg(ICONS.lock), `${fmt(x.trophies)}`)
        : el('span', { class: 'tag' }, '✓ Unlocked');
    return el(
      'div',
      { class: `arena-row${current ? ' current' : ''}${locked ? ' locked' : ''}`, style: `--a1:${x.colors[0]};--a2:${x.colors[1]}` },
      el('div', { class: 'arena-banner' }, scene, el('div', { class: 'arena-banner-text' }, el('b', { class: 'outline' }, `${x.index + 1}. ${x.name}`), el('span', { class: 'outline' }, svg(ICONS.trophy), fmt(x.trophies))), status),
      el(
        'div',
        { class: 'arena-cast' },
        face(boss, true),
        el('div', { class: 'arena-minions' }, ...x.minions.map((m) => face(m, false))),
      ),
      el('small', { class: 'arena-note' }, locked ? `Reach ${fmt(x.trophies)} trophies to unlock.` : `Boss ${boss.name} shows up every ${BOSS_EVERY} battles · ${fmt(played)} played here`),
    );
  });
  return el(
    'div',
    { class: 'page' },
    el('div', { class: 'page-title outline' }, 'Arenas'),
    el('p', { class: 'center muted' }, `Win battles to earn trophies and climb to new arenas. Each one has its own robots, and its boss challenges you every ${BOSS_EVERY} battles for a big chest.`),
    button('Trophy Road', { cls: 'btn-gold', icon: ICONS.road, onClick: () => home.road() }),
    ...cards,
  );
}

// ------------------------------------------------------------------ profile

export function profileTab(home: Home): HTMLElement {
  const info = levelInfo();
  const st = profile.stats;
  const { canvas } = heroCanvas({ skin: profile.skin, size: 150, scale: 0.6, onTap: (h) => {
    h.act('hop');
    h.say(pick(LINES.tap), 2);
  } });
  canvas.style.cssText = 'width:150px;height:150px;flex:none';
  const nameInput = el('input', { type: 'text', maxLength: 12, value: profile.name });
  nameInput.addEventListener('change', () => {
    profile.name = nameInput.value.trim().slice(0, 12) || profile.name;
    settings.name = profile.name;
    saveSettings();
    save();
    home.renderTop();
    toast('Name saved');
  });
  const stat = (label: string, value: string): HTMLElement => el('div', { class: 'card dark center', style: 'padding:8px' }, el('div', { class: 'display', style: 'font-size:22px' }, value), el('small', { class: 'muted' }, label));
  const slider = (label: string, get: () => number, set: (v: number) => void): HTMLElement => {
    const r = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(get() * 100)) });
    r.addEventListener('input', () => {
      set(Number(r.value) / 100);
      audio.setVolumes(settings.sfx, settings.music);
      saveSettings();
    });
    r.addEventListener('change', () => audio.sfx('pop', 2));
    return el('label', { class: 'stack', style: 'gap:2px' }, el('span', {}, label), r);
  };
  const controls = el('div', { class: 'seg' });
  ([['auto', 'Swipe'], ['on', 'Buttons'], ['off', 'Off']] as const).forEach(([v, label]) => {
    const b = el('button', { type: 'button', class: settings.touch === v ? 'on' : '' }, label);
    b.addEventListener('click', () => {
      settings.touch = v;
      saveSettings();
      home.render();
    });
    controls.append(b);
  });
  const a = arena();
  return el(
    'div',
    { class: 'page' },
    el('div', { class: 'card row' }, canvas, el('div', { class: 'stack grow' }, nameInput, el('div', { class: 'row' }, el('span', { class: 'tag' }, `Level ${info.level}`), el('span', { class: 'tag' }, svg(ICONS.trophy), fmt(profile.trophies))), el('small', {}, `${a.name} · arena ${a.index + 1}/${ARENAS.length}`))),
    el('div', { class: 'grid3' }, stat('Wins', fmt(st.wins)), stat('Battles', fmt(st.played)), stat('Best chain', String(st.bestChain)), stat('Best trophies', fmt(profile.bestTrophies)), stat('Refugees sent', fmt(st.refugees)), stat('Best streak', String(st.bestStreak))),
    el('div', { class: 'card dark stack' },
      el('h3', { class: 'outline' }, 'Settings'),
      slider('Sound effects', () => settings.sfx, (v) => (settings.sfx = v)),
      slider('Music', () => settings.music, (v) => (settings.music = v)),
      el('span', {}, 'Touch controls'),
      controls,
    ),
    el('div', { class: 'grid2' }, button('Trophy Road', { cls: 'btn-gold', icon: ICONS.road, onClick: () => home.road() }), button('Quests', { cls: 'btn-blue', icon: ICONS.scroll, onClick: () => home.quests() })),
    button('How to play', { cls: 'btn-blue', onClick: () => howTo() }),
    installCard(home),
    el('p', { class: 'center muted', style: 'font-size:12px' }, 'Classic 1993 falling-bean rules, new cast. A fan project; no SEGA assets.'),
  );
}

/** Put the game on the home screen: one tap where the browser allows it, instructions on iOS. */
function installCard(home: Home): HTMLElement | string {
  if (isInstalled()) return '';
  if (canPromptInstall()) {
    return button('Install the app', { cls: 'btn-green', icon: ICONS.play, onClick: () => void promptInstall().then((ok) => {
      if (ok) toast('Installed! Find Bean Machine on your home screen');
      home.render();
    }) });
  }
  if (isIos()) return el('div', { class: 'card dark center', style: 'font-size:14px' }, 'Play full screen: tap Share, then “Add to Home Screen”.');
  return '';
}

export function howTo(): void {
  modal('How to play', [
    el('p', {}, 'Beans fall in pairs. Join 4 or more of one colour and they pop. Beans above fall, and new matches make a CHAIN.'),
    el('p', {}, 'Chains dump clear refugee beans on your rival: 70 points = 1 refugee, up to 30 per turn, and they can’t be cancelled. Refugees only pop next to a popping group.'),
    el('p', { style: 'color:#ffb0b8' }, 'If the third column fills to the X at the top, you lose.'),
    el('div', { class: 'card dark stack' }, el('b', {}, 'Keyboard'), el('span', {}, '← → move · ↓ drop · X / ↑ turn clockwise · Z turn counter-clockwise · Esc pause')),
    el('div', { class: 'card dark stack' }, el('b', {}, 'Touch'), el('span', {}, 'Drag sideways to move · tap the right half to turn ↻, left half ↺ · drag down to drop')),
  ]);
}
