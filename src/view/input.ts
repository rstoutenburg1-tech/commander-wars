import type { World, Unit, Formation } from '../game/types';
import { ABILITIES, MAP, RULES, isTroop, type Ability, type Building } from '../game/config';
import { command } from '../game/commands';
import { ABILITY_KEYS, advanceCursor, bindAbility, learnedAbilities, syncAbilityBindings, type AbilityBindings } from '../game/hotkeys';
import { setSelectionFormation, gatherArmy } from '../game/formations';
import { cast } from '../game/abilities';
import { inSafeZone } from '../game/objectives';
import type { Battlefield } from './battlefield';
export class Input {
  readonly selected = new Set<number>();
  attackMove = false;
  activeRegiment: number | null = null;
  sidebarView: 'selection' | 'hero' | 'items' | 'merchant' | 'gate' | 'territories' = 'hero';
  activeGateSite = 0;
  cursorTarget?: Unit;
  readonly cursorKeys = new Set<string>();
  readonly screenCursor = { x: 0.5, y: 0.5 };
  readonly abilityBindings: AbilityBindings = {};
  private cursor = document.createElement('div');
  private start?: { x: number; y: number };
  private box = document.createElement('div');
  constructor(private w: World, private view: Battlefield, readonly onKey: (key: string) => void = () => {}) {
    this.box.className = 'selection-box'; document.body.append(this.box);
    this.cursor.className = 'keyboard-cursor'; this.cursor.innerHTML = '<span class="crosshair"></span><small></small>';
    view.canvas.parentElement!.append(this.cursor);
    try {
      const saved = JSON.parse(localStorage.getItem('commander-wars-ability-keys') ?? '{}');
      for (const ability of Object.keys(ABILITIES) as Ability[]) if (saved[ability] === null || ABILITY_KEYS.includes(saved[ability])) this.abilityBindings[ability] = saved[ability];
      const seen = new Set<string>();
      for (const ability of Object.keys(this.abilityBindings) as Ability[]) { const key = this.abilityBindings[ability]; if (key && seen.has(key)) delete this.abilityBindings[ability]; else if (key) seen.add(key); }
    } catch { /* Preferences are optional when storage is unavailable. */ }
    const hero = w.units.find(u => u.team === 0 && u.kind === 'hero'); if (hero) this.selected.add(hero.id);
    view.canvas.addEventListener('contextmenu', e => e.preventDefault());
    view.canvas.addEventListener('pointerdown', e => {
      view.canvas.setPointerCapture(e.pointerId);
      if (e.button === 0) this.start = { x: e.clientX, y: e.clientY };
      if (e.button === 2) {
        const point = view.ground(e.clientX, e.clientY); const id = view.pick(e.clientX, e.clientY);
        const enemy = w.units.find(u => u.id === id && u.team !== 0);
        if (point) command(w, this.selected, enemy ? 'attack' : 'move', point, enemy?.id);
        this.attackMove = false;
      }
    });
    view.canvas.addEventListener('pointermove', e => {
      if (!this.start) return;
      Object.assign(this.box.style, { display: 'block', left: `${Math.min(e.clientX, this.start.x)}px`, top: `${Math.min(e.clientY, this.start.y)}px`,
        width: `${Math.abs(e.clientX - this.start.x)}px`, height: `${Math.abs(e.clientY - this.start.y)}px` });
    });
    view.canvas.addEventListener('pointerup', e => {
      if (e.button !== 0 || !this.start) return;
      const start = this.start; this.start = undefined; this.box.style.display = 'none';
      if (this.attackMove) {
        const p = view.ground(e.clientX, e.clientY); if (p) command(w, this.selected, 'advance', p);
        this.attackMove = false; return;
      }
      this.activeRegiment = null; this.sidebarView = 'selection';
      if (!e.shiftKey) this.selected.clear();
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
        for (const u of w.units) {
          if (u.team !== 0 || !isTroop(u.kind) && u.kind !== 'hero') continue;
          const p = view.screen(u);
          if (p.x >= Math.min(start.x, e.clientX) && p.x <= Math.max(start.x, e.clientX) && p.y >= Math.min(start.y, e.clientY) && p.y <= Math.max(start.y, e.clientY)) this.selected.add(u.id);
        }
      } else {
        const id = view.pick(e.clientX, e.clientY);
        if (id !== undefined && (w.units.find(u => u.id === id)?.team === 0 || w.structures.find(s => s.id === id)?.team === 0)) this.selected.add(id);
        if (this.selected.size === 1 && w.units.find(u => u.id === id)?.kind === 'hero') this.sidebarView = 'hero';
        const gate = w.gates.find(g => g.id === id && g.owner === 0); if (gate && this.selected.size === 1) { this.activeGateSite = gate.site; this.sidebarView = 'gate'; }
      }
    });
    view.canvas.addEventListener('wheel', e => { e.preventDefault(); view.zoom = Math.max(25, Math.min(MAP.overviewZoom, view.zoom + e.deltaY * 0.08)); view.resize(); }, { passive: false });
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement).matches('input:not([type="checkbox"]),select,textarea') || (e.target as HTMLElement).isContentEditable) {
        if (e.key === 'Escape') { (e.target as HTMLElement).blur(); e.preventDefault(); } return;
      }
      if (e.altKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (/^[1-9]$/.test(k)) {
        e.preventDefault(); const index = Number(k) - 1;
        if (!e.repeat) { if (e.ctrlKey) this.assignRegiment(index); else this.selectRegiment(index, e.shiftKey); }
        return;
      }
      if (e.ctrlKey) return;
      if (['w', 'a', 's', 'd'].includes(k)) { e.preventDefault(); this.cursorKeys.add(k); return; }
      if (k.startsWith('arrow')) { e.preventDefault(); view.keys.add(k); return; }
      if (['tab', ' ', 'home', 'end', 'enter', '+', '=', '-', 'f1', 'f2', 'f3', 'f4'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === 'x') this.attackAtCursor();
      if (k === 'enter') this.moveAtCursor();
      if (k === 'h') command(w, this.selected, 'hold');
      if (k === 't') command(w, this.selected, 'retreat');
      if (k === 'f') {
        if (this.sidebarView === 'hero') gatherArmy(w);
        const ids = new Set([...this.selected].filter(id => w.units.find(u => u.id === id)?.kind !== 'hero'));
        command(w, ids, 'follow');
      }
      if (k === 'f1') { e.preventDefault(); this.selectHero(); }
      if (k === 'f2') this.setFormation('line'); if (k === 'f3') this.setFormation('wall'); if (k === 'f4') this.setFormation('wedge');
      if (k === ' ') this.focusSelection();
      if (k === 'tab') this.selectHero(); if (k === '0') this.selectArmy();
      if (k === 'b') this.selectBuilding('barracks'); if (k === 'k') this.selectBuilding('base');
      if (k === 'home') { view.zoom = MAP.overviewZoom; view.center({ x: 0, z: 0 }); view.resize(); this.centerCursor(); }
      if (k === 'end') this.centerCursor();
      if (['+', '=', '-'].includes(k)) { view.zoom = Math.max(25, Math.min(MAP.overviewZoom, view.zoom * (k === '-' ? 1.2 : 1 / 1.2))); view.resize(); }
      if (k === 'p' && w.winner === null) w.paused = !w.paused;
      if (k === 'escape') { this.attackMove = false; this.selected.clear(); this.activeRegiment = null; this.sidebarView = 'selection'; }
      syncAbilityBindings(w.players[0], this.abilityBindings);
      const ability = learnedAbilities(w.players[0]).find(a => this.abilityBindings[a] === k); if (ability) cast(w, 0, ability);
      this.onKey(k);
    });
    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase(); view.keys.delete(k); this.cursorKeys.delete(k);
    });
    document.addEventListener('focusin', e => { if ((e.target as HTMLElement).matches('input,select,textarea')) { this.cursorKeys.clear(); view.keys.clear(); } });
    window.addEventListener('blur', () => { this.cursorKeys.clear(); view.keys.clear(); w.paused = true; this.start = undefined; this.box.style.display = 'none'; });
  }
  centerCursor() { this.screenCursor.x = 0.5; this.screenCursor.y = 0.5; }
  setFormation(formation: Formation) { setSelectionFormation(this.w, this.selected, formation, this.activeRegiment); }
  private cursorPosition() { const r = this.view.canvas.getBoundingClientRect(); return { x: r.left + r.width * this.screenCursor.x, y: r.top + r.height * this.screenCursor.y }; }
  private findCursorTarget(): Unit | undefined {
    const p = this.cursorPosition(), r = this.view.canvas.getBoundingClientRect();
    const valid = (u: Unit) => u.team !== 0 && u.hp > 0 && !inSafeZone(u);
    const hitId = this.view.pick(p.x, p.y), hit = this.w.units.find(u => u.id === hitId && valid(u)); if (hit) return hit;
    let nearest: Unit | undefined, best = 34;
    for (const u of this.w.units) {
      if (!valid(u)) continue;
      const s = this.view.screen(u); if (s.x < r.left || s.x > r.right || s.y < r.top || s.y > r.bottom) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < best) { nearest = u; best = d; }
    }
    return nearest;
  }
  updateCursor(dt: number) {
    const r = this.view.canvas.getBoundingClientRect();
    Object.assign(this.screenCursor, advanceCursor(this.screenCursor, this.cursorKeys, dt, r.width, r.height));
    this.cursor.style.left = `${this.screenCursor.x * 100}%`; this.cursor.style.top = `${this.screenCursor.y * 100}%`;
    this.cursorTarget = this.findCursorTarget(); this.cursor.classList.toggle('has-target', !!this.cursorTarget);
    const p = this.cursorPosition(), point = this.view.ground(p.x, p.y);
    this.cursor.querySelector('small')!.textContent = this.cursorTarget ? `X · Attack ${this.cursorTarget.kind} · ${Math.ceil(this.cursorTarget.hp)} HP` : `X · Attack-move / Enter · Move${point ? ` · ${Math.round(point.x)}, ${Math.round(point.z)}` : ''}`;
  }
  attackAtCursor() {
    if (this.w.paused || this.w.winner !== null) return;
    this.attackMove = false;
    const p = this.cursorPosition(), point = this.view.ground(p.x, p.y), target = this.findCursorTarget();
    if (point) command(this.w, this.selected, target ? 'attack' : 'advance', target ?? point, target?.id);
  }
  moveAtCursor() {
    if (this.w.paused || this.w.winner !== null) return;
    this.attackMove = false;
    const p = this.cursorPosition(), point = this.view.ground(p.x, p.y); if (point) command(this.w, this.selected, 'move', point);
  }
  focusSelection() {
    const units = this.w.units.filter(u => this.selected.has(u.id) && u.hp > 0);
    const site = this.w.structures.find(s => this.selected.has(s.id));
    const point = units.length ? { x: units.reduce((sum, u) => sum + u.x, 0) / units.length, z: units.reduce((sum, u) => sum + u.z, 0) / units.length } : site ?? this.w.units.find(u => u.team === 0 && u.kind === 'hero');
    if (point) { this.view.zoom = 45; this.view.center(point); this.view.resize(); this.centerCursor(); }
  }
  assignAbility(ability: Ability, key: string) {
    if (!bindAbility(this.w.players[0], this.abilityBindings, ability, key)) return;
    try { localStorage.setItem('commander-wars-ability-keys', JSON.stringify(this.abilityBindings)); } catch { /* Session bindings still work. */ }
  }
  selectHero() { this.sidebarView = 'hero'; this.activeRegiment = null; this.selected.clear(); const u = this.w.units.find(u => u.team === 0 && u.kind === 'hero' && u.hp > 0); if (u) this.selected.add(u.id); }
  selectBuilding(building: Building) { this.sidebarView = 'selection'; this.activeRegiment = null; const s = this.w.structures.find(s => s.team === 0 && s.site === 0 && s.building === building); this.selected.clear(); if (s && !this.w.players[0].eliminated) this.selected.add(s.id); }
  selectGate(site = 0) { const g = this.w.gates.find(g => g.site === site && g.owner === 0); if (!g) return; this.sidebarView = 'gate'; this.activeGateSite = site; this.activeRegiment = null; this.selected.clear(); if (this.w.units.some(u => u.id === g.id && u.hp > 0)) this.selected.add(g.id); this.view.zoom = 45; this.view.center({ x: MAP.bases[site].x * 0.64, z: MAP.bases[site].z * 0.64 }); this.view.resize(); this.centerCursor(); }
  selectTerritory(site: number) { const t = this.w.territories[site], s = this.w.structures.find(s => s.site === site && s.building === 'base'); if (!t?.captured || t.owner !== 0 || !s) return; this.sidebarView = 'selection'; this.activeRegiment = null; this.selected.clear(); this.selected.add(s.id); this.view.zoom = 65; this.view.center(s); this.view.resize(); this.centerCursor(); }
  selectArmy() { this.sidebarView = 'selection'; this.activeRegiment = null; this.selected.clear(); this.w.units.filter(u => u.team === 0 && u.hp > 0 && isTroop(u.kind) && u.garrison === undefined).forEach(u => this.selected.add(u.id)); }
  selectRegiment(index: number, add = false) { if (index < 0 || index >= RULES.regimentCount) return; this.sidebarView = 'selection'; this.activeRegiment = index; if (!add) this.selected.clear(); this.w.units.filter(u => u.team === 0 && u.hp > 0 && u.regiment === index && isTroop(u.kind) && u.garrison === undefined).forEach(u => this.selected.add(u.id)); }
  assignRegiment(index: number) {
    if (index < 0 || index >= RULES.regimentCount) return;
    const troops = this.w.units.filter(u => this.selected.has(u.id) && u.team === 0 && isTroop(u.kind) && u.garrison === undefined);
    if (!troops.length) return;
    for (const u of troops) { u.regiment = index; u.tactical = false; u.target = undefined; }
    const r = this.w.regiments.find(r => r.team === 0 && r.index === index)!;
    r.anchor = { x: troops.reduce((s, u) => s + u.x, 0) / troops.length, z: troops.reduce((s, u) => s + u.z, 0) / troops.length };
    r.goal = { ...r.anchor }; r.movement = 'hold'; this.activeRegiment = index;
  }
}
