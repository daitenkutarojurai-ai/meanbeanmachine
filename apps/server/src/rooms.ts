import {
  type ClientMessage,
  type FrameBatch,
  InputReplay,
  type LobbyPlayer,
  MAX_GAMES,
  type RoundReason,
  type ServerMessage,
  gamesToWin,
  randomSeed,
  versusConfigs,
} from '@mbm/engine';

export const COUNTDOWN_MS = 3000;
export const BETWEEN_ROUNDS_MS = 3500;
const FRAME_MS = 1000 / 60;
/** How far ahead of the wall clock a client may report frames (clock drift, catch-up bursts). */
const AHEAD_TOLERANCE = 180;
/** How far behind before we call it a disconnect. */
const BEHIND_LIMIT_MS = 20_000;
/** Frames a client may keep playing after refugees were sent before it must credit them. */
const ACK_DEADLINE = 600;
/** After one board tops out, how long to wait for the other to catch up. */
const DEATH_GRACE_MS = 3000;
const MAX_BATCH = 600;

export interface Peer {
  id: string;
  name: string;
  level: number;
  room: Room | null;
  /** Was searching for a quick match when its connection dropped. */
  wasQueued?: boolean;
  send(msg: ServerMessage): void;
}

interface Seat {
  peer: Peer;
  ready: boolean;
  replay: InputReplay | null;
  /** Refugees the server has told this player about, and when (in their frames). */
  owed: { total: number; atFrame: number }[];
  sentToMe: number;
  deathFrame: number | null;
  diedAt: number;
}

type RoomState = 'lobby' | 'playing' | 'between' | 'over';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export class Lobby {
  readonly rooms = new Map<string, Room>();
  private queue: Peer[] = [];
  private timer: NodeJS.Timeout;
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
    this.timer = setInterval(() => {
      for (const r of this.rooms.values()) r.tick();
    }, 250);
    this.timer.unref?.();
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private code(): string {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  handle(peer: Peer, msg: ClientMessage): void {
    switch (msg.t) {
      case 'quick': {
        this.leave(peer);
        peer.level = clampLevel(msg.level);
        const other = this.queue.shift();
        if (other) {
          const room = this.createRoom(3);
          room.add(other);
          room.add(peer);
          room.autoStart();
        } else {
          this.queue.push(peer);
          peer.send({ t: 'queued' });
        }
        return;
      }
      case 'create': {
        this.leave(peer);
        peer.level = clampLevel(msg.level);
        const games = Math.min(MAX_GAMES, Math.max(1, Math.floor(msg.games) | 1));
        this.createRoom(games).add(peer);
        return;
      }
      case 'join': {
        const room = this.rooms.get(String(msg.code).toUpperCase());
        if (!room) {
          peer.send({ t: 'error', message: 'No room with that code.' });
          return;
        }
        if (room.full) {
          peer.send({ t: 'error', message: 'That room is full.' });
          return;
        }
        this.leave(peer);
        peer.level = clampLevel(msg.level);
        room.add(peer);
        return;
      }
      case 'leave':
        this.leave(peer);
        return;
      case 'ping':
        peer.send({ t: 'pong', at: msg.at });
        return;
      default:
        peer.room?.handle(peer, msg);
    }
  }

  private createRoom(games: number): Room {
    const room = new Room(this.code(), games, this.now, (r) => this.rooms.delete(r.code));
    this.rooms.set(room.code, room);
    return room;
  }

  leave(peer: Peer): void {
    this.queue = this.queue.filter((p) => p !== peer);
    peer.room?.remove(peer, 'left the room');
  }

  /** A dropped connection can't play: keep it out of matchmaking until it comes back. */
  offline(peer: Peer): void {
    const before = this.queue.length;
    this.queue = this.queue.filter((p) => p !== peer);
    if (this.queue.length < before) peer.wasQueued = true;
  }

  /** Back from a dropped connection: carry on searching if it was. */
  online(peer: Peer): void {
    if (!peer.wasQueued) return;
    peer.wasQueued = false;
    this.handle(peer, { t: 'quick', level: peer.level });
  }

  /** Frames of the current round the server holds for this player, for resends. */
  framesReceived(peer: Peer): number | null {
    return peer.room?.framesReceived(peer) ?? null;
  }
}

export class Room {
  private seats: (Seat | null)[] = [null, null];
  private state: RoomState = 'lobby';
  private wins = [0, 0];
  private round = 0;
  private roundStart = 0;
  private nextRoundAt = 0;
  readonly code: string;
  readonly games: number;
  private readonly now: () => number;
  private readonly onEmpty: (r: Room) => void;

  constructor(code: string, games: number, now: () => number, onEmpty: (r: Room) => void) {
    this.code = code;
    this.games = games;
    this.now = now;
    this.onEmpty = onEmpty;
  }

  framesReceived(peer: Peer): number | null {
    const seat = this.seats.find((s) => s?.peer === peer);
    return this.state === 'playing' && seat?.replay ? seat.replay.received : null;
  }

  get full(): boolean {
    return this.seats.every(Boolean);
  }

  add(peer: Peer): void {
    const i = this.seats.findIndex((s) => !s);
    if (i < 0) return;
    peer.room = this;
    this.seats[i] = { peer, ready: false, replay: null, owed: [], sentToMe: 0, deathFrame: null, diedAt: 0 };
    if (this.state !== 'lobby') {
      this.state = 'lobby';
      this.wins = [0, 0];
    }
    this.broadcastLobby();
  }

  /** Quick match: both players start as soon as they meet. */
  autoStart(): void {
    for (const s of this.seats) if (s) s.ready = true;
    this.broadcastLobby();
    this.startMatch();
  }

  remove(peer: Peer, reason: string): void {
    const i = this.seats.findIndex((s) => s?.peer === peer);
    if (i < 0) return;
    this.seats[i] = null;
    peer.room = null;
    const other = this.seats[1 - i];
    if (!other) {
      this.onEmpty(this);
      return;
    }
    if (this.state === 'playing' || this.state === 'between') other.peer.send({ t: 'left', reason: `${peer.name} ${reason}` });
    this.state = 'lobby';
    this.wins = [0, 0];
    other.ready = false;
    other.replay = null;
    this.broadcastLobby();
  }

  handle(peer: Peer, msg: ClientMessage): void {
    const i = this.seats.findIndex((s) => s?.peer === peer);
    const seat = this.seats[i];
    if (!seat) return;
    switch (msg.t) {
      case 'level':
        if (this.state === 'playing' || seat.ready) return;
        peer.level = clampLevel(msg.level);
        this.broadcastLobby();
        return;
      case 'ready':
        if (this.state === 'playing' || this.state === 'between') return;
        seat.ready = true;
        this.broadcastLobby();
        if (this.full && this.seats.every((s) => s!.ready)) this.startMatch();
        return;
      case 'frames':
        this.frames(i, msg);
        return;
    }
  }

  private broadcastLobby(): void {
    const players: LobbyPlayer[] = this.seats.map((s) =>
      s
        ? { name: s.peer.name, level: s.peer.level, ready: s.ready, connected: true }
        : { name: '', level: 0, ready: false, connected: false },
    );
    this.seats.forEach((s, i) => {
      s?.peer.send({ t: 'lobby', code: this.code, you: i, players, games: this.games, wins: this.wins });
    });
  }

  private startMatch(): void {
    this.wins = [0, 0];
    this.round = 0;
    this.startRound();
  }

  private startRound(): void {
    const seed = randomSeed();
    const levels = this.seats.map((s) => s!.peer.level);
    const cfgs = versusConfigs(seed, levels);
    this.seats.forEach((s, i) => {
      s!.replay = new InputReplay(cfgs[i]);
      s!.owed = [];
      s!.sentToMe = 0;
      s!.deathFrame = null;
      s!.diedAt = 0;
    });
    this.state = 'playing';
    this.roundStart = this.now() + COUNTDOWN_MS;
    for (const s of this.seats) s!.peer.send({ t: 'start', seed, levels, round: this.round, countdownMs: COUNTDOWN_MS });
  }

  private frames(i: number, batch: FrameBatch): void {
    if (this.state !== 'playing') return;
    const me = this.seats[i]!;
    const other = this.seats[1 - i]!;
    const replay = me.replay!;
    if (!Array.isArray(batch.inputs) || !Array.isArray(batch.acks) || batch.inputs.length > MAX_BATCH) return this.forfeit(i, 'desync');
    const allowed = (this.now() - this.roundStart) / FRAME_MS + AHEAD_TOLERANCE;
    if (batch.from + batch.inputs.length > allowed) return this.forfeit(i, 'desync');
    if (!replay.push(batch)) return this.forfeit(i, 'desync');
    if (replay.ackedTotal > me.sentToMe) return this.forfeit(i, 'desync');

    const events = replay.advance();
    for (const e of events) {
      if (e.type === 'chainEnd' && e.garbage > 0 && other.replay) {
        other.sentToMe += e.garbage;
        other.owed.push({ total: other.sentToMe, atFrame: other.replay.received });
        other.peer.send({ t: 'garbage', amount: e.garbage });
      }
    }
    // Refugees must be credited within the deadline; ignoring them is cheating.
    while (me.owed.length && replay.ackedTotal >= me.owed[0].total) me.owed.shift();
    if (me.owed.length && replay.received > me.owed[0].atFrame + ACK_DEADLINE) return this.forfeit(i, 'desync');

    if (!replay.sim.alive && me.deathFrame === null) {
      me.deathFrame = replay.frame;
      me.diedAt = this.now();
    }
    other.peer.send({ t: 'frames', from: batch.from, inputs: batch.inputs, acks: batch.acks });
    this.resolve();
  }

  /** Decides a round once the order of top-outs is known. */
  private resolve(): void {
    if (this.state !== 'playing') return;
    const [a, b] = this.seats as Seat[];
    const da = a.deathFrame;
    const db = b.deathFrame;
    if (da === null && db === null) return;
    if (da !== null && db !== null) {
      if (da === db) this.endRound(-1, 'topout');
      else this.endRound(da < db ? 1 : 0, 'topout');
      return;
    }
    const dead = da !== null ? 0 : 1;
    const deadSeat = this.seats[dead]!;
    const living = this.seats[1 - dead]!;
    if (living.replay!.frame > deadSeat.deathFrame! || this.now() - deadSeat.diedAt > DEATH_GRACE_MS) {
      this.endRound(1 - dead, 'topout');
    }
  }

  private forfeit(i: number, reason: RoundReason): void {
    this.endRound(1 - i, reason);
  }

  private endRound(winner: number, reason: RoundReason): void {
    if (this.state !== 'playing') return;
    if (winner >= 0) this.wins[winner]++;
    const need = gamesToWin(this.games);
    for (const s of this.seats) s?.peer.send({ t: 'roundOver', winner, wins: this.wins, reason });
    if (winner >= 0 && this.wins[winner] >= need) {
      this.state = 'over';
      for (const s of this.seats) {
        if (!s) continue;
        s.ready = false;
        s.peer.send({ t: 'matchOver', winner, wins: this.wins });
      }
    } else {
      this.state = 'between';
      this.round++;
      this.nextRoundAt = this.now() + BETWEEN_ROUNDS_MS;
    }
  }

  tick(): void {
    const t = this.now();
    if (this.state === 'between' && t >= this.nextRoundAt && this.full) this.startRound();
    if (this.state !== 'playing') return;
    this.resolve();
    if (this.state !== 'playing') return;
    // A client that stops sending frames has dropped.
    const expected = (t - this.roundStart) / FRAME_MS;
    this.seats.forEach((s, i) => {
      if (this.state !== 'playing' || !s?.replay) return;
      if (s.replay.received < expected - BEHIND_LIMIT_MS / FRAME_MS && s.deathFrame === null) this.forfeit(i, 'timeout');
    });
  }
}

export function sanitizeName(raw: unknown): string {
  const s = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .!?-]/g, '')
    .trim()
    .slice(0, 10);
  return s || 'BEAN';
}

const clampLevel = (n: unknown): number => Math.min(4, Math.max(0, Math.floor(Number(n)) || 0));
