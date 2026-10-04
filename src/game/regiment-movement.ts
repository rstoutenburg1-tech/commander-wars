import { FORMATIONS, MAP, STATS, isTroop } from './config';
import { projectWalkable } from './navigation';
import type { Formation, Point, Regiment, Unit, World } from './types';

export function escortOffset(layout: 'ring' | 'vanguard' | 'rearguard', index: number, count: number, facing: number): Point {
  const angle = facing + (layout === 'ring' ? index / Math.max(1, count) * Math.PI * 2 : 0);
  if (layout === 'ring') return { x: Math.sin(angle) * 9, z: Math.cos(angle) * 9 };
  const side = (index % 3 - 1) * 10, front = (layout === 'vanguard' ? 1 : -1) * (8 + Math.floor(index / 3) * 7);
  return { x: side * Math.cos(angle) + front * Math.sin(angle), z: -side * Math.sin(angle) + front * Math.cos(angle) };
}

export function formationSlot(formation: Formation, i: number, n: number, facing: number): Point {
  const spacing = FORMATIONS[formation].spacing;
  let side: number, back: number;
  if (formation === 'wedge') {
    let row = 0, index = i;
    while (index > row) { index -= row + 1; row++; }
    side = (index - row / 2) * spacing; back = -row * spacing;
  } else {
    const width = Math.min(formation === 'wall' ? 6 : 8, n);
    side = (i % width - (width - 1) / 2) * spacing;
    back = -Math.floor(i / width) * spacing;
  }
  return { x: side * Math.cos(facing) + back * Math.sin(facing), z: -side * Math.sin(facing) + back * Math.cos(facing) };
}

export function regimentTroops(w: World, r: Regiment) {
  return w.units.filter(u => u.hp > 0 && u.team === r.team && u.regiment === r.index && isTroop(u.kind) && u.garrison === undefined && !u.tactical)
    .sort((a, b) => Number(STATS[a.kind].range > 3) - Number(STATS[b.kind].range > 3) || a.id - b.id);
}

export function centroid(troops: Unit[]): Point {
  return { x: troops.reduce((sum, u) => sum + u.x, 0) / troops.length, z: troops.reduce((sum, u) => sum + u.z, 0) / troops.length };
}

// Every troop heads straight for its destination slot. The anchor measures the
// actual group position; it is never a rendezvous that must be reached first.
export function updateRegimentGoals(w: World, r: Regiment, options: { reform?: boolean; newMember?: Unit } = {}) {
  const troops = regimentTroops(w, r);
  if (troops.length) r.anchor = centroid(troops);
  const hero = w.units.find(u => u.team === r.team && u.kind === 'hero' && u.hp > 0);
  if (r.movement === 'follow' && hero) {
    const escorts = w.regiments.filter(group => group.team === r.team && group.movement === 'follow' && regimentTroops(w, group).length);
    const offset = escortOffset(w.players[r.team].escortLayout, Math.max(0, escorts.indexOf(r)), escorts.length, hero.facing);
    r.goal = projectWalkable({ x: hero.x + offset.x, z: hero.z + offset.z });
    r.facing = hero.facing;
  } else if (r.movement === 'retreat') r.goal = { x: MAP.bases[r.team].x * 0.8, z: MAP.bases[r.team].z * 0.8 };
  const target = w.units.find(u => u.id === r.target && u.hp > 0 && u.team !== r.team);
  if (r.movement === 'attack' && target) r.goal = projectWalkable(target);
  if (!target) r.target = undefined;
  troops.forEach((u, i) => {
    // Hold stops each soldier where it stands. Only a new recruit or an explicit
    // formation change needs a slot in an already stationary regiment.
    if (r.movement !== 'hold' || options.reform || u === options.newMember) {
      const offset = formationSlot(r.formation, i, troops.length, r.facing);
      u.goal = projectWalkable({ x: r.goal.x + offset.x, z: r.goal.z + offset.z });
    }
    u.order = r.movement;
    u.target = r.target;
  });
  return troops;
}
