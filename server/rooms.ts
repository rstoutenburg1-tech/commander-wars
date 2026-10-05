import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { RULES } from '../src/game/config';
import { applyAction } from '../src/game/actions';
import { defaultSettings, validateSettings, type MatchSettings } from '../src/game/match';
import { createWorld, notify } from '../src/game/world';
import { step } from '../src/game/simulation';
import type { World } from '../src/game/types';
import type { LobbyMember, LobbyState, ServerMessage } from '../src/network/protocol';

interface Member extends LobbyMember { token: string; socket?: WebSocket; lastSequence: number; disconnectedAt?: number }
export interface Room { code: string; hostId: string; phase: LobbyState['phase']; settings: MatchSettings; members: Member[]; revision: number; world?: World; offlineSince?: number }
interface Connection { room?: Room; member?: Member; rateStart: number; rateCount: number }
export interface RoomOptions { reconnectGraceMs?: number; roomIdleMs?: number }

export function sanitizeName(value: unknown, fallback = 'Commander') {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || fallback;
}
function fail(message: string): never { throw new Error(message); }

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private connections = new Map<WebSocket, Connection>();
  private tickTimer: ReturnType<typeof setInterval>;
  private snapshotTicks = 0;
  private reconnectGraceMs: number;
  private roomIdleMs: number;
  constructor(options: RoomOptions = {}) {
    this.reconnectGraceMs = options.reconnectGraceMs ?? 60_000;
    this.roomIdleMs = options.roomIdleMs ?? 300_000;
    this.tickTimer = setInterval(() => this.tick(), RULES.tick * 1000);
    this.tickTimer.unref();
  }
  attach(socket: WebSocket) {
    this.connections.set(socket, { rateStart: Date.now(), rateCount: 0 });
    socket.on('message', (data, binary) => {
      const connection = this.connections.get(socket); if (!connection) return;
      const now = Date.now();
      if (now - connection.rateStart >= 1000) { connection.rateStart = now; connection.rateCount = 0; }
      if (++connection.rateCount > 60) { socket.close(1008, 'Too many messages'); return; }
      try {
        if (binary) fail('Use JSON text messages');
        const message: unknown = JSON.parse(data.toString());
        this.receive(socket, connection, message);
      } catch (error) { this.send(socket, { type: 'error', message: error instanceof Error ? error.message : 'Invalid message' }); }
    });
    socket.on('close', () => this.disconnected(socket));
    socket.on('error', () => { /* close performs reservation and host transfer. */ });
  }
  private send(socket: WebSocket | undefined, message: ServerMessage) {
    if (socket?.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 2_000_000) { socket.close(1013, 'Connection cannot keep up'); return; }
    socket.send(JSON.stringify(message));
  }
  state(room: Room): LobbyState {
    return { code: room.code, hostId: room.hostId, phase: room.phase, settings: structuredClone(room.settings), members: room.members.map(({ id, seat, name, ready, connected }) => ({ id, seat, name, ready, connected })), revision: room.revision };
  }
  private broadcast(room: Room, message: ServerMessage) { for (const member of room.members) this.send(member.socket, message); }
  private lobby(room: Room) { room.revision++; this.broadcast(room, { type: 'lobby', lobby: this.state(room) }); }
  private code() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let value: string;
    do { value = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (this.rooms.has(value));
    return value;
  }
  private settings(value: unknown) {
    const settings = validateSettings(value);
    settings.slots.forEach((slot, index) => slot.name = sanitizeName(slot.name, `Commander ${index + 1}`));
    return settings;
  }
  private member(room: Room, socket: WebSocket, seat: number, name: unknown) {
    const member: Member = { id: randomUUID(), token: randomBytes(32).toString('hex'), seat, name: sanitizeName(name), ready: !room.members.length, connected: true, socket, lastSequence: 0 };
    room.settings.slots[seat].name = member.name; room.members.push(member); room.offlineSince = undefined;
    const connection = this.connections.get(socket)!; connection.room = room; connection.member = member;
    if (!room.hostId) room.hostId = member.id;
    this.send(socket, { type: 'welcome', id: member.id, token: member.token, seat: member.seat, lobby: this.state(room) });
    this.lobby(room); return member;
  }
  private resetReadiness(room: Room) { for (const member of room.members) member.ready = member.id === room.hostId; }
  private findRoom(value: unknown) {
    if (typeof value !== 'string' || !/^[A-Z2-9]{6}$/.test(value.trim().toUpperCase())) fail('Enter a valid six-character lobby code');
    const room = this.rooms.get((value as string).trim().toUpperCase()); return room ?? fail('Lobby not found. Check the code or ask the host to create a new lobby.');
  }
  private receive(socket: WebSocket, connection: Connection, input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid message');
    const message = input as Record<string, unknown>;
    if (message.type === 'create' || message.type === 'join' || message.type === 'resume') {
      if (connection.member) fail('Leave your current lobby first');
      if (message.type === 'create') {
        if (this.rooms.size >= 256) fail('Lobby server is full');
        const settings = this.settings(message.settings ?? defaultSettings()), seat = settings.slots.findIndex(slot => slot.controller === 'human');
        if (seat < 0) fail('The host needs a human player section');
        const room: Room = { code: this.code(), hostId: '', phase: 'lobby', settings, members: [], revision: 0 };
        this.rooms.set(room.code, room); this.member(room, socket, seat, message.name); return;
      }
      const room = this.findRoom(message.code);
      if (message.type === 'join') {
        if (room.phase !== 'lobby') fail('This match has already started');
        const seat = room.settings.slots.findIndex((slot, seat) => slot.controller === 'human' && !room.members.some(member => member.seat === seat));
        if (seat < 0) fail('No open human sections. Ask the host to add one.');
        this.member(room, socket, seat, message.name); return;
      }
      if (typeof message.token !== 'string') fail('Invalid reconnect token');
      const member = room.members.find(member => member.token === message.token);
      if (!member) fail('This lobby reservation is no longer available');
      const oldSocket = member.socket;
      member.socket = socket; member.connected = true; member.disconnectedAt = undefined; member.lastSequence = 0;
      connection.room = room; connection.member = member; room.offlineSince = undefined;
      if (room.world) { room.world.players[member.seat].controller = 'human'; room.world.players[member.seat].aiTimer = 0; }
      if (oldSocket && oldSocket !== socket) oldSocket.close(1000, 'Session resumed elsewhere');
      this.send(socket, { type: 'welcome', id: member.id, token: member.token, seat: member.seat, lobby: this.state(room) });
      if (room.world) this.send(socket, { type: 'start', world: room.world, seat: member.seat });
      this.lobby(room); return;
    }
    const room = connection.room, member = connection.member;
    if (!room || !member || member.socket !== socket) fail('Join a lobby first');
    if (message.type === 'leave') { this.leave(room, member, socket); return; }
    if (message.type === 'action') {
      if (room.phase !== 'playing' || !room.world) fail('The match is not running');
      if (!Number.isSafeInteger(message.sequence) || (message.sequence as number) <= member.lastSequence) fail('Invalid action sequence');
      member.lastSequence = message.sequence as number;
      if (!applyAction(room.world, member.seat, message.action)) fail('Action unavailable or not owned by your section');
      return;
    }
    if (room.phase !== 'lobby') fail('Game setup is locked after the match starts');
    if (message.type === 'configure') {
      if (member.id !== room.hostId) fail('Only the host can change game setup');
      const settings = this.settings(message.settings);
      for (const occupant of room.members) {
        if (settings.slots[occupant.seat].controller !== 'human') fail('An occupied human section cannot be removed');
        settings.slots[occupant.seat].name = occupant.name;
      }
      room.settings = settings; this.resetReadiness(room); this.lobby(room); return;
    }
    if (message.type === 'team') {
      if (!Number.isInteger(message.alliance) || (message.alliance as number) < 0 || (message.alliance as number) > 3) fail('Invalid team');
      room.settings.slots[member.seat].alliance = message.alliance as number; this.resetReadiness(room); this.lobby(room); return;
    }
    if (message.type === 'ready') {
      if (typeof message.ready !== 'boolean') fail('Invalid ready state');
      member.ready = message.ready; this.lobby(room); return;
    }
    if (message.type === 'start') {
      if (member.id !== room.hostId) fail('Only the host can start the match');
      const active = room.settings.slots.filter(slot => slot.controller !== 'closed');
      if (active.length < 2 || new Set(active.map(slot => slot.alliance)).size < 2) fail('Choose at least two opposing teams');
      for (const [seat, slot] of room.settings.slots.entries()) if (slot.controller === 'human') {
        const occupant = room.members.find(member => member.seat === seat);
        if (!occupant?.connected || !occupant.ready) fail('Every human player must be connected and ready');
      }
      room.world = createWorld(room.settings); room.world.networked = true; room.phase = 'playing';
      for (const occupant of room.members) this.send(occupant.socket, { type: 'start', world: room.world, seat: occupant.seat });
      this.lobby(room); return;
    }
    fail('Unknown lobby message');
  }
  private transferHost(room: Room) {
    if (room.members.some(member => member.id === room.hostId && member.connected)) return;
    const next = room.members.find(member => member.connected);
    if (next) { room.hostId = next.id; if (room.phase === 'lobby') next.ready = true; }
  }
  private disconnected(socket: WebSocket) {
    const connection = this.connections.get(socket); this.connections.delete(socket);
    const room = connection?.room, member = connection?.member;
    if (!room || !member || member.socket !== socket) return;
    member.socket = undefined; member.connected = false; member.disconnectedAt = Date.now();
    if (room.phase === 'lobby') member.ready = false;
    this.transferHost(room); if (!room.members.some(member => member.connected)) room.offlineSince = Date.now();
    this.lobby(room);
  }
  private takeover(room: Room, member: Member) {
    if (!room.world || room.world.players[member.seat].controller === 'ai') return;
    const player = room.world.players[member.seat]; player.controller = 'ai'; player.aiTimer = 0;
    notify(room.world, `${sanitizeName(member.name)} disconnected. AI is commanding their section.`);
  }
  private leave(room: Room, member: Member, socket: WebSocket) {
    if (room.world) { this.takeover(room, member); room.settings.slots[member.seat].controller = 'ai'; }
    room.members = room.members.filter(occupant => occupant !== member); member.socket = undefined; member.connected = false;
    const connection = this.connections.get(socket)!; connection.room = undefined; connection.member = undefined;
    this.transferHost(room); if (!room.members.some(member => member.connected)) room.offlineSince = Date.now();
    this.send(socket, { type: 'left' }); this.lobby(room);
  }
  private tick() {
    const now = Date.now(), snapshot = ++this.snapshotTicks % 2 === 0;
    for (const room of this.rooms.values()) {
      if (room.offlineSince !== undefined && now - room.offlineSince > this.roomIdleMs) { this.rooms.delete(room.code); continue; }
      if (room.phase === 'playing' && room.world) {
        for (const member of room.members) if (!member.connected && member.disconnectedAt !== undefined && now - member.disconnectedAt >= this.reconnectGraceMs) this.takeover(room, member);
        step(room.world, RULES.tick);
        if (room.world.winner !== null) { room.phase = 'finished'; this.lobby(room); this.broadcast(room, { type: 'snapshot', world: room.world }); }
      }
      if (snapshot && room.world) this.broadcast(room, { type: 'snapshot', world: room.world });
    }
  }
  close() { clearInterval(this.tickTimer); this.rooms.clear(); this.connections.clear(); }
}
