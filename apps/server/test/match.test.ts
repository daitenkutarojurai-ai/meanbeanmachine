import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AI_PRESETS,
  AiController,
  type ClientMessage,
  InputRecorder,
  InputReplay,
  PlayerSim,
  type ServerMessage,
  versusConfigs,
} from '@mbm/engine';
import { Lobby, type Peer } from '../src/rooms.ts';

const FRAME_MS = 1000 / 60;
const LATENCY_TICKS = 4;

/** A scripted client: plays with an AI and speaks the real protocol through a laggy pipe. */
class BotClient {
  peer: Peer;
  inbox: { at: number; msg: ServerMessage }[] = [];
  outbox: { at: number; msg: ClientMessage }[] = [];
  local: PlayerSim | null = null;
  remote: InputReplay | null = null;
  recorder = new InputRecorder();
  ai: AiController;
  startAt = 0;
  incoming: number[] = [];
  you = 0;
  log: ServerMessage[] = [];
  private clock: { tick: number };

  constructor(id: string, preset: keyof typeof AI_PRESETS, clock: { tick: number }) {
    this.clock = clock;
    this.ai = new AiController(AI_PRESETS[preset], id.length * 7);
    this.peer = { id, name: id, level: 2, room: null, send: (msg) => this.inbox.push({ at: clock.tick + LATENCY_TICKS, msg }) };
  }

  send(msg: ClientMessage): void {
    this.outbox.push({ at: this.clock.tick + LATENCY_TICKS, msg });
  }

  receive(msg: ServerMessage): void {
    this.log.push(msg);
    if (msg.t === 'lobby') this.you = msg.you;
    if (msg.t === 'start') {
      const cfgs = versusConfigs(msg.seed, msg.levels);
      this.local = new PlayerSim(cfgs[this.you]);
      this.local.start();
      this.remote = new InputReplay(cfgs[1 - this.you]);
      this.recorder = new InputRecorder();
      this.startAt = this.clock.tick + msg.countdownMs / FRAME_MS;
      this.incoming = [];
    }
    if (msg.t === 'garbage') this.incoming.push(msg.amount);
    if (msg.t === 'frames') this.remote?.push(msg);
    if (msg.t === 'roundOver' || msg.t === 'matchOver') this.local = null;
  }

  step(): void {
    if (!this.local || this.clock.tick < this.startAt) return;
    for (const a of this.incoming.splice(0)) {
      this.local.receiveGarbage(a);
      this.recorder.ack(a);
    }
    const input = this.ai.input(this.local);
    this.local.step(input);
    this.recorder.record(input);
    this.local.events.length = 0;
    const b = this.recorder.takeBatch();
    if (b) this.send({ t: 'frames', ...b });
    this.remote?.advance();
  }
}

test('two clients play a full best-of-3 match through the server', () => {
  const clock = { tick: 0 };
  const lobby = new Lobby(() => clock.tick * FRAME_MS);
  lobby.stop();
  const a = new BotClient('ALPHA', 'expert', clock);
  const b = new BotClient('BRAVO', 'rookie', clock);
  a.send({ t: 'create', level: 2, games: 3 });

  let joined = false;
  let over: Extract<ServerMessage, { t: 'matchOver' }> | null = null;
  for (; clock.tick < 60 * 60 * 30 && !over; clock.tick++) {
    for (const c of [a, b]) {
      while (c.outbox.length && c.outbox[0].at <= clock.tick) lobby.handle(c.peer, c.outbox.shift()!.msg);
      while (c.inbox.length && c.inbox[0].at <= clock.tick) {
        const m = c.inbox.shift()!.msg;
        c.receive(m);
        if (m.t === 'matchOver') over = m;
      }
    }
    if (!joined) {
      const lobbyMsg = a.log.find((m) => m.t === 'lobby');
      if (lobbyMsg && lobbyMsg.t === 'lobby') {
        b.send({ t: 'join', code: lobbyMsg.code, level: 2 });
        a.send({ t: 'ready' });
        b.send({ t: 'ready' });
        joined = true;
      }
    }
    a.step();
    b.step();
    if (clock.tick % 15 === 0) for (const r of lobby.rooms.values()) r.tick();
  }

  assert.ok(over, 'match should finish');
  assert.equal(over.winner, 0, 'the expert AI should beat the rookie');
  assert.equal(over.wins[0], 2);
  const rounds = a.log.filter((m) => m.t === 'roundOver');
  assert.ok(rounds.every((m) => m.t === 'roundOver' && m.reason === 'topout'), `rounds ended by top-out, got ${JSON.stringify(rounds)}`);
  assert.ok(b.log.some((m) => m.t === 'garbage'), 'refugees were sent');
});

test('a client that ignores refugees forfeits', () => {
  const clock = { tick: 0 };
  const lobby = new Lobby(() => clock.tick * FRAME_MS);
  lobby.stop();
  const msgs: ServerMessage[] = [];
  const cheat: Peer = { id: 'c', name: 'CHEAT', level: 0, room: null, send: (m) => msgs.push(m) };
  const honest: Peer = { id: 'h', name: 'HONEST', level: 0, room: null, send: () => {} };
  lobby.handle(cheat, { t: 'quick', level: 0 });
  lobby.handle(honest, { t: 'quick', level: 0 });
  const room = [...lobby.rooms.values()][0];
  // Pretend the server owes the cheater refugees, then let it play on without crediting them.
  const seat = (room as unknown as { seats: { sentToMe: number; owed: { total: number; atFrame: number }[] }[] }).seats[0];
  seat.sentToMe = 6;
  seat.owed.push({ total: 6, atFrame: 0 });
  clock.tick = 60 * 60;
  let from = 0;
  for (let k = 0; k < 220 && !msgs.some((m) => m.t === 'roundOver'); k++) {
    lobby.handle(cheat, { t: 'frames', from, inputs: [0, 0, 0], acks: [] });
    from += 3;
  }
  const end = msgs.find((m) => m.t === 'roundOver');
  assert.ok(end && end.t === 'roundOver');
  assert.equal(end.reason, 'desync');
  assert.equal(end.winner, 1);
});
