import { RULES, STATS } from './config';
import type { World } from './types';
export const levelFloor = (tier: number) => (tier - 1) * 10 + 1;
export const xpRequired = (level: number) => level * RULES.hero.xpPerLevel;
export function refreshStats(w: World, team: number) {
  const p = w.players[team]; if (!p) return;
  for (const u of w.units) {
    if (u.team !== team) continue;
    const s = STATS[u.kind];
    const factor = u.kind === 'base' ? 1 + (p.tier - 1) * 0.5 : u.kind === 'hero'
      ? 1 + (p.tier - 1) * 0.9 + (p.level - levelFloor(p.tier)) * 0.04
      : 1 + (p.tier - 1) * 0.22 + (p.level - 1) * 0.018;
    const ratio = u.hp / u.maxHp;
    u.maxHp = s.hp * factor; u.hp = u.maxHp * ratio; u.damage = s.damage * factor;
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
    p.mana = Math.min(RULES.hero.mana, p.mana + RULES.hero.manaRegen * dt);
    p.cooldowns.rally = Math.max(0, p.cooldowns.rally - dt); p.cooldowns.wind = Math.max(0, p.cooldowns.wind - dt);
    const hero = w.units.find(u => u.team === p.id && u.kind === 'hero');
    if (hero) hero.hp = Math.min(hero.maxHp, hero.hp + RULES.hero.hpRegen * dt);
  }
}
