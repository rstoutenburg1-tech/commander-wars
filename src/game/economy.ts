import { MAP, RULES, TROOP_COSTS, troopKinds, UPGRADES, isTroop, type Building, type Cost, type TroopKind } from './config';
import type { Player, World } from './types';
import { notify, spawn } from './world';
import { refreshStats } from './hero';
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
export const unlocked = (p: Player, kind: string) => kind === 'footman' || kind === 'archer' || kind === 'musketeer' && p.barracks >= 2 || kind === 'knight' && p.barracks >= 3;
export const costText = (c: Cost, compact = false) => compact
  ? [`${Math.round(c.gold)}g`, ...(c.wood ? [`${Math.round(c.wood)}w`] : []), ...(c.ore ? [`${Math.round(c.ore)}o`] : [])].join(' / ')
  : `${Math.round(c.gold)}g / ${Math.round(c.wood)}w / ${Math.round(c.ore)}o`;
export const cycleCost = (p: Player): Cost => troopKinds.reduce((sum, kind) => {
  if (unlocked(p, kind)) for (const resource of ['gold', 'wood', 'ore'] as const) sum[resource] += p.production.counts[kind] * TROOP_COSTS[kind][resource];
  return sum;
}, { gold: 0, wood: 0, ore: 0 });
export function recruitmentReason(p: Player, kind: TroopKind): string | null {
  const c = TROOP_COSTS[kind];
  if (p.gold - c.gold < p.production.reserve) return 'gold reserve';
  if (p.wood < c.wood) return 'wood';
  if (p.ore < c.ore) return 'ore';
  return null;
}
export function recruit(p: Player, kind: TroopKind) {
  if (!unlocked(p, kind) || recruitmentReason(p, kind)) return false;
  pay(p, TROOP_COSTS[kind]); return true;
}
export function resourceIncome(w: World, p: Player): Cost {
  const income = { gold: RULES.incomeRates.goldmine[p.goldmine], wood: RULES.incomeRates.forest[p.forest], ore: RULES.incomeRates.quarry[p.quarry] };
  for (const t of w.territories.filter(t => t.captured && t.owner === p.id)) {
    income.gold += t.buildings.goldmine * RULES.incomeRates.goldmine[1]; income.wood += t.buildings.forest * RULES.incomeRates.forest[1]; income.ore += t.buildings.quarry * RULES.incomeRates.quarry[1];
  }
  return income;
}
export function productionBurn(w: World, p: Player): Cost {
  const wave = cycleCost(p), sites = 1 + w.territories.filter(t => t.captured && t.owner === p.id && t.buildings.barracks).length;
  const multiplier = p.production.interval ? sites * 60 / p.production.interval : 0;
  return { gold: wave.gold * multiplier, wood: wave.wood * multiplier, ore: wave.ore * multiplier };
}
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
        p.tier = job.to; p.xp += p.bankedXP; p.bankedXP = 0; refreshStats(w, p.id);
      } else p[job.building] = job.to;
      if (p.id === 0) notify(w, `${job.building === 'crafting' ? 'Workshop' : job.building} level ${job.to} ready.`);
    }
    p.upgrades = p.upgrades.filter(job => job.remaining > 0);
    const prod = p.production;
    if (prod.interval === 0) { prod.status = 'Paused · saving resources'; continue; }
    prod.timer -= dt;
    if (prod.timer > 0) continue;
    prod.timer += prod.interval;
    let count = w.units.filter(u => u.team === p.id && u.hp > 0 && isTroop(u.kind)).length;
    let spawned = 0, skipped = 0; const shortages = new Set<string>();
    for (const kind of troopKinds) {
      if (!unlocked(p, kind)) continue;
      for (let i = 0; i < prod.counts[kind]; i++) {
        if (count >= RULES.armyCap) { skipped++; continue; }
        const reason = recruitmentReason(p, kind);
        if (reason) { skipped++; shortages.add(reason); continue; }
        if (!recruit(p, kind)) continue;
        const b = MAP.bases[p.id];
        const pos = { x: b.x * 0.82 + ((count + i) % 5 - 2) * 1.8, z: b.z * 0.82 + Math.floor((count + i) % 10 / 5) * 1.8 };
        spawn(w, p.id, kind, pos, prod.regiment); count++; spawned++;
      }
    }
    prod.status = count >= RULES.armyCap ? 'Army cap · 40 troops' : skipped ? `${spawned} raised · ${skipped} skipped (${[...shortages].join(', ')})` : `${spawned} raised last cycle`;
  }
}
