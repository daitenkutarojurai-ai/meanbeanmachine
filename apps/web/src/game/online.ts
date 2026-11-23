import { InputRecorder, InputReplay, MAX_GAMES, PlayerSim, type ServerMessage, countBeans, versusConfigs } from '@mbm/engine';
import type { App, Session } from '../app.ts';
import { audio } from '../audio.ts';
import { SOLO_KEYS } from '../input.ts';
import { recordBattle } from '../meta/profile.ts';
import { SKINS } from '../meta/rewards.ts';
import { net } from '../net/client.ts';
import type { Banner, BoardView, Panel } from '../render/battleRenderer.ts';
import { LINES, pick } from '../render/hero.ts';
import type { SceneKind } from '../render/stage.ts';
import { saveSettings, settings } from '../storage.ts';
import { ICONS, type ModalHandle, button, el, modal, svg, toast } from '../ui/components.ts';
import { HeroDirector, playEventSounds, trackFor } from './battle.ts';

const FRAME_MS = 1000 / 60;
const SCENES: SceneKind[] = ['meadow', 'junkyard', 'steam', 'disco', 'sea', 'city', 'mine', 'castle', 'lava', 'rooftop'];

interface Lobby {
  code: string;
  you: number;
  names: string[];
}

const codeHash = (code: string): number => [...code].reduce((h, c) => Math.imul(h, 31) + c.charCodeAt(0), 7) >>> 0;

/** A networked round: your board runs locally, your rival's is replayed from their inputs. */
class OnlineBattle implements Session {
  private local: PlayerSim;
  private remote: InputReplay;
  private recorder = new InputRecorder();
  private views: BoardView[];
  private startAt: number;
  private sent = 0;
  private incoming: number[] = [];
  private state: 'intro' | 'play' | 'roundEnd' | 'matchEnd' = 'intro';
  private bannerTimer = 0;
  private winner = -1;
  private frame = 0;
  private ping = 0;
  private pingTimer: number;
  private lastCount = 0;
  private off: (() => void) | null;
  private readonly me: HeroDirector;
  private readonly rival: HeroDirector;
  readonly stats = { score: 0, maxChain: 0, refugeesSent: 0, popped: 0 };
  wins: number[];

  private readonly app: App;
  private readonly lobby: Lobby;
  private readonly msg: Extract<ServerMessage, { t: 'start' }>;
  private readonly games: number;
  private readonly onMatchOver: (iWon: boolean) => void;

  constructor(app: App, lobby: Lobby, msg: Extract<ServerMessage, { t: 'start' }>, wins: number[], games: number, skin: string, onMatchOver: (iWon: boolean) => void) {
    this.app = app;
    this.lobby = lobby;
    this.msg = msg;
    this.games = games;
    this.onMatchOver = onMatchOver;
    this.wins = wins;
    const cfgs = versusConfigs(msg.seed, msg.levels);
    this.local = new PlayerSim(cfgs[lobby.you]);
    this.local.start();
    this.remote = new InputReplay(cfgs[1 - lobby.you]);
    this.views = [
      { sim: this.local, pending: 0, shake: 0 },
      { sim: this.remote.sim, pending: 0, shake: 0 },
    ];
    this.me = new HeroDirector(skin);
    this.rival = new HeroDirector(SKINS[codeHash(lobby.code) % SKINS.length].id);
    this.startAt = performance.now() + msg.countdownMs;
    app.renderer.effects.reset();
    app.renderer.resetHud();
    audio.music(this.track());
    audio.sfx('ready');
    this.off = net.on((m) => this.onMessage(m));
    this.pingTimer = window.setInterval(() => net.send({ t: 'ping', at: performance.now() }), 2000);
  }

  private track(): 'battle' | 'battle2' | 'battle3' {
    return trackFor(codeHash(this.lobby.code) % 12, 13) as 'battle' | 'battle2' | 'battle3';
  }

  private onMessage(m: ServerMessage): void {
    switch (m.t) {
      case 'frames':
        this.remote.push(m);
        break;
      case 'garbage':
        this.incoming.push(m.amount);
        break;
      case 'resumed':
        if (m.framesReceived !== null) this.recorder.resendFrom(m.framesReceived);
        break;
      case 'pong':
        this.ping = Math.round(performance.now() - m.at);
        break;
      case 'roundOver': {
        this.wins = m.wins;
        this.winner = m.winner < 0 ? -1 : m.winner === this.lobby.you ? 0 : 1;
        this.state = 'roundEnd';
        this.bannerTimer = 0;
        this.flush();
        if (this.winner >= 0) {
          const v = this.views[1 - this.winner];
          if (v.deadAt === undefined) v.deadAt = this.frame;
          this.app.renderer.effects.confetti(this.app.renderer.fxBoards(this.views)[this.winner]);
        }
        audio.jingle(this.winner === 0 ? 'win' : 'lose');
        this.me.hero.say(pick(this.winner === 0 ? LINES.win : LINES.lose), 2);
        this.views.forEach((v, i) => (v.mood = this.winner < 0 ? 'lose' : i === this.winner ? 'win' : 'lose'));
        this.stats.score = Math.max(this.stats.score, this.local.score);
        this.stats.maxChain = Math.max(this.stats.maxChain, this.local.maxChain);
        break;
      }
      case 'matchOver':
        this.wins = m.wins;
        this.state = 'matchEnd';
        setTimeout(() => this.onMatchOver(m.winner === this.lobby.you), 1600);
        break;
    }
  }

  private flush(): void {
    const b = this.recorder.takeBatch(true);
    if (b) net.send({ t: 'frames', ...b });
  }

  update(now: number): void {
    if (this.state === 'intro') {
      const left = Math.ceil((this.startAt - now) / 1000);
      if (left !== this.lastCount && left > 0) audio.sfx('tick');
      this.lastCount = left;
      if (now >= this.startAt) {
        this.state = 'play';
        audio.sfx('go');
      }
    }
    if (this.state === 'play') {
      const target = Math.floor((now - this.startAt) / FRAME_MS);
      let steps = 0;
      while (this.recorder.frame < target && steps < 600) {
        this.stepLocal();
        steps++;
      }
      const batch = this.recorder.takeBatch();
      if (batch) net.send({ t: 'frames', ...batch });
    }
    const evs = this.remote.advance();
    this.app.renderer.effects.handle(1, evs, this.app.renderer.fxBoards(this.views));
    playEventSounds(evs, false, 'rival');
    this.rival.events(evs);
  }

  private stepLocal(): void {
    for (const amount of this.incoming.splice(0)) {
      this.local.receiveGarbage(amount);
      this.recorder.ack(amount);
    }
    const input = this.app.input.mask(SOLO_KEYS, 0, this.app.controls === 'buttons') | this.app.touch.frame();
    this.local.step(input);
    this.recorder.record(input);
    const evs = this.local.events.splice(0);
    this.app.renderer.effects.handle(0, evs, this.app.renderer.fxBoards(this.views));
    playEventSounds(evs, true, 'hero');
    this.me.events(evs);
    for (const e of evs) {
      if (e.type === 'chainEnd') {
        this.sent += e.garbage;
        this.stats.refugeesSent += e.garbage;
      }
      if (e.type === 'pop') this.stats.popped += e.score.cleared;
    }
    if (!this.local.alive && this.views[0].deadAt === undefined) this.views[0].deadAt = this.frame;
  }

  render(): void {
    this.frame++;
    this.bannerTimer++;
    const fx = this.app.renderer.effects;
    fx.update(this.app.renderer.fxBoards(this.views));
    for (const target of fx.hits.splice(0)) (target === 0 ? this.me : this.rival).hit();
    const over = this.state === 'roundEnd' || this.state === 'matchEnd';
    this.me.frame(this.local, 1 / 60, over ? (this.winner === 0 ? 'win' : 'lose') : null);
    this.rival.frame(this.remote.sim, 1 / 60, over ? (this.winner === 1 ? 'win' : 'lose') : null);
    this.views[0].pending = this.local.pending + this.incoming.reduce((a, b) => a + b, 0);
    this.views[1].pending = this.remote.sim.pending + Math.max(0, this.sent - this.remote.ackedTotal);
    if (!this.remote.sim.alive && this.views[1].deadAt === undefined) this.views[1].deadAt = this.frame;
    if (this.state === 'play') audio.music(countBeans(this.local.field) >= 54 ? 'danger' : this.track());

    const me = this.lobby.you;
    const names = [this.lobby.names[me] || 'You', this.lobby.names[1 - me] || 'Rival'];
    const panels: Panel[] = [0, 1].map((i) => {
      const step = fx.stepText[i];
      const sim = i === 0 ? this.local : this.remote.sim;
      return { label: names[i], value: step && step.life > 0 ? step.text : undefined, score: sim.score, color: i === 0 ? '#7ab8ff' : '#ff8a9a' };
    });
    const banners: Banner[] = [];
    if (this.state === 'intro') {
      const msLeft = this.startAt - performance.now();
      const left = Math.ceil(msLeft / 1000);
      const age = Math.floor((1000 - (((msLeft % 1000) + 1000) % 1000)) / 16.7);
      banners.push(left > 0 ? { text: String(left), style: 'bounce', age, sub: this.msg.round > 0 ? `Round ${this.msg.round + 1}` : 'Get ready!' } : { text: 'GO!', tone: 'green', style: 'zoom', age: 0 });
    } else if (over) {
      if (this.winner < 0) banners.push({ text: 'DRAW', style: 'bounce', age: this.bannerTimer });
      else [0, 1].forEach((i) => banners.push({ text: this.winner === i ? 'WIN!' : 'LOSE', board: i, style: 'bounce', age: this.bannerTimer, tone: this.winner === i ? 'green' : 'red' }));
    }
    this.app.renderer.draw({
      scene: SCENES[codeHash(this.lobby.code) % SCENES.length],
      boards: this.views,
      hero: this.me.hero,
      foe: { kind: 'hero', hero: this.rival.hero, name: names[1] },
      panels,
      info: [`${this.wins[me]} – ${this.wins[1 - me]}`, `First to ${Math.floor(this.games / 2) + 1}`, net.reconnecting ? 'Reconnecting…' : this.ping ? `${this.ping} ms` : ''],
      banners,
      frame: this.frame,
    });
  }

  dispose(): void {
    this.off?.();
    this.off = null;
    clearInterval(this.pingTimer);
  }
}

/** Matchmaking, rooms and rematches around online rounds. */
export class OnlineFlow {
  private lobby: Lobby | null = null;
  private games = settings.games;
  private wins = [0, 0];
  private ui: ModalHandle | null = null;
  private offMsg: (() => void) | null = null;
  private offClose: (() => void) | null = null;
  private battle: OnlineBattle | null = null;
  private readonly app: App;
  private readonly skin: string;
  private readonly name: string;
  private readonly onDone: () => void;

  constructor(app: App, me: { name: string; skin: string }, onDone: () => void, start: 'menu' | 'quick' = 'menu') {
    this.app = app;
    this.skin = me.skin;
    this.name = me.name;
    this.onDone = onDone;
    if (start === 'quick') void this.go({ t: 'quick', level: settings.onlineLevel });
    else this.menu();
  }

  private closeUi(): void {
    const u = this.ui;
    this.ui = null;
    u?.close();
  }

  private show(title: string, content: (Node | string)[], closable = true): void {
    this.closeUi();
    this.ui = modal(title, content, { onClose: () => this.ui && this.quit(), closable });
  }

  private levelPicker(onChange?: () => void): HTMLElement {
    const seg = el('div', { class: 'seg' });
    const render = (): void => {
      seg.replaceChildren(
        ...[0, 1, 2, 3, 4].map((l) => {
          const b = el('button', { type: 'button', class: l === settings.onlineLevel ? 'on' : '' }, String(l + 1));
          b.addEventListener('click', () => {
            settings.onlineLevel = l;
            saveSettings();
            audio.sfx('menu');
            render();
            onChange?.();
          });
          return b;
        }),
      );
    };
    render();
    return seg;
  }

  private menu(error?: string): void {
    const games = el('div', { class: 'seg' });
    const renderGames = (): void => {
      games.replaceChildren(
        ...[1, 3, 5, 7].map((n) => {
          const b = el('button', { type: 'button', class: n === this.games ? 'on' : '' }, `Bo${n}`);
          b.addEventListener('click', () => {
            this.games = Math.min(MAX_GAMES, n);
            settings.games = this.games;
            saveSettings();
            audio.sfx('menu');
            renderGames();
          });
          return b;
        }),
      );
    };
    renderGames();
    const code = el('input', { type: 'text', maxLength: 4, placeholder: 'ROOM CODE' });
    this.show('Online Battle', [
      error ? el('p', { class: 'center', style: 'color:#ffb0b8' }, error) : '',
      el('p', { class: 'muted center' }, 'Handicap level (1 = 4 colours, 4–5 start with refugees)'),
      this.levelPicker(),
      button('Quick match', { cls: 'btn-gold btn-xl', icon: ICONS.globe, onClick: () => void this.go({ t: 'quick', level: settings.onlineLevel }) }),
      el('div', { class: 'card dark stack' }, el('h3', { class: 'outline' }, 'Play a friend'), games, button('Create room', { cls: 'btn-blue', onClick: () => void this.go({ t: 'create', level: settings.onlineLevel, games: this.games }) }), el('div', { class: 'row' }, code, button('Join', { cls: 'btn-green', onClick: () => this.join(code.value) }))),
    ]);
    code.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.join(code.value);
    });
  }

  private join(raw: string): void {
    const c = raw.trim().toUpperCase();
    if (c.length !== 4) return toast('Codes have 4 letters');
    void this.go({ t: 'join', code: c, level: settings.onlineLevel });
  }

  private async go(msg: Parameters<typeof net.send>[0]): Promise<void> {
    this.show('Connecting…', [el('p', { class: 'center' }, 'Finding the bean arena…')]);
    try {
      this.listen();
      await net.connect(this.name);
      net.send(msg);
    } catch (e) {
      this.menu((e as Error).message);
    }
  }

  private listen(): void {
    if (this.offMsg) return;
    this.offMsg = net.on((m) => this.onMessage(m));
    this.offClose = net.onClose(() => {
      if (this.battle) this.app.leave();
      this.battle = null;
      this.lobby = null;
      this.menu('Connection lost.');
    });
  }

  private onMessage(m: ServerMessage): void {
    switch (m.t) {
      case 'queued':
        this.show('Searching…', [
          el('div', { class: 'center', style: 'font-size:56px;animation:spin 2s linear infinite;display:inline-block' }, '🫘'),
          el('p', { class: 'center' }, 'Looking for an opponent'),
          button('Cancel', { cls: 'btn-red', onClick: () => this.leave() }),
        ]);
        break;
      case 'lobby':
        this.lobby = { code: m.code, you: m.you, names: m.players.map((p) => p.name) };
        this.games = m.games;
        this.wins = m.wins;
        if (!this.battle) this.showLobby(m);
        break;
      case 'start':
        this.closeUi();
        if (!this.lobby) return;
        this.battle = new OnlineBattle(this.app, this.lobby, m, this.wins, this.games, this.skin, (iWon) => this.matchOver(iWon));
        this.app.play(this.battle);
        break;
      case 'roundOver':
      case 'matchOver':
        this.wins = m.wins;
        break;
      case 'left':
        this.app.leave();
        this.battle = null;
        this.show('Opponent left', [el('p', { class: 'center' }, m.reason), button('OK', { cls: 'btn-blue', onClick: () => this.leave() })]);
        break;
      case 'error':
        this.menu(m.message);
        break;
    }
  }

  private matchOver(iWon: boolean): void {
    const stats = this.battle?.stats ?? { score: 0, maxChain: 0, refugeesSent: 0, popped: 0 };
    const rewards = recordBattle({ won: iWon, ...stats, ranked: false });
    const me = this.lobby?.you ?? 0;
    this.app.leave();
    this.battle = null;
    this.show(iWon ? 'Victory!' : 'Defeat', [
      el('div', { class: `ribbon ${iWon ? 'win' : 'lose'} outline` }, `${this.wins[me]} – ${this.wins[1 - me]}`),
      el('div', { class: 'reward-row' }, el('div', { class: 'reward' }, svg(ICONS.coin), `+${rewards.coins}`), el('div', { class: 'reward' }, svg(ICONS.star), `+${rewards.xp} XP`)),
      button('Rematch', { cls: 'btn-gold', onClick: () => {
        net.send({ t: 'ready' });
        this.show('Rematch', [el('p', { class: 'center' }, 'Waiting for your rival…'), button('Leave', { cls: 'btn-red', onClick: () => this.leave() })]);
      } }),
      button('Leave', { cls: 'btn-red', onClick: () => this.leave() }),
    ], false);
  }

  private showLobby(m: Extract<ServerMessage, { t: 'lobby' }>): void {
    const meP = m.players[m.you];
    const slot = (i: number): HTMLElement => {
      const p = m.players[i]?.connected ? m.players[i] : null;
      return el('div', { class: 'card dark center stack', style: 'padding:10px' }, el('b', { class: 'display', style: 'font-size:20px' }, p ? p.name : 'Waiting…'), el('small', { class: 'muted' }, p ? `Level ${p.level + 1}` : 'Share the code'), el('span', { style: `color:${p?.ready ? '#7ef08a' : '#b8c4f0'}` }, p ? (p.ready ? 'READY!' : 'Not ready') : ''));
    };
    this.show('Room', [
      el('div', { class: 'center display outline', style: 'font-size:52px;letter-spacing:8px;color:#ffe36a' }, m.code),
      el('p', { class: 'muted center' }, `Best of ${m.games} · share this code with a friend`),
      el('div', { class: 'grid2' }, slot(0), slot(1)),
      meP?.ready ? el('p', { class: 'center' }, 'Waiting for your opponent…') : this.levelPicker(() => net.send({ t: 'level', level: settings.onlineLevel })),
      meP?.ready ? '' : button('Ready!', { cls: 'btn-green btn-xl', onClick: () => net.send({ t: 'ready' }) }),
      button('Leave room', { cls: 'btn-red', onClick: () => this.leave() }),
    ]);
  }

  private leave(): void {
    net.send({ t: 'leave' });
    this.app.leave();
    this.battle = null;
    this.lobby = null;
    this.menu();
  }

  private quit(): void {
    this.offMsg?.();
    this.offClose?.();
    this.offMsg = null;
    net.close();
    this.app.leave();
    this.onDone();
  }
}
