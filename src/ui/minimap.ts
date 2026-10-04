import { MAP, TEAMS } from '../game/config';
import type { World } from '../game/types';
import type { Battlefield } from '../view/battlefield';
export class Minimap {
  readonly canvas = document.createElement('canvas');
  private c: CanvasRenderingContext2D;
  constructor(private w: World, private view: Battlefield) {
    this.canvas.width = 160; this.canvas.height = 160; this.canvas.id = 'minimap'; this.canvas.setAttribute('aria-label', 'Battlefield minimap: click to pan camera');
    this.c = this.canvas.getContext('2d')!; document.querySelector('#battlefield')!.append(this.canvas);
    this.canvas.addEventListener('pointerdown', e => {
      const rect = this.canvas.getBoundingClientRect();
      view.center({ x: (e.clientX - rect.left) / rect.width * MAP.half * 2 - MAP.half, z: (e.clientY - rect.top) / rect.height * MAP.half * 2 - MAP.half });
    });
  }
  update() {
    const c = this.c; c.fillStyle = '#253c40'; c.fillRect(0, 0, 160, 160);
    const map = (n: number) => (n + MAP.half) / (MAP.half * 2) * 160;
    c.fillStyle = '#536647';
    c.fillRect(map(-MAP.arenaHalf), map(-MAP.arenaHalf), MAP.arenaHalf / MAP.half * 160, MAP.arenaHalf / MAP.half * 160);
    for (const b of MAP.bases) c.fillRect(map(b.x - MAP.baseHalf), map(b.z - MAP.baseHalf), MAP.baseHalf / MAP.half * 160, MAP.baseHalf / MAP.half * 160);
    c.strokeStyle = '#687863'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(20, 20); c.lineTo(140, 140); c.moveTo(140, 20); c.lineTo(20, 140); c.stroke();
    c.strokeStyle = '#a3c5b2'; c.lineWidth = 1; c.beginPath(); c.arc(map(MAP.merchant.x), map(MAP.merchant.z), MAP.merchant.radius / (MAP.half * 2) * 160, 0, Math.PI * 2); c.stroke();
    for (const t of this.w.territories.filter(t => t.captured && t.owner !== null)) { const b = MAP.bases[t.site]; c.strokeStyle = TEAMS[t.owner!].color; c.strokeRect(map(b.x) - 15, map(b.z) - 15, 30, 30); }
    for (const u of this.w.units) {
      c.fillStyle = TEAMS[u.team]?.color ?? '#e5a155';
      const r = u.kind === 'base' ? 4 : u.kind === 'hero' || u.kind === 'boss' ? 3 : u.kind === 'gate' ? 2.5 : 1.5;
      c.fillRect(map(u.x) - r, map(u.z) - r, r * 2, r * 2);
    }
    c.strokeStyle = '#f5e3ad'; c.lineWidth = 1;
    const x = map(this.view.focus.x), y = map(this.view.focus.z);
    c.strokeRect(x - 18, y - 13, 36, 26);
  }
}
