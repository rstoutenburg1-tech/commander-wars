import { RULES, ranks, troopKinds, STATS, UPGRADES, TEAMS, FORMATIONS, ABILITIES, ITEMS, type Building } from '../game/config';
import { startUpgrade, buildingLevel, cycleCost, unlocked, upgradeReason } from '../game/economy';
import { command, commandRegiment } from '../game/commands';
import { cast } from '../game/abilities';
import { startCraft, merchant, inSafeZone } from '../game/objectives';
import type { Formation, Engagement, Priority, Order } from '../game/types';
import { levelFloor, refreshStats, xpRequired } from '../game/hero';
import { spawn } from '../game/world';
import type { World } from '../game/types';
import type { Input } from '../view/input';
import type { Battlefield } from '../view/battlefield';

const names: Record<Building, string> = { base: 'Keep', barracks: 'Barracks', crafting: 'Workshop', goldmine: 'Gold mine', forest: 'Forest', quarry: 'Quarry' };
const buildings = Object.keys(names) as Building[];
function text(id: string, value: string) { const el = document.getElementById(id); if (el && el.textContent !== value) el.textContent = value; }
export class HUD {
  speed = 1;
  editingRegiment = 0;
  constructor(private w: World, private input: Input, private view: Battlefield) {
    document.querySelector('#hud')!.innerHTML = `
      <h2>Your commander</h2><div id="commander"></div><div class="buttons"><button data-action="hero">F1 · Hero</button><button data-action="army">Tab · Army</button><button data-action="center">Space · Find</button></div>
      <div class="buttons"><button data-ability="rally" class="ability"></button><button data-ability="wind" class="ability"></button></div>
      <nav><button data-panel="army" class="active">Army</button><button data-panel="supply">Supply</button><button data-panel="base">Base</button><button data-panel="objectives">Center</button><button data-panel="intel">Intel</button></nav>
      <section data-section="army">
        <h2>Orders</h2><div class="buttons"><button data-action="advance">X · Attack-move</button><button data-action="hold">H · Hold</button></div>
        <h2>Regiment doctrine</h2><div class="regiments">${[0, 1, 2, 3].map(i => `<button data-regiment="${i}">${i + 1}</button>`).join('')}</div><p id="regiment-status"></p>
        <button data-action="assign">Assign selected troops · Ctrl+1–4</button>
        <label>Formation <select id="formation"><option value="line">Battle line</option><option value="wall">Shield wall</option><option value="wedge">Cavalry wedge</option></select></label>
        <p id="formation-help"></p>
        <label>Movement <select id="movement"><option value="hold">Hold position</option><option value="follow">Follow commander</option><option value="advance">Advance to order</option><option value="move">Move to order</option><option value="retreat">Retreat to keep</option><option value="attack" hidden>Attack target</option></select></label>
        <label>Engagement <select id="engagement"><option value="aggressive">Aggressive</option><option value="defensive">Defensive</option><option value="charge">Charge</option></select></label>
        <label>Priority <select id="priority"><option value="closest">Closest</option><option value="hero">Hero first</option><option value="ranged">Ranged first</option></select></label>
      </section><section data-section="supply" hidden><h2>Automatic production</h2><label>Cycle <select id="interval"><option value="10">10 seconds</option><option value="15">15 seconds</option><option value="20">20 seconds</option><option value="30">30 seconds</option><option value="0">Paused</option></select></label>
        <label>Gold reserve <input id="reserve" type="number" min="0" max="5000" step="25" value="50"></label>
        <label>New troops join <select id="spawn-regiment">${[0, 1, 2, 3].map(i => `<option value="${i}">Regiment ${i + 1}</option>`).join('')}</select></label>
        <div class="production">${troopKinds.map(k => `<label>${k.charAt(0).toUpperCase() + k.slice(1)} <small>${STATS[k].cost}g</small><input data-count="${k}" aria-label="${k} per cycle" type="number" min="0" max="8" value="${k === 'footman' ? 4 : 0}"></label>`).join('')}</div>
        <p id="production-cost"></p><p id="production-status"></p><p id="composition-help"></p>
      </section>
      <section data-section="objectives" hidden><h2>Iron Golem</h2><p id="boss-status"></p><p>Dangerous early. Watch for the orange smash warning. Armies need an explicit attack order to engage the boss.</p><button data-action="boss">Attack boss with selected</button>
        <h2>Workshop</h2><p id="items-status"></p><button data-craft="sword">Longsword · 40w / 35o · 5s</button><p>+18 commander damage</p><button data-craft="armor">Armor · 90g / 50o · 5s</button><p>+220 HP and 15% damage reduction</p>
        <h2>Merchant safe zone</h2><p id="merchant-status"></p><p>Commander only. Enter the green circle to trade. Attacks and damage are blocked inside it.</p><button data-trade="buy">Heal 40% · 90 gold</button><button data-trade="sell-sword">Sell longsword · 100 gold</button><button data-trade="sell-armor">Sell armor · 130 gold</button>
      </section>
      <section data-section="base" hidden><h2>Infrastructure</h2><p>Production continues during upgrades. Develop wood and ore, then build the workshop to unlock Tier II.</p>
        ${buildings.map(b => `<div class="upgrade"><button data-upgrade="${b}"></button><small id="cost-${b}"></small></div>`).join('')}
        <div id="construction"></div>
      </section>
      <section data-section="intel" hidden><h2>Opponents</h2><div id="scores"></div><h2>Field log</h2><div id="log"></div>
        <details><summary>Developer controls</summary><div class="buttons"><button data-debug="resources">+ resources</button><button data-debug="xp">+ XP</button><button data-debug="tier">Promote now</button><button data-debug="roster">Spawn roster</button><button data-debug="ai">Toggle AI</button><button data-debug="invulnerable">Invulnerability</button></div><label>Simulation speed <select id="speed"><option>1</option><option>2</option><option>4</option><option>8</option></select></label><p id="debug-status"></p></details>
      </section>
      <details><summary>Controls & goal</summary><p>WASD pan · Wheel zoom · Click / drag select · Shift adds selection · Right-click move or attack · X then left-click: attack-move · H: hold · F: follow · T: retreat · 1–4: select regiment · Ctrl+1–4: assign · Q: Rally · E: Second Wind · Space: find hero · Home: overview · Escape: clear.</p><p>Unlock ranged troops at Tier II + Barracks II; knights at Tier III + Barracks III. Production changes affect future units.</p></details>`;
    document.querySelector('#pause')!.addEventListener('click', () => { w.paused = !w.paused; });
    document.querySelector('#hud')!.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest('button'); if (!button) return;
      if (button.dataset.panel) {
        document.querySelectorAll<HTMLElement>('[data-section]').forEach(s => { s.hidden = s.dataset.section !== button.dataset.panel; });
        document.querySelectorAll('[data-panel]').forEach(b => b.classList.toggle('active', b === button));
      }
      if (button.dataset.action === 'hero') input.selectHero();
      if (button.dataset.action === 'army') input.selectArmy();
      if (button.dataset.action === 'center') { const hero = w.units.find(u => u.team === 0 && u.kind === 'hero'); if (hero) { view.zoom = 45; view.center(hero); view.resize(); } }
      if (button.dataset.action === 'advance') input.attackMove = true;
      if (button.dataset.action === 'hold') command(w, input.selected, 'hold');
      if (button.dataset.action === 'assign') input.assignRegiment(this.editingRegiment);
      if (button.dataset.action === 'boss') { const boss = w.units.find(u => u.kind === 'boss'); if (boss) command(w, input.selected, 'attack', boss, boss.id); }
      if (button.dataset.regiment !== undefined) { this.editingRegiment = Number(button.dataset.regiment); input.selectRegiment(this.editingRegiment); }
      if (button.dataset.ability) cast(w, 0, button.dataset.ability as 'rally' | 'wind');
      if (button.dataset.craft) startCraft(w, 0, button.dataset.craft as 'sword' | 'armor');
      if (button.dataset.trade) merchant(w, button.dataset.trade as 'buy' | 'sell-sword' | 'sell-armor');
      if (button.dataset.upgrade) startUpgrade(w, 0, button.dataset.upgrade as Building);
      if (button.dataset.debug) this.debug(button.dataset.debug);
      this.update();
    });
    document.querySelector('#interval')!.addEventListener('change', e => { const prod = w.players[0].production; prod.interval = Number((e.target as HTMLSelectElement).value); prod.timer = prod.interval; });
    document.querySelector('#reserve')!.addEventListener('change', e => { const field = e.target as HTMLInputElement; const n = Math.max(0, Math.min(5000, Number(field.value) || 0)); field.value = String(n); w.players[0].production.reserve = n; });
    document.querySelector('#speed')!.addEventListener('change', e => { this.speed = Number((e.target as HTMLSelectElement).value); });
    const edited = () => w.regiments.find(r => r.team === 0 && r.index === this.editingRegiment)!;
    document.querySelector('#formation')!.addEventListener('change', e => { edited().formation = (e.target as HTMLSelectElement).value as Formation; });
    document.querySelector('#engagement')!.addEventListener('change', e => { edited().engagement = (e.target as HTMLSelectElement).value as Engagement; });
    document.querySelector('#priority')!.addEventListener('change', e => { edited().priority = (e.target as HTMLSelectElement).value as Priority; });
    document.querySelector('#movement')!.addEventListener('change', e => commandRegiment(w, 0, this.editingRegiment, (e.target as HTMLSelectElement).value as Order));
    document.querySelector('#spawn-regiment')!.addEventListener('change', e => { w.players[0].production.regiment = Number((e.target as HTMLSelectElement).value); });
    document.addEventListener('keydown', e => { if ((e.target as HTMLElement).matches('input,select,textarea') || e.repeat) return; if (e.key.toLowerCase() === 'q') cast(w, 0, 'rally'); if (e.key.toLowerCase() === 'e') cast(w, 0, 'wind'); });
    document.querySelectorAll<HTMLInputElement>('[data-count]').forEach(field => field.addEventListener('change', () => {
      const p = w.players[0], kind = field.dataset.count as typeof troopKinds[number];
      const other = troopKinds.filter(k => k !== kind).reduce((s, k) => s + p.production.counts[k], 0);
      p.production.counts[kind] = Math.max(0, Math.min(RULES.maxCycleUnits - other, Math.floor(Number(field.value) || 0))); field.value = String(p.production.counts[kind]);
    }));
    document.addEventListener('keydown', e => { if (e.key === 'Home' && !(e.target as HTMLElement).matches('input,select')) { e.preventDefault(); view.zoom = 105; view.center({ x: 0, z: 0 }); view.resize(); } });
    this.update();
  }
  private debug(action: string) {
    const p = this.w.players[0];
    if (p.eliminated) return;
    if (action === 'resources') { p.gold += 1000; p.wood += 300; p.ore += 300; }
    if (action === 'xp') p.xp += 1000;
    if (action === 'tier') { p.tier = Math.min(3, p.tier + 1); p.level = Math.max(p.level, levelFloor(p.tier)); p.barracks = p.tier; p.crafting = 1; refreshStats(this.w, 0); }
    if (action === 'ai') this.w.aiEnabled = !this.w.aiEnabled;
    if (action === 'invulnerable') this.w.invulnerable = !this.w.invulnerable;
    if (action === 'roster') for (const kind of troopKinds) spawn(this.w, 0, kind, { x: -32 + troopKinds.indexOf(kind) * 2, z: 30 });
  }
  update() {
    const w = this.w, p = w.players[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero');
    text('resources', `Gold ${Math.floor(p.gold)}  ·  Wood ${Math.floor(p.wood)}  ·  Ore ${Math.floor(p.ore)}`);
    text('commander', `${ranks[p.tier - 1]} · Lv ${p.level} / ${p.tier * 10}  |  ${hero ? `${Math.ceil(hero.hp)} / ${Math.ceil(hero.maxHp)} HP` : `Respawn ${Math.ceil(p.respawn)}s`}  |  Mana ${Math.floor(p.mana)} / ${RULES.hero.mana}  |  XP ${Math.floor(p.xp)} / ${xpRequired(p.level)}${p.bankedXP ? ` · ${Math.floor(p.bankedXP)} banked` : ''}`);
    for (const ability of ['rally', 'wind'] as const) {
      const btn = document.querySelector<HTMLButtonElement>(`[data-ability="${ability}"]`)!;
      btn.textContent = `${ability === 'rally' ? 'Q' : 'E'} · ${ABILITIES[ability].name} · ${p.cooldowns[ability] > 0 ? `${Math.ceil(p.cooldowns[ability])}s` : `${ABILITIES[ability].cost} mana`}`;
      btn.disabled = !hero || w.paused || w.winner !== null || p.mana < ABILITIES[ability].cost || p.cooldowns[ability] > 0;
      btn.title = ability === 'rally' ? 'Nearby army: +40% attack speed, +25% movement, +30 cohesion for 10s' : 'Restore 30% of commander maximum HP';
    }
    const selectedTroops = w.units.filter(u => this.input.selected.has(u.id) && u.kind !== 'hero' && u.kind !== 'base');
    if (selectedTroops.length && selectedTroops.every(u => u.regiment === selectedTroops[0].regiment)) this.editingRegiment = selectedTroops[0].regiment;
    const r = w.regiments.find(r => r.team === 0 && r.index === this.editingRegiment)!;
    text('regiment-status', `Regiment ${r.index + 1}: ${w.units.filter(u => u.team === 0 && u.regiment === r.index && u.kind !== 'hero' && u.kind !== 'base').length} troops · cohesion ${Math.round(r.cohesion)}%`);
    document.querySelectorAll<HTMLButtonElement>('[data-regiment]').forEach(b => b.classList.toggle('active', Number(b.dataset.regiment) === r.index));
    for (const key of ['formation', 'engagement', 'priority', 'movement'] as const) { const field = document.querySelector<HTMLSelectElement>(`#${key}`)!; if (document.activeElement !== field) field.value = r[key]; }
    text('formation-help', r.formation === 'wall' ? 'Footmen: up to 48% frontal reduction at full cohesion. 35% slower. Flanks bypass protection.' : r.formation === 'wedge' ? '12% faster. Charging knights hit harder after 8m of movement and disrupt enemy cohesion.' : 'Wide frontage; melee front, ranged rear. Small frontal protection scales with cohesion.');
    text('production-cost', `${troopKinds.reduce((s, k) => s + p.production.counts[k], 0)} units / cycle · ${cycleCost(p)}g · burn ${p.production.interval ? Math.round(cycleCost(p) * 60 / p.production.interval) : 0}g/min vs income ${RULES.incomeRates.goldmine[p.goldmine] * 60}g/min`);
    const boss = w.units.find(u => u.kind === 'boss');
    text('boss-status', boss ? `${Math.ceil(boss.hp)} / ${boss.maxHp} HP · Reward: 650g / 100o + XP` : 'Defeated this match.');
    text('items-status', p.craft ? `Crafting ${ITEMS[p.craft.item].name} · ${Math.ceil(p.craft.remaining)}s` : `Equipped: ${p.items.sword ? 'Longsword ' : ''}${p.items.armor ? 'Armor' : ''}${!p.items.sword && !p.items.armor ? 'none' : ''}`);
    document.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach(b => { const item = b.dataset.craft as 'sword' | 'armor', cost = ITEMS[item].cost; b.disabled = p.crafting < 1 || !!p.craft || p.items[item] || p.gold < cost.gold || p.wood < cost.wood || p.ore < cost.ore; b.title = p.crafting < 1 ? 'Build workshop at your base first' : 'Craft and automatically equip'; });
    text('merchant-status', `${hero && inSafeZone(hero) ? 'In trading range' : 'Commander outside safe zone'} · merchant gold ${Math.floor(w.merchantGold)}`);
    document.querySelectorAll<HTMLButtonElement>('[data-trade]').forEach(b => { const action = b.dataset.trade!; b.disabled = !hero || !inSafeZone(hero) || (action === 'buy' ? p.gold < ITEMS.potion.buy : action === 'sell-sword' ? !p.items.sword || w.merchantGold < ITEMS.sword.sell : !p.items.armor || w.merchantGold < ITEMS.armor.sell); });
    text('production-status', `${p.production.status} · next ${Math.max(0, Math.ceil(p.production.timer))}s`);
    text('composition-help', p.tier === 1 ? 'Tier I: footmen composition locked. Cycle and reserve remain adjustable.' : 'Up to 8 troops per cycle. Existing units keep their class.');
    document.querySelectorAll<HTMLInputElement>('[data-count]').forEach(f => { f.disabled = p.tier < 2 || !unlocked(p, f.dataset.count!); if (document.activeElement !== f) f.value = String(p.production.counts[f.dataset.count as typeof troopKinds[number]]); });
    for (const b of buildings) {
      const level = buildingLevel(p, b), next = UPGRADES[b][level + 1];
      const btn = document.querySelector<HTMLButtonElement>(`[data-upgrade="${b}"]`)!;
      btn.textContent = `${names[b]} ${level || 'undeveloped'} → ${next ? level + 1 : 'MAX'}`;
      const reason = upgradeReason(p, b); btn.disabled = !!reason; btn.title = reason ?? 'Start construction';
      text(`cost-${b}`, next ? `${next.cost.gold}g / ${next.cost.wood}w / ${next.cost.ore}o · ${next.time}s${reason && !reason.startsWith('Need') ? ` · ${reason}` : ''}` : 'Prototype maximum');
    }
    document.querySelector('#construction')!.innerHTML = p.upgrades.map(j => `<p>${names[j.building]} ${j.to} · ${Math.ceil(j.remaining)}s<progress max="${j.total}" value="${j.total - j.remaining}"></progress></p>`).join('');
    document.querySelector('#scores')!.innerHTML = w.players.map(pl => `<p style="border-left:3px solid ${TEAMS[pl.id].color};padding-left:8px">${TEAMS[pl.id].name}: ${pl.eliminated ? 'eliminated' : `T${pl.tier} · Lv ${pl.level} · ${w.units.filter(u => u.team === pl.id && u.kind !== 'base' && u.kind !== 'hero').length} troops · ${pl.id ? pl.aiState : 'you'}`}</p>`).join('');
    document.querySelector('#log')!.innerHTML = w.events.map(e => `<p>${e}</p>`).join('');
    text('debug-status', `AI ${w.aiEnabled ? 'on' : 'off'} · Player invulnerability ${w.invulnerable ? 'on' : 'off'}`);
    for (const id of this.input.selected) if (!w.units.some(u => u.id === id)) this.input.selected.delete(id);
    text('selected', this.input.attackMove ? 'ATTACK-MOVE: left-click a destination' : `${this.input.selected.size} selected · Right-click move / attack`);
    text('time', `${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, '0')} · ${w.units.length} entities`);
    text('pause', w.paused ? 'Resume' : 'Pause');
    if (w.winner !== null) {
      const outcome = document.querySelector<HTMLElement>('#outcome')!; outcome.hidden = false;
      if (!outcome.innerHTML) {
        outcome.innerHTML = `<h1>${w.winner === 0 ? 'Victory' : 'Defeat'}</h1><p>${w.winner === 0 ? 'All enemy keeps destroyed.' : 'Your keep has fallen.'}</p><button id="restart">New match</button>`;
        document.querySelector('#restart')!.addEventListener('click', () => location.reload());
      }
    }
  }
}
