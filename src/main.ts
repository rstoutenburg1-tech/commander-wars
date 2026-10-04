import './style.css';
import { createWorld } from './game/world';
import { step } from './game/simulation';
import { RULES } from './game/config';
import { Battlefield } from './view/battlefield';
import { Input } from './view/input';
import { HUD } from './ui/context-hud';
import { Minimap } from './ui/minimap';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div><strong>COMMANDER WARS</strong><span class="muted">MECHANICS PROTOTYPE</span></div><div id="resources"></div><button id="pause">Pause</button></header>
  <main><div id="battlefield"><div class="objective">Destroy the three enemy keeps.<br><small>Tab: hero · 1–9: regiments · WASD: cursor · Arrows: camera<br>X: attack · Enter: move · F2/F3/F4: line/wall/wedge</small></div><div id="outcome" hidden></div></div><aside id="hud"></aside></main>
  <footer><span id="selected"></span><span id="time"></span></footer>`;
const w = createWorld();
const view = new Battlefield(document.querySelector('#battlefield')!);
const input = new Input(w, view);
const hud = new HUD(w, input);
const minimap = new Minimap(w, view);
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { commanderWars: { world: w, input, view, step, hud } });
let last = performance.now(), accumulator = 0, uiTime = 0;
function frame(now: number) {
  const elapsed = Math.min((now - last) / 1000, 0.1); last = now;
  if (!w.paused && w.winner === null) accumulator += elapsed * hud.speed;
  while (accumulator >= RULES.tick) { step(w, RULES.tick); accumulator -= RULES.tick; }
  view.pan(elapsed); input.updateCursor(elapsed); view.render(w, input.selected, input.cursorTarget?.id);
  if ((uiTime += elapsed) > 0.15) {
    uiTime = 0;
    hud.update();
    minimap.update();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
