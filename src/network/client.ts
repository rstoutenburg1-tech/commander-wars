import type { MatchSettings } from '../game/match';
import type { Effect, World } from '../game/types';
import type { ClientMessage, GameAction, LobbyState, ServerMessage } from './protocol';
import { applyAction } from '../game/actions';
import { effectIdentity, SnapshotPlayback } from './playback';

export type LobbyView = LobbyState;
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export interface SavedSession { code: string; token: string; url: string; name: string }
interface ClientOptions {
  onLobby?: (lobby: LobbyState) => void;
  onMatch?: (world: World, client: NetworkClient) => void;
  onStatus?: (status: ConnectionStatus, message: string) => void;
  onError?: (message: string) => void;
}
interface ConnectOptions { mode: 'host' | 'join' | 'resume'; name: string; code?: string; settings?: MatchSettings; url?: string; token?: string }
const sessionKey = 'commander-wars-session';

/** Resolve the same-origin production endpoint, also used by Vite's /ws proxy. */
export function websocketUrl(address?: string, base = location.href) {
  const url = new URL(address?.trim() || '/ws', base);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) throw new Error('Use an https:// or wss:// lobby server address.');
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  if (!url.pathname || url.pathname === '/') url.pathname = '/ws';
  url.hash = ''; return url.toString();
}

/** Rendering tracks effects by object identity; reuse a spell across snapshots. */
export function reconcileEffects(previous: World, incoming: World) {
  const key = effectIdentity;
  const live = new Map<string, Effect[]>();
  for (const effect of previous.effects) {
    const id = key(effect, previous.time); live.set(id, [...live.get(id) ?? [], effect]);
  }
  return incoming.effects.map(effect => {
    const existing = live.get(key(effect, incoming.time))?.shift();
    return existing ? Object.assign(existing, effect) : effect;
  });
}

export class NetworkClient {
  status: ConnectionStatus = 'idle';
  lastError = '';
  id = '';
  token = '';
  seat = 0;
  code = '';
  lobby?: LobbyState;
  world?: World;
  latencyMs?: number;
  get pendingCount() { return this.pending.length; }
  private playback = new SnapshotPlayback();
  private authoritative?: World;
  private pending: { sequence: number; action: GameAction }[] = [];
  private heartbeat?: ReturnType<typeof setInterval>;
  private lastMessageAt = 0;
  private socket?: WebSocket;
  private connectOptions?: ConnectOptions;
  private endpoint = '';
  private intentionalClose = false;
  private retry?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private sequence = 0;
  private started = false;
  private awaitingWelcome = false;
  private statusListeners = new Set<(status: ConnectionStatus, message: string) => void>();
  private messageListeners = new Set<(message: ServerMessage) => void>();

  constructor(private options: ClientOptions = {}) {}

  static savedSession(): SavedSession | undefined {
    try {
      const value = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null');
      if (value && typeof value.code === 'string' && typeof value.token === 'string' && typeof value.url === 'string' && typeof value.name === 'string') return value;
    } catch { /* A browser can disable storage without disabling multiplayer. */ }
    return undefined;
  }

  onStatus(listener: (status: ConnectionStatus, message: string) => void) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  onMessage(listener: (message: ServerMessage) => void) { this.messageListeners.add(listener); return () => this.messageListeners.delete(listener); }

  connect(options: ConnectOptions) {
    const previous = this.socket; this.socket = undefined; previous?.close();
    this.stopHeartbeat(); this.pending = []; this.authoritative = undefined; this.playback.reset(); this.latencyMs = undefined;
    this.intentionalClose = false; this.connectOptions = options; this.attempts = 0;
    this.sequence = 0; this.started = false; this.world = undefined; this.lobby = undefined;
    this.id = ''; this.token = options.token ?? ''; this.code = options.code ?? ''; this.lastError = '';
    try { this.endpoint = websocketUrl(options.url); }
    catch (error) { this.fail(error instanceof Error ? error.message : 'Invalid lobby server address.'); return; }
    this.open(false);
  }

  private setStatus(status: ConnectionStatus, message: string) {
    this.status = status;
    this.options.onStatus?.(status, message);
    for (const listener of this.statusListeners) listener(status, message);
  }

  private fail(message: string) {
    this.lastError = message; this.options.onError?.(message);
    this.setStatus('disconnected', message);
  }

  private saveSession() {
    if (!this.token || !this.code) return;
    try { sessionStorage.setItem(sessionKey, JSON.stringify({ code: this.code, token: this.token, url: this.endpoint, name: this.connectOptions?.name ?? 'Commander' } satisfies SavedSession)); }
    catch { /* Reconnect still works until this tab is closed. */ }
  }

  private open(resume: boolean) {
    if (!this.connectOptions) return;
    if (this.retry) { clearTimeout(this.retry); this.retry = undefined; }
    this.setStatus(resume ? 'reconnecting' : 'connecting', resume ? 'Connection lost. Reconnecting…' : 'Connecting to the lobby server…');
    let socket: WebSocket;
    try { socket = new WebSocket(this.endpoint); }
    catch { this.fail('The browser could not connect. Use a secure lobby address when playing from an HTTPS website.'); return; }
    this.socket = socket; this.awaitingWelcome = true;
    socket.addEventListener('open', () => {
      if (this.socket !== socket || this.intentionalClose) return;
      const options = this.connectOptions!;
      const message: ClientMessage = resume || options.mode === 'resume'
        ? { type: 'resume', code: this.code, token: this.token }
        : options.mode === 'host' ? { type: 'create', name: options.name, settings: options.settings }
        : { type: 'join', name: options.name, code: this.code };
      socket.send(JSON.stringify(message));
    });
    socket.addEventListener('message', event => {
      if (this.socket !== socket || this.intentionalClose) return;
      this.lastMessageAt = performance.now();
      try { this.receive(JSON.parse(event.data) as ServerMessage); }
      catch { this.options.onError?.('The lobby server sent an invalid message.'); }
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket || this.intentionalClose) return;
      this.stopHeartbeat(); this.pending = [];
      if (this.token && this.code && this.attempts < 8) {
        this.setStatus('reconnecting', 'Connection lost. Your section is reserved while you reconnect.');
        const delay = Math.min(1000 * 2 ** this.attempts++, 8000);
        this.retry = setTimeout(() => this.open(true), delay);
      } else this.fail(this.token ? 'Unable to reconnect. Check your connection, then try Reconnect.' : 'Could not reach the lobby server. Check the address or ask the host to restart it.');
    });
    socket.addEventListener('error', () => { /* close reports the error and schedules a bounded reconnect. */ });
  }

  private receive(message: ServerMessage) {
    if (message.type === 'welcome') {
      this.awaitingWelcome = false;
      this.id = message.id; this.token = message.token; this.seat = message.seat; this.code = message.lobby.code;
      this.attempts = 0; this.lastError = ''; this.saveSession();
      this.pending = []; this.startHeartbeat();
      this.setStatus('connected', 'Connected.'); this.lobby = message.lobby; this.options.onLobby?.(message.lobby);
    } else if (message.type === 'lobby') { this.lobby = message.lobby; this.options.onLobby?.(message.lobby); }
    else if (message.type === 'start' || message.type === 'snapshot') {
      if (message.type === 'start') this.seat = message.seat;
      this.authoritative = message.world;
      this.pending = message.ack === undefined ? [] : this.pending.filter(action => action.sequence > message.ack!);
      this.playback.push(message.world, performance.now(), message.type === 'start');
      this.reconcile();
      if (!this.started && this.world) { this.started = true; this.options.onMatch?.(this.world, this); }
    } else if (message.type === 'pong') {
      this.latencyMs = Math.max(0, performance.now() - message.sent);
    } else if (message.type === 'actionResult') {
      if (!message.accepted) { this.pending = this.pending.filter(action => action.sequence !== message.sequence); this.reconcile(); }
    } else if (message.type === 'error') {
      this.lastError = message.message; this.options.onError?.(message.message);
      if (this.awaitingWelcome) {
        this.intentionalClose = true; this.socket?.close();
        if (this.connectOptions?.mode === 'resume' || this.token) { try { sessionStorage.removeItem(sessionKey); } catch { /* Nothing else to clear. */ } this.token = ''; }
        this.setStatus('disconnected', message.message);
      }
    } else if (message.type === 'left') { this.disconnect(false); }
    for (const listener of this.messageListeners) listener(message);
  }

  private reconcile() {
    if (!this.authoritative) return;
    // Replay only outstanding control changes over a fresh authoritative copy.
    // Never predict costs, damage, purchases, cooldowns or ability outcomes.
    const incoming = structuredClone(this.authoritative);
    incoming.localPlayer = this.seat; incoming.networked = true;
    for (const pending of this.pending) applyAction(incoming, this.seat, pending.action);
    if (this.world) { const effects = reconcileEffects(this.world, incoming); Object.assign(this.world, incoming, { effects }); }
    else this.world = incoming;
  }

  renderWorld(now: number) { return this.world ? this.playback.sample(this.world, now) : undefined; }

  private stopHeartbeat() { if (this.heartbeat) clearInterval(this.heartbeat); this.heartbeat = undefined; }
  private startHeartbeat() {
    this.stopHeartbeat(); this.lastMessageAt = performance.now();
    this.heartbeat = setInterval(() => {
      if (performance.now() - this.lastMessageAt > 8000) { this.reconnect(); return; }
      this.send({ type: 'ping', sent: performance.now() });
    }, 2000);
    this.heartbeat.unref?.();
  }

  private send(message: ClientMessage) {
    if (this.status !== 'connected' || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message)); return true;
  }
  updateSettings(settings: MatchSettings) { return this.send({ type: 'configure', settings }); }
  chooseTeam(alliance: number) { return this.send({ type: 'team', alliance }); }
  ready(ready: boolean) { return this.send({ type: 'ready', ready }); }
  start() { return this.send({ type: 'start' }); }
  sendAction(action: GameAction) {
    const sequence = ++this.sequence;
    if (!this.send({ type: 'action', action, sequence })) return false;
    if (['order', 'formation', 'assign', 'escort', 'stopEscorts', 'heroSetting', 'regimentSetting', 'production', 'roster', 'outpostRegiment'].includes(action.type)) {
      this.pending.push({ sequence, action: structuredClone(action) });
      if (this.world) applyAction(this.world, this.seat, action);
    }
    return true;
  }

  reconnect() {
    if (!this.connectOptions || !this.token || !this.code) {
      if (this.connectOptions && this.connectOptions.mode !== 'resume') this.connect(this.connectOptions);
      else this.fail('This lobby reservation is no longer available. Join with its code again.');
      return;
    }
    this.intentionalClose = false; this.attempts = 0; this.stopHeartbeat(); this.pending = [];
    // A half-open TCP connection can take much longer to emit close. Detach it
    // before opening the replacement so its late events cannot disrupt resume.
    const previous = this.socket; this.socket = undefined; previous?.close(); this.open(true);
  }

  disconnect(sendLeave = true) {
    this.intentionalClose = true;
    this.stopHeartbeat(); this.pending = [];
    if (this.retry) { clearTimeout(this.retry); this.retry = undefined; }
    if (sendLeave) this.send({ type: 'leave' });
    this.socket?.close(); this.socket = undefined;
    try { sessionStorage.removeItem(sessionKey); } catch { /* Nothing else to clear. */ }
    this.setStatus('disconnected', 'Disconnected.');
  }
}
