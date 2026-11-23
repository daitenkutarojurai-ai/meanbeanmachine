import {
  InputRecorder,
  InputReplay,
  MAX_GAMES,
  PlayerSim,
  type ServerMessage,
  countBeans,
  versusConfigs,
} from '@mbm/engine';
import type { App, Session } from '../app.ts';
import { audio } from '../audio.ts';
import { SOLO_KEYS } from '../input.ts';
import { portrait } from '../render/portraits.ts';
import type { Banner, BoardView, Panel } from '../render/renderer.ts';
import { net } from '../net/client.ts';
import { progress, saveProgress, saveSettings, settings } from '../storage.ts';
import { el, pad, showLayer, showMenu } from '../ui.ts';
import { moodOf, playEventSounds } from './battle.ts';
import { MenuBackdrop } from './backdrop.ts';
import { CAST } from './characters.ts';

const FRAME_MS = 1000 / 60;

interface Lobby {
  code: string;
  you: number;
  names: string[];
}

/** A networked round: own board simulated locally, opponent's board replayed from its inputs. */
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
  private happy = [0, 0];
  private renderFrame = 0;
  private ping = 0;
  private pingTimer: number;
  private off: () => void;
  wins: number[];

  private readonly app: App;
  private readonly lobby: Lobby;
  private readonly msg: Extract<ServerMessage, { t: 'start' }>;
  private readonly games: number;
  private readonly onEnd: (rematch: boolean) => void;

  constructor(
    app: App,
    lobby: Lobby,
    msg: Extract<ServerMessage, { t: 'start' }>,
    wins: number[],
    games: number,
    onEnd: (rematch: boolean) => void,
  ) {
    this.app = app;
    this.lobby = lobby;
    this.msg = msg;
    this.games = games;
    this.onEnd = onEnd;
    this.wins = wins;
    const cfgs = versusConfigs(msg.seed, msg.levels);
    const me = lobby.you;
    this.local = new PlayerSim(cfgs[me]);
    this.local.start();
    this.remote = new InputReplay(cfgs[1 - me]);
    // Your board is always on the left.
    this.views = [
      { sim: this.local, fx: 16, fy: 16, pending: 0, shake: 0 },
      { sim: this.remote.sim, fx: 208, fy: 16, pending: 0, shake: 0 },
    ];
    this.startAt = performance.now() + msg.countdownMs;
    app.renderer.effects.reset();
    audio.music('battle');
    audio.sfx('ready');
    this.off = net.on((m) => this.onMessage(m));
    this.pingTimer = window.setInterval(() => net.send({ t: 'ping', at: performance.now() }), 2000);
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
          if (v.deadAt === undefined) v.deadAt = this.renderFrame;
        }
        audio.sfx(this.winner === 0 ? 'win' : 'lose');
        break;
      }
      case 'matchOver': {
        this.wins = m.wins;
        this.state = 'matchEnd';
        const iWon = m.winner === this.lobby.you;
        if (iWon) progress.wins++;
        else progress.losses++;
        progress.bestChain = Math.max(progress.bestChain, this.local.maxChain);
        saveProgress();
        setTimeout(() => this.matchMenu(iWon), 1500);
        break;
      }
    }
  }

  private matchMenu(iWon: boolean): void {
    if (!this.off) return;
    const menu = showMenu({
      title: iWon ? 'YOU WIN THE MATCH!' : 'YOU LOST THE MATCH',
      subtitle: `${this.wins[this.lobby.you]} - ${this.wins[1 - this.lobby.you]}`,
      items: [
        {
          label: 'REMATCH',
          action: () => {
            menu.close();
            this.onEnd(true);
          },
        },
        {
          label: 'LEAVE',
          action: () => {
            menu.close();
            this.onEnd(false);
          },
        },
      ],
    });
  }

  private flush(): void {
    const b = this.recorder.takeBatch(true);
    if (b) net.send({ t: 'frames', ...b });
  }

  update(now: number): void {
    if (this.state === 'intro' && now >= this.startAt) {
      this.state = 'play';
      audio.sfx('go');
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
    this.app.renderer.effects.handle(1, evs, this.views);
    playEventSounds(evs, false);
    for (const e of evs) if (e.type === 'chainEnd' && e.chain >= 3) this.happy[1] = 90;
  }

  private stepLocal(): void {
    for (const amount of this.incoming.splice(0)) {
      this.local.receiveGarbage(amount);
      this.recorder.ack(amount);
    }
    const input = this.app.input.mask(SOLO_KEYS, 0, this.app.touchEnabled);
    this.local.step(input);
    this.recorder.record(input);
    const evs = this.local.events.splice(0);
    this.app.renderer.effects.handle(0, evs, this.views);
    playEventSounds(evs, true);
    for (const e of evs) {
      if (e.type === 'chainEnd') {
        this.sent += e.garbage;
        if (e.chain >= 3) this.happy[0] = 90;
      }
    }
    if (!this.local.alive && this.views[0].deadAt === undefined) this.views[0].deadAt = this.renderFrame;
  }

  render(): void {
    this.renderFrame++;
    this.bannerTimer++;
    this.happy = this.happy.map((h) => Math.max(0, h - 1));
    const fx = this.app.renderer.effects;
    fx.update(this.views);
    this.views[0].pending = this.local.pending + this.incoming.reduce((a, b) => a + b, 0);
    this.views[1].pending = this.remote.sim.pending + Math.max(0, this.sent - this.remote.ackedTotal);
    if (!this.remote.sim.alive && this.views[1].deadAt === undefined) this.views[1].deadAt = this.renderFrame;
    audio.music(countBeans(this.local.field) >= 54 ? 'danger' : 'battle');

    const me = this.lobby.you;
    const names = [this.lobby.names[me] ?? 'YOU', this.lobby.names[1 - me] ?? 'RIVAL'];
    const panels: Panel[] = [0, 1].map((i) => {
      const step = fx.stepText[i];
      const sim = i === 0 ? this.local : this.remote.sim;
      return { label: names[i].slice(0, 10), value: step && step.life > 0 ? step.text : pad(sim.score), color: i === 0 ? '#80c0ff' : '#ff9090' };
    });
    const banners: Banner[] = [];
    if (this.state === 'intro') {
      const left = Math.ceil((this.startAt - performance.now()) / 1000);
      banners.push({ text: left > 0 ? String(left) : 'GO!', sub: this.msg.round > 0 ? `ROUND ${this.msg.round + 1}` : 'READY' });
    } else if (this.state === 'roundEnd' || this.state === 'matchEnd') {
      if (this.winner < 0) banners.push({ text: 'DRAW' });
      else {
        banners.push({ text: this.winner === 0 ? 'WIN!' : 'LOSE', board: 0, color: this.winner === 0 ? '#60ff80' : '#ff6070' });
        banners.push({ text: this.winner === 1 ? 'WIN!' : 'LOSE', board: 1, color: this.winner === 1 ? '#60ff80' : '#ff6070' });
      }
    }
    const rivalFace = CAST[(this.lobby.code.charCodeAt(0) + this.lobby.code.charCodeAt(1)) % CAST.length];
    this.app.renderer.draw({
      layout: 'versus',
      boards: this.views,
      frame: this.renderFrame,
      bg: rivalFace.stage,
      portrait: portrait(rivalFace, moodOf(this.remote.sim, this.local, this.happy[1])),
      panels,
      info: [`WINS ${this.wins[me]}-${this.wins[1 - me]}`, `FIRST TO ${Math.floor(this.games / 2) + 1}`, net.reconnecting ? 'RECONNECTING...' : this.ping ? `PING ${this.ping}MS` : ''],
      banners,
      dim: this.state === 'matchEnd',
    });
  }

  dispose(): void {
    this.off();
    this.off = null as unknown as () => void;
    clearInterval(this.pingTimer);
  }
}

/** Lobby and matchmaking screens around online rounds. */
export class OnlineFlow {
  private lobby: Lobby | null = null;
  private games = settings.games;
  private wins = [0, 0];
  private ui: { close(): void } | null = null;
  private offMsg: (() => void) | null = null;
  private offClose: (() => void) | null = null;
  private battle: OnlineBattle | null = null;

  private readonly app: App;
  private readonly onQuit: () => void;

  constructor(app: App, onQuit: () => void) {
    this.app = app;
    this.onQuit = onQuit;
    this.menu();
  }

  private closeUi(): void {
    this.ui?.close();
    this.ui = null;
  }

  private menu(error?: string): void {
    this.closeUi();
    const name = el('input', { type: 'text', maxLength: 10, value: settings.name, placeholder: 'NAME' });
    const items = [
      {
        label: 'LEVEL',
        value: () => String(settings.onlineLevel + 1),
        change: (d: -1 | 1) => {
          settings.onlineLevel = (settings.onlineLevel + d + 5) % 5;
          saveSettings();
        },
      },
      { label: 'QUICK MATCH', action: () => this.go(name.value, { t: 'quick', level: settings.onlineLevel }) },
      {
        label: 'GAMES',
        value: () => `BEST OF ${this.games}`,
        change: (d: -1 | 1) => {
          this.games = Math.min(MAX_GAMES, Math.max(1, this.games + d * 2));
          settings.games = this.games;
          saveSettings();
        },
      },
      { label: 'CREATE ROOM', action: () => this.go(name.value, { t: 'create', level: settings.onlineLevel, games: this.games }) },
      { label: 'JOIN ROOM', action: () => this.joinPrompt(name.value) },
      { label: 'BACK', action: () => this.quit() },
    ];
    this.ui = showMenu({
      title: 'ONLINE BATTLE',
      before: [el('div', { class: 'row' }, el('span', {}, 'NAME'), name), error ? el('p', { class: 'bad' }, error) : el('span')],
      items,
      onBack: () => this.quit(),
      footer: 'LEVEL 1: 4 COLOURS · LEVEL 4-5 START WITH REFUGEES',
      focus: 1,
    });
  }

  private joinPrompt(name: string): void {
    this.closeUi();
    const code = el('input', { type: 'text', maxLength: 4, placeholder: 'CODE' });
    const go = (): void => {
      const c = code.value.trim().toUpperCase();
      if (c.length === 4) this.go(name, { t: 'join', code: c, level: settings.onlineLevel });
    };
    this.ui = showLayer(
      [el('div', { class: 'panel' }, el('h2', {}, 'JOIN ROOM'), el('br'), code, el('br'), el('br'), el('button', { class: 'btn', type: 'button', onclick: go }, 'JOIN ▶'), el('p', { class: 'hint' }, 'ENTER THE 4-LETTER ROOM CODE'))],
      { onBack: () => this.menu(), onConfirm: go },
    );
    code.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    setTimeout(() => code.focus(), 30);
  }

  private async go(name: string, msg: Parameters<typeof net.send>[0]): Promise<void> {
    settings.name = name.trim().slice(0, 10).toUpperCase() || 'BEAN';
    saveSettings();
    this.closeUi();
    this.ui = showLayer([el('div', { class: 'panel' }, el('p', {}, 'CONNECTING...'))]);
    try {
      this.listen();
      await net.connect(settings.name);
      net.send(msg);
    } catch (e) {
      this.menu((e as Error).message.toUpperCase());
    }
  }

  private listen(): void {
    if (this.offMsg) return;
    this.offMsg = net.on((m) => this.onMessage(m));
    this.offClose = net.onClose(() => {
      if (this.battle) this.app.setSession(new MenuBackdrop(this.app));
      this.battle = null;
      this.lobby = null;
      this.menu('CONNECTION LOST');
    });
  }

  private onMessage(m: ServerMessage): void {
    switch (m.t) {
      case 'queued':
        this.closeUi();
        this.ui = showLayer(
          [el('div', { class: 'panel' }, el('h2', {}, 'SEARCHING...'), el('br'), el('p', { class: 'muted' }, 'LOOKING FOR AN OPPONENT'), el('p', { class: 'hint' }, 'ESC TO CANCEL'))],
          { onBack: () => this.leave() },
        );
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
        this.battle = new OnlineBattle(this.app, this.lobby, m, this.wins, this.games, (rematch) => {
          if (rematch) {
            net.send({ t: 'ready' });
            this.app.setSession(new MenuBackdrop(this.app));
            this.battle = null;
            this.ui = showLayer([el('div', { class: 'panel' }, el('p', {}, 'WAITING FOR REMATCH...'), el('p', { class: 'hint' }, 'ESC TO LEAVE'))], {
              onBack: () => this.leave(),
            });
          } else this.leave();
        });
        this.app.setSession(this.battle);
        break;
      case 'roundOver':
      case 'matchOver':
        this.wins = m.wins;
        break;
      case 'left':
        this.app.setSession(new MenuBackdrop(this.app));
        this.battle = null;
        this.closeUi();
        this.ui = showMenu({
          title: 'OPPONENT LEFT',
          subtitle: m.reason.toUpperCase(),
          items: [{ label: 'OK', action: () => this.leave() }],
          onBack: () => this.leave(),
        });
        break;
      case 'error':
        this.menu(m.message.toUpperCase());
        break;
    }
  }

  private showLobby(m: Extract<ServerMessage, { t: 'lobby' }>): void {
    this.closeUi();
    const me = m.players[m.you];
    const slot = (i: number): HTMLElement => {
      const p = m.players[i]?.connected ? m.players[i] : null;
      return el(
        'div',
        {},
        el('p', { class: i === m.you ? 'ok' : '' }, p ? p.name : '---'),
        el('p', { class: 'muted' }, p ? `LEVEL ${p.level + 1}` : 'WAITING'),
        el('p', { class: p?.ready ? 'ok' : 'muted' }, p ? (p.ready ? 'READY!' : 'NOT READY') : ''),
      );
    };
    this.ui = showMenu({
      title: 'ROOM',
      before: [el('p', { class: 'code' }, m.code), el('p', { class: 'hint' }, 'SHARE THIS CODE WITH A FRIEND'), el('div', { class: 'players' }, slot(0), slot(1)), el('p', { class: 'muted' }, `BEST OF ${m.games}`)],
      items: [
        {
          label: me?.ready ? 'WAITING...' : 'READY',
          disabled: me?.ready,
          action: () => net.send({ t: 'ready' }),
        },
        {
          label: 'LEVEL',
          value: () => String(settings.onlineLevel + 1),
          change: (d) => {
            settings.onlineLevel = (settings.onlineLevel + d + 5) % 5;
            saveSettings();
            net.send({ t: 'level', level: settings.onlineLevel });
          },
          disabled: me?.ready,
        },
        { label: 'LEAVE', action: () => this.leave() },
      ],
      onBack: () => this.leave(),
    });
  }

  private leave(): void {
    net.send({ t: 'leave' });
    this.app.setSession(new MenuBackdrop(this.app));
    this.battle = null;
    this.lobby = null;
    this.menu();
  }

  private quit(): void {
    this.closeUi();
    this.offMsg?.();
    this.offClose?.();
    this.offMsg = null;
    net.close();
    this.onQuit();
  }
}

