import { RULES, STATS, MAP, isTroop } from './config';
import { distance } from './math';
import type { World } from './types';
import { grantLevelPoints } from './skills';
import { equipmentBonuses, maxMana } from './items';
export const xpRequired = (level: number) => level * RULES.hero.xpPerLevel;
export function refreshStats(w: World, team: number) {
  const p = w.players[team]; if (!p) return;
  const gear = equipmentBonuses(p);
  for (const u of w.units) {
    if (u.team !== team || u.kind === 'gate') continue;
    const s = STATS[u.kind];
    // Keep tiers open technology; combat experience grows the hero. Army
    // upgrades stay small enough for composition and positioning to counter them.
    const factor = u.kind === 'base' ? 1 + (p.tier - 1) * 0.25 : u.kind === 'hero'
      ? 1 + (p.level - 1) * 0.025 : 1 + (p.tier - 1) * 0.08;
    const ratio = u.hp / u.maxHp;
    const troop = isTroop(u.kind);
    u.maxHp = s.hp * factor * (u.kind === 'hero' ? 1 + p.skills.resilience * 0.1 : troop ? 1 + p.skills.discipline * 0.05 : 1) + (u.kind === 'hero' ? gear.hp + p.training.vitality * 250 : 0);
    u.hp = u.maxHp * ratio;
    u.damage = (s.damage * factor + (u.kind === 'hero' ? gear.ranged + p.training.warfare * 5 : 0)) * (u.kind === 'hero' ? 1 + p.skills.martial * 0.08 : troop ? 1 + p.skills.inspiration * 0.05 : 1);
    u.meleeDamage = u.kind === 'hero' ? (s.damage * factor * 3 + gear.melee + p.training.warfare * 15) * (1 + p.skills.martial * 0.08) : u.damage;
    u.range = s.range + (u.kind === 'hero' ? gear.range : 0); u.speed = s.speed * (u.kind === 'hero' ? 1 + gear.speed : 1);
    u.cooldown = s.cooldown / (u.kind === 'hero' ? 1 + p.skills.martial * 0.05 : 1);
  }
}
export function progressHero(w: World, dt: number) {
  for (const p of w.players) {
    if (p.eliminated) continue;
    let changed = false;
    while (p.level < p.tier * 10 && p.xp >= xpRequired(p.level)) {
      p.xp -= xpRequired(p.level); p.level++; changed = true;
    }
    if (changed) refreshStats(w, p.id);
    grantLevelPoints(p);
    if (p.level === p.tier * 10) { p.bankedXP += p.xp; p.xp = 0; }
    const gear = equipmentBonuses(p);
    p.mana = Math.min(maxMana(p), p.mana + (RULES.hero.manaRegen + gear.manaRegen) * dt);
    for (const ability of Object.keys(p.cooldowns) as (keyof typeof p.cooldowns)[]) p.cooldowns[ability] = Math.max(0, p.cooldowns[ability] - dt);
    const hero = w.units.find(u => u.team === p.id && u.kind === 'hero' && u.hp > 0);
    if (hero) hero.hp = Math.min(hero.maxHp, hero.hp + (RULES.hero.hpRegen + p.skills.resilience + gear.hpRegen) * (distance(hero, MAP.bases[p.id]) < 12 ? 8 : 1) * dt);
  }
}
