import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Lobby } from './rooms.ts';
import { Sessions, instanceId } from './sessions.ts';
import { serveWebSockets } from './wire.ts';

const PORT = Number(process.env.PORT ?? 8787);
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? join(fileURLToPath(import.meta.url), '../../../web/dist'));
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

const lobby = new Lobby();
const sessions = new Sessions(lobby);

const http = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, instance: instanceId(), rooms: lobby.rooms.size, sessions: sessions.size }));
    return;
  }
  if (!existsSync(STATIC_DIR)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Bean Machine server is running. Build the web app (npm run build) to serve it from here.');
    return;
  }
  let file = normalize(join(STATIC_DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': file.includes(`${join('assets', '')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({
  server: http,
  path: '/ws',
  maxPayload: 64 * 1024,
  verifyClient: ({ origin }: { origin: string }) => ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin),
});

serveWebSockets(wss, sessions);

http.listen(PORT, () => {
  console.log(`Bean Machine server on http://localhost:${PORT} (ws path /ws, static ${existsSync(STATIC_DIR) ? STATIC_DIR : 'not built'})`);
});
