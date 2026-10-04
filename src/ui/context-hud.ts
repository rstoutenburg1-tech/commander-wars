import { ABILITIES, FORMATIONS, ITEMS, MAP, RULES, SKILLS, STATS, TEAMS, UPGRADES, SHOP_TOMES, TARGET_PRIORITIES, isTroop, ranks, troopKinds, type Ability, type Building, type SkillId, type TroopKind, type ItemId, type ItemSlot, type OutpostBuilding } from '../game/config';
import { buildingLevel, cycleCost, startUpgrade, unlocked, upgradeReason } from '../game/economy';
import { cast } from '../game/abilities';
import { command, commandRegiment } from '../game/commands';
import { grantLevelPoints, skillPoints, skillReason, trainSkill, activeSlots } from '../game/skills';
import { buildingNames, selectedStructure } from '../game/structures';
import { levelFloor, refreshStats, xpRequired } from '../game/hero';
import { merchant, startCraft, inSafeZone } from '../game/objectives';
import { spawn } from '../game/world';
import { ABILITY_KEYS, learnedAbilities, syncAbilityBindings } from '../game/hotkeys';
import { selectedRegiments, gatherArmy } from '../game/formations';
import { atMerchant, abilityRank, buyItem, sellItem, buyConsumable, craftReason, equipItem, unequipItem, maxMana, trainHero, trainingReason, type Training } from '../game/items';
import { heroProgressionPanel, equipmentPanel, merchantPanel, workshopPanel } from './hero-panels';
import { gatePanel, territoriesPanel, outpostPanel, updateGatePanel, updateOutpostPanel } from './territory-panels';
import { toggleGate, repairGate, buildTower, garrisonUnit, leaveTower, gatePosition } from '../game/gates';
import { buildOutpost } from '../game/outposts';
import type { World, Formation, Engagement, Priority, Order } from '../game/types';
import type { Input } from '../view/input';
const setText = (id: string, value: string) => { const e = document.getElementById(id); if (e && e.textContent !== value) e.textContent = value; };
export class HUD {
  speed = 1; editingRegiment = 0; private context = ''; private wasTrading = false;
  constructor(private w: World, private input: Input) {
    document.querySelector('#pause')!.addEventListener('click', () => { w.paused = !w.paused; });
    document.querySelector('#hud')!.addEventListener('click', e => this.click((e.target as HTMLElement).closest('button')));
    document.querySelector('#hud')!.addEventListener('change', e => this.change(e.target as HTMLInputElement));
    this.update();
  }
  private upgrade(building: Building) { return `<div class="upgrade"><button data-upgrade="${building}"></button><small id="upgrade-cost"></small><p id="upgrade-reason"></p><div id="construction"></div></div>`; }
  private renderContext(key: string) {
    this.context = key; const w = this.w, s = selectedStructure(w, this.input.selected);
    const common = `<div class="buttons quick-select"><button data-action="hero">Tab · Hero</button><button data-panel="items">Items</button><button data-select="base">K · Keep</button><button data-select="barracks">B · Barracks</button><button data-select="crafting">Workshop</button><button data-select="goldmine">Gold mine</button><button data-select="quarry">Quarry</button><button data-select="forest">Forest</button><button data-panel="merchant">Merchant</button><button data-action="army">0 · Troops</button><button data-action="gate">Gate & tower</button><button data-action="territories">Captured bases</button></div><h2>Regiments · 1–9</h2><div class="regiments">${Array.from({ length: RULES.regimentCount }, (_, i) => `<button data-regiment="${i}"></button>`).join('')}</div><p>Ctrl + number: assign selected troops · Shift + number: add regiment.</p><div id="quick-formations"><h2>Formation</h2><div class="formation-buttons">${Object.entries(FORMATIONS).map(([id, f], i) => `<button data-formation="${id}" title="${f.name}: F${i + 2}" aria-pressed="false"><strong>F${i + 2}</strong>${f.name}</button>`).join('')}</div><p id="formation-status"></p></div>`;
    let content = '';
    if (this.input.sidebarView === 'gate') content = gatePanel(w, this.input.activeGateSite);
    else if (this.input.sidebarView === 'territories') content = territoriesPanel(w);
    else if (this.input.sidebarView === 'items') content = equipmentPanel(w.players[0]);
    else if (this.input.sidebarView === 'merchant') content = merchantPanel(w.players[0]);
    else if (this.input.sidebarView === 'hero') content = `<h2 id="selection-name">Hero</h2><p id="selection-stats"></p><h2>Hero command</h2><button data-action="gather">F · Gather army around hero</button><div class="buttons"><button data-escort-layout="ring">Ring</button><button data-escort-layout="vanguard">Vanguard</button><button data-escort-layout="rearguard">Rear guard</button></div><label>March at army speed<input id="march-army" type="checkbox"></label><label>Hero target priority<select id="hero-priority">${Object.entries(TARGET_PRIORITIES).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><label>Automatic engagement<input id="auto-tracking" type="checkbox"></label><p>Each escort regiment takes a separate position. Give a regiment a move/attack order to operate independently. X overrides automatic targets.</p>${heroProgressionPanel()}<h2>Abilities</h2><div id="abilities"></div>`;
    else if (s && w.territories[s.site].captured) content = outpostPanel(s.site);
    else if (s) {
      content = `<h2 id="selection-name"></h2><p id="selection-stats"></p>`;
      if (s.building === 'base') content += `${this.upgrade('base')}<p>Keep advancement raises your commander's level cap and minimum level. Select the hero with Tab to manage skills, training and equipment.</p>`;
      else if (s.building === 'barracks') content += `${this.upgrade('barracks')}<h2>Troop production</h2><p>Click a troop to add it to future waves. Existing troops keep their class.</p><div class="troop-cards">${troopKinds.map(k => `<div class="troop-card"><button data-troop="${k}"></button><div class="buttons"><button data-minus="${k}" aria-label="Remove ${k} from wave">−</button><span id="count-${k}"></span></div><small id="unlock-${k}"></small></div>`).join('')}</div>
        <label>Wave interval <select id="interval">${[10, 15, 20, 30].map(n => `<option value="${n}">${n} seconds</option>`).join('')}<option value="0">Paused</option></select></label><label>Gold reserve <input id="reserve" type="number" min="0" max="5000" step="25"></label><label>Assign new troops <select id="spawn-regiment">${Array.from({ length: RULES.regimentCount }, (_, i) => `<option value="${i}">Regiment ${i + 1}</option>`).join('')}</select></label><p id="production-cost"></p><p id="production-status"></p>`;
      else if (s.building === 'crafting') content += `${this.upgrade('crafting')}${workshopPanel()}`;
      else content += `${this.upgrade(s.building)}<p id="income-rate"></p><p>Develop this site for automatic extraction. Upgrades keep producing at the previous rate until complete.</p>`;
    } else {
      const units = w.units.filter(u => this.input.selected.has(u.id));
      content = `<h2 id="selection-name">${units.length ? 'Selected army' : 'Select a unit or building'}</h2><p id="selection-stats"></p>`;
      if (units.length) content += `<p>WASD: move cursor · Arrows: pan · X: attack cursor · Enter: move to cursor · Space: focus</p><div class="buttons"><button data-order="advance">X · Attack cursor</button><button data-order="hold">H · Hold</button><button data-order="follow">F · Follow</button><button data-order="retreat">T · Retreat</button></div><h2>Abilities</h2><div id="abilities"></div><details><summary>Change ability hotkeys</summary><div id="ability-bindings"></div></details><button data-action="hero">Hero levels & skills</button><details><summary>Advanced regiment settings</summary><p id="regiment-status"></p><button data-action="assign">Assign selected troops to regiment</button>
        <label>Movement <select id="movement"><option value="hold">Hold</option><option value="follow">Follow commander</option><option value="advance">Advance</option><option value="move">Move</option><option value="retreat">Retreat</option><option value="attack">Attack target</option></select></label><label>Engagement <select id="engagement"><option value="aggressive">Aggressive</option><option value="defensive">Defensive</option><option value="charge">Charge</option></select></label><label>Priority <select id="priority"><option value="closest">Nearest</option><option value="hero">Heroes</option><option value="ranged">Ranged troops</option><option value="footman">Footmen</option><option value="archer">Archers</option><option value="musketeer">Musketeers</option><option value="knight">Knights</option><option value="base">Keeps</option></select></label></details>`;
      else content += `<p>Press Tab for hero progression; K for keep upgrades. Click the barracks for troop production. Each resource site has its own extraction controls.</p>`;
      content += `<details><summary>Central objectives</summary><p id="boss-status"></p><button data-action="boss">Attack boss with selected</button><p id="merchant-status"></p><button data-trade="buy">Buy healing · 90 gold</button><button data-trade="sell-sword">Sell sword · 100 gold</button><button data-trade="sell-armor">Sell armor · 130 gold</button></details>`;
    }
    document.querySelector('#hud')!.innerHTML = `${common}${content}<details><summary>Match info & developer controls</summary><div id="scores"></div><div id="log"></div><div class="buttons">${['resources', 'xp', 'tier', 'roster', 'ai', 'invulnerable'].map(x => `<button data-debug="${x}">${x === 'resources' ? '+ resources' : x === 'xp' ? '+ XP' : x}</button>`).join('')}</div><label>Simulation speed <select id="speed"><option>1</option><option>2</option><option>4</option></select></label></details>`;
    document.querySelector('#hud')!.scrollTop = 0;
  }
  private click(b: HTMLButtonElement | null) {
    if (!b) return; const w = this.w;
    if (b.dataset.select) this.input.selectBuilding(b.dataset.select as Building);
    if (b.dataset.gateSite !== undefined) this.input.selectGate(Number(b.dataset.gateSite));
    if (b.dataset.gateToggle !== undefined) toggleGate(w, Number(b.dataset.gateToggle));
    if (b.dataset.gateRepair !== undefined) { repairGate(w, Number(b.dataset.gateRepair)); this.input.selectGate(Number(b.dataset.gateRepair)); }
    if (b.dataset.gateTower !== undefined) buildTower(w, Number(b.dataset.gateTower));
    if (b.dataset.mount) garrisonUnit(w, this.input.activeGateSite, Number(b.dataset.mount));
    if (b.dataset.dismount) { const u = w.units.find(u => u.id === Number(b.dataset.dismount) && u.team === 0); if (u) leaveTower(w, u); }
    if (b.dataset.territory !== undefined) this.input.selectTerritory(Number(b.dataset.territory));
    if (b.dataset.outpost) buildOutpost(w, Number(b.dataset.site), b.dataset.outpost as OutpostBuilding);
    if (b.dataset.panel) { this.input.selectHero(); this.input.sidebarView = b.dataset.panel as 'items' | 'merchant'; }
    if (b.dataset.upgrade) { const s = selectedStructure(w, this.input.selected); if (s?.site === 0 && s.building === b.dataset.upgrade) startUpgrade(w, 0, s.building); }
    if (b.dataset.skill && this.input.sidebarView === 'hero') trainSkill(w, 0, b.dataset.skill as SkillId);
    if (b.dataset.training && this.input.sidebarView === 'hero') trainHero(w, b.dataset.training as Training);
    if (b.dataset.style) w.players[0].combatStyle = b.dataset.style as 'melee' | 'ranged';
    if (b.dataset.escortLayout) w.players[0].escortLayout = b.dataset.escortLayout as 'ring' | 'vanguard' | 'rearguard';
    if (b.dataset.equip) equipItem(w, 0, b.dataset.equip as ItemId);
    if (b.dataset.unequip) unequipItem(w, 0, b.dataset.unequip as ItemSlot);
    if (b.dataset.buyItem) buyItem(w, b.dataset.buyItem as ItemId);
    if (b.dataset.sellItem) sellItem(w, b.dataset.sellItem as ItemId);
    if (b.dataset.consumable) buyConsumable(w, b.dataset.consumable as 'healing' | 'mana' | keyof typeof SHOP_TOMES);
    if (b.dataset.troop) this.changeCount(b.dataset.troop as TroopKind, 1);
    if (b.dataset.minus) this.changeCount(b.dataset.minus as TroopKind, -1);
    if (b.dataset.ability) cast(w, 0, b.dataset.ability as Ability);
    if (b.dataset.craft) startCraft(w, 0, b.dataset.craft as ItemId);
    if (b.dataset.trade) merchant(w, b.dataset.trade as 'buy' | 'sell-sword' | 'sell-armor');
    if (b.dataset.regiment !== undefined) { this.editingRegiment = Number(b.dataset.regiment); this.input.selectRegiment(this.editingRegiment); }
    if (b.dataset.formation) this.input.setFormation(b.dataset.formation as Formation);
    if (b.dataset.order === 'advance') this.input.attackAtCursor();
    else if (b.dataset.order) command(w, new Set([...this.input.selected].filter(id => b.dataset.order !== 'follow' || w.units.find(u => u.id === id)?.kind !== 'hero')), b.dataset.order as Order);
    if (b.dataset.action === 'hero') this.input.selectHero(); if (b.dataset.action === 'army') this.input.selectArmy();
    if (b.dataset.action === 'gather') gatherArmy(w);
    if (b.dataset.action === 'gate') this.input.selectGate();
    if (b.dataset.action === 'territories') { this.input.sidebarView = 'territories'; this.input.selected.clear(); this.input.activeRegiment = null; }
    if (b.dataset.action === 'travel-gate') { const h = w.units.find(u => u.team === 0 && u.kind === 'hero' && u.hp > 0); if (h) command(w, new Set([h.id]), 'move', gatePosition(this.input.activeGateSite)); }
    if (b.dataset.action === 'travel-merchant') { this.input.selectHero(); command(w, this.input.selected, 'move', MAP.merchant); this.input.sidebarView = 'merchant'; }
    if (b.dataset.action === 'assign') this.input.assignRegiment(this.editingRegiment);
    if (b.dataset.action === 'boss') { const boss = w.units.find(u => u.kind === 'boss'); if (boss) command(w, this.input.selected, 'attack', boss, boss.id); }
    if (b.dataset.debug) this.debug(b.dataset.debug); this.update();
  }
  private changeCount(kind: TroopKind, amount: number) {
    const selected = selectedStructure(this.w, this.input.selected); if (selected?.site !== 0 || selected.building !== 'barracks') return;
    const p = this.w.players[0], total = Object.values(p.production.counts).reduce((a, b) => a + b, 0);
    if (unlocked(p, kind) && (amount < 0 || total < RULES.maxCycleUnits)) p.production.counts[kind] = Math.max(0, p.production.counts[kind] + amount);
  }
  private change(field: HTMLInputElement) {
    const p = this.w.players[0], s = selectedStructure(this.w, this.input.selected), r = this.w.regiments.find(r => r.team === 0 && r.index === this.editingRegiment)!;
    if (field.dataset.bind) { this.input.assignAbility(field.dataset.bind as Ability, field.value); field.blur(); }
    if (field.id === 'hero-priority') { p.heroPriority = field.value as Priority; const hero = this.w.units.find(u => u.team === 0 && u.kind === 'hero'); if (hero) hero.autoTarget = undefined; }
    if (field.id === 'auto-tracking') p.autoTracking = field.checked;
    if (field.id === 'march-army') p.marchWithArmy = field.checked;
    if (field.id === 'outpost-regiment' && s && this.w.territories[s.site].captured) this.w.territories[s.site].regiment = Number(field.value);
    if (s?.site === 0 && s.building === 'barracks') {
      if (field.id === 'interval') { p.production.interval = Number(field.value); p.production.timer = p.production.interval; }
      if (field.id === 'reserve') p.production.reserve = Math.max(0, Math.min(5000, Number(field.value) || 0));
      if (field.id === 'spawn-regiment') p.production.regiment = Number(field.value);
    }
    if (field.id === 'engagement') r.engagement = field.value as Engagement;
    if (field.id === 'priority') { for (const group of selectedRegiments(this.w, this.input.selected, this.input.activeRegiment)) group.priority = field.value as Priority; for (const u of this.w.units.filter(u => u.team === 0)) u.autoTarget = undefined; } if (field.id === 'movement') commandRegiment(this.w, 0, r.index, field.value as Order);
    if (field.id === 'speed') this.speed = Number(field.value);
    if (field.tagName === 'SELECT') field.blur(); this.update();
  }
  private debug(action: string) {
    const p = this.w.players[0]; if (p.eliminated) return;
    if (action === 'resources') { p.gold += 1500; p.wood += 500; p.ore += 500; } if (action === 'xp') p.xp += 2000;
    if (action === 'tier') { p.tier = Math.min(4, p.tier + 1); p.level = Math.max(p.level, levelFloor(p.tier)); p.barracks = Math.min(3, p.tier); p.crafting = 1; grantLevelPoints(p); refreshStats(this.w, 0); }
    if (action === 'ai') this.w.aiEnabled = !this.w.aiEnabled; if (action === 'invulnerable') this.w.invulnerable = !this.w.invulnerable;
    if (action === 'roster') for (const [i, kind] of troopKinds.entries()) spawn(this.w, 0, kind, { x: MAP.bases[0].x * 0.82 + i * 2, z: MAP.bases[0].z * 0.82 });
  }
  update() {
    const w = this.w, p = w.players[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero' && u.hp > 0);
    const trading = atMerchant(w);
    if (trading && !this.wasTrading) { this.input.selectHero(); this.input.sidebarView = 'merchant'; } this.wasTrading = trading;
    syncAbilityBindings(p, this.input.abilityBindings);
    if (this.input.activeRegiment !== null) this.editingRegiment = this.input.activeRegiment;
    for (const id of this.input.selected) if (!w.units.some(u => u.id === id && u.hp > 0) && !w.structures.some(s => s.id === id && !p.eliminated)) this.input.selected.delete(id);
    const s = selectedStructure(w, this.input.selected), selected = w.units.filter(u => this.input.selected.has(u.id));
    const pane = this.input.sidebarView, key = pane !== 'selection' ? `${pane}${pane === 'items' || pane === 'merchant' ? JSON.stringify([p.items, p.equipment]) : pane === 'gate' ? `${this.input.activeGateSite}:${JSON.stringify(w.gates.map(g => [g.id, g.owner]))}` : pane === 'territories' ? JSON.stringify(w.territories.map(t => [t.owner, t.captured])) : ''}` : s ? `building-${s.id}-${w.territories[s.site].captured}` : selected.length ? 'units' : 'none';
    if (key !== this.context) this.renderContext(key);
    const formationGroups = selectedRegiments(w, this.input.selected, this.input.activeRegiment);
    const formationPanel = document.querySelector<HTMLElement>('#quick-formations')!; formationPanel.hidden = !formationGroups.length || p.eliminated;
    document.querySelectorAll<HTMLButtonElement>('[data-formation]').forEach(b => {
      const active = !!formationGroups.length && formationGroups.every(r => r.formation === b.dataset.formation);
      b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); b.disabled = w.winner !== null;
    });
    setText('formation-status', formationGroups.length ? `${formationGroups.length === 1 ? `Regiment ${formationGroups[0].index + 1}` : `${formationGroups.length} selected regiments`} · ${formationGroups.every(r => r.formation === formationGroups[0].formation) ? FORMATIONS[formationGroups[0].formation].name : 'Mixed formations'}` : '');
    document.querySelectorAll<HTMLButtonElement>('[data-regiment]').forEach(b => {
      const index = Number(b.dataset.regiment), troops = w.units.filter(u => u.team === 0 && u.hp > 0 && isTroop(u.kind) && u.garrison === undefined && u.regiment === index);
      b.textContent = `${index + 1} · ${troops.length}`; b.title = `Regiment ${index + 1}: ${troops.length} troops. Ctrl+${index + 1} assigns selection.`;
      b.classList.toggle('active', this.input.activeRegiment === index || troops.length > 0 && troops.every(u => this.input.selected.has(u.id)));
    });
    const bindings = document.querySelector('#ability-bindings'), learned = learnedAbilities(p);
    if (bindings) {
      if (bindings.getAttribute('data-list') !== learned.join(',')) {
        bindings.innerHTML = learned.length ? learned.map(a => `<label class="ability-binding">${ABILITIES[a].name}<select id="bind-${a}" data-bind="${a}"><option value="">Unassigned</option>${ABILITY_KEYS.map(k => `<option value="${k}">${k.toUpperCase()}</option>`).join('')}</select></label>`).join('') : '<p>Learn a skill to assign its hotkey.</p>';
        bindings.setAttribute('data-list', learned.join(','));
      }
      for (const a of learned) this.field(`bind-${a}`, this.input.abilityBindings[a] ?? '');
    }
    setText('resources', `Gold ${Math.floor(p.gold)} · Wood ${Math.floor(p.wood)} · Ore ${Math.floor(p.ore)}`);
    if (pane === 'gate') updateGatePanel(w, this.input.activeGateSite);
    if (s && w.territories[s.site].captured) updateOutpostPanel(w, s.site);
    if (s && !w.territories[s.site].captured) {
      const level = buildingLevel(p, s.building); setText('selection-name', `${buildingNames[s.building]} · ${level ? `Level ${level}` : 'Undeveloped site'}`);
      setText('selection-stats', s.building === 'base' ? `Your ${ranks[p.tier - 1]}'s command center` : 'Selected building · actions apply here');
      const btn = document.querySelector<HTMLButtonElement>('[data-upgrade]');
      if (btn) { const spec = UPGRADES[s.building][level + 1], reason = upgradeReason(p, s.building); btn.textContent = spec ? `${level ? 'Upgrade' : 'Develop'} ${buildingNames[s.building]} → ${level + 1}` : 'Maximum level'; btn.disabled = !!reason; setText('upgrade-cost', spec ? `${spec.cost.gold} gold / ${spec.cost.wood} wood / ${spec.cost.ore} ore · ${spec.time}s` : ''); setText('upgrade-reason', reason ?? 'Ready to build'); }
      const construction = document.querySelector('#construction'); if (construction) construction.innerHTML = p.upgrades.filter(j => j.building === s.building).map(j => `<p>Construction: ${Math.ceil(j.remaining)}s<progress max="${j.total}" value="${j.total - j.remaining}"></progress></p>`).join('');
    }
    if (pane === 'hero' || pane === 'items') {
        setText('hero-progress', `${ranks[p.tier - 1]} · Level ${p.level} / ${p.tier * 10} · ${Math.floor(p.xp)} / ${xpRequired(p.level)} XP${p.bankedXP ? ` · ${Math.floor(p.bankedXP)} banked` : ''}`);
        const bar = document.querySelector<HTMLProgressElement>('#xp-bar'); if (bar) { bar.max = xpRequired(p.level); bar.value = p.level === p.tier * 10 ? bar.max : p.xp; }
        setText('hero-details', hero ? `HP ${Math.ceil(hero.hp)} / ${Math.ceil(hero.maxHp)} · Melee ${Math.round(hero.meleeDamage)} / Ranged ${Math.round(hero.damage)} · Range ${hero.range} · Speed ${hero.speed.toFixed(1)} · Mana ${Math.floor(p.mana)} / ${maxMana(p)}` : `Respawn in ${Math.ceil(p.respawn)}s`);
        setText('skill-points', `${skillPoints(p)} unspent skill points · ${p.abilityOrder.length} / ${activeSlots(p.level)} normal ability slots · ultimate at level 20`);
        document.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach(b => { const id = b.dataset.skill as SkillId, reason = skillReason(p, id); b.textContent = `${SKILLS[id].name} ${SKILLS[id].active ? abilityRank(p, id as Ability) : p.skills[id]} / ${SKILLS[id].max} · + rank`; b.disabled = !!reason; setText(`skill-reason-${id}`, reason ?? 'Spend 1 skill point'); });
        document.querySelectorAll<HTMLButtonElement>('[data-training]').forEach(b => { const kind = b.dataset.training as Training, next = p.training[kind] + 1; b.textContent = `${kind} ${p.training[kind]} / 3 · ${200 * next}g / ${30 * next}o`; b.disabled = !!trainingReason(p, kind); setText(`training-${kind}`, trainingReason(p, kind) ?? 'Train now'); });
        document.querySelectorAll<HTMLButtonElement>('[data-style]').forEach(b => b.classList.toggle('active', b.dataset.style === p.combatStyle));
        document.querySelectorAll<HTMLButtonElement>('[data-escort-layout]').forEach(b => b.classList.toggle('active', b.dataset.escortLayout === p.escortLayout));
        this.field('hero-priority', p.heroPriority);
        for (const [id, value] of [['auto-tracking', p.autoTracking], ['march-army', p.marchWithArmy]] as const) { const field = document.querySelector<HTMLInputElement>(`#${id}`); if (field) field.checked = value; }
    }
    if (s && !w.territories[s.site].captured) {
      const level = buildingLevel(p, s.building);
      if (s.building === 'barracks') {
        for (const kind of troopKinds) { const btn = document.querySelector<HTMLButtonElement>(`[data-troop="${kind}"]`)!; btn.textContent = `+ ${kind} · ${STATS[kind].cost}g`; btn.disabled = !unlocked(p, kind) || Object.values(p.production.counts).reduce((a, b) => a + b, 0) >= RULES.maxCycleUnits; setText(`count-${kind}`, `${p.production.counts[kind]} per wave`); setText(`unlock-${kind}`, unlocked(p, kind) ? 'Click to add; − to remove' : `Requires Barracks ${kind === 'knight' ? 3 : 2}`); }
        setText('production-cost', `Wave: ${cycleCost(p)} gold · Burn ${p.production.interval ? Math.round(cycleCost(p) * 60 / p.production.interval) : 0}g/min · Income ${RULES.incomeRates.goldmine[p.goldmine] * 60}g/min`);
        setText('production-status', p.production.interval ? `${p.production.status} · next wave in ${Math.ceil(p.production.timer)}s` : 'Production paused');
        this.field('interval', p.production.interval); this.field('reserve', p.production.reserve); this.field('spawn-regiment', p.production.regiment);
      }
      if (['forest', 'quarry', 'goldmine'].includes(s.building)) setText('income-rate', `${RULES.incomeRates[s.building as 'forest' | 'quarry' | 'goldmine'][level]} resources / second`);
    } else if (!s && selected.length && pane === 'selection') {
      const troops = selected.filter(u => u.kind !== 'hero'); if (troops.length && troops.every(u => u.regiment === troops[0].regiment)) this.editingRegiment = troops[0].regiment;
      setText('selection-name', selected.length === 1 && selected[0].kind === 'hero' ? `${ranks[p.tier - 1]} · Level ${p.level}` : `${selected.length} units selected`);
      setText('selection-stats', selected.length === 1 ? `HP ${Math.ceil(selected[0].hp)} / ${Math.ceil(selected[0].maxHp)} · Damage ${Math.round(selected[0].damage)} · Mana ${Math.floor(p.mana)}` : 'Right-click to move or attack · Drag to select a group');
      const r = w.regiments.find(r => r.team === 0 && r.index === this.editingRegiment)!; setText('regiment-status', `Regiment ${r.index + 1} · Cohesion ${Math.round(r.cohesion)}%`);
      for (const k of ['movement', 'engagement', 'priority'] as const) this.field(k, r[k]);
    }
    const abilities = document.querySelector('#abilities');
    if (abilities && abilities.getAttribute('data-list') !== learned.join(',')) { abilities.innerHTML = learned.length ? learned.map(a => `<button data-ability="${a}"></button>`).join('') : '<p>Choose your first skill with Tab.</p>'; abilities.setAttribute('data-list', learned.join(',')); }
    document.querySelectorAll<HTMLButtonElement>('[data-ability]').forEach(b => { const a = b.dataset.ability as Ability; b.textContent = `${this.input.abilityBindings[a]?.toUpperCase() ?? 'Unassigned'} · ${ABILITIES[a].name} ${abilityRank(p, a)} · ${p.cooldowns[a] > 0 ? `${Math.ceil(p.cooldowns[a])}s` : `${ABILITIES[a].cost} mana`}`; b.disabled = !hero || w.paused || p.mana < ABILITIES[a].cost || p.cooldowns[a] > 0; });
    setText('items-status', p.craft ? `Crafting ${ITEMS[p.craft.item].name} · ${Math.ceil(p.craft.remaining)}s` : 'Ready to craft. Equipment slots prevent duplicate bonuses.');
    document.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach(b => { const id = b.dataset.craft as ItemId; b.disabled = !!craftReason(p, id); setText(`craft-reason-${id}`, craftReason(p, id) ?? 'Ready'); });
    document.querySelectorAll<HTMLButtonElement>('[data-buy-item]').forEach(b => { const id = b.dataset.buyItem as ItemId; b.disabled = !trading || !!p.items[id] || p.gold < ITEMS[id].buy; });
    document.querySelectorAll<HTMLButtonElement>('[data-sell-item]').forEach(b => { const id = b.dataset.sellItem as ItemId; b.disabled = !trading || !p.items[id] || w.merchantGold < ITEMS[id].sell; });
    document.querySelectorAll<HTMLButtonElement>('[data-consumable]').forEach(b => { const id = b.dataset.consumable!, cost = id === 'healing' ? 90 : id === 'mana' ? 120 : SHOP_TOMES[id as keyof typeof SHOP_TOMES].buy; b.disabled = !trading || p.gold < cost || (id === 'warcry' || id === 'standfast') && abilityRank(p, id) > 0; });
    setText('merchant-status', hero && inSafeZone(hero) ? 'Commander in trading range' : 'Move commander into the merchant circle to trade');
    document.querySelectorAll<HTMLButtonElement>('[data-trade]').forEach(b => { b.disabled = !hero || !inSafeZone(hero) || (b.dataset.trade === 'buy' ? p.gold < 90 : b.dataset.trade === 'sell-sword' ? !p.items.sword || w.merchantGold < 100 : !p.items.armor || w.merchantGold < 130); });
    const boss = w.units.find(u => u.kind === 'boss'); setText('boss-status', boss ? `Iron Golem · ${Math.ceil(boss.hp)} HP · contestable arena` : 'Iron Golem defeated');
    document.querySelector('#scores')!.innerHTML = w.players.map(p => `<p>${TEAMS[p.id].name}: ${p.eliminated ? 'eliminated' : `Tier ${p.tier} · Lv ${p.level}`}</p>`).join('');
    document.querySelector('#log')!.innerHTML = w.events.map(e => `<p>${e}</p>`).join(''); this.field('speed', this.speed);
    setText('selected', this.input.activeRegiment !== null && !selected.length ? `Regiment ${this.input.activeRegiment + 1} is empty · Select troops with 0, then Ctrl+${this.input.activeRegiment + 1} to assign` : 'WASD: cursor · Arrows: camera · X: attack · Enter: move · Tab: hero · 1–9: regiments · F2/F3/F4: formations');
    setText('time', `${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, '0')}`); setText('pause', w.paused ? 'Resume' : 'Pause');
    if (w.winner !== null) { const outcome = document.querySelector<HTMLElement>('#outcome')!; outcome.hidden = false; if (!outcome.innerHTML) { outcome.innerHTML = `<h1>${w.winner === 0 ? 'Victory' : 'Defeat'}</h1><button id="restart">New match</button>`; document.querySelector('#restart')!.addEventListener('click', () => location.reload()); } }
  }
  private field(id: string, value: string | number) { const f = document.getElementById(id) as HTMLInputElement | null; if (f && document.activeElement !== f) f.value = String(value); }
}
