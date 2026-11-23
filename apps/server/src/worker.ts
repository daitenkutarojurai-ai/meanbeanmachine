// Cloudflare Worker entry. The platform serves the built client from static assets;
// /ws and /health reach a single Durable Object that runs the lobby, so every player
// meets in the same place and connections have no time limit.
import { Lobby } from './rooms.ts';
import { Sessions, instanceId, type Socket } from './sessions.ts';

interface CfWebSocket extends Socket {
  accept(): void;
  addEventListener(type: 'message', fn: (e: { data: string | ArrayBuffer }) => void): void;
  addEventListener(type: 'close' | 'error', fn: () => void): void;
}

declare const WebSocketPair: { new (): { 0: CfWebSocket; 1: CfWebSocket } };

interface Env {
  LOBBY: { idFromName(name: string): unknown; get(id: unknown): { fetch(req: Request): Promise<Response> } };
  ASSETS: { fetch(req: Request): Promise<Response> };
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/ws' || pathname === '/health') return env.LOBBY.get(env.LOBBY.idFromName('main')).fetch(request);
    return env.ASSETS.fetch(request);
  },
};

export class LobbyRoom {
  private readonly lobby = new Lobby();
  private readonly sessions = new Sessions(this.lobby);

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json(
        { ok: true, instance: instanceId(), rooms: this.lobby.rooms.size, sessions: this.sessions.size },
        { headers: { 'cache-control': 'no-store' } },
      );
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const handlers = this.sessions.connect(server);
    const decoder = new TextDecoder();
    server.addEventListener('message', (e) => handlers.message(typeof e.data === 'string' ? e.data : decoder.decode(e.data)));
    server.addEventListener('close', handlers.close);
    server.addEventListener('error', handlers.close);
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }
}
