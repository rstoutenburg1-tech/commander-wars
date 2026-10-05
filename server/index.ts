import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomManager, type RoomOptions } from './rooms';

export interface GameServerOptions extends RoomOptions { port?: number; host?: string; distDir?: string; heartbeatMs?: number }
export interface GameServer { http: Server; wss: WebSocketServer; rooms: RoomManager; url: string; port: number; close(): Promise<void> }
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' };

export async function createGameServer(options: GameServerOptions = {}): Promise<GameServer> {
  const dist = resolve(options.distDir ?? fileURLToPath(new URL('../dist/', import.meta.url))), rooms = new RoomManager(options);
  const http = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end('Method not allowed'); return; }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); }
    catch { response.writeHead(400); response.end('Invalid URL'); return; }
    if (pathname === '/health') { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(request.method === 'HEAD' ? '' : JSON.stringify({ ok: true, game: 'commander-wars', rooms: rooms.rooms.size })); return; }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(segment => segment.startsWith('.'))) { response.writeHead(404); response.end('Not found'); return; }
    const requested = resolve(dist, `.${pathname}`), inside = relative(dist, requested);
    if (inside.startsWith('..') || isAbsolute(inside)) { response.writeHead(404); response.end('Not found'); return; }
    try {
      let file = requested;
      try { if (!(await stat(file)).isFile()) file = resolve(dist, 'index.html'); }
      catch { if (extname(pathname)) throw new Error('Not found'); file = resolve(dist, 'index.html'); }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(404); response.end('Game build not found. Run the production build first.'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: { threshold: 1024, serverNoContextTakeover: true, clientNoContextTakeover: true, concurrencyLimit: 4, zlibDeflateOptions: { level: 3 } } });
  const alive = new WeakMap<object, boolean>();
  http.on('upgrade', (request, socket, head) => {
    let path = '';
    try { path = new URL(request.url ?? '/', 'http://localhost').pathname; } catch { /* Reject malformed requests below. */ }
    if (path !== '/ws') { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, client => { wss.emit('connection', client, request); });
  });
  wss.on('connection', socket => { alive.set(socket, true); socket.on('pong', () => alive.set(socket, true)); rooms.attach(socket); });
  const heartbeat = setInterval(() => { for (const socket of wss.clients) { if (!alive.get(socket)) socket.terminate(); else { alive.set(socket, false); socket.ping(); } } }, options.heartbeatMs ?? 30_000);
  heartbeat.unref();
  try { await new Promise<void>((resolve, reject) => { http.once('error', reject); http.listen(options.port ?? 8787, options.host ?? '0.0.0.0', () => { http.removeListener('error', reject); resolve(); }); }); }
  catch (error) { clearInterval(heartbeat); rooms.close(); wss.close(); throw error; }
  const address = http.address(); if (!address || typeof address === 'string') throw new Error('Server did not open a TCP port');
  return { http, wss, rooms, port: address.port, url: `http://127.0.0.1:${address.port}`, close: async () => {
    clearInterval(heartbeat); rooms.close(); for (const socket of wss.clients) socket.terminate();
    await Promise.all([new Promise<void>(resolve => wss.close(() => resolve())), new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()))]);
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be between 0 and 65535');
  const game = await createGameServer({ port, host: process.env.HOST ?? '0.0.0.0' });
  console.log(`Commander Wars multiplayer server: ${game.url} (LAN access on port ${game.port})`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void game.close().then(() => process.exit(0)); });
}
