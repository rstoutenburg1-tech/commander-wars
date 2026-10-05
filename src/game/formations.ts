import { COHESION, STATS, isTroop, isRangedTroop } from './config';
import { distance, clamp } from './math';
import type { Formation, World } from './types';
import { commandRegiment } from './commands';
import { updateRegimentGoals } from './regiment-movement';
import { localPlayer, enemies } from './match';
import { blockingGate } from './gates';
import { inSafeZone } from './objectives';
export { escortOffset, formationSlot } from './regiment-movement';
export function gatherArmy(w: World, team = localPlayer(w)) {
  for (const r of w.regiments.filter(r => r.team === team)) {
    commandRegiment(w, team, r.index, 'follow');
  }
  for (const r of w.regiments.filter(r => r.team === team && r.movement === 'follow')) updateRegimentGoals(w, r);
}
export function selectedRegiments(w: World, ids: Set<number>, activeIndex: number | null = null, team = localPlayer(w)) {
  const indices = new Set(w.units.filter(u => ids.has(u.id) && u.team === team && u.hp > 0 && isTroop(u.kind) && u.garrison === undefined).map(u => u.regiment));
  if (!indices.size && activeIndex !== null) indices.add(activeIndex);
  return w.regiments.filter(r => r.team === team && indices.has(r.index));
}
export function setSelectionFormation(w: World, ids: Set<number>, formation: Formation, activeIndex: number | null = null, team = localPlayer(w)) {
  if (w.winner !== null || w.players[team].eliminated) return;
  for (const r of selectedRegiments(w, ids, activeIndex, team)) { r.formation = formation; updateRegimentGoals(w, r, { reform: true }); }
}
export function stepRegiments(w: World, dt: number) {
  const byId = new Map(w.units.map(u => [u.id, u]));
  for (const r of w.regiments) {
    const troops = updateRegimentGoals(w, r);
    if (!troops.length) continue;
    const hero = w.units.find(u => u.team === r.team && u.kind === 'hero' && u.hp > 0);
    const firing = new Set(troops.filter(u => {
      if (!isRangedTroop(u.kind) || u.order === 'move' || u.order === 'retreat' || inSafeZone(u)) return false;
      const valid = (t: typeof u) => t.hp > 0 && enemies(w, u.team, t.team) && !inSafeZone(t);
      const exact = byId.get(u.target ?? -1), tracked = byId.get(u.autoTarget ?? -1);
      let target = exact && valid(exact) ? exact : tracked && valid(tracked) ? tracked : undefined;
      if (target) {
        const barrier = blockingGate(w, u, target, [target.garrison ?? -1, target.kind === 'gate' ? target.id : -1]);
        if (barrier) target = enemies(w, u.team, barrier.team) ? barrier : undefined;
      }
      return target && distance(u, target) - STATS[target.kind].radius <= u.range + 1e-6;
    }).map(u => u.id));
    // A soldier firing from its weapon reach is in position, not a straggler.
    const moving = troops.some(u => !firing.has(u.id) && distance(u, u.goal) > 0.75);
    const separated = troops.filter(u => !firing.has(u.id) && distance(u, u.goal) > COHESION.separationDistance).length;
    const nearHero = !!hero && distance(hero, r.anchor) < 16;
    r.cohesion = clamp(r.cohesion + dt * ((!moving || nearHero ? COHESION.recovery + w.players[r.team].skills.discipline * 0.4 : 0.4) - separated / troops.length * COHESION.separationLoss), 0, 100);
  }
}
