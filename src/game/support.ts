import { SUPPORT, isTroop, type Support } from './config';
import { afford, pay } from './economy';
import { distance, clamp } from './math';
import type { World } from './types';
import { notify } from './world';
const commander = (w: World, team: number) => w.units.find(u => u.team === team && u.kind === 'hero' && u.hp > 0);
const nearby = (w: World, team: number) => {
  const hero = commander(w, team);
  return hero ? w.units.filter(u => u.team === team && u.hp > 0 && (u.kind === 'hero' || isTroop(u.kind)) && distance(u, hero) <= SUPPORT.resupply.radius) : [];
};
export function supportReason(w: World, team: number, action: Support): string | null {
  const p = w.players[team], spec = SUPPORT[action], hero = commander(w, team);
  if (p.eliminated || w.winner !== null) return 'Match ended';
  if (p.crafting < spec.tier) return `Requires Workshop ${spec.tier}`;
  if (!hero) return 'Requires living hero';
  if (w.time < p.supportReady[action]) return `Ready in ${Math.ceil(p.supportReady[action] - w.time)}s`;
  if (!afford(p, spec.cost)) return 'Insufficient resources';
  if (action === 'resupply') {
    if (w.units.some(u => u.hp > 0 && u.team !== team && (u.kind === 'hero' || isTroop(u.kind) || u.kind === 'boss' || u.kind === 'base') && distance(u, hero) < 22)) return 'Withdraw hero from enemies to resupply';
    const allies = nearby(w, team), groups = w.regiments.filter(r => r.team === team && allies.some(u => isTroop(u.kind) && u.regiment === r.index));
    if (!allies.some(u => u.hp < u.maxHp) && !groups.some(r => r.cohesion < 100)) return 'Nearby army is fully supplied';
  }
  return null;
}
export function useSupport(w: World, team: number, action: Support) {
  if (supportReason(w, team, action)) return false;
  const p = w.players[team], spec = SUPPORT[action], hero = commander(w, team)!;
  pay(p, spec.cost); p.supportReady[action] = w.time + spec.cooldown;
  if (action === 'siege') p.siegeUntil = w.time + SUPPORT.siege.duration;
  else {
    const allies = nearby(w, team);
    for (const u of allies) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * SUPPORT.resupply.heal);
    for (const r of w.regiments.filter(r => r.team === team && allies.some(u => isTroop(u.kind) && u.regiment === r.index))) r.cohesion = clamp(r.cohesion + SUPPORT.resupply.cohesion, 0, 100);
    w.effects.push({ x: hero.x, z: hero.z, radius: SUPPORT.resupply.radius, life: 1.2, duration: 1.2, color: '#70edaa', kind: 'wind', source: hero.id });
  }
  if (team === 0) notify(w, action === 'siege' ? 'Siege ammunition: archers and musketeers deal 150% damage to structures for 35s.' : 'Field resupply: nearby hero and troops healed 20%; cohesion restored.');
  return true;
}
