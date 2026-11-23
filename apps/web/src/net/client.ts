import { type ClientMessage, PROTOCOL_VERSION, RESUME_GRACE_MS, type Sequenced, type ServerMessage } from '@mbm/engine';

/** Server address: ?server=wss://host/ws, then VITE_SERVER_URL, then this site's /ws. */
export function serverUrl(): string {
  const param = new URLSearchParams(location.search).get('server');
  if (param) return param;
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
}

const CONNECT_TIMEOUT_MS = 8000;

/**
 * One connection to the game server that survives drops: when the socket closes
 * unexpectedly it reconnects and resumes the same session, and the server replays
 * whatever was missed. Listeners only hear `onClose` once resuming has failed.
 */
export class NetClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(m: ServerMessage) => void>();
  private closeListeners = new Set<() => void>();
  private session: { id: string; token: string } | null = null;
  private lastSeq = 0;
  private outbox: ClientMessage[] = [];
  private wanted = false;
  reconnecting = false;
  instance = '';

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && !this.reconnecting;
  }

  /** Opens a fresh session. */
  async connect(name: string): Promise<void> {
    if (this.open && this.session) return;
    this.wanted = true;
    const ws = await this.dial();
    const welcome = await this.handshake(ws, { t: 'hello', name, v: PROTOCOL_VERSION });
    if (welcome.t !== 'welcome') {
      ws.close();
      throw new Error(welcome.t === 'error' ? welcome.message : 'Could not join the game server.');
    }
    this.session = { id: welcome.id, token: welcome.token };
    this.instance = welcome.instance;
    this.lastSeq = 0;
    this.adopt(ws);
  }

  private dial(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(serverUrl());
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('Could not reach the game server.'));
      }, CONNECT_TIMEOUT_MS);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve(ws);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Could not reach the game server.'));
      };
    });
  }

  /** Sends the first message and waits for the server's first answer. */
  private handshake(ws: WebSocket, first: ClientMessage): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The game server did not answer.')), CONNECT_TIMEOUT_MS);
      ws.onmessage = (ev) => {
        clearTimeout(timer);
        ws.onmessage = null;
        try {
          resolve(JSON.parse(ev.data as string) as ServerMessage);
        } catch {
          reject(new Error('Bad reply from the game server.'));
        }
      };
      ws.onclose = () => {
        clearTimeout(timer);
        reject(new Error('The game server closed the connection.'));
      };
      ws.send(JSON.stringify(first));
    });
  }

  private adopt(ws: WebSocket): void {
    this.ws = ws;
    ws.onmessage = (ev) => {
      let msg: Sequenced<ServerMessage>;
      try {
        msg = JSON.parse(ev.data as string) as Sequenced<ServerMessage>;
      } catch {
        return;
      }
      if (msg.seq !== undefined) {
        if (msg.seq <= this.lastSeq) return;
        this.lastSeq = msg.seq;
      }
      this.emit(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.wanted && this.session) void this.resume();
      else this.fail();
    };
  }

  private async resume(): Promise<void> {
    this.reconnecting = true;
    const deadline = Date.now() + RESUME_GRACE_MS - 1000;
    let delay = 250;
    while (this.wanted && this.session && Date.now() < deadline) {
      try {
        const ws = await this.dial();
        const reply = await this.handshake(ws, { t: 'resume', ...this.session, lastSeq: this.lastSeq, v: PROTOCOL_VERSION });
        if (reply.t !== 'resumed') {
          ws.close();
          break;
        }
        this.adopt(ws);
        this.reconnecting = false;
        for (const m of this.outbox.splice(0)) ws.send(JSON.stringify(m));
        this.emit(reply);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 3000);
      }
    }
    this.fail();
  }

  private fail(): void {
    this.reconnecting = false;
    this.session = null;
    this.outbox = [];
    if (!this.wanted) return;
    this.wanted = false;
    for (const fn of [...this.closeListeners]) fn();
  }

  private emit(msg: ServerMessage): void {
    for (const fn of [...this.listeners]) fn(msg);
  }

  /** Input batches are dropped while reconnecting (they're resent from the server's count); other messages wait. */
  send(msg: ClientMessage): void {
    if (this.open) this.ws!.send(JSON.stringify(msg));
    else if (this.reconnecting && msg.t !== 'frames' && msg.t !== 'ping') this.outbox.push(msg);
  }

  on(fn: (m: ServerMessage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onClose(fn: () => void): () => void {
    this.closeListeners.add(fn);
    return () => this.closeListeners.delete(fn);
  }

  /** Leaves on purpose: tells the server so the opponent hears right away. */
  close(): void {
    this.wanted = false;
    if (this.open) this.ws!.send(JSON.stringify({ t: 'leave' } satisfies ClientMessage));
    this.ws?.close();
    this.ws = null;
    this.session = null;
    this.reconnecting = false;
  }
}

export const net = new NetClient();
