import { randomUUID } from 'node:crypto';
import { type ClientMessage, PROTOCOL_VERSION, RESUME_GRACE_MS, type ServerMessage } from '@mbm/engine';
import { type Lobby, type Peer, sanitizeName } from './rooms.ts';

/** The parts of a WebSocket the session layer uses. */
export interface Socket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
}

const OPEN = 1;
/** About three minutes of a busy match; a resume only needs the last few seconds. */
const LOG_LIMIT = 4000;

/** Identifies this server process, so tests can tell which instance a client reached. */
export const INSTANCE = randomUUID().slice(0, 8);

interface Session {
  peer: Peer;
  token: string;
  seq: number;
  log: { seq: number; data: string }[];
  socket: Socket | null;
  grace: ReturnType<typeof setTimeout> | null;
}

/**
 * Keeps a player's seat when their connection drops (hosts cap connection length, phones
 * switch networks). Every message to a player is numbered and kept briefly, so a client
 * that resumes gets exactly what it missed.
 */
export class Sessions {
  private readonly byId = new Map<string, Session>();
  private readonly lobby: Lobby;

  constructor(lobby: Lobby) {
    this.lobby = lobby;
  }

  get size(): number {
    return this.byId.size;
  }

  connect(socket: Socket): { message(raw: string): void; close(): void } {
    let session: Session | null = null;
    let budget = 120;
    let last = Date.now();
    return {
      message: (raw) => {
        const now = Date.now();
        budget = Math.min(240, budget + ((now - last) / 1000) * 60);
        last = now;
        if (--budget < 0) return;
        let msg: ClientMessage;
        try {
          msg = JSON.parse(raw) as ClientMessage;
        } catch {
          return;
        }
        if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
        if (!session) {
          session = this.open(socket, msg);
          return;
        }
        if (session.socket !== socket || msg.t === 'hello' || msg.t === 'resume') return;
        this.lobby.handle(session.peer, msg);
      },
      close: () => {
        const s = session;
        if (!s || s.socket !== socket) return;
        s.socket = null;
        s.grace = setTimeout(() => this.drop(s), RESUME_GRACE_MS);
      },
    };
  }

  private open(socket: Socket, msg: ClientMessage): Session | null {
    const reply = (m: ServerMessage): void => socket.send(JSON.stringify(m));
    if (msg.t === 'hello') {
      if (msg.v !== PROTOCOL_VERSION) {
        reply({ t: 'error', message: 'Please refresh: the game was updated.' });
        return null;
      }
      const s: Session = { peer: null as unknown as Peer, token: randomUUID(), seq: 0, log: [], socket, grace: null };
      s.peer = { id: randomUUID(), name: sanitizeName(msg.name), level: 1, room: null, send: (m) => this.push(s, m) };
      this.byId.set(s.peer.id, s);
      reply({ t: 'welcome', id: s.peer.id, token: s.token, instance: INSTANCE });
      return s;
    }
    if (msg.t === 'resume') {
      const s = this.byId.get(String(msg.id));
      if (!s || s.token !== msg.token || msg.v !== PROTOCOL_VERSION) {
        reply({ t: 'resumeFailed' });
        socket.close(4001, 'unknown session');
        return null;
      }
      if (s.grace) clearTimeout(s.grace);
      s.grace = null;
      if (s.socket && s.socket !== socket && s.socket.readyState === OPEN) s.socket.close(4000, 'replaced');
      s.socket = socket;
      reply({ t: 'resumed', framesReceived: this.lobby.framesReceived(s.peer) });
      const lastSeq = Number(msg.lastSeq) || 0;
      for (const e of s.log) if (e.seq > lastSeq) socket.send(e.data);
      return s;
    }
    return null;
  }

  private push(s: Session, msg: ServerMessage): void {
    s.seq++;
    const data = JSON.stringify({ ...msg, seq: s.seq });
    s.log.push({ seq: s.seq, data });
    if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
    if (s.socket && s.socket.readyState === OPEN) s.socket.send(data);
  }

  private drop(s: Session): void {
    this.lobby.leave(s.peer);
    this.byId.delete(s.peer.id);
  }
}
