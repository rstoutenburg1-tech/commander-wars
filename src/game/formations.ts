import { COHESION, isTroop } from './config';
import { distance, clamp } from './math';
import type { Formation, World } from './types';
import { commandRegiment } from './commands';
import { updateRegimentGoals } from './regiment-movement';
export { escortOffset, formationSlot } from './regiment-movement';
export function gatherArmy(w: World, team = 0) {
  for (const r of w.regiments.filter(r => r.team === team)) {
    commandRegiment(w, team, r.index, 'follow');
  }
  for (const r of w.regiments.filter(r => r.team === team && r.movement === 'follow')) updateRegimentGoals(w, r);
}
export function selectedRegiments(w: World, ids: Set<number>, activeIndex: number | null = null) {
  const indices = new Set(w.units.filter(u => ids.has(u.id) && u.team === 0 && u.hp > 0 && isTroop(u.kind) && u.garrison === undefined).map(u => u.regiment));
  if (!indices.size && activeIndex !== null) indices.add(activeIndex);
  return w.regiments.filter(r => r.team === 0 && indices.has(r.index));
}
export function setSelectionFormation(w: World, ids: Set<number>, formation: Formation, activeIndex: number | null = null) {
  if (w.winner !== null || w.players[0].eliminated) return;
  for (const r of selectedRegiments(w, ids, activeIndex)) { r.formation = formation; updateRegimentGoals(w, r, { reform: true }); }
}
export function stepRegiments(w: World, dt: number) {
  for (const r of w.regiments) {
    const troops = updateRegimentGoals(w, r);
    if (!troops.length) continue;
    const hero = w.units.find(u => u.team === r.team && u.kind === 'hero' && u.hp > 0);
    const moving = troops.some(u => distance(u, u.goal) > 0.75);
    const separated = troops.filter(u => distance(u, u.goal) > COHESION.separationDistance).length;
    const nearHero = !!hero && distance(hero, r.anchor) < 16;
    r.cohesion = clamp(r.cohesion + dt * ((!moving || nearHero ? COHESION.recovery + w.players[r.team].skills.discipline * 0.4 : 0.4) - separated / troops.length * COHESION.separationLoss), 0, 100);
  }
}
