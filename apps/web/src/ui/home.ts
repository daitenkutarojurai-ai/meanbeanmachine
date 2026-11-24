import type { App } from '../app.ts';
import { audio } from '../audio.ts';
import { ARENAS, BOSS_EVERY, bossOf, nextArena } from '../meta/arenas.ts';
import {
  arena,
  chestSkipCost,
  chestState,
  claimQuest,
  claimRoad,
  freeChestReady,
  isUnlocking,
  levelInfo,
  openChest,
  openFreeChest,
  profile,
  refreshDaily,
  roadUnclaimed,
  save,
  skipChest,
  startUnlock,
} from '../meta/profile.ts';
import { CHESTS, QUEST_POOL, TROPHY_ROAD, skinById } from '../meta/rewards.ts';
import { type Hero, LINES, pick } from '../render/hero.ts';
import { onInstallChange } from '../pwa.ts';
import { drawStage } from '../render/stage.ts';
import { settings, saveSettings } from '../storage.ts';
import { openChestModal } from './chest.ts';
import { ICONS, button, chestSvg, el, fmt, fmtTime, heroCanvas, modal, svg, toast } from './components.ts';
import { Flows, nextIsBoss } from './flows.ts';
import { arenasTab, profileTab, shopTab, skinsTab } from './tabs.ts';

export type Tab = 'shop' | 'skins' | 'battle' | 'arenas' | 'profile';

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'shop', label: 'Shop', icon: ICONS.shop },
  { id: 'skins', label: 'Skins', icon: ICONS.cards },
  { id: 'battle', label: 'Battle', icon: ICONS.swords },
  { id: 'arenas', label: 'Arenas', icon: ICONS.map },
  { id: 'profile', label: 'Profile', icon: ICONS.user },
];

export class Home {
  readonly app: App;
  readonly flows: Flows;
  tab: Tab = 'battle';
  private root = document.getElementById('ui')!;
  private top = el('header', { class: 'topbar' });
  private view = el('main', { class: 'view' });
  private nav = el('nav', { class: 'navbar' });
  private backdrop = el('canvas', { id: 'backdrop' });
  private backdropKey = '';
  private slotsBox: HTMLElement | null = null;
  private freeBtn: HTMLElement | null = null;
  private hero: Hero | null = null;
  private idleTimer = 0;
  private greeted = false;
  private pendingInvite = '';

  constructor(app: App) {
    this.app = app;
    this.flows = new Flows(app, this);
    refreshDaily();
    this.root.replaceChildren(this.backdrop, el('div', { class: 'shell' }, this.top, this.view, this.nav));
    window.addEventListener('resize', () => this.paintBackdrop());
    this.render();
    setInterval(() => this.tick(), 1000);
    onInstallChange(() => this.tab === 'profile' && this.render());
    if (!profile.name) this.askName();
    else audio.music('title');
  }

  show(): void {
    this.root.hidden = false;
  }

  /** Opened from a friend's invite link: join their room once we know your name. */
  openInvite(code: string): void {
    if (!profile.name) this.pendingInvite = code;
    else this.flows.online({ join: code });
  }

  setTab(t: Tab): void {
    if (t === this.tab) return;
    this.tab = t;
    audio.sfx('menu');
    this.render();
  }

  /** The current arena, blurred, fills the space around the menu on wide screens. */
  private paintBackdrop(): void {
    const w = Math.round(window.innerWidth / 2);
    const h = Math.round(window.innerHeight / 2);
    const key = `${arena().scene}:${w}x${h}`;
    if (key === this.backdropKey) return;
    this.backdropKey = key;
    this.backdrop.width = w;
    this.backdrop.height = h;
    drawStage(this.backdrop.getContext('2d')!, arena().scene, w, h, 0);
  }

  render(): void {
    this.paintBackdrop();
    this.renderTop();
    this.renderNav();
    this.view.replaceChildren(this.tabContent());
    this.view.scrollTop = 0;
  }

  private tabContent(): HTMLElement {
    switch (this.tab) {
      case 'battle':
        return this.battleTab();
      case 'shop':
        return shopTab(this);
      case 'skins':
        return skinsTab(this);
      case 'arenas':
        return arenasTab(this);
      case 'profile':
        return profileTab(this);
    }
  }

  renderTop(): void {
    const info = levelInfo();
    const player = el(
      'div',
      { class: 'player' },
      el('div', { class: 'lvl outline' }, String(info.level)),
      el('div', { class: 'pname' }, el('b', { class: 'outline' }, profile.name || 'New Bean'), el('div', { class: 'xpbar' }, el('i', { style: `width:${Math.round((info.into / info.need) * 100)}%` }))),
    );
    player.addEventListener('click', () => this.setTab('profile'));
    const pill = (icon: string, n: number): HTMLElement => el('div', { class: 'pill outline' }, svg(icon), el('span', { class: 'num' }, fmt(n)));
    this.top.replaceChildren(player, pill(ICONS.coin, profile.coins), pill(ICONS.gem, profile.gems));
  }

  private renderNav(): void {
    const claimable = profile.quests.some((q) => !q.claimed && q.progress >= (QUEST_POOL.find((x) => x.id === q.id)?.goal ?? 99));
    this.nav.replaceChildren(
      ...NAV.map((n) => {
        const b = el('button', { class: `nav-btn${n.id === this.tab ? ' active' : ''}`, type: 'button' }, svg(n.icon), el('span', { class: 'outline' }, n.label));
        if (n.id === 'profile' && (claimable || roadUnclaimed() > 0)) b.append(el('span', { class: 'badge' }, '!'));
        b.addEventListener('click', () => this.setTab(n.id));
        return b;
      }),
    );
  }

  // ------------------------------------------------------------------ battle tab

  private battleTab(): HTMLElement {
    const a = arena();
    const next = nextArena(a);
    const { canvas, hero } = heroCanvas({
      skin: profile.skin,
      size: 300,
      scale: 0.4,
      foot: 0.93,
      background: (g, w, h, t) => drawStage(g, a.scene, w, h, t),
      onTap: (h) => {
        h.act('hop');
        h.say(pick(LINES.tap), 2);
        audio.sfx('pop', 2);
      },
    });
    this.hero = hero;
    if (!this.greeted) {
      this.greeted = true;
      setTimeout(() => hero.say(profile.name ? `Hey ${profile.name}! ${pick(LINES.greet)}` : pick(LINES.greet), 3), 600);
      hero.act('wave');
    }
    const trophy = el('div', { class: 'trophy-chip outline' }, svg(ICONS.trophy), fmt(profile.trophies));
    trophy.addEventListener('click', () => this.road());
    const card = el(
      'div',
      { class: 'arena-card' },
      canvas,
      el('div', { class: 'arena-head' }, trophy, el('div', { class: 'arena-name outline' }, a.name), el('div', { class: 'arena-sub outline' }, next ? `Next arena at ${fmt(next.trophies)} trophies` : 'Top arena!')),
    );
    this.freeBtn = el('button', { class: 'side-btn outline', type: 'button' });
    this.freeBtn.addEventListener('click', () => this.freeChest());
    const roadBtn = el('button', { class: 'side-btn outline', type: 'button' }, svg(ICONS.road), 'Road');
    if (roadUnclaimed()) roadBtn.append(el('span', { class: 'badge' }, String(roadUnclaimed())));
    roadBtn.addEventListener('click', () => this.road());
    const questBtn = el('button', { class: 'side-btn outline', type: 'button' }, svg(ICONS.scroll), 'Quests');
    const claimable = profile.quests.filter((q) => !q.claimed && q.progress >= (QUEST_POOL.find((x) => x.id === q.id)?.goal ?? 99)).length;
    if (claimable) questBtn.append(el('span', { class: 'badge' }, String(claimable)));
    questBtn.addEventListener('click', () => this.quests());
    card.append(el('div', { class: 'side-btns left' }, this.freeBtn, roadBtn), el('div', { class: 'side-btns right' }, questBtn));
    this.updateFree();

    const boss = nextIsBoss();
    const battle = button(boss ? 'BOSS BATTLE' : 'BATTLE', { cls: `btn-xl ${boss ? 'btn-red boss-pulse' : 'btn-gold'}`, onClick: () => this.flows.ranked() });
    const left = BOSS_EVERY - 1 - ((profile.arenaBattles[a.id] ?? 0) % BOSS_EVERY);
    const bossInfo = profile.stats.played < 3 ? null : el('div', { class: `boss-hint outline${boss ? ' now' : ''}` }, boss ? `Boss ${bossOf(a).name} is here! Win for a big chest` : `Boss ${bossOf(a).name} in ${left} battle${left === 1 ? '' : 's'}`);
    const modes = button('', { cls: 'btn-blue btn-icon', icon: ICONS.modes, onClick: () => this.modes() });
    modes.style.cssText = 'width:72px;height:72px;border-radius:20px';
    this.slotsBox = el('div', { class: 'chest-slots' });
    this.renderSlots();
    return el('div', { class: 'battle-tab' }, card, bossInfo ?? '', el('div', { class: 'battle-row' }, battle, modes), this.slotsBox);
  }

  private tick(): void {
    if (this.tab === 'battle' && this.slotsBox?.isConnected) {
      this.renderSlots();
      this.updateFree();
    }
    // Sprout gets chatty if left alone.
    this.idleTimer++;
    if (this.idleTimer % 25 === 0 && this.hero && this.tab === 'battle' && !document.getElementById('ui')!.hidden) {
      this.hero.say(pick([...LINES.tap, ...LINES.greet]), 2.5);
      this.hero.act(Math.random() < 0.5 ? 'wave' : 'hop');
    }
  }

  private updateFree(): void {
    if (!this.freeBtn) return;
    const ready = freeChestReady();
    this.freeBtn.className = `side-btn outline${ready ? ' ready' : ''}`;
    this.freeBtn.replaceChildren(el('span', { html: chestSvg('wood'), style: 'width:44px;display:block' }), ready ? 'FREE!' : fmtTime(profile.freeChestAt - Date.now()));
  }

  private freeChest(): void {
    if (!freeChestReady()) return toast(`Free chest in ${fmtTime(profile.freeChestAt - Date.now())}`);
    const loot = openFreeChest();
    if (loot) openChestModal(loot, () => this.render());
  }

  renderSlots(): void {
    if (!this.slotsBox) return;
    const now = Date.now();
    this.slotsBox.replaceChildren(
      ...profile.chests.map((c, i) => {
        if (!c) return el('div', { class: 'chest-slot empty' }, 'Chest slot');
        const state = chestState(c, now);
        const art = el('span', { html: chestSvg(c.type), style: 'display:contents' });
        let label: HTMLElement;
        if (state === 'ready') label = el('div', { class: 'when outline' }, 'OPEN!');
        else if (state === 'unlocking') label = el('div', { class: 'when outline' }, fmtTime(c.readyAt! - now), el('div', { class: 'gemcost' }, svg(ICONS.gem), String(chestSkipCost(i))));
        else label = el('div', { class: 'when outline' }, isUnlocking() ? fmtTime(CHESTS[c.type].unlockMs) : 'Tap to unlock');
        const slot = el('button', { class: `chest-slot ${state}`, type: 'button' }, art, label);
        slot.addEventListener('click', () => this.slotClick(i));
        return slot;
      }),
    );
  }

  private slotClick(i: number): void {
    const c = profile.chests[i];
    if (!c) return;
    const state = chestState(c);
    if (state === 'ready') {
      const loot = openChest(i);
      if (loot) openChestModal(loot, () => this.render());
      return;
    }
    const def = CHESTS[c.type];
    const cost = chestSkipCost(i);
    const m = modal(def.name, [
      el('div', { html: chestSvg(c.type), style: 'width:150px;margin:0 auto' }),
      el('p', { class: 'center muted' }, `${fmt(def.coins[0])}–${fmt(def.coins[1])} coins${def.gemChance ? ' · gems' : ''}${def.skinChance ? ' · chance of a skin' : ''}`),
      state === 'locked' && !isUnlocking()
        ? button(`Start unlock · ${fmtTime(def.unlockMs)}`, { cls: 'btn-green', icon: ICONS.clock, onClick: () => {
            startUnlock(i);
            m.close();
            this.renderSlots();
          } })
        : el('p', { class: 'center' }, state === 'locked' ? 'Another chest is unlocking.' : `Unlocking: ${fmtTime(c.readyAt! - Date.now())} left`),
      button(`Open now`, { cls: 'btn-purple', icon: ICONS.gem, disabled: profile.gems < cost, onClick: () => {
        if (skipChest(i)) {
          m.close();
          const loot = openChest(i);
          if (loot) openChestModal(loot, () => this.render());
        }
      } }),
      el('p', { class: 'center muted' }, `Costs ${cost} gems`),
    ]);
  }

  // ------------------------------------------------------------------ modals

  modes(): void {
    const item = (icon: string, title: string, sub: string, action: () => void, cls = 'btn-blue'): HTMLElement => {
      const b = button('', { cls, onClick: () => {
        m.close();
        action();
      } });
      b.style.cssText = 'justify-content:flex-start;text-align:left;padding:10px 14px';
      b.replaceChildren(svg(icon), el('span', { style: 'display:flex;flex-direction:column' }, el('span', {}, title), el('small', { style: 'font-family:var(--body);font-size:13px;text-shadow:none;opacity:.9' }, sub)));
      return b;
    };
    const m = modal('Game modes', [
      item(ICONS.globe, 'Online battle', 'Quick match against real players', () => this.flows.online('quick'), 'btn-gold'),
      item(ICONS.people, 'Play a friend', 'Create or join a room with a code', () => this.flows.online('menu')),
      item(ICONS.keyboard, 'Two players, one device', 'WASD + F/G vs arrows + K/L, or two gamepads', () => this.flows.local2p([1, 1], 2), 'btn-purple'),
      item(ICONS.star, 'Practice', 'Endless solo run, beat your best score', () => this.flows.practice(), 'btn-green'),
    ]);
  }

  quests(): void {
    refreshDaily();
    const list = el('div', { class: 'stack' });
    const render = (): void => {
      list.replaceChildren(
        ...profile.quests.map((q) => {
          const def = QUEST_POOL.find((x) => x.id === q.id)!;
          const done = q.progress >= def.goal;
          const reward = el('span', { class: 'tag' }, svg(def.gems ? ICONS.gem : ICONS.coin), String(def.gems ?? def.coins));
          const action = q.claimed
            ? el('span', { class: 'tag' }, '✓ Done')
            : button('Claim', { cls: 'btn-green btn-sm', disabled: !done, onClick: () => {
                const r = claimQuest(q.id);
                if (r) {
                  audio.sfx('levelUp');
                  toast(`+${r.gems || r.coins} ${r.gems ? 'gems' : 'coins'}`);
                  render();
                  this.render();
                }
              } });
          return el('div', { class: 'card dark stack' }, el('div', { class: 'row spread' }, el('b', {}, def.text), reward), el('div', { class: 'row' }, el('div', { class: 'progress grow' }, el('i', { style: `width:${Math.round((q.progress / def.goal) * 100)}%` }), el('span', {}, `${fmt(Math.min(q.progress, def.goal))} / ${fmt(def.goal)}`)), action));
        }),
      );
    };
    render();
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    modal('Daily quests', [list, el('p', { class: 'center muted' }, `New quests in ${fmtTime(tomorrow.getTime() - Date.now())}`)]);
  }

  /** Rewards and arena unlocks in trophy order, scrolled to where you are. */
  road(): void {
    const list = el('div', { class: 'road' });
    const best = profile.bestTrophies;
    const render = (): void => {
      const stops: { t: number; node: HTMLElement }[] = [];
      for (const a of ARENAS) {
        if (a.trophies === 0) continue;
        const open = best >= a.trophies;
        stops.push({
          t: a.trophies,
          node: el('div', { class: `road-arena${open ? ' reached' : ''}`, style: `--a1:${a.colors[0]};--a2:${a.colors[1]}` }, svg(open ? ICONS.map : ICONS.lock), el('b', { class: 'outline' }, `Arena ${a.index + 1}: ${a.name}`), el('span', { class: 'tag' }, svg(ICONS.trophy), fmt(a.trophies))),
        });
      }
      TROPHY_ROAD.forEach((r, i) => {
        const reached = best >= r.trophies;
        const claimed = profile.roadClaimed.includes(i);
        const what = r.skin ? `${skinById(r.skin).name}` : r.chest ? CHESTS[r.chest].name : r.gems ? `${r.gems} gems` : `${fmt(r.coins ?? 0)} coins`;
        let art: HTMLElement;
        if (r.skin) {
          const { canvas } = heroCanvas({ skin: r.skin, size: 56, scale: 0.62 });
          art = el('div', { class: 'road-art' }, canvas);
        } else if (r.chest) art = el('div', { class: 'road-art', html: chestSvg(r.chest) });
        else art = el('div', { class: 'road-art' }, svg(r.gems ? ICONS.gem : ICONS.coin));
        const action = claimed
          ? el('span', { class: 'tag' }, '✓')
          : reached
            ? button('Claim', { cls: 'btn-green btn-sm', onClick: () => {
                const res = claimRoad(i);
                if (!res) return;
                if ('type' in res && r.chest) openChestModal(res, () => this.render());
                else {
                  audio.sfx('levelUp');
                  toast(r.skin ? `Unlocked ${skinById(r.skin).name}!` : `+${what}`);
                }
                render();
                this.render();
              } })
            : el('span', { class: 'tag' }, svg(ICONS.lock));
        stops.push({
          t: r.trophies,
          node: el('div', { class: `road-row${reached ? ' reached' : ''}${claimed ? ' claimed' : ''}` }, el('span', { class: 'road-pin outline' }, svg(ICONS.trophy), fmt(r.trophies)), art, el('b', { class: 'grow outline' }, what), action),
        });
      });
      // Arena unlocks sort ahead of the rewards at the same count.
      stops.sort((a, b) => a.t - b.t || Number(b.node.classList.contains('road-arena')) - Number(a.node.classList.contains('road-arena')));
      const here = stops.findIndex((s) => s.t > best);
      const marker = el('div', { class: 'road-here outline' }, svg(ICONS.trophy), `You: ${fmt(best)}`);
      const nodes = stops.map((s) => s.node);
      nodes.splice(here < 0 ? nodes.length : here, 0, marker);
      list.replaceChildren(...nodes);
    };
    render();
    const next = TROPHY_ROAD.find((r) => r.trophies > best);
    modal('Trophy Road', [el('p', { class: 'center muted' }, next ? `Best: ${fmt(best)} trophies · next reward at ${fmt(next.trophies)}` : `Best: ${fmt(best)} trophies · road complete!`), list]);
    requestAnimationFrame(() => (list.querySelector('.road-row.reached:not(.claimed)') ?? list.querySelector('.road-here'))?.scrollIntoView({ block: 'center' }));
  }

  private askName(): void {
    const input = el('input', { type: 'text', maxLength: 12, placeholder: 'Your name' });
    const { canvas, hero } = heroCanvas({ skin: 'classic', size: 200, scale: 0.62, foot: 0.94 });
    canvas.style.cssText = 'width:100%;height:200px;display:block';
    hero.act('wave');
    setTimeout(() => hero.say("Hi! I'm Sprout. What's your name?", 4), 300);
    const done = (): void => {
      profile.name = input.value.trim().slice(0, 12) || `Bean${Math.floor(1000 + Math.random() * 9000)}`;
      settings.name = profile.name;
      saveSettings();
      save();
      m.close();
    };
    const m = modal('Welcome to Beanbury!', [canvas, input, button("Let's go!", { cls: 'btn-gold btn-xl', onClick: done })], {
      closable: false,
      onClose: () => {
        audio.music('title');
        this.greeted = false;
        this.render();
        if (this.pendingInvite) this.flows.online({ join: this.pendingInvite });
        this.pendingInvite = '';
      },
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done();
    });
    setTimeout(() => input.focus(), 50);
  }
}
