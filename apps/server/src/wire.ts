import type { WebSocketServer } from 'ws';
import type { Sessions } from './sessions.ts';

/** Hooks a ws server up to the session layer, with a heartbeat to reap dead sockets. */
export function serveWebSockets(wss: WebSocketServer, sessions: Sessions): void {
  const alive = new WeakSet<object>();
  wss.on('connection', (ws) => {
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
    const handlers = sessions.connect(ws);
    ws.on('message', (data) => handlers.message(String(data)));
    ws.on('close', handlers.close);
    ws.on('error', () => ws.terminate());
  });
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, 25_000).unref();
}
