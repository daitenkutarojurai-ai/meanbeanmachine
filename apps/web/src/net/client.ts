import { type ClientMessage, PROTOCOL_VERSION, type ServerMessage } from '@mbm/engine';

/** Server address: ?server=wss://host/ws, then VITE_SERVER_URL, then this site's /ws. */
export function serverUrl(): string {
  const param = new URLSearchParams(location.search).get('server');
  if (param) return param;
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
}

export class NetClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(m: ServerMessage) => void>();
  private closeListeners = new Set<() => void>();
  id: string | null = null;

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(name: string): Promise<void> {
    if (this.open) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(serverUrl());
      this.ws = ws;
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Could not reach the game server.'));
      }, 8000);
      ws.onopen = () => {
        clearTimeout(timeout);
        this.send({ t: 'hello', name, v: PROTOCOL_VERSION });
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Could not reach the game server.'));
      };
      ws.onclose = () => {
        this.ws = null;
        for (const fn of [...this.closeListeners]) fn();
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data as string) as ServerMessage;
        } catch {
          return;
        }
        if (msg.t === 'welcome') this.id = msg.id;
        for (const fn of [...this.listeners]) fn(msg);
      };
    });
  }

  send(msg: ClientMessage): void {
    if (this.open) this.ws!.send(JSON.stringify(msg));
  }

  on(fn: (m: ServerMessage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onClose(fn: () => void): () => void {
    this.closeListeners.add(fn);
    return () => this.closeListeners.delete(fn);
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export const net = new NetClient();
