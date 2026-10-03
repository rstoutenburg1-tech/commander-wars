import { MAP, RULES } from './config';
import type { World } from './types';
import { distance } from './math';
import { startUpgrade } from './economy';
import { cast } from './abilities';
import { commandRegiment } from './commands';
import { trainSkill } from './skills';
export function stepAI(w: World, dt: number) {
  if (!w.aiEnabled) return;
  for (const p of w.players.slice(1)) {
    if (p.eliminated || (p.aiTimer -= dt) > 0) continue;
    p.aiTimer = RULES.ai.thinkInterval;
    for (const id of ['rally', 'wind', 'discipline', 'resilience', 'cleave', 'inspiration', 'martial', 'ultimate'] as const) trainSkill(w, p.id, id);
    const hero = w.units.find(u => u.team === p.id && u.kind === 'hero');
    const army = w.units.filter(u => u.team === p.id && u.kind !== 'base');
    if (!p.forest) startUpgrade(w, p.id, 'forest');
    if (!p.quarry) startUpgrade(w, p.id, 'quarry');
    if (!p.crafting) startUpgrade(w, p.id, 'crafting');
    p.production.interval = p.gold < 120 || p.upgrades.some(j => j.building === 'base') ? 30 : RULES.spawnInterval;
    p.production.reserve = 90;
    if (p.barracks < p.tier) startUpgrade(w, p.id, 'barracks');
    else if (p.tier < 4 && w.time > p.tier * 120) startUpgrade(w, p.id, 'base');
    if (p.tier >= 2 && p.goldmine < p.tier) startUpgrade(w, p.id, 'goldmine');
    if (p.barracks === 2) p.production.counts = { footman: 2, archer: 1, musketeer: 1, knight: 0 };
    if (p.barracks >= 3) p.production.counts = { footman: 1, archer: 1, musketeer: 1, knight: 1 };
    const b = MAP.bases[p.id];
    const threat = w.units.find(u => u.team !== p.id && u.team < 4 && u.kind !== 'base' && distance(u, b) < RULES.ai.defendRadius);
    const bases = w.units.filter(u => u.kind === 'base' && u.team !== p.id);
    bases.sort((a, c) => distance(a, hero ?? b) - distance(c, hero ?? b));
    // Stable team tie-break prevents all three AIs opening on the human.
    const target = threat ?? bases.find(base => base.team === (p.id + 1) % 4) ?? bases[0];
    const retreat = hero && hero.hp < hero.maxHp * RULES.ai.retreatHp;
    if (hero && hero.hp < hero.maxHp * 0.7) cast(w, p.id, 'wind');
    if (hero && w.units.some(u => u.team !== p.id && u.kind !== 'base' && distance(u, hero) < 12)) cast(w, p.id, 'rally');
    const ready = w.time >= RULES.ai.firstAttack && army.length >= RULES.ai.minAttackArmy;
    const rallyPoint = { x: p.id === 1 ? -10 : 0, z: p.id === 3 ? 10 : -4 };
    const goal = retreat ? { x: b.x * 0.9, z: b.z * 0.9 } : threat ? target : ready ? w.time < RULES.ai.baseAssault ? rallyPoint : target : undefined;
    p.aiState = retreat ? 'Recover' : threat ? 'Defend' : ready ? 'Attack' : 'Muster';
    if (!goal) continue;
    if (hero) { hero.order = retreat ? 'retreat' : 'advance'; hero.target = undefined; hero.goal = { x: goal.x, z: goal.z }; }
    for (const r of w.regiments.filter(r => r.team === p.id)) {
      r.formation = p.barracks >= 3 ? 'wedge' : threat ? 'wall' : 'line'; r.engagement = p.barracks >= 3 ? 'charge' : 'aggressive';
      commandRegiment(w, p.id, r.index, retreat ? 'retreat' : 'advance', goal);
    }
  }
}
