import { MAP, RULES, STATS, troopKinds, UPGRADES, type Building, type Cost } from './config';
import type { Player, World } from './types';
import { notify, spawn } from './world';
import { levelFloor, refreshStats } from './hero';
import { grantLevelPoints } from './skills';
export const afford = (p: Player, c: Cost) => p.gold >= c.gold && p.wood >= c.wood && p.ore >= c.ore;
export function pay(p: Player, c: Cost) { p.gold -= c.gold; p.wood -= c.wood; p.ore -= c.ore; }
export const buildingLevel = (p: Player, b: Building) => b === 'base' ? p.tier : p[b];
export function upgradeReason(p: Player, building: Building): string | null {
  const next = buildingLevel(p, building) + 1; const spec = UPGRADES[building][next];
  if (!spec) return 'Maximum prototype level';
  if (p.eliminated) return 'Base destroyed';
  if (p.upgrades.some(u => u.building === building)) return 'Construction in progress';
  if (p.tier < spec.requiresTier) return `Requires base Tier ${spec.requiresTier}`;
  if (building === 'base' && p.crafting < 1) return 'Build workshop first';
  if (building === 'base' && p.barracks < p.tier) return `Requires Barracks ${p.tier}`;
  if (!afford(p, spec.cost)) return `Need ${spec.cost.gold} gold / ${spec.cost.wood} wood / ${spec.cost.ore} ore`;
  return null;
}
export function startUpgrade(w: World, team: number, building: Building) {
  const p = w.players[team]; const reason = upgradeReason(p, building);
  if (reason) { if (team === 0) notify(w, reason); return false; }
  const to = buildingLevel(p, building) + 1; const spec = UPGRADES[building][to]; pay(p, spec.cost);
  p.upgrades.push({ building, to, remaining: spec.time, total: spec.time }); return true;
}
export const unlocked = (p: Player, kind: string) => kind === 'footman' || (kind === 'archer' || kind === 'musketeer') && p.barracks >= 2 || kind === 'knight' && p.barracks >= 3;
export const cycleCost = (p: Player) => troopKinds.reduce((sum, kind) => sum + (unlocked(p, kind) ? p.production.counts[kind] * STATS[kind].cost : 0), 0);
export function stepEconomy(w: World, dt: number) {
  for (const p of w.players) {
    if (p.eliminated) continue;
    p.gold += RULES.incomeRates.goldmine[p.goldmine] * dt;
    p.wood += RULES.incomeRates.forest[p.forest] * dt;
    p.ore += RULES.incomeRates.quarry[p.quarry] * dt;
    for (const job of p.upgrades) {
      job.remaining -= dt;
      if (job.remaining > 0) continue;
      if (job.building === 'base') {
        p.tier = job.to; p.level = Math.max(p.level, levelFloor(p.tier)); p.xp += p.bankedXP; p.bankedXP = 0; grantLevelPoints(p); refreshStats(w, p.id);
      } else p[job.building] = job.to;
      if (p.id === 0) notify(w, `${job.building === 'crafting' ? 'Workshop' : job.building} level ${job.to} ready.`);
    }
    p.upgrades = p.upgrades.filter(job => job.remaining > 0);
    const prod = p.production;
    if (prod.interval === 0) { prod.status = 'Paused · saving gold'; continue; }
    prod.timer -= dt;
    if (prod.timer > 0) continue;
    prod.timer += prod.interval;
    let count = w.units.filter(u => u.team === p.id && u.kind !== 'hero' && u.kind !== 'base').length;
    let spawned = 0, skipped = 0;
    for (const kind of troopKinds) {
      if (!unlocked(p, kind)) continue;
      for (let i = 0; i < prod.counts[kind]; i++) {
        if (count >= RULES.armyCap || p.gold - STATS[kind].cost < prod.reserve) { skipped++; continue; }
        p.gold -= STATS[kind].cost;
        const b = MAP.bases[p.id], r = w.regiments.find(r => r.team === p.id && r.index === prod.regiment)!;
        const pos = { x: b.x * 0.82 + ((count + i) % 5 - 2) * 1.8, z: b.z * 0.82 + Math.floor((count + i) % 10 / 5) * 1.8 };
        const u = spawn(w, p.id, kind, pos, prod.regiment);
        u.order = r.movement === 'advance' ? 'advance' : r.movement;
        u.goal = { ...r.goal }; count++; spawned++;
      }
    }
    prod.status = count >= RULES.armyCap ? 'Army cap · 40 troops' : skipped ? `${spawned} raised · ${skipped} skipped (reserve)` : `${spawned} raised last cycle`;
  }
}
