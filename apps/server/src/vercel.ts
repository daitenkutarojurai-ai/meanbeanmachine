// Vercel Function entry: Vercel serves the static client and routes /ws here.
// Bundled to api/ws.js by scripts/bundle-api.mjs.
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { Lobby } from './rooms.ts';
import { INSTANCE, Sessions } from './sessions.ts';
import { serveWebSockets } from './wire.ts';

const lobby = new Lobby();
const sessions = new Sessions(lobby);

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ ok: true, instance: INSTANCE, rooms: lobby.rooms.size, sessions: sessions.size }));
});

serveWebSockets(new WebSocketServer({ server, maxPayload: 64 * 1024 }), sessions);

export default server;
