import { ABILITIES, RULES, MAP } from './config';
import { distance, clamp } from './math';
import type { World } from './types';
import { notify } from './world';
import { damageUnit } from './combat';
import { abilityRank, maxMana } from './items';
export function cast(w: World, team: number, ability: keyof typeof ABILITIES) {
  const p = w.players[team], spec = ABILITIES[ability];
  const hero = w.units.find(u => u.team === team && u.kind === 'hero' && u.hp > 0);
  const rank = abilityRank(p, ability);
  if (w.paused || w.winner !== null || !hero || !rank || p.mana < spec.cost || p.cooldowns[ability] > 0) return false;
  if (ability === 'cleave' && distance(hero, MAP.merchant) < MAP.merchant.radius) return false;
  p.mana -= spec.cost; p.cooldowns[ability] = spec.cooldown;
  if (ability === 'rally') {
    p.rallyUntil = w.time + ABILITIES.rally.duration;
    for (const r of w.regiments) if (r.team === team && distance(r.anchor, hero) < ABILITIES.rally.radius) r.cohesion = clamp(r.cohesion + ABILITIES.rally.cohesion + (rank - 1) * 5, 0, 100);
  } else if (ability === 'wind') hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * (0.25 + (rank - 1) * 0.05));
  else if (ability === 'cleave') {
    for (const u of w.units) if (u.team !== team && u.kind !== 'base' && distance(u, hero) < ABILITIES.cleave.radius) damageUnit(w, u, hero, hero.meleeDamage * (1.6 + rank * 0.4));
  } else if (ability === 'warcry') p.warcryUntil = w.time + ABILITIES.warcry.duration;
  else if (ability === 'standfast') p.standfastUntil = w.time + ABILITIES.standfast.duration;
  else if (ability === 'ultimate') {
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.4);
    for (const u of w.units) if (u.team === team && u.hp > 0 && u.kind !== 'base' && u.kind !== 'hero' && distance(u, hero) < ABILITIES.ultimate.radius) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.25);
    for (const r of w.regiments) if (r.team === team && distance(r.anchor, hero) < ABILITIES.ultimate.radius) r.cohesion = 100;
  }
  w.effects.push({ x: hero.x, z: hero.z, life: 0.8, radius: ability === 'rally' ? ABILITIES.rally.radius : 3, color: ability === 'rally' ? '#ffe9a0' : '#8dfaab' });
  if (team === 0) notify(w, `${spec.name} activated · ${Math.floor(p.mana)} / ${maxMana(p)} mana.`);
  return true;
}
