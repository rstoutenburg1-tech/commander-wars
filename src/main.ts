import './style.css';
import { createWorld } from './game/world';
import { step } from './game/simulation';
import { MAP, RULES } from './game/config';
import { localPlayer, type MatchSettings } from './game/match';
import type { World } from './game/types';
import { Battlefield } from './view/battlefield';
import { Input } from './view/input';
import { HUD } from './ui/context-hud';
import { Minimap } from './ui/minimap';
import { SetupScreen } from './ui/setup';
import type { NetworkClient } from './network/client';

const app = document.querySelector<HTMLDivElement>('#app')!;
const query = new URLSearchParams(location.search);
let setup: SetupScreen | undefined;

function startGame(w: World, client?: NetworkClient) {
  setup?.destroy();
  app.innerHTML = `
    <header><div><strong>COMMANDER WARS</strong><span class="muted" id="network-status">${client ? 'ONLINE MATCH' : 'PRACTICE MATCH'}</span></div><div id="resources"></div><button id="pause" ${client ? 'hidden' : ''}>Pause</button><button id="leave-match">Leave match</button></header>
    <main><div id="battlefield"><div class="objective">Defeat the opposing keeps with your team.<br><small>Tab: hero · 1–9: regiments · WASD: cursor · Arrows: camera<br>X: attack · Enter: move · F2/F3/F4: line/wall/wedge</small></div><div id="network-notice" hidden role="status"><span></span><button id="reconnect" hidden>Reconnect</button></div><div id="outcome" hidden></div></div><aside id="hud"></aside></main>
    <footer><span id="selected"></span><span id="time"></span></footer>`;
  const view = new Battlefield(document.querySelector('#battlefield')!);
  view.center(MAP.bases[localPlayer(w)]);
  const input = new Input(w, view, undefined, client ? action => client.sendAction(action) : undefined);
  const hud = new HUD(w, input);
  const minimap = new Minimap(w, view);
  document.querySelector('#leave-match')!.addEventListener('click', () => {
    client?.disconnect();
    location.assign(location.pathname + '?setup=1');
  });
  if (client) {
    const connection = document.querySelector<HTMLElement>('#network-status')!;
    const notice = document.querySelector<HTMLElement>('#network-notice')!;
    const noticeText = notice.querySelector('span')!;
    const reconnect = notice.querySelector<HTMLButtonElement>('#reconnect')!;
    reconnect.addEventListener('click', () => client.reconnect());
    const status = (state: string, message: string) => {
      connection.textContent = `${client.code} · Team ${w.players[localPlayer(w)].alliance + 1} · ${state === 'connected' ? 'Online' : state}`;
      notice.hidden = state === 'connected';
      noticeText.textContent = message; reconnect.hidden = state !== 'disconnected';
    };
    client.onStatus(status);
    client.onMessage(message => {
      if (message.type === 'error') { notice.hidden = false; noticeText.textContent = message.message; setTimeout(() => { if (client.status === 'connected') notice.hidden = true; }, 3500); }
    });
    status(client.status, client.lastError);
  }
  if (query.has('debug')) Object.assign(window, { commanderWars: { world: w, input, view, step, hud, client } });
  let last = performance.now(), accumulator = 0, uiTime = 0;
  function frame(now: number) {
    const elapsed = Math.min((now - last) / 1000, 0.1); last = now;
    if (!client) {
      if (!w.paused && w.winner === null) accumulator += elapsed * hud.speed;
      while (accumulator >= RULES.tick) { step(w, RULES.tick); accumulator -= RULES.tick; }
    }
    view.pan(elapsed); input.updateCursor(elapsed); view.render(w, input.selected, input.cursorTarget?.id);
    if ((uiTime += elapsed) > 0.15) { uiTime = 0; hud.update(); minimap.update(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Existing developer smoke pages can start practice directly; normal play uses setup.
if (query.has('debug') && !query.has('setup') && !query.has('room') && !query.has('lobby')) startGame(createWorld());
else setup = new SetupScreen({ root: app, onSolo: (settings: MatchSettings) => startGame(createWorld(settings)), onMatch: startGame });
