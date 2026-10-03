import type { World } from '../game/types';
import { command } from '../game/commands';
import type { Battlefield } from './battlefield';
export class Input {
  readonly selected = new Set<number>();
  attackMove = false;
  private start?: { x: number; y: number };
  private box = document.createElement('div');
  constructor(private w: World, private view: Battlefield, readonly onKey: (key: string) => void = () => {}) {
    this.box.className = 'selection-box'; document.body.append(this.box);
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
      if (!e.shiftKey) this.selected.clear();
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
        for (const u of w.units) {
          if (u.team !== 0 || u.kind === 'base') continue;
          const p = view.screen(u);
          if (p.x >= Math.min(start.x, e.clientX) && p.x <= Math.max(start.x, e.clientX) && p.y >= Math.min(start.y, e.clientY) && p.y <= Math.max(start.y, e.clientY)) this.selected.add(u.id);
        }
      } else {
        const id = view.pick(e.clientX, e.clientY);
        if (id !== undefined && w.units.find(u => u.id === id)?.team === 0) this.selected.add(id);
      }
    });
    view.canvas.addEventListener('wheel', e => { e.preventDefault(); view.zoom = Math.max(25, Math.min(145, view.zoom + e.deltaY * 0.06)); view.resize(); }, { passive: false });
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement).matches('input,select,textarea')) return;
      const k = e.key.toLowerCase();
      if (/^[1-4]$/.test(k)) {
        e.preventDefault(); const index = Number(k) - 1;
        if (e.ctrlKey) this.assignRegiment(index); else this.selectRegiment(index);
      }
      if (['w', 'a', 's', 'd'].includes(k)) view.keys.add(k);
      if (k === 'x') this.attackMove = true;
      if (k === 'h') command(w, this.selected, 'hold');
      if (k === 't') command(w, this.selected, 'retreat');
      if (k === 'f') {
        const ids = new Set([...this.selected].filter(id => w.units.find(u => u.id === id)?.kind !== 'hero'));
        command(w, ids, 'follow');
      }
      if (k === 'f1') { e.preventDefault(); this.selectHero(); }
      if (k === ' ') { e.preventDefault(); const hero = w.units.find(u => u.team === 0 && u.kind === 'hero'); if (hero) { view.zoom = 45; view.center(hero); view.resize(); } }
      if (k === 'tab') { e.preventDefault(); this.selectArmy(); }
      if (k === 'escape') { this.attackMove = false; this.selected.clear(); }
      if (!e.repeat) this.onKey(k);
    });
    window.addEventListener('keyup', e => view.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { view.keys.clear(); w.paused = true; this.start = undefined; this.box.style.display = 'none'; });
  }
  selectHero() { this.selected.clear(); const u = this.w.units.find(u => u.team === 0 && u.kind === 'hero'); if (u) this.selected.add(u.id); }
  selectArmy() { this.selected.clear(); this.w.units.filter(u => u.team === 0 && u.kind !== 'base').forEach(u => this.selected.add(u.id)); }
  selectRegiment(index: number) { this.selected.clear(); this.w.units.filter(u => u.team === 0 && u.regiment === index && u.kind !== 'hero' && u.kind !== 'base').forEach(u => this.selected.add(u.id)); }
  assignRegiment(index: number) {
    const troops = this.w.units.filter(u => this.selected.has(u.id) && u.team === 0 && u.kind !== 'hero' && u.kind !== 'base');
    if (!troops.length) return;
    for (const u of troops) { u.regiment = index; u.tactical = false; u.target = undefined; }
    const r = this.w.regiments.find(r => r.team === 0 && r.index === index)!;
    r.anchor = { x: troops.reduce((s, u) => s + u.x, 0) / troops.length, z: troops.reduce((s, u) => s + u.z, 0) / troops.length };
    r.goal = { ...r.anchor }; r.movement = 'hold';
  }
}
