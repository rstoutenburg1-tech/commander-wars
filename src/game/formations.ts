import { COHESION, FORMATIONS, MAP, STATS, ABILITIES } from './config';
import { distance, moveToward, clamp } from './math';
import type { Formation, Point, World } from './types';
import { moveOnMap, projectWalkable } from './navigation';
import { commandRegiment } from './commands';
export function escortOffset(layout: 'ring' | 'vanguard' | 'rearguard', index: number, count: number, facing: number): Point {
  const angle = facing + (layout === 'ring' ? index / Math.max(1, count) * Math.PI * 2 : 0);
  if (layout === 'ring') return { x: Math.sin(angle) * 9, z: Math.cos(angle) * 9 };
  const side = (index % 3 - 1) * 10, front = (layout === 'vanguard' ? 1 : -1) * (8 + Math.floor(index / 3) * 7);
  return { x: side * Math.cos(angle) + front * Math.sin(angle), z: -side * Math.sin(angle) + front * Math.cos(angle) };
}
export function gatherArmy(w: World, team = 0) {
  for (const r of w.regiments.filter(r => r.team === team)) {
    const troops = w.units.filter(u => u.team === team && u.regiment === r.index && u.kind !== 'hero' && u.kind !== 'base');
    if (!troops.length) continue;
    r.anchor = { x: troops.reduce((sum, u) => sum + u.x, 0) / troops.length, z: troops.reduce((sum, u) => sum + u.z, 0) / troops.length };
    commandRegiment(w, team, r.index, 'follow');
  }
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
export function selectedRegiments(w: World, ids: Set<number>, activeIndex: number | null = null) {
  const indices = new Set(w.units.filter(u => ids.has(u.id) && u.team === 0 && u.hp > 0 && u.kind !== 'hero' && u.kind !== 'base').map(u => u.regiment));
  if (!indices.size && activeIndex !== null) indices.add(activeIndex);
  return w.regiments.filter(r => r.team === 0 && indices.has(r.index));
}
export function setSelectionFormation(w: World, ids: Set<number>, formation: Formation, activeIndex: number | null = null) {
  if (w.winner !== null || w.players[0].eliminated) return;
  for (const r of selectedRegiments(w, ids, activeIndex)) r.formation = formation;
}
export function stepRegiments(w: World, dt: number) {
  for (const r of w.regiments) {
    const troops = w.units.filter(u => u.team === r.team && u.regiment === r.index && u.kind !== 'hero' && u.kind !== 'base' && !u.tactical);
    if (!troops.length) continue;
    // Melee occupies the front slots; ranged troops remain behind the screen.
    troops.sort((a, b) => Number(STATS[a.kind].range > 3) - Number(STATS[b.kind].range > 3) || a.id - b.id);
    const hero = w.units.find(u => u.team === r.team && u.kind === 'hero');
    let goal = r.goal;
    if (r.movement === 'follow' && hero) {
      const escorts = w.regiments.filter(group => group.team === r.team && group.movement === 'follow' && w.units.some(u => u.team === r.team && u.regiment === group.index && u.kind !== 'hero' && u.kind !== 'base' && !u.tactical));
      const offset = escortOffset(w.players[r.team].escortLayout, escorts.indexOf(r), escorts.length, hero.facing);
      goal = projectWalkable({ x: hero.x + offset.x, z: hero.z + offset.z });
    } else if (r.movement === 'follow') goal = r.anchor;
    if (r.movement === 'retreat') goal = { x: MAP.bases[r.team].x * 0.8, z: MAP.bases[r.team].z * 0.8 };
    const moving = r.movement !== 'hold' && distance(r.anchor, goal) > 0.5;
    if (moving) {
      r.facing = Math.atan2(goal.x - r.anchor.x, goal.z - r.anchor.z);
      const rally = hero && w.players[r.team].rallyUntil > w.time && distance(hero, r.anchor) < ABILITIES.rally.radius;
      const speed = Math.min(...troops.map(u => u.speed)) * FORMATIONS[r.formation].speed * (rally ? ABILITIES.rally.movement : 1);
      moveOnMap(r.anchor, goal, speed * dt);
    } else if (r.movement === 'follow' && hero) r.facing = hero.facing;
    let separated = 0;
    troops.forEach((u, i) => {
      const offset = formationSlot(r.formation, i, troops.length, r.facing);
      u.goal = projectWalkable({ x: r.anchor.x + offset.x, z: r.anchor.z + offset.z });
      u.order = r.movement;
      if (distance(u, u.goal) > COHESION.separationDistance) separated++;
    });
    const nearHero = !!hero && distance(hero, r.anchor) < 16;
    r.cohesion = clamp(r.cohesion + dt * ((!moving || nearHero ? COHESION.recovery + w.players[r.team].skills.discipline * 0.4 : 0.4) - separated / troops.length * COHESION.separationLoss), 0, 100);
  }
}
