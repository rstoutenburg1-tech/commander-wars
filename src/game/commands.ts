import type { Order, Point, World } from './types';
import { isTroop } from './config';
import { leaveTower } from './gates';
import { centroid, formationSlot, updateRegimentGoals } from './regiment-movement';
import { clearRoute, projectWalkable } from './navigation';
import { enemies, localPlayer } from './match';
export function commandRegiment(w: World, team: number, index: number, order: Order, point?: Point, target?: number) {
  const r = w.regiments.find(r => r.team === team && r.index === index);
  if (!r) return;
  if (target !== undefined && !w.units.some(u => u.id === target && u.hp > 0 && enemies(w, team, u.team))) return;
  const troops = w.units.filter(u => u.hp > 0 && u.team === team && u.regiment === index && isTroop(u.kind) && u.garrison === undefined);
  if (troops.length) r.anchor = centroid(troops);
  r.movement = order;
  r.target = target;
  if (point) r.goal = projectWalkable(point);
  if (order === 'hold') r.goal = { ...r.anchor };
  if (order === 'retreat') { const base = w.units.find(u => u.team === team && u.kind === 'base'); if (base) r.goal = { x: base.x * 0.8, z: base.z * 0.8 }; }
  if (order !== 'hold' && order !== 'follow') r.facing = Math.atan2(r.goal.x - r.anchor.x, r.goal.z - r.anchor.z);
  for (const u of troops) {
    u.tactical = false; u.order = order; u.target = target; u.autoTarget = undefined; clearRoute(u);
    if (order === 'hold') u.goal = { x: u.x, z: u.z };
  }
  updateRegimentGoals(w, r);
}
export function command(w: World, ids: Set<number>, order: Order, point?: Point, target?: number, regimentIndices: readonly number[] = [], team = localPlayer(w)) {
  if (target !== undefined && !w.units.some(u => u.id === target && u.hp > 0 && enemies(w, team, u.team))) return;
  const units = w.units.filter(u => ids.has(u.id) && u.team === team && u.hp > 0 && (isTroop(u.kind) || u.kind === 'hero'));
  for (const u of units) leaveTower(w, u);
  const fullRegiments = new Set<number>();
  // Number-key selections represent a regiment, including recruits born after
  // selection and empty groups whose future troops should inherit this order.
  for (const index of regimentIndices) { fullRegiments.add(index); commandRegiment(w, team, index, order, point, target); }
  for (const index of new Set(units.filter(u => u.kind !== 'hero').map(u => u.regiment))) {
    const members = w.units.filter(u => u.hp > 0 && u.team === team && u.regiment === index && isTroop(u.kind) && u.garrison === undefined);
    if (!fullRegiments.has(index) && members.every(u => ids.has(u.id))) { fullRegiments.add(index); commandRegiment(w, team, index, order, point, target); }
  }
  const independent = units.filter(u => u.kind === 'hero' || !fullRegiments.has(u.regiment));
  const troops = independent.filter(u => isTroop(u.kind));
  const center = troops.length ? centroid(troops) : undefined;
  const facing = point && center ? Math.atan2(point.x - center.x, point.z - center.z) : 0;
  independent.forEach(u => {
    if (u.kind !== 'hero' && fullRegiments.has(u.regiment)) return;
    u.tactical = true;
    u.order = order; u.target = target; u.autoTarget = undefined; clearRoute(u);
    if (point) {
      const r = w.regiments.find(r => r.team === u.team && r.index === u.regiment);
      const offset = u.kind === 'hero' ? { x: 0, z: 0 } : formationSlot(r?.formation ?? 'line', troops.indexOf(u), troops.length, facing);
      u.goal = projectWalkable({ x: point.x + offset.x, z: point.z + offset.z });
    }
    if (order === 'hold') u.goal = { x: u.x, z: u.z };
    if (order === 'retreat') { const base = w.units.find(b => b.team === team && b.kind === 'base'); if (base) u.goal = { x: base.x * 0.85, z: base.z * 0.85 }; }
  });
}
