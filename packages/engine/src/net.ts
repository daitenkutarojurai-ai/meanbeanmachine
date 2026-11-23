// Online play. Each client runs its own board locally from its own inputs, and streams
// those inputs. The server replays both boards with this same engine, so it is the judge
// of refugee amounts and of who topped out first. Opponents' boards are replays too.

import { type PlayerConfig, PlayerSim, type SimEvent } from './player.ts';

export const PROTOCOL_VERSION = 2;
/** How long a dropped connection keeps its seat before the opponent is told. */
export const RESUME_GRACE_MS = 15_000;
export const BATCH_FRAMES = 3;
export const MAX_GAMES = 15;

/** Refugees credited to a board just before it simulates `frame`. */
export interface GarbageAck {
  frame: number;
  amount: number;
}

export interface FrameBatch {
  from: number;
  inputs: number[];
  acks: GarbageAck[];
}

export interface LobbyPlayer {
  name: string;
  level: number;
  ready: boolean;
  connected: boolean;
}

export type ClientMessage =
  | { t: 'hello'; name: string; v: number }
  /** Reattach to a session after the socket dropped; `lastSeq` is the last server message seen. */
  | { t: 'resume'; id: string; token: string; lastSeq: number; v: number }
  | { t: 'quick'; level: number }
  | { t: 'create'; level: number; games: number }
  | { t: 'join'; code: string; level: number }
  | { t: 'level'; level: number }
  | { t: 'ready' }
  | ({ t: 'frames' } & FrameBatch)
  | { t: 'leave' }
  | { t: 'ping'; at: number };

export type RoundReason = 'topout' | 'forfeit' | 'desync' | 'timeout';

export type ServerMessage =
  | { t: 'welcome'; id: string; token: string; instance: string }
  /** `framesReceived`: where the server's copy of your input log ends, so you can resend the rest. */
  | { t: 'resumed'; framesReceived: number | null }
  | { t: 'resumeFailed' }
  | { t: 'queued' }
  | { t: 'lobby'; code: string; you: number; players: LobbyPlayer[]; games: number; wins: number[] }
  | { t: 'start'; seed: number; levels: number[]; round: number; countdownMs: number }
  | ({ t: 'frames' } & FrameBatch)
  | { t: 'garbage'; amount: number }
  | { t: 'roundOver'; winner: number; wins: number[]; reason: RoundReason }
  | { t: 'matchOver'; winner: number; wins: number[] }
  | { t: 'left'; reason: string }
  | { t: 'error'; message: string }
  | { t: 'pong'; at: number };

/** Every server message after `welcome` carries a sequence number so a resumed client can skip repeats. */
export type Sequenced<T> = T & { seq?: number };

/** Games needed to take a best-of-N match. */
export const gamesToWin = (games: number): number => Math.floor(games / 2) + 1;

/** Rebuilds a board from a streamed input log. */
export class InputReplay {
  readonly sim: PlayerSim;
  private readonly inputs: number[] = [];
  private readonly acks = new Map<number, number>();
  private simulated = 0;
  ackedTotal = 0;

  constructor(cfg: PlayerConfig) {
    this.sim = new PlayerSim(cfg);
    this.sim.start();
  }

  /** Frames received so far (the next expected `from`). */
  get received(): number {
    return this.inputs.length;
  }

  get frame(): number {
    return this.simulated;
  }

  /** Appends a batch. Frames already received (a resend after reconnecting) are skipped. */
  push(batch: FrameBatch): boolean {
    if (batch.from > this.inputs.length) return false;
    if (batch.from < this.inputs.length) {
      const skip = this.inputs.length - batch.from;
      if (skip >= batch.inputs.length) return true;
      batch = {
        from: this.inputs.length,
        inputs: batch.inputs.slice(skip),
        acks: batch.acks.filter((a) => a.frame >= this.inputs.length),
      };
    }
    for (const a of batch.acks) {
      if (a.frame < batch.from || a.frame >= batch.from + batch.inputs.length || a.amount <= 0) return false;
    }
    for (const v of batch.inputs) this.inputs.push(v & 0x3f);
    for (const a of batch.acks) {
      this.acks.set(a.frame, (this.acks.get(a.frame) ?? 0) + a.amount);
      this.ackedTotal += a.amount;
    }
    return true;
  }

  /** Simulates every frame received so far; returns the events produced. */
  advance(): SimEvent[] {
    while (this.simulated < this.inputs.length) {
      const f = this.simulated;
      const ack = this.acks.get(f);
      if (ack) {
        this.sim.receiveGarbage(ack);
        this.acks.delete(f);
      }
      this.sim.step(this.inputs[f]);
      this.simulated++;
      if (!this.sim.alive) break;
    }
    return this.sim.events.splice(0);
  }
}

/** Records the local board's inputs and refugee credits, and slices them into batches. */
export class InputRecorder {
  private inputs: number[] = [];
  private acks: GarbageAck[] = [];
  private sentUpTo = 0;
  frame = 0;

  record(input: number): void {
    this.inputs.push(input);
    this.frame++;
  }

  /** Call before simulating the current frame. */
  ack(amount: number): void {
    this.acks.push({ frame: this.frame, amount });
  }

  takeBatch(force = false): FrameBatch | null {
    const pending = this.inputs.length - this.sentUpTo;
    if (pending <= 0 || (!force && pending < BATCH_FRAMES)) return null;
    const from = this.sentUpTo;
    const to = this.inputs.length;
    const inputs = this.inputs.slice(from);
    // Credits that apply before the next unsimulated frame wait for that frame's input.
    const acks = this.acks.filter((a) => a.frame >= from && a.frame < to);
    this.sentUpTo = to;
    return { from, inputs, acks };
  }

  /** After a reconnect: send everything again from the frame the server has. */
  resendFrom(frame: number): void {
    this.sentUpTo = Math.max(0, Math.min(frame, this.inputs.length));
  }
}
