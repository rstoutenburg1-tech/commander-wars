import type { Order, Point, World } from './types';
export function command(w: World, ids: Set<number>, order: Order, point?: Point, target?: number) {
  const units = w.units.filter(u => ids.has(u.id) && u.team === 0 && u.kind !== 'base');
  units.forEach((u, i) => {
    u.order = order; u.target = target;
    if (point) u.goal = { x: point.x + (i % 5 - Math.min(4, units.length - 1) / 2) * 1.7, z: point.z + Math.floor(i / 5) * 1.7 };
    if (order === 'hold') u.goal = { x: u.x, z: u.z };
  });
}
