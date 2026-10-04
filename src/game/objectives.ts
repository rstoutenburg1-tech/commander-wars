import { BOSS, COHESION, ITEMS, MAP } from './config';
import { distance, clamp } from './math';
import { buyConsumable, sellItem, grantItem } from './items';
export { startCraft } from './items';
import { damageUnit } from './combat';
import { notify } from './world';
import type { Unit, World } from './types';
export const inSafeZone = (u: Unit) => distance(u, MAP.merchant) < MAP.merchant.radius;
export function merchant(w: World, action: 'buy' | 'sell-sword' | 'sell-armor') {
  const p = w.players[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero');
  if (!hero || !inSafeZone(hero)) { notify(w, 'Move your commander into the merchant safe zone.'); return false; }
  return action === 'buy' ? buyConsumable(w, 'healing') : sellItem(w, action === 'sell-sword' ? 'sword' : 'armor');
}
export function stepObjectives(w: World, dt: number) {
  w.merchantGold += dt;
  for (const p of w.players) {
    if (!p.craft || p.eliminated) continue;
    p.craft.remaining -= dt;
    if (p.craft.remaining <= 0) {
      grantItem(w, p.id, p.craft.item);
      if (p.id === 0) notify(w, `${ITEMS[p.craft.item].name} crafted. Manage equipment in Items.`);
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
