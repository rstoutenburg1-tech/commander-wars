import type { Order, Point, World } from './types';
export function commandRegiment(w: World, team: number, index: number, order: Order, point?: Point, target?: number) {
  const r = w.regiments.find(r => r.team === team && r.index === index)!;
  const troops = w.units.filter(u => u.team === team && u.regiment === index && u.kind !== 'hero' && u.kind !== 'base');
  if (order === 'hold' && troops.length) r.anchor = { x: troops.reduce((s, u) => s + u.x, 0) / troops.length, z: troops.reduce((s, u) => s + u.z, 0) / troops.length };
  r.movement = order;
  if (point) r.goal = { ...point };
  if (order === 'retreat') { const base = w.units.find(u => u.team === team && u.kind === 'base'); if (base) r.goal = { x: base.x * 0.8, z: base.z * 0.8 }; }
  for (const u of troops) { u.tactical = false; u.order = order; u.target = target; u.autoTarget = undefined; }
}
export function command(w: World, ids: Set<number>, order: Order, point?: Point, target?: number) {
  const units = w.units.filter(u => ids.has(u.id) && u.team === 0 && u.kind !== 'base');
  const fullRegiments = new Set<number>();
  for (const index of new Set(units.filter(u => u.kind !== 'hero').map(u => u.regiment))) {
    const members = w.units.filter(u => u.team === 0 && u.regiment === index && u.kind !== 'hero' && u.kind !== 'base');
    if (members.every(u => ids.has(u.id))) { fullRegiments.add(index); commandRegiment(w, 0, index, order, point, target); }
  }
  units.forEach((u, i) => {
    if (u.kind !== 'hero' && fullRegiments.has(u.regiment)) return;
    u.tactical = true;
    u.order = order; u.target = target; u.autoTarget = undefined;
    if (point) u.goal = { x: point.x + (i % 5 - Math.min(4, units.length - 1) / 2) * 1.7, z: point.z + Math.floor(i / 5) * 1.7 };
    if (order === 'hold') u.goal = { x: u.x, z: u.z };
    if (order === 'retreat') { const base = w.units.find(b => b.team === 0 && b.kind === 'base'); if (base) u.goal = { x: base.x * 0.85, z: base.z * 0.85 }; }
  });
}
