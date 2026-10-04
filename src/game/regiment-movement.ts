import { FORMATIONS, MAP, STATS, isTroop } from './config';
import { projectWalkable } from './navigation';
import type { Formation, Point, Regiment, Unit, World } from './types';

interface EscortFootprint { width: number; depth: number; center: number }

export function escortOffset(layout: 'ring' | 'vanguard' | 'rearguard', index: number, count: number, facing: number, footprints?: readonly EscortFootprint[]): Point {
  const angle = facing + (layout === 'ring' ? index / Math.max(1, count) * Math.PI * 2 : 0);
  if (layout === 'ring') return { x: Math.sin(angle) * 9, z: Math.cos(angle) * 9 };
  // Center each row, including a single regiment or a partially filled row.
  // Vanguard anchors include rank depth so its last rank stays ahead of the hero.
  const sizes = Array.from({ length: Math.max(1, count) }, (_, i) => footprints?.[i] ?? { width: 8, depth: 0, center: 0 });
  const rowStart = Math.floor(index / 3) * 3, row = sizes.slice(rowStart, rowStart + 3), gap = 2;
  const width = row.reduce((sum, size) => sum + size.width, 0) + Math.max(0, row.length - 1) * gap;
  const before = row.slice(0, index - rowStart).reduce((sum, size) => sum + size.width + gap, 0);
  const size = sizes[index] ?? { width: 8, depth: 0, center: 0 };
  const side = -width / 2 + before + size.width / 2 - size.center;
  let edge = 8;
  for (let start = 0; start < rowStart; start += 3) edge += Math.max(...sizes.slice(start, start + 3).map(size => size.depth)) + gap;
  const front = layout === 'vanguard' ? edge + size.depth : -edge;
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

const escortHeadings = new WeakMap<Unit, { position: Point; goal: Point; order: Unit['order']; target?: number; facing: number }>();
function escortFacing(hero: Unit) {
  const marching = hero.order === 'move' || hero.order === 'advance' || hero.order === 'retreat';
  const old = escortHeadings.get(hero);
  const goalChanged = !old || Math.hypot(hero.goal.x - old.goal.x, hero.goal.z - old.goal.z) > 0.1 || hero.order !== old.order || hero.target !== old.target;
  let facing = old?.facing ?? hero.facing;
  if ((marching || hero.order === 'attack' && hero.target !== undefined) && goalChanged && Math.hypot(hero.goal.x - hero.x, hero.goal.z - hero.z) > 0.75) facing = Math.atan2(hero.goal.x - hero.x, hero.goal.z - hero.z);
  else if (marching && old && hero.target === undefined && hero.autoTarget === undefined && Math.hypot(hero.x - old.position.x, hero.z - old.position.z) > 0.04) facing = Math.atan2(hero.x - old.position.x, hero.z - old.position.z);
  // Weapon swings and nearby auto-target changes must not spin every escort slot.
  escortHeadings.set(hero, { position: { x: hero.x, z: hero.z }, goal: { ...hero.goal }, order: hero.order, target: hero.target, facing });
  return facing;
}

function escortFootprint(r: Regiment, troops: Unit[]): EscortFootprint {
  const slots = troops.map((_, i) => formationSlot(r.formation, i, troops.length, 0));
  const min = Math.min(...slots.map(slot => slot.x)), max = Math.max(...slots.map(slot => slot.x));
  const radius = Math.max(...troops.map(u => STATS[u.kind].radius));
  return { width: max - min + radius * 2, depth: -Math.min(...slots.map(slot => slot.z)), center: (min + max) / 2 };
}

// Every troop heads straight for its destination slot. The anchor measures the
// actual group position; it is never a rendezvous that must be reached first.
export function updateRegimentGoals(w: World, r: Regiment, options: { reform?: boolean; newMember?: Unit } = {}) {
  const troops = regimentTroops(w, r);
  if (troops.length) r.anchor = centroid(troops);
  const hero = w.units.find(u => u.team === r.team && u.kind === 'hero' && u.hp > 0);
  if (r.movement === 'follow' && hero) {
    const escorts = w.regiments.filter(group => group.team === r.team && group.movement === 'follow' && regimentTroops(w, group).length);
    const facing = escortFacing(hero), footprints = escorts.map(group => escortFootprint(group, regimentTroops(w, group)));
    const offset = escortOffset(w.players[r.team].escortLayout, Math.max(0, escorts.indexOf(r)), escorts.length, facing, footprints);
    r.goal = projectWalkable({ x: hero.x + offset.x, z: hero.z + offset.z });
    r.facing = facing;
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
