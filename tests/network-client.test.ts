import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkClient, reconcileEffects, websocketUrl } from '../src/network/client';
import { createWorld } from '../src/game/world';
import { defaultSettings } from '../src/game/match';
import type { LobbyState, ServerMessage } from '../src/network/protocol';

test('public lobby endpoints use secure sockets and preserve custom server paths', () => {
  assert.equal(websocketUrl(undefined, 'https://game.example/play?room=ABC'), 'wss://game.example/ws');
  assert.equal(websocketUrl('https://lobby.example', 'http://localhost:5173'), 'wss://lobby.example/ws');
  assert.equal(websocketUrl('wss://lobby.example/game/ws', 'http://localhost:5173'), 'wss://lobby.example/game/ws');
  assert.equal(websocketUrl(undefined, 'http://localhost:5173'), 'ws://localhost:5173/ws');
  assert.throws(() => websocketUrl('javascript:alert(1)', 'https://game.example'), /address/);
});

test('snapshots preserve ongoing spell identity without reusing a later attack', () => {
  const previous = createWorld(), incoming = createWorld();
  previous.time = 10; incoming.time = 10.1;
  const arrow = { x: 1, z: 2, to: { x: 3, z: 4 }, kind: 'arrow' as const, source: 5, target: 6, radius: .3, color: '#ffeedd', duration: .5, life: .45 };
  const ended = { ...arrow, source: 7, life: .05 };
  previous.effects = [arrow, ended];
  incoming.effects = [{ ...arrow, life: .35 }, { ...arrow, source: 5, life: .45 }];
  const effects = reconcileEffects(previous, incoming);
  assert.equal(effects[0], arrow); assert.equal(arrow.life, .35);
  assert.notEqual(effects[1], arrow); assert.ok(!effects.includes(ended));
});

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  listeners = new Map<string, ((event: any) => void)[]>();
  constructor(public url: string) { FakeSocket.instances.push(this); }
  addEventListener(name: string, callback: (event: any) => void) { this.listeners.set(name, [...this.listeners.get(name) ?? [], callback]); }
  emit(name: string, event: any = {}) { for (const callback of this.listeners.get(name) ?? []) callback(event); }
  open() { this.readyState = 1; this.emit('open'); }
  send(message: string) { this.sent.push(message); }
  receive(message: ServerMessage) { this.emit('message', { data: JSON.stringify(message) }); }
  close() { this.readyState = 3; this.emit('close'); }
}

test('resume restores the same world and seat without opening a second match or replaying commands', () => {
  const storage = new Map<string, string>();
  const original = { WebSocket: globalThis.WebSocket, location: (globalThis as any).location, sessionStorage: (globalThis as any).sessionStorage };
  Object.assign(globalThis, { WebSocket: FakeSocket, location: { href: 'https://game.example/' }, sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
  const settings = defaultSettings(); settings.slots[2].controller = 'human';
  const lobby: LobbyState = { code: 'ABC123', hostId: 'host', phase: 'lobby', revision: 1, settings, members: [{ id: 'friend', seat: 2, name: 'Friend', ready: false, connected: true }] };
  let starts = 0;
  const client = new NetworkClient({ onMatch: () => starts++ });
  try {
    client.connect({ mode: 'join', name: 'Friend', code: 'ABC123' });
    const first = FakeSocket.instances.at(-1)!;
    first.open(); assert.deepEqual(JSON.parse(first.sent[0]), { type: 'join', name: 'Friend', code: 'ABC123' });
    first.receive({ type: 'welcome', id: 'friend', token: 'reservation', seat: 2, lobby });
    assert.equal(client.status, 'connected');
    assert.equal(NetworkClient.savedSession()?.token, 'reservation');
    first.receive({ type: 'start', world: createWorld(), seat: 2 });
    const reference = client.world!; assert.equal(reference.localPlayer, 2); assert.equal(reference.networked, true);
    client.sendAction({ type: 'upgrade', building: 'forest' });
    assert.deepEqual(JSON.parse(first.sent.at(-1)!), { type: 'action', action: { type: 'upgrade', building: 'forest' }, sequence: 1 });
    first.close(); assert.equal(client.status, 'reconnecting');
    assert.equal(client.sendAction({ type: 'upgrade', building: 'quarry' }), false);
    client.reconnect();
    const resumed = FakeSocket.instances.at(-1)!;
    resumed.open(); assert.deepEqual(JSON.parse(resumed.sent[0]), { type: 'resume', code: 'ABC123', token: 'reservation' });
    resumed.receive({ type: 'welcome', id: 'friend', token: 'reservation', seat: 2, lobby });
    const next = createWorld(); next.time = 100; next.players[2].gold = 123;
    resumed.receive({ type: 'start', world: next, seat: 2 });
    assert.equal(client.world, reference); assert.equal(reference.time, 100); assert.equal(reference.players[2].gold, 123);
    assert.equal(reference.localPlayer, 2); assert.equal(starts, 1);
    client.chooseTeam(1); assert.deepEqual(JSON.parse(resumed.sent.at(-1)!), { type: 'team', alliance: 1 });
    client.sendAction({ type: 'upgrade', building: 'forest' });
    assert.ok(JSON.parse(resumed.sent.at(-1)!).sequence > 1);
    client.disconnect(); assert.equal(NetworkClient.savedSession(), undefined);
    assert.equal(client.status, 'disconnected');
    client.connect({ mode: 'join', name: 'Friend', code: 'ABC123' });
    const reserved = FakeSocket.instances.at(-1)!; reserved.open();
    reserved.receive({ type: 'welcome', id: 'friend', token: 'expired', seat: 2, lobby });
    reserved.close(); client.reconnect();
    const expired = FakeSocket.instances.at(-1)!; expired.open();
    expired.receive({ type: 'error', message: 'This lobby has expired.' });
    assert.equal(client.status, 'disconnected'); assert.equal(client.lastError, 'This lobby has expired.');
    assert.equal(NetworkClient.savedSession(), undefined); assert.equal(client.token, '');
  } finally { client.disconnect(false); Object.assign(globalThis, original); }
});
