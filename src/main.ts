import './style.css';
import { createWorld } from './game/world';
import { step } from './game/simulation';
import { RULES } from './game/config';
import { Battlefield } from './view/battlefield';
import { Input } from './view/input';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div><strong>COMMANDER WARS</strong><span class="muted">PLAYABLE PROTOTYPE</span></div><div id="resources"></div><button id="pause">Pause</button></header>
  <main><div id="battlefield"><div class="objective">Destroy the three enemy keeps.</div></div><aside>
    <h2>Commander</h2><div id="commander"></div><div class="buttons"><button id="hero">F1 · Select hero</button><button id="army">Tab · All army</button></div>
    <h2>Orders</h2><p>Right-click ground to move. Right-click enemies to attack.</p><button id="advance">X · Attack-move</button><button id="hold">H · Hold position</button>
    <h2>Field log</h2><div id="log"></div>
    <details><summary>Controls</summary><p>WASD pan · Wheel zoom · Left-click or drag to select · Shift adds selection · Space centers hero · Escape clears selection.</p></details>
  </aside></main><footer><span id="selected"></span><span id="time"></span></footer>`;
const w = createWorld();
const view = new Battlefield(document.querySelector('#battlefield')!);
const input = new Input(w, view);
document.querySelector('#hero')!.addEventListener('click', () => input.selectHero());
document.querySelector('#army')!.addEventListener('click', () => input.selectArmy());
document.querySelector('#advance')!.addEventListener('click', () => { input.attackMove = true; });
document.querySelector('#hold')!.addEventListener('click', () => { w.units.filter(u => input.selected.has(u.id)).forEach(u => { u.order = 'hold'; u.goal = { x: u.x, z: u.z }; }); });
document.querySelector('#pause')!.addEventListener('click', () => { w.paused = !w.paused; });
let last = performance.now(), accumulator = 0, uiTime = 0;
function frame(now: number) {
  const elapsed = Math.min((now - last) / 1000, 0.1); last = now; accumulator += elapsed;
  while (accumulator >= RULES.tick) { step(w, RULES.tick); accumulator -= RULES.tick; }
  view.pan(elapsed); view.render(w, input.selected);
  if ((uiTime += elapsed) > 0.15) {
    uiTime = 0;
    const p = w.players[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero');
    document.querySelector('#resources')!.textContent = `Gold ${Math.floor(p.gold)}`;
    document.querySelector('#commander')!.innerHTML = `Captain · Level ${p.level}<br>${hero ? `${Math.ceil(hero.hp)} / ${hero.maxHp} HP` : `Respawn ${Math.ceil(p.respawn)}s`}<br>XP ${Math.floor(p.xp)} / ${p.level * 40}`;
    document.querySelector('#log')!.innerHTML = w.events.map(e => `<p>${e}</p>`).join('');
    document.querySelector('#selected')!.textContent = input.attackMove ? 'ATTACK-MOVE: click a destination' : `${input.selected.size} selected · Right-click to command`;
    document.querySelector('#time')!.textContent = `${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, '0')}`;
    document.querySelector('#pause')!.textContent = w.paused ? 'Resume' : 'Pause';
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
