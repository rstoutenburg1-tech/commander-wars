import { MAP, RULES, UPGRADES, isTroop, type Building, type TroopKind } from './config';
import type { Player, Unit, World } from './types';
import { distance } from './math';
import { buildingLevel, cycleCost, resourceIncome, startUpgrade, unlocked } from './economy';
import { cast } from './abilities';
import { commandRegiment } from './commands';
import { trainSkill } from './skills';
import { toggleGate, buildTower, gatePosition, garrisonUnit, leaveTower } from './gates';
import { buildOutpost } from './outposts';
import { startCraft } from './items';
import { useSupport } from './support';

function composition(p: Player, visible: Unit[]) {
  const counts: Record<TroopKind, number> = p.id === 1
    ? { footman: 3, archer: 1, musketeer: 0, knight: 0 }
    : p.id === 2
      ? { footman: 2, archer: 0, musketeer: 2, knight: 0 }
      : { footman: 1, archer: 2, musketeer: 0, knight: 1 };
  const ranged = visible.filter(u => u.kind === 'archer' || u.kind === 'musketeer').length;
  const cavalry = visible.filter(u => u.kind === 'knight').length;
  const infantry = visible.filter(u => u.kind === 'footman').length;
  if (cavalry >= 2 && unlocked(p, 'musketeer')) Object.assign(counts, { footman: 2, archer: 0, musketeer: 2, knight: 0 });
  else if (ranged >= 3 && unlocked(p, 'knight')) Object.assign(counts, { footman: 2, archer: 1, musketeer: 0, knight: 1 });
  else if (infantry >= 4 && infantry > ranged + cavalry) Object.assign(counts, { footman: 2, archer: 2, musketeer: 0, knight: 0 });
  for (const kind of ['musketeer', 'knight'] as const) if (!unlocked(p, kind)) {
    counts.footman += counts[kind]; counts[kind] = 0;
  }
  return counts;
}

function nextBuilding(w: World, p: Player, wave: ReturnType<typeof cycleCost>): Building | undefined {
  const available = (b: Building) => {
    const spec = UPGRADES[b][buildingLevel(p, b) + 1];
    return spec && spec.requiresTier <= p.tier && !p.upgrades.some(j => j.building === b);
  };
  for (const b of ['forest', 'quarry', 'crafting'] as const) if (!p[b] && available(b)) return b;
  if (p.upgrades.length) return;
  if (p.goldmine < Math.min(3, p.tier) && available('goldmine')) return 'goldmine';
  const income = resourceIncome(w, p);
  for (const [building, resource] of [['forest', 'wood'], ['quarry', 'ore']] as const) {
    if (available(building) && (wave[resource] * 3 > income[resource] * 60 * .85 || p[building] < Math.min(p.tier, 3))) return building;
  }
  if (p.barracks < 2 && w.time > (p.id === 2 ? 60 : 180) && available('barracks')) return 'barracks';
  if (p.barracks < 3 && p.tier >= 2 && w.time > (p.id === 3 ? 300 : 480) && available('barracks')) return 'barracks';
  if (p.crafting < 2 && p.tier >= 2 && w.time > 360 && available('crafting')) return 'crafting';
  if (p.tier < 4 && w.time > p.tier * 180 + p.id * 15 && p.crafting && p.barracks >= p.tier && available('base')) return 'base';
}

function planEconomy(w: World, p: Player, visible: Unit[]) {
  p.production.counts = composition(p, visible);
  const wave = cycleCost(p), income = resourceIncome(w, p), building = nextBuilding(w, p, wave);
  const saving = building ? UPGRADES[building][buildingLevel(p, building) + 1].cost : undefined;
  p.production.reserve = Math.max(90, saving?.gold ?? 0);
  const sites = 1 + w.territories.filter(t => t.captured && t.owner === p.id && t.buildings.barracks).length;
  p.production.interval = p.upgrades.some(j => j.building === 'base') || p.gold < 120 ||
    wave.gold * sites / RULES.spawnInterval > income.gold * .9 || wave.wood * sites / RULES.spawnInterval > income.wood || wave.ore * sites / RULES.spawnInterval > income.ore ? 30 : RULES.spawnInterval;
  // Save construction materials before repeating expensive troops; gold-only
  // infantry keeps reinforcements coming while the workshop/economy develops.
  if (saving) {
    if (p.wood < saving.wood + wave.wood) { p.production.counts.footman += p.production.counts.archer + p.production.counts.knight; p.production.counts.archer = p.production.counts.knight = 0; }
    if (p.ore < saving.ore + wave.ore) { p.production.counts.footman += p.production.counts.musketeer + p.production.counts.knight; p.production.counts.musketeer = p.production.counts.knight = 0; }
    startUpgrade(w, p.id, building!);
  }
  if (!building && !p.craft && w.time > 180 && p.gold > 350 && p.wood > 120 && p.ore > 140) startCraft(w, p.id, p.id === 2 ? 'sword' : 'armor');
}

export function stepAI(w: World, dt: number) {
  if (!w.aiEnabled) return;
  for (const p of w.players.slice(1)) {
    if (p.eliminated || (p.aiTimer -= dt) > 0) continue;
    p.aiTimer = RULES.ai.thinkInterval;
    const skills = p.id === 2 ? ['cleave', 'martial', 'wind', 'rally', 'resilience', 'discipline', 'inspiration', 'ultimate'] as const : ['rally', 'wind', 'discipline', 'resilience', 'cleave', 'inspiration', 'martial', 'ultimate'] as const;
    for (const id of skills) trainSkill(w, p.id, id);
    const hero = w.units.find(u => u.team === p.id && u.kind === 'hero' && u.hp > 0);
    const army = w.units.filter(u => u.hp > 0 && u.team === p.id && (u.kind === 'hero' || isTroop(u.kind)));
    const b = MAP.bases[p.id];
    const visible = w.units.filter(u => u.hp > 0 && u.team !== p.id && u.team < 4 && (u.kind === 'hero' || isTroop(u.kind)) && (distance(u, hero ?? b) < 35 || distance(u, b) < RULES.ai.defendRadius));
    planEconomy(w, p, visible);
    const threat = w.units.find(u => u.hp > 0 && u.team !== p.id && u.team < 4 && (u.kind === 'hero' || isTroop(u.kind)) && (distance(u, b) < RULES.ai.defendRadius || distance(u, gatePosition(p.id)) < 18));
    const bases = w.units.filter(u => u.kind === 'base' && u.team !== p.id);
    bases.sort((a, c) => distance(a, hero ?? b) - distance(c, hero ?? b));
    // Stable team tie-break prevents all three AIs opening on the human.
    const target = threat ?? bases.find(base => base.team === (p.id + 1) % 4) ?? bases[0];
    const retreat = hero && hero.hp < hero.maxHp * RULES.ai.retreatHp;
    if (hero && hero.hp < hero.maxHp * 0.7) cast(w, p.id, 'wind');
    if (hero && visible.some(u => distance(u, hero) < 12)) { cast(w, p.id, 'rally'); cast(w, p.id, 'cleave'); }
    if (hero && army.some(u => distance(u, hero) < 18 && u.hp < u.maxHp * .7) && !w.units.some(u => u.hp > 0 && u.team !== p.id && (u.kind === 'hero' || isTroop(u.kind) || u.kind === 'boss' || u.kind === 'base') && distance(u, hero) < 22)) useSupport(w, p.id, 'resupply');
    if (hero && army.filter(u => u.kind === 'archer' || u.kind === 'musketeer').length >= 2 && w.units.some(u => u.hp > 0 && u.team !== p.id && (u.kind === 'base' || u.kind === 'gate' && !w.gates.find(g => g.id === u.id)?.open) && distance(u, hero) < 18)) useSupport(w, p.id, 'siege');
    const ready = w.time >= RULES.ai.firstAttack && army.length >= RULES.ai.minAttackArmy;
    const gate = w.gates.find(g => g.site === p.id)!;
    if (gate.owner === p.id && threat && gate.open && !retreat) toggleGate(w, p.id, p.id);
    if (gate.owner === p.id && (ready && !threat || retreat) && !gate.open) toggleGate(w, p.id, p.id);
    if (p.tier >= 2 && p.gold > 1600) buildTower(w, p.id, p.id);
    for (const u of army) {
      if (!threat && u.garrison !== undefined) leaveTower(w, u);
      if (threat && (u.kind === 'archer' || u.kind === 'musketeer')) garrisonUnit(w, p.id, u.id, p.id);
    }
    for (const t of w.territories.filter(t => t.captured && t.owner === p.id)) {
      if (!t.buildings.goldmine) buildOutpost(w, t.site, 'goldmine', p.id);
      else if (!t.buildings.forest) buildOutpost(w, t.site, 'forest', p.id);
      else if (!t.buildings.quarry) buildOutpost(w, t.site, 'quarry', p.id);
      else if (!t.buildings.barracks && p.gold > 600) buildOutpost(w, t.site, 'barracks', p.id);
    }
    // Staging stays outside the neutral boss leash; automatic tracking does not
    // attack that boss without an explicit order.
    const rallyPoint = { x: p.id === 1 ? -32 : 32, z: p.id === 3 ? 32 : -32 };
    const goal = retreat ? { x: b.x * 0.9, z: b.z * 0.9 } : threat ? target : ready ? w.time < RULES.ai.baseAssault ? rallyPoint : target : undefined;
    p.aiState = retreat ? 'Recover' : threat ? 'Defend' : ready ? 'Attack' : 'Muster';
    if (!goal) continue;
    if (hero) { hero.order = retreat ? 'retreat' : 'advance'; hero.target = undefined; hero.goal = { x: goal.x, z: goal.z }; }
    const origin = hero ?? b, heading = Math.atan2(goal.x - origin.x, goal.z - origin.z);
    for (const u of army) if (isTroop(u.kind)) u.regiment = u.kind === 'knight' ? 2 : u.kind === 'footman' ? 0 : 1;
    for (const r of w.regiments.filter(r => r.team === p.id)) {
      r.formation = r.index === 2 ? 'wedge' : threat && r.index === 0 ? 'wall' : 'line';
      r.engagement = r.index === 2 ? 'charge' : threat ? 'defensive' : 'aggressive';
      r.priority = r.index === 2 ? 'ranged' : r.index === 1 && army.some(u => u.kind === 'musketeer') ? 'knight' : 'closest';
      const offset = retreat ? { x: 0, z: 0 } : r.index === 1 ? { x: -Math.sin(heading) * 8, z: -Math.cos(heading) * 8 } : r.index === 2 ? { x: Math.cos(heading) * 8, z: -Math.sin(heading) * 8 } : { x: 0, z: 0 };
      commandRegiment(w, p.id, r.index, retreat ? 'retreat' : 'advance', { x: goal.x + offset.x, z: goal.z + offset.z });
    }
  }
}
