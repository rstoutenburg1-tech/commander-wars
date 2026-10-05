import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createGameServer, type GameServerOptions } from '../server/index.ts';
import { defaultSettings } from '../src/game/match.ts';
import type { ClientMessage, ServerMessage } from '../src/network/protocol.ts';

class Peer {
  readonly messages: ServerMessage[] = [];
  private waiters: { test: (value: ServerMessage) => boolean; resolve: (value: ServerMessage) => void }[] = [];
  constructor(readonly socket: WebSocket) { socket.on('message', data => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    const index = this.waiters.findIndex(waiter => waiter.test(message));
    if (index >= 0) this.waiters.splice(index, 1)[0].resolve(message); else this.messages.push(message);
  }); }
  send(message: ClientMessage | object) { this.socket.send(JSON.stringify(message)); }
  async wait<T extends ServerMessage['type']>(type: T, check: (message: Extract<ServerMessage, { type: T }>) => boolean = () => true): Promise<Extract<ServerMessage, { type: T }>> {
    const matches = (message: ServerMessage) => message.type === type && check(message as Extract<ServerMessage, { type: T }>);
    const index = this.messages.findIndex(matches);
    if (index >= 0) return this.messages.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>;
    let waiter: typeof this.waiters[number];
    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters = this.waiters.filter(value => value !== waiter); reject(new Error(`Timed out waiting for ${type}`)); }, 4000);
      waiter = { test: matches, resolve: value => { clearTimeout(timer); resolve(value); } }; this.waiters.push(waiter);
    }) as Promise<Extract<ServerMessage, { type: T }>>;
  }
  async close() { if (this.socket.readyState === WebSocket.CLOSED) return; const closed = once(this.socket, 'close'); this.socket.close(); await closed; }
}
async function fixture(t: TestContext, options: GameServerOptions = {}) {
  const server = await createGameServer({ port: 0, host: '127.0.0.1', ...options }), peers: Peer[] = [];
  t.after(async () => { for (const peer of peers) peer.socket.terminate(); await server.close(); });
  return { server, open: async () => { const socket = new WebSocket(server.url.replace('http:', 'ws:') + '/ws'), peer = new Peer(socket); peers.push(peer); await once(socket, 'open'); return peer; } };
}
function twoHumans() {
  const settings = defaultSettings(); settings.slots[1].controller = 'human';
  settings.slots.forEach((slot, index) => slot.alliance = Math.floor(index / 2));
  settings.slots[2].difficulty = 'hard'; settings.slots[3].difficulty = 'easy'; return settings;
}

test('actual WebSocket lobby supports human/AI 2v2 setup, teams, readiness and authoritative seat ownership', async t => {
  const { server, open } = await fixture(t), host = await open(), guest = await open();
  host.send({ type: 'create', name: '<Host>\n', settings: twoHumans() });
  const welcome = await host.wait('welcome'); assert.match(welcome.lobby.code, /^[A-Z2-9]{6}$/); assert.equal(welcome.lobby.members[0].name, 'Host'); assert.equal(welcome.lobby.members[0].ready, true);
  guest.send({ type: 'join', name: 'Guest', code: welcome.lobby.code.toLowerCase() }); const joined = await guest.wait('welcome'); assert.equal(joined.seat, 1);
  host.send({ type: 'start' }); assert.match((await host.wait('error')).message, /connected and ready/);
  guest.send({ type: 'configure', settings: twoHumans() }); assert.match((await guest.wait('error')).message, /Only the host/);
  const rejected = twoHumans(); rejected.slots[1].controller = 'ai'; host.send({ type: 'configure', settings: rejected }); assert.match((await host.wait('error')).message, /occupied human/);
  guest.send({ type: 'team', alliance: 2 }); await host.wait('lobby', message => message.lobby.settings.slots[1].alliance === 2);
  guest.send({ type: 'team', alliance: 0 }); await host.wait('lobby', message => message.lobby.settings.slots[1].alliance === 0 && message.lobby.revision > joined.lobby.revision + 1);
  guest.send({ type: 'ready', ready: true }); await host.wait('lobby', message => message.lobby.members.find(member => member.seat === 1)?.ready === true);
  host.send({ type: 'start' }); const start = await host.wait('start'), otherStart = await guest.wait('start');
  assert.equal(otherStart.seat, 1); assert.equal(start.world.networked, true); assert.deepEqual(start.world.players.map(p => p.alliance), [0, 0, 1, 1]); assert.deepEqual(start.world.players.map(p => p.difficulty), ['normal', 'normal', 'hard', 'easy']);
  const hostHero = start.world.units.find(u => u.team === 0 && u.kind === 'hero')!;
  guest.send({ type: 'action', sequence: 1, action: { type: 'order', ids: [hostHero.id], order: 'move', point: { x: 0, z: 25 } } }); assert.match((await guest.wait('error')).message, /not owned/);
  // An extra claimed seat cannot override the seat derived from the connection.
  guest.send({ type: 'action', sequence: 2, seat: 0, action: { type: 'heroSetting', field: 'combatStyle', value: 'ranged' }, world: { winner: 1 } });
  const snap = await host.wait('snapshot', message => message.world.players[1].combatStyle === 'ranged');
  assert.equal(snap.world.players[0].combatStyle, 'melee'); assert.equal(snap.world.winner, null); assert.deepEqual(snap.world.units.find(u => u.id === hostHero.id)!.goal, hostHero.goal);
  guest.send({ type: 'action', sequence: 2, action: { type: 'production', field: 'reserve', value: 2000 } }); assert.match((await guest.wait('error')).message, /sequence/);
  guest.send({ type: 'action', sequence: 3, action: { type: 'upgrade', building: 'forest' } });
  const upgrade = await guest.wait('snapshot', message => message.world.players[1].upgrades.some(job => job.building === 'forest'));
  assert.equal(upgrade.world.players[0].upgrades.some(job => job.building === 'forest'), false);
  guest.send({ type: 'action', sequence: 4, action: { type: 'pause' } }); assert.match((await guest.wait('error')).message, /unavailable/);
  assert.equal(server.rooms.rooms.get(welcome.lobby.code)!.phase, 'playing');
});

test('four human commanders can fill a 2v2 lobby and the fourth seat controls only its own army', async t => {
  const { open } = await fixture(t), peers = await Promise.all([open(), open(), open(), open()]);
  const settings = twoHumans(); settings.slots.forEach(slot => slot.controller = 'human');
  peers[0].send({ type: 'create', name: 'Blue', settings }); const welcome = await peers[0].wait('welcome');
  for (let i = 1; i < 4; i++) {
    peers[i].send({ type: 'join', name: `Commander ${i + 1}`, code: welcome.lobby.code });
    assert.equal((await peers[i].wait('welcome')).seat, i);
    peers[i].send({ type: 'ready', ready: true });
    await peers[0].wait('lobby', message => message.lobby.members.find(member => member.seat === i)?.ready === true);
  }
  const extra = await open(); extra.send({ type: 'join', name: 'Fifth player', code: welcome.lobby.code });
  assert.match((await extra.wait('error')).message, /No open human/);
  peers[0].send({ type: 'start' }); const starts = await Promise.all(peers.map(peer => peer.wait('start')));
  assert.deepEqual(starts.map(start => start.seat), [0, 1, 2, 3]);
  assert.ok(starts[3].world.players.every(player => player.controller === 'human'));
  const purple = starts[3].world.units.find(unit => unit.team === 3 && unit.kind === 'hero')!;
  peers[3].send({ type: 'action', sequence: 1, action: { type: 'order', ids: [purple.id], order: 'move', point: { x: 80, z: 80 } } });
  const snapshot = await peers[0].wait('snapshot', message => message.world.units.some(unit => unit.id === purple.id && unit.goal.x === 80 && unit.goal.z === 80));
  assert.equal(snapshot.world.units.find(unit => unit.id === purple.id)!.order, 'move');
  assert.ok(snapshot.world.units.filter(unit => unit.team !== 3 && unit.kind === 'hero').every(unit => unit.order !== 'move'));
  peers[3].send({ type: 'action', sequence: 2, action: { type: 'production', field: 'regiment', value: 8 } });
  const production = await peers[1].wait('snapshot', message => message.world.players[3].production.regiment === 8);
  assert.deepEqual(production.world.players.map(player => player.production.regiment), [0, 0, 0, 8]);
});

test('wrong codes and tokens fail, disconnected seats reserve ownership and reconnect to the same live world', async t => {
  const { server, open } = await fixture(t, { reconnectGraceMs: 100 }), host = await open(), guest = await open(), bad = await open();
  bad.send({ type: 'join', name: 'Wrong', code: 'ABC234' }); assert.match((await bad.wait('error')).message, /Lobby not found/);
  host.send({ type: 'create', name: 'Host', settings: twoHumans() }); const welcome = await host.wait('welcome');
  guest.send({ type: 'join', name: 'Guest', code: welcome.lobby.code }); const joined = await guest.wait('welcome');
  bad.send({ type: 'resume', code: welcome.lobby.code, token: 'wrong' }); assert.match((await bad.wait('error')).message, /no longer available/);
  guest.send({ type: 'ready', ready: true }); await host.wait('lobby', message => message.lobby.members.find(member => member.seat === 1)?.ready === true);
  host.send({ type: 'start' }); const start = await guest.wait('start'); await host.wait('start');
  guest.send({ type: 'action', sequence: 10, action: { type: 'heroSetting', field: 'combatStyle', value: 'ranged' } }); await host.wait('snapshot', message => message.world.players[1].combatStyle === 'ranged');
  await guest.close(); await host.wait('lobby', message => message.lobby.members.find(member => member.seat === 1)?.connected === false);
  const takeover = await host.wait('snapshot', message => message.world.players[1].controller === 'ai'); assert.ok(takeover.world.time > start.world.time);
  const resumed = await open(); resumed.send({ type: 'resume', code: welcome.lobby.code, token: joined.token }); const back = await resumed.wait('welcome'), current = await resumed.wait('start');
  assert.equal(back.id, joined.id); assert.equal(back.seat, 1); assert.equal(current.world.players[1].controller, 'human'); assert.ok(current.world.time >= takeover.world.time);
  resumed.send({ type: 'action', sequence: 1, action: { type: 'heroSetting', field: 'combatStyle', value: 'melee' } }); await host.wait('snapshot', message => message.world.players[1].combatStyle === 'melee' && message.world.players[1].controller === 'human');
  resumed.send({ type: 'leave' }); await resumed.wait('left'); const left = await host.wait('snapshot', message => message.world.players[1].controller === 'ai'); assert.ok(left.world.time >= current.world.time);
  bad.send({ type: 'resume', code: welcome.lobby.code, token: joined.token }); assert.match((await bad.wait('error')).message, /no longer available/);
  assert.equal(server.rooms.rooms.get(welcome.lobby.code)!.members.length, 1);
});

test('lobby host transfers on disconnect, keeps reservation and rejects one-alliance starts', async t => {
  const { open } = await fixture(t), host = await open(), guest = await open(), newcomer = await open();
  const settings = twoHumans(); settings.slots[2].controller = settings.slots[3].controller = 'closed';
  host.send({ type: 'create', name: 'Host', settings }); const welcome = await host.wait('welcome');
  guest.send({ type: 'join', name: 'Guest', code: welcome.lobby.code }); const joined = await guest.wait('welcome');
  await host.close(); const transferred = await guest.wait('lobby', message => message.lobby.hostId === joined.id);
  assert.equal(transferred.lobby.members.find(member => member.seat === 0)?.connected, false);
  newcomer.send({ type: 'join', name: 'New', code: welcome.lobby.code }); assert.match((await newcomer.wait('error')).message, /No open human sections/);
  const single = structuredClone(transferred.lobby.settings); single.slots.forEach(slot => slot.alliance = 0); guest.send({ type: 'configure', settings: single }); await guest.wait('lobby', message => message.lobby.settings.slots.every(slot => slot.alliance === 0));
  guest.send({ type: 'start' }); assert.match((await guest.wait('error')).message, /opposing teams/);
  const resume = await open(); resume.send({ type: 'resume', code: welcome.lobby.code, token: welcome.token }); const restored = await resume.wait('welcome'); assert.equal(restored.seat, 0); assert.equal(restored.lobby.hostId, joined.id);
});

test('server serves the built game and health endpoint without exposing source or dot files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'commander-wars-server-')); t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Commander Wars</title>'); await mkdir(join(directory, 'assets')); await writeFile(join(directory, 'assets', 'game.js'), 'console.log("game")');
  const { server } = await fixture(t, { distDir: directory });
  assert.equal((await fetch(server.url + '/')).status, 200); assert.match(await (await fetch(server.url + '/lobby/ABC234')).text(), /Commander Wars/);
  const script = await fetch(server.url + '/assets/game.js'); assert.equal(script.status, 200); assert.match(script.headers.get('content-type')!, /javascript/);
  assert.deepEqual(await (await fetch(server.url + '/health')).json(), { ok: true, game: 'commander-wars', rooms: 0 });
  for (const path of ['/src/game/world.ts', '/.env', '/assets/missing.js', '/%2e%2e%5csrc%5cgame%5cworld.ts']) assert.equal((await fetch(server.url + path)).status, 404);
  assert.equal((await fetch(server.url + '/', { method: 'POST' })).status, 405);
});

test('invalid JSON reports an error and excessive messages close the connection', async t => {
  const { open } = await fixture(t), peer = await open();
  peer.socket.send('not json'); assert.match((await peer.wait('error')).message, /JSON|Unexpected/);
  const closed = once(peer.socket, 'close'); for (let i = 0; i < 65; i++) peer.send({ type: 'unknown' });
  const [code] = await closed; assert.equal(code, 1008);
});
