import { ABILITIES, RULES } from './config';
import { distance, clamp } from './math';
import type { World } from './types';
import { notify } from './world';
export function cast(w: World, team: number, ability: keyof typeof ABILITIES) {
  const p = w.players[team], spec = ABILITIES[ability];
  const hero = w.units.find(u => u.team === team && u.kind === 'hero' && u.hp > 0);
  if (w.paused || w.winner !== null || !hero || p.mana < spec.cost || p.cooldowns[ability] > 0) return false;
  p.mana -= spec.cost; p.cooldowns[ability] = spec.cooldown;
  if (ability === 'rally') {
    p.rallyUntil = w.time + ABILITIES.rally.duration;
    for (const r of w.regiments) if (r.team === team && distance(r.anchor, hero) < ABILITIES.rally.radius) r.cohesion = clamp(r.cohesion + ABILITIES.rally.cohesion, 0, 100);
  } else hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * ABILITIES.wind.heal);
  w.effects.push({ x: hero.x, z: hero.z, life: 0.8, radius: ability === 'rally' ? ABILITIES.rally.radius : 3, color: ability === 'rally' ? '#ffe9a0' : '#8dfaab' });
  if (team === 0) notify(w, `${spec.name} activated · ${Math.floor(p.mana)} / ${RULES.hero.mana} mana.`);
  return true;
}
