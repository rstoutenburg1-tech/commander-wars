import type { MatchSettings, MatchSlot } from '../game/match';
import type { World } from '../game/types';
import { NetworkClient, type LobbyView } from '../network/client';

interface SetupOptions {
  root: HTMLElement;
  onSolo: (settings: MatchSettings) => void;
  onMatch: (world: World, client: NetworkClient) => void;
}
const seatNames = ['Blue', 'Red', 'Green', 'Purple'];
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function savedName() { try { return localStorage.getItem('commander-wars-player-name') ?? 'Commander'; } catch { return 'Commander'; } }
function defaultSettings(solo: boolean, name: string): MatchSettings {
  return { slots: seatNames.map((seat, i) => ({ controller: i === 0 || !solo && i === 1 ? 'human' : 'ai', alliance: i, difficulty: 'normal', name: i === 0 ? name : `${seat} commander` })) };
}
function cloneSettings(settings: MatchSettings): MatchSettings { return { ...settings, slots: settings.slots.map(slot => ({ ...slot })) }; }

/** A small setup screen shared by practice games and public multiplayer lobbies. */
export class SetupScreen {
  private mode: 'home' | 'solo' | 'lobby' = 'home';
  private name = savedName();
  private solo = defaultSettings(true, this.name);
  private client?: NetworkClient;
  private lobby?: LobbyView;
  private error = '';
  private status = '';
  private busy = false;
  private server = '';
  private joinCode = (new URLSearchParams(location.search).get('room') ?? new URLSearchParams(location.search).get('lobby'))?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) ?? '';
  private active = true;
  private click = (event: Event) => this.onClick(event);
  private change = (event: Event) => this.onChange(event);
  private keydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.target as HTMLElement).id === 'setup-code') {
      event.preventDefault(); this.options.root.querySelector<HTMLButtonElement>('[data-setup="join"]')?.click();
    }
  };

  constructor(private options: SetupOptions) {
    this.server = new URLSearchParams(location.search).get('server') ?? '';
    options.root.classList.add('setup-active');
    options.root.addEventListener('click', this.click);
    options.root.addEventListener('change', this.change);
    options.root.addEventListener('keydown', this.keydown);
    this.render();
  }

  destroy() {
    this.active = false;
    this.options.root.removeEventListener('click', this.click);
    this.options.root.removeEventListener('change', this.change);
    this.options.root.removeEventListener('keydown', this.keydown);
    this.options.root.classList.remove('setup-active');
  }

  private readIdentity() {
    const field = this.options.root.querySelector<HTMLInputElement>('#setup-name');
    if (field) this.name = field.value.trim().slice(0, 24) || 'Commander';
    const endpoint = this.options.root.querySelector<HTMLInputElement>('#setup-server');
    if (endpoint) this.server = endpoint.value.trim();
    const code = this.options.root.querySelector<HTMLInputElement>('#setup-code');
    if (code) this.joinCode = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    try { localStorage.setItem('commander-wars-player-name', this.name); } catch { /* The current name still works. */ }
  }

  private async onClick(event: Event) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-setup]');
    if (!button || button.disabled) return;
    this.readIdentity();
    const action = button.dataset.setup;
    this.error = '';
    if (action === 'solo') { this.mode = 'solo'; this.solo.slots[0].name = this.name; this.render(); }
    else if (action === 'play') { this.destroy(); this.options.onSolo(cloneSettings(this.solo)); }
    else if (action === 'host' || action === 'join') {
      if (action === 'join' && !this.joinCode) { this.error = 'Enter a lobby code to join your friends.'; this.render(); return; }
      this.connect(action);
    } else if (action === 'resume') {
      const session = NetworkClient.savedSession();
      if (session) { this.server = session.url; this.joinCode = session.code; this.connect('resume', session.token); }
    } else if (action === 'back' || action === 'leave') {
      this.client?.disconnect(); this.client = undefined; this.lobby = undefined;
      this.mode = 'home'; this.busy = false; this.status = ''; this.render();
    } else if (action === 'ffa' || action === '2v2') {
      const settings = cloneSettings(this.mode === 'solo' ? this.solo : this.lobby!.settings);
      settings.slots.forEach((slot, i) => slot.alliance = action === 'ffa' ? i : i < 2 ? 0 : 1);
      if (this.mode === 'solo') { this.solo = settings; this.render(); }
      else this.configure(settings);
    } else if (action === 'ready') {
      const self = this.lobby?.members.find(member => member.seat === this.client?.seat);
      this.client?.ready(!self?.ready);
    } else if (action === 'start') this.client?.start();
    else if (action === 'reconnect') this.client?.reconnect();
    else if (action === 'copy' || action === 'share') {
      const text = action === 'copy' ? this.lobby!.code : this.shareUrl();
      try { await navigator.clipboard.writeText(text); this.status = action === 'copy' ? 'Lobby code copied.' : 'Invite link copied.'; }
      catch { this.status = `Copy ${action === 'copy' ? 'the code above' : 'the invite link below'} to invite a friend.`; }
      this.render();
    }
  }

  private onChange(event: Event) {
    const field = event.target as HTMLSelectElement;
    if (field.id === 'setup-name' || field.id === 'setup-server' || field.id === 'setup-code') { this.readIdentity(); return; }
    if (field.dataset.slot === undefined || !field.dataset.field) return;
    const index = Number(field.dataset.slot), key = field.dataset.field as keyof MatchSlot;
    const source = this.mode === 'solo' ? this.solo : this.lobby?.settings;
    if (!source || index < 0 || index > 3) return;
    const settings = cloneSettings(source);
    const slot = settings.slots[index];
    if (key === 'alliance') slot.alliance = Number(field.value);
    else if (key === 'controller') slot.controller = field.value as MatchSlot['controller'];
    else if (key === 'difficulty') slot.difficulty = field.value as MatchSlot['difficulty'];
    if (this.mode === 'solo') { this.solo = settings; this.render(); }
    else if (this.lobby?.hostId === this.client?.id) this.configure(settings);
    else if (key === 'alliance') this.client?.chooseTeam(slot.alliance);
  }

  private configure(settings: MatchSettings) {
    if (!this.lobby || !this.client) return;
    // Preserve rapid successive edits while the server acknowledges each change.
    this.lobby.settings = settings;
    this.lobby.members = this.lobby.members.map(member => ({ ...member, ready: member.id === this.lobby!.hostId }));
    this.client.updateSettings(settings); this.render();
  }

  private connect(mode: 'host' | 'join' | 'resume', token?: string) {
    this.client?.disconnect();
    this.busy = true; this.status = 'Connecting to the lobby server…'; this.render();
    this.client = new NetworkClient({
      onLobby: lobby => { this.lobby = lobby; this.mode = 'lobby'; this.busy = false; this.error = ''; this.render(); },
      onStatus: (_state, message) => { this.status = message; this.busy = this.client?.status === 'connecting'; this.render(); },
      onError: message => { this.error = message; this.busy = false; this.render(); },
      onMatch: (world, client) => { this.destroy(); this.options.onMatch(world, client); },
    });
    this.client.connect({ mode, name: this.name, code: this.joinCode, settings: defaultSettings(false, this.name), url: this.server || undefined, token });
  }

  private shareUrl() {
    const url = new URL(location.href); url.search = ''; url.hash = '';
    url.searchParams.set('room', this.lobby!.code);
    if (this.server) url.searchParams.set('server', this.server);
    return url.toString();
  }

  private slots(settings: MatchSettings, solo = false) {
    const host = solo || this.lobby?.hostId === this.client?.id;
    const online = solo || this.client?.status === 'connected';
    const hostSeat = this.lobby?.members.find(member => member.id === this.lobby?.hostId)?.seat;
    return settings.slots.map((slot, i) => {
      const member = this.lobby?.members.find(member => member.seat === i);
      const self = !solo && this.client?.seat === i;
      const occupied = !!member;
      const controlDisabled = !online || !host || i === (solo ? 0 : hostSeat) || occupied;
      const teamDisabled = !online || !host && !self;
      const who = solo && i === 0 ? `${this.name} · You` : slot.controller === 'ai' ? `${seatNames[i]} AI` : slot.controller === 'closed' ? 'Empty section' : member ? `${member.name}${self ? ' · You' : ''}` : 'Waiting for a player';
      const connection = slot.controller === 'ai' ? `${slot.difficulty} AI` : slot.controller === 'closed' ? 'Excluded from the match' : solo ? 'Ready' : member ? `${member.connected ? member.ready ? 'Ready' : 'Not ready' : 'Disconnected'}` : 'Share the lobby code';
      return `<article class="setup-seat seat-${i}"><div class="seat-heading"><span class="seat-color" aria-hidden="true"></span><strong>${seatNames[i]} section</strong><span class="seat-readiness ${member?.ready || solo || slot.controller === 'ai' ? 'is-ready' : ''}">${escape(connection)}</span></div><p class="seat-name">${escape(who)}</p><label>Player<select data-slot="${i}" data-field="controller" aria-label="${seatNames[i]} player type" ${controlDisabled ? 'disabled' : ''}>${['human', 'ai', 'closed'].map(value => `<option value="${value}" ${slot.controller === value ? 'selected' : ''} ${solo && i !== 0 && value === 'human' ? 'disabled' : ''}>${value === 'human' ? 'Human' : value === 'ai' ? 'AI' : 'Closed'}</option>`).join('')}</select></label><label>Team<select data-slot="${i}" data-field="alliance" aria-label="${seatNames[i]} team" ${teamDisabled || slot.controller === 'closed' ? 'disabled' : ''}>${[0, 1, 2, 3].map(team => `<option value="${team}" ${slot.alliance === team ? 'selected' : ''}>Team ${team + 1}</option>`).join('')}</select></label><label>AI difficulty<select data-slot="${i}" data-field="difficulty" aria-label="${seatNames[i]} AI difficulty" ${!online || !host || slot.controller !== 'ai' ? 'disabled' : ''}>${['easy', 'normal', 'hard'].map(level => `<option value="${level}" ${slot.difficulty === level ? 'selected' : ''}>${level[0].toUpperCase()}${level.slice(1)}</option>`).join('')}</select></label></article>`;
    }).join('');
  }

  private startReason(settings: MatchSettings) {
    const active = settings.slots.filter(slot => slot.controller !== 'closed');
    if (active.length < 2) return 'Open at least two sections.';
    if (new Set(active.map(slot => slot.alliance)).size < 2) return 'Choose at least two opposing teams.';
    if (this.mode === 'solo') return '';
    for (let i = 0; i < settings.slots.length; i++) {
      if (settings.slots[i].controller !== 'human') continue;
      const member = this.lobby?.members.find(member => member.seat === i);
      if (!member) return `Waiting for a player in the ${seatNames[i].toLowerCase()} section. Set it to AI or closed to start without them.`;
      if (!member.connected) return `Waiting for ${member.name} to reconnect.`;
      if (!member.ready) return `${member.name} must click Ready.`;
    }
    return '';
  }

  private render() {
    if (!this.active) return;
    const home = this.mode === 'home';
    let content = '';
    if (home) content = `<h1>Gather your commanders</h1><p class="setup-lead">Defend your keep, field an army and defeat the opposing teams.</p><label class="setup-name">Your name<input id="setup-name" maxlength="24" autocomplete="nickname" value="${escape(this.name)}"></label><div class="setup-home-actions"><button data-setup="solo" ${this.busy ? 'disabled' : ''}><strong>Play against AI</strong><span>Choose teams and difficulty</span></button><button data-setup="host" ${this.busy ? 'disabled' : ''}><strong>Host a lobby</strong><span>Invite friends with a lobby code</span></button></div><div class="setup-join"><label for="setup-code">Join a friend's lobby</label><div><input id="setup-code" maxlength="8" placeholder="LOBBY CODE" autocomplete="off" value="${escape(this.joinCode)}"><button data-setup="join" ${this.busy ? 'disabled' : ''}>Join lobby</button></div></div>${NetworkClient.savedSession() ? '<button class="setup-resume" data-setup="resume">Reconnect to your last lobby or match</button>' : ''}<details class="setup-server"><summary>Connection settings</summary><label>Lobby server<input id="setup-server" type="url" placeholder="Use this website's server" value="${escape(this.server)}"></label><p>Leave blank to use this website. Use a custom server only when your host provides its address.</p></details>`;
    else {
      const solo = this.mode === 'solo', settings = solo ? this.solo : this.lobby!.settings;
      const host = solo || this.lobby?.hostId === this.client?.id;
      const self = this.lobby?.members.find(member => member.seat === this.client?.seat);
      const reason = this.startReason(settings);
      const online = solo || this.client?.status === 'connected';
      content = `<div class="setup-topline"><button data-setup="${solo ? 'back' : 'leave'}">${solo ? '← Back' : 'Leave lobby'}</button><h1>${solo ? 'Game setup' : 'Your lobby'}</h1></div>${!solo ? `<div class="setup-invite"><div><small>Lobby code</small><strong id="lobby-code">${escape(this.lobby!.code)}</strong></div><div class="buttons"><button data-setup="copy">Copy code</button><button data-setup="share">Copy invite link</button></div></div><input class="setup-share-url" aria-label="Invite link" readonly value="${escape(this.shareUrl())}">` : ''}<p class="setup-lead">Players on the same team fight together. Closed sections sit out.</p><div class="setup-presets"><span>Teams</span><button data-setup="ffa" ${host && online ? '' : 'disabled'}>Free for all</button><button data-setup="2v2" ${host && online ? '' : 'disabled'}>2 vs 2</button></div><div class="setup-seats">${this.slots(settings, solo)}</div><p class="setup-difficulty-note">Easy AI builds and attacks more slowly. Hard AI acts earlier and adapts faster. Every player uses the same combat and resource rules.</p><div class="setup-launch">${solo ? `<button class="setup-primary" data-setup="play" ${reason ? 'disabled' : ''}>Start game</button>` : `<button data-setup="ready" class="${self?.ready ? 'active' : ''}" ${online ? '' : 'disabled'}>${self?.ready ? 'Ready ✓ · Unready' : 'Ready'}</button>${host ? `<button data-setup="start" class="setup-primary" ${reason || !online ? 'disabled' : ''}>Start match</button>` : '<span>The host starts the match when everyone is ready.</span>'}`}<p id="setup-start-reason">${escape(reason || (solo ? 'Ready to play.' : 'All commanders are ready.'))}</p></div>`;
    }
    this.options.root.innerHTML = `<div class="setup-screen"><section class="setup-card"><div class="setup-brand"><span aria-hidden="true">⚔</span><strong>COMMANDER WARS</strong><small>Four sections · Your teams · Your strategy</small></div>${content}<div class="setup-feedback" aria-live="polite"><p class="setup-status">${escape(this.status)}</p><p class="setup-error" role="alert">${escape(this.error)}</p>${this.client?.status === 'disconnected' ? '<button data-setup="reconnect">Reconnect</button>' : ''}</div></section></div>`;
  }
}
