import { BOSS, COHESION, ITEMS, MAP } from './config';
import { distance, clamp } from './math';
import { afford, pay } from './economy';
import { refreshStats } from './hero';
import { damageUnit } from './combat';
import { notify } from './world';
import type { Unit, World } from './types';
export const inSafeZone = (u: Unit) => distance(u, MAP.merchant) < MAP.merchant.radius;
export function startCraft(w: World, team: number, item: 'sword' | 'armor') {
  const p = w.players[team], recipe = ITEMS[item];
  if (p.eliminated || p.crafting < 1 || p.craft || p.items[item] || !afford(p, recipe.cost)) return false;
  pay(p, recipe.cost); p.craft = { item, remaining: recipe.craftTime }; return true;
}
export function merchant(w: World, action: 'buy' | 'sell-sword' | 'sell-armor') {
  const p = w.players[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero');
  if (!hero || !inSafeZone(hero)) { notify(w, 'Move your commander into the merchant safe zone.'); return false; }
  if (action === 'buy') {
    if (p.gold < ITEMS.potion.buy) return false;
    p.gold -= ITEMS.potion.buy; w.merchantGold += ITEMS.potion.buy;
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * ITEMS.potion.heal);
  } else {
    const item = action === 'sell-sword' ? 'sword' : 'armor';
    if (!p.items[item] || w.merchantGold < ITEMS[item].sell) return false;
    p.items[item] = false; p.gold += ITEMS[item].sell; w.merchantGold -= ITEMS[item].sell; refreshStats(w, 0);
  }
  return true;
}
export function stepObjectives(w: World, dt: number) {
  w.merchantGold += dt;
  for (const p of w.players) {
    if (!p.craft || p.eliminated) continue;
    p.craft.remaining -= dt;
    if (p.craft.remaining <= 0) {
      p.items[p.craft.item] = true; refreshStats(w, p.id);
      if (p.id === 0) notify(w, `${ITEMS[p.craft.item].name} equipped.`);
      p.craft = undefined;
    }
  }
  const boss = w.units.find(u => u.kind === 'boss');
  if (!boss) return;
  const nearby = w.units.filter(u => u.team < 4 && u.kind !== 'base' && !inSafeZone(u) && distance(u, boss) < BOSS.smashRadius);
  if (!nearby.length) { w.bossTimer = Math.max(0, w.bossTimer - dt); return; }
  w.bossTimer += dt;
  // One-second visible warning gives the commander time to leave the smash radius.
  if (w.bossTimer >= BOSS.smashInterval - 1 && w.bossTimer - dt < BOSS.smashInterval - 1) w.effects.push({ x: boss.x, z: boss.z, radius: BOSS.smashRadius, life: 1, color: '#ff734b' });
  if (w.bossTimer < BOSS.smashInterval) return;
  w.bossTimer = 0;
  for (const u of nearby) {
    damageUnit(w, u, boss, BOSS.smashDamage);
    const r = w.regiments.find(r => r.team === u.team && r.index === u.regiment);
    if (r) r.cohesion = clamp(r.cohesion - COHESION.chargeLoss * 0.15, 0, 100);
  }
  w.effects.push({ x: boss.x, z: boss.z, radius: BOSS.smashRadius, life: 0.4, color: '#ffe083' });
}
