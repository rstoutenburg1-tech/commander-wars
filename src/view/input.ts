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
      if (['w', 'a', 's', 'd'].includes(k)) view.keys.add(k);
      if (k === 'x') this.attackMove = true;
      if (k === 'h') command(w, this.selected, 'hold');
      if (k === 'f1') { e.preventDefault(); this.selectHero(); }
      if (k === ' ') { e.preventDefault(); const hero = w.units.find(u => u.team === 0 && u.kind === 'hero'); if (hero) view.center(hero); }
      if (k === 'tab') { e.preventDefault(); this.selectArmy(); }
      if (k === 'escape') { this.attackMove = false; this.selected.clear(); }
      if (!e.repeat) this.onKey(k);
    });
    window.addEventListener('keyup', e => view.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { view.keys.clear(); w.paused = true; this.start = undefined; this.box.style.display = 'none'; });
  }
  selectHero() { this.selected.clear(); const u = this.w.units.find(u => u.team === 0 && u.kind === 'hero'); if (u) this.selected.add(u.id); }
  selectArmy() { this.selected.clear(); this.w.units.filter(u => u.team === 0 && u.kind !== 'base').forEach(u => this.selected.add(u.id)); }
}
