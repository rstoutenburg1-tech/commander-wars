import { STATS, MAP, TEAMS, RULES, FORMATIONS, DOCTRINE, ABILITIES, COHESION, BOSS, GATES, isTroop } from './config';
import { distance, clamp } from './math';
import type { World, Unit, Priority } from './types';
import { notify, spawn } from './world';
import { refreshStats } from './hero';
import { inSafeZone } from './objectives';
import { walkable, projectWalkable } from './navigation';
import { abilityRank, equipmentBonuses } from './items';
import { blockingGate, moveWithGates, leaveTower } from './gates';
import { captureTerritory } from './outposts';
export const matchesPriority = (u: Unit, priority: Priority) => priority === 'ranged' ? u.kind === 'archer' || u.kind === 'musketeer' : u.kind === priority;
export function ordinaryAttackModifier(w: World, attacker: Unit, victim: Unit, meleeAttack = false) {
  if (victim.kind === 'base' || victim.kind === 'gate') {
    if (attacker.kind === 'archer' || attacker.kind === 'musketeer') {
      return w.players[attacker.team]?.siegeUntil > w.time ? 1.5 : attacker.kind === 'archer' ? 0.55 : 0.8;
    }
    return attacker.kind === 'hero' && !meleeAttack ? 0.75 : 1;
  }
  if (attacker.kind === 'footman' && victim.kind === 'knight') return 1.4;
  if (attacker.kind === 'archer') return victim.kind === 'footman' ? 1.3 : victim.kind === 'knight' ? 0.75 : 1;
  if (attacker.kind === 'musketeer') return victim.kind === 'knight' ? 1.35 : victim.kind === 'hero' ? 1.15 : victim.kind === 'footman' ? 0.85 : 1;
  if (attacker.kind === 'knight' && (victim.kind === 'archer' || victim.kind === 'musketeer')) return 1.35;
  return 1;
}
export function bracedAgainst(w: World, victim: Unit, attacker: Unit) {
  const r = w.regiments.find(r => r.team === victim.team && r.index === victim.regiment);
  return victim.kind === 'footman' && victim.garrison === undefined && r?.formation === 'wall' && r.cohesion >= 50 &&
    Math.cos(Math.atan2(attacker.x - victim.x, attacker.z - victim.z) - r.facing) > 0.45;
}
export function clampBoss(boss: Unit) {
  const radius = MAP.boss.radius - STATS.boss.radius, d = distance(boss, MAP.boss);
  if (d > radius) { boss.x = MAP.boss.x + (boss.x - MAP.boss.x) / d * radius; boss.z = MAP.boss.z + (boss.z - MAP.boss.z) / d * radius; }
}
export function damageUnit(w: World, victim: Unit, attacker: Unit, amount: number) {
  if (victim.hp <= 0 || inSafeZone(victim) || inSafeZone(attacker) || w.invulnerable && victim.team === 0) return;
  if (blockingGate(w, attacker, victim, [attacker.garrison ?? -1, victim.garrison ?? -1, victim.kind === 'gate' ? victim.id : -1])) return;
  const r = w.regiments.find(r => r.team === victim.team && r.index === victim.regiment);
  const frontal = r && Math.cos(Math.atan2(attacker.x - victim.x, attacker.z - victim.z) - r.facing) > 0.45;
  if (r && isTroop(victim.kind) && victim.garrison === undefined && frontal) {
    const reduction = victim.kind === 'footman' ? FORMATIONS[r.formation].frontalReduction : FORMATIONS[r.formation].frontalReduction * 0.25;
    amount *= 1 - reduction * r.cohesion / 100;
  }
  if (victim.kind === 'hero') amount *= 1 - equipmentBonuses(w.players[victim.team]).mitigation;
  if (victim.garrison !== undefined) amount *= 1 - GATES.mitigation;
  const defender = w.players[victim.team], commander = w.units.find(u => u.team === victim.team && u.kind === 'hero' && u.hp > 0);
  if (defender && commander && defender.standfastUntil > w.time && distance(victim, commander) < ABILITIES.standfast.radius) amount *= 1 - (0.2 + abilityRank(defender, 'standfast') * 0.05);
  victim.hp -= amount;
  if (victim.kind === 'boss' && w.players[attacker.team]) w.players[attacker.team].xp += Math.min(amount, victim.hp + amount) * 0.025;
  if (victim.hp <= 0) kill(w, victim, attacker);
}
export function kill(w: World, victim: Unit, attacker: Unit) {
  victim.hp = 0;
  leaveTower(w, victim);
  const p = w.players[attacker.team];
  if (p && attacker.team !== victim.team) { p.gold += STATS[victim.kind].cost * RULES.killBounty; p.xp += STATS[victim.kind].xp; }
  const regiment = w.regiments.find(r => r.team === victim.team && r.index === victim.regiment);
  if (regiment && isTroop(victim.kind)) regiment.cohesion = clamp(regiment.cohesion - COHESION.casualtyLoss, 0, 100);
  if (victim.kind === 'gate') {
    const gate = w.gates.find(g => g.id === victim.id);
    if (gate) { gate.open = true; gate.tower = false; gate.towerRemaining = 0; for (const id of [...gate.garrison]) { const u = w.units.find(u => u.id === id); if (u) leaveTower(w, u); } }
    notify(w, `${TEAMS[victim.team].name} gate breached.`);
  }
  if (victim.kind === 'boss' && p) { p.gold += BOSS.gold; p.ore += BOSS.ore; notify(w, `${TEAMS[p.id].name} defeated the Iron Golem: +${BOSS.gold} gold, +${BOSS.ore} ore.`); }
  if (victim.kind === 'hero') {
    const owner = w.players[victim.team];
    owner.respawn = RULES.hero.respawn[owner.tier - 1];
    owner.level = Math.max(1, owner.level - RULES.hero.deathLevels); refreshStats(w, victim.team);
    owner.xp = 0; owner.rallyUntil = 0;
    for (const r of w.regiments.filter(r => r.team === victim.team)) r.cohesion = clamp(r.cohesion - COHESION.heroDeathLoss, 0, 100);
    notify(w, `${TEAMS[victim.team].name} commander fell. Respawning in ${owner.respawn}s.`);
  }
  if (victim.kind === 'base') {
    w.players[victim.team].eliminated = true;
    for (const u of w.units) if (u.team === victim.team) u.hp = 0;
    notify(w, `${TEAMS[victim.team].name} base destroyed.`);
    if (p) captureTerritory(w, victim.team, p.id);
    const survivors = w.players.filter(p => !p.eliminated);
    if (survivors.length === 1) w.winner = survivors[0].id;
    if (victim.team === 0) w.winner = survivors[0]?.id ?? -1;
  }
}
export function stepCombat(w: World, dt: number) {
  const living = w.units.filter(u => u.hp > 0);
  for (const u of living) {
    if (u.hp <= 0 || u.kind === 'gate') continue;
    u.attackTimer = Math.max(0, u.attackTimer - dt);
    if (u.order === 'move' && distance(u, u.goal) < 0.75) u.order = 'advance';
    const r = isTroop(u.kind) ? w.regiments.find(r => r.team === u.team && r.index === u.regiment) : undefined;
    // Attack-moving reinforcements can engage locally while traveling. Once in
    // place, the destination slot defines their defended area.
    const withinLeash = (t: Unit) => !r || u.tactical || distance(u, u.goal) > COHESION.separationDistance && u.order !== 'hold' || distance(t, u.goal) <= DOCTRINE[r.engagement].leash + u.range;
    const hero = w.units.find(h => h.team === u.team && h.kind === 'hero');
    const rally = !!hero && w.players[u.team].rallyUntil > w.time && distance(hero, u) < ABILITIES.rally.radius;
    const groundMelee = u.garrison === undefined && (u.kind === 'hero' ? w.players[u.team].combatStyle === 'melee' : u.range < 3);
    const targetValid = (t: Unit) => t.hp > 0 && t.team !== u.team && !inSafeZone(t) && !(groundMelee && t.garrison !== undefined) && (u.kind !== 'boss' || t.kind !== 'base' && t.kind !== 'gate' && distance(t, MAP.boss) <= MAP.boss.radius);
    if (u.kind === 'boss') { clampBoss(u); if (u.target && !living.some(t => t.id === u.target && targetValid(t))) u.target = undefined; }
    const explicit = !inSafeZone(u) ? living.find(t => t.id === u.target && targetValid(t)) : undefined;
    let enemy = explicit;
    if (!enemy && !inSafeZone(u) && u.order !== 'move' && u.order !== 'retreat' && (u.kind === 'boss' || u.kind === 'base' || w.players[u.team].autoTracking)) {
      const aggro = u.garrison !== undefined ? u.range + GATES.rangeBonus + 1 : u.kind === 'base' ? u.range : u.kind === 'boss' ? 11 : u.order === 'hold' ? u.range + 1 : r ? DOCTRINE[r.engagement].aggro : 13;
      const priority = u.kind === 'hero' ? w.players[u.team].heroPriority : r?.priority ?? 'closest';
      const retained = living.find(t => t.id === u.autoTarget && targetValid(t) && !(t.kind === 'gate' && w.gates.find(g => g.id === t.id)?.open) && !blockingGate(w, u, t, [u.garrison ?? -1, t.garrison ?? -1, t.kind === 'gate' ? t.id : -1]) && distance(u, t) <= aggro * 1.7 && withinLeash(t));
      enemy = retained;
      let best = Infinity;
      for (const t of living) {
        if (!targetValid(t)) continue;
        if (t.kind === 'gate' && w.gates.find(g => g.id === t.id)?.open || blockingGate(w, u, t, [u.garrison ?? -1, t.garrison ?? -1, t.kind === 'gate' ? t.id : -1])) continue;
        // Neutral boss responds to nearby attackers; ordinary units need an explicit boss order.
        if (t.kind === 'boss' && u.kind !== 'base') continue;
        const d = distance(u, t) - STATS[t.kind].radius;
        if (d > aggro || !withinLeash(t)) continue;
        const preferred = matchesPriority(t, priority);
        const score = d - (preferred ? 30 : 0);
        if (score < best && (!retained || preferred && !matchesPriority(retained, priority))) { enemy = t; best = score; }
      }
      u.autoTarget = enemy?.id;
    }
    const barrier = blockingGate(w, u, enemy ?? u.goal, [u.garrison ?? -1, enemy?.garrison ?? -1, enemy?.kind === 'gate' ? enemy.id : -1]);
    if (barrier && enemy) enemy = barrier.team !== u.team ? barrier : undefined;
    else if (barrier && barrier.team !== u.team && u.order !== 'move' && u.order !== 'retreat' && u.order !== 'hold' && w.players[u.team]?.autoTracking) { enemy = barrier; u.autoTarget = barrier.id; }
    const d = enemy ? distance(u, enemy) - STATS[enemy.kind].radius : Infinity;
    const melee = u.kind === 'hero' && u.garrison === undefined && w.players[u.team].combatStyle === 'melee', attackRange = melee ? 2.5 : u.range + (u.garrison !== undefined ? GATES.rangeBonus : 0);
    if (enemy && d <= attackRange) {
      u.facing = Math.atan2(enemy.x - u.x, enemy.z - u.z);
      if (u.attackTimer === 0) {
        const charge = u.kind === 'knight' && r?.engagement === 'charge' && u.travel > 8 && !bracedAgainst(w, enemy, u);
        const warcry = hero && w.players[u.team].warcryUntil > w.time && distance(hero, u) < ABILITIES.warcry.radius;
        const aura = hero && isTroop(u.kind) && distance(u, hero) < 18 ? 1 + w.players[u.team].training.command * 0.05 : 1;
        const meleeAttack = u.kind === 'boss' || u.kind === 'footman' || u.kind === 'knight' || u.kind === 'hero' && u.garrison === undefined && (melee || d < 2.5);
        const damage = (u.kind === 'hero' && u.garrison === undefined && (melee || d < 2.5) ? u.meleeDamage : u.damage) * ordinaryAttackModifier(w, u, enemy, meleeAttack) * (charge ? r?.formation === 'wedge' ? 2.4 : 1.8 : 1) * (warcry ? 1.2 + abilityRank(w.players[u.team], 'warcry') * 0.1 : 1) * aura * (u.garrison !== undefined ? GATES.damageBonus : 1);
        damageUnit(w, enemy, u, damage);
        if (charge) {
          const defender = w.regiments.find(r => r.team === enemy!.team && r.index === enemy!.regiment);
          if (defender) defender.cohesion = clamp(defender.cohesion - COHESION.chargeLoss, 0, 100);
          w.effects.push({ x: enemy.x, z: enemy.z, radius: 3, life: 0.5, duration: 0.5, color: '#ffd676', kind: 'charge', source: u.id, target: enemy.id });
        }
        u.travel = 0;
        u.attackTimer = u.cooldown / (rally ? ABILITIES.rally.attackSpeed + (w.players[u.team].skills.rally - 1) * 0.08 : 1);
        const kind = meleeAttack ? 'melee' : u.kind === 'musketeer' ? 'shot' : 'arrow';
        const duration = kind === 'arrow' ? 0.5 : 0.3;
        w.effects.push({ x: u.x, z: u.z, to: { x: enemy.x, z: enemy.z }, color: TEAMS[u.team]?.color ?? '#ffc872', life: duration, duration, radius: 0.3, kind, source: u.id, target: enemy.id,
          height: u.garrison !== undefined ? 6.5 : 0, toHeight: enemy.garrison !== undefined ? 6.5 : 0 });
      }
    } else if (u.speed > 0 && u.garrison === undefined) {
      const goal = u.kind === 'boss' ? enemy ?? MAP.boss : enemy && u.order !== 'hold' ? enemy : u.goal;
      u.facing = distance(u, goal) > 0.1 ? Math.atan2(goal.x - u.x, goal.z - u.z) : r?.facing ?? u.facing;
      let speed = u.speed * (r && !u.tactical ? FORMATIONS[r.formation].speed : 1) * (rally ? ABILITIES.rally.movement : 1) * (u.order === 'retreat' ? 1.15 : 1);
      if (u.kind === 'hero' && w.players[u.team].marchWithArmy && !inSafeZone(u)) {
        const escorts = w.units.filter(t => t.hp > 0 && t.team === u.team && isTroop(t.kind) && t.garrison === undefined && distance(t, u) < 22 && !t.tactical && w.regiments.some(group => group.team === u.team && group.index === t.regiment && group.movement === 'follow'));
        if (escorts.length) speed = Math.min(speed, Math.min(...escorts.map(t => t.speed * FORMATIONS[w.regiments.find(group => group.team === t.team && group.index === t.regiment)!.formation].speed)));
      }
      u.travel = Math.min(12, u.travel + Math.min(distance(u, goal), speed * dt));
      moveWithGates(w, u, goal, speed * dt);
      if (u.kind !== 'hero' && distance(u, MAP.merchant) < MAP.merchant.radius + STATS[u.kind].radius) {
        const angle = Math.atan2(u.z - MAP.merchant.z, u.x - MAP.merchant.x);
        u.x = MAP.merchant.x + Math.cos(angle) * (MAP.merchant.radius + STATS[u.kind].radius);
        u.z = MAP.merchant.z + Math.sin(angle) * (MAP.merchant.radius + STATS[u.kind].radius);
      }
      u.x = clamp(u.x, -MAP.half + 1, MAP.half - 1); u.z = clamp(u.z, -MAP.half + 1, MAP.half - 1);
    }
  }
  for (const u of living) if (u.hp > 0 && !walkable(u)) Object.assign(u, projectWalkable(u));
  // Small local separation keeps units readable while allowing loose formation slots.
  for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
    const a = living[i], b = living[j];
    if (a.hp <= 0 || b.hp <= 0 || a.kind === 'base' || b.kind === 'base' || a.kind === 'gate' || b.kind === 'gate' || a.garrison !== undefined || b.garrison !== undefined) continue;
    const d = distance(a, b), min = (STATS[a.kind].radius + STATS[b.kind].radius) * 0.8;
    if (d >= min) continue;
    const angle = d > 0.01 ? Math.atan2(b.z - a.z, b.x - a.x) : (a.id * 1.618) % (Math.PI * 2);
    const push = (min - d) * 0.3;
    const beforeA = { x: a.x, z: a.z }, beforeB = { x: b.x, z: b.z };
    a.x -= Math.cos(angle) * push; a.z -= Math.sin(angle) * push;
    b.x += Math.cos(angle) * push; b.z += Math.sin(angle) * push;
    if (!walkable(a)) Object.assign(a, projectWalkable(a)); if (!walkable(b)) Object.assign(b, projectWalkable(b));
    if (blockingGate(w, beforeA, a)) Object.assign(a, beforeA); if (blockingGate(w, beforeB, b)) Object.assign(b, beforeB);
  }
  w.units = w.units.filter(u => u.hp > 0);
  for (const boss of w.units.filter(u => u.kind === 'boss')) clampBoss(boss);
  for (const p of w.players) {
    if (p.eliminated) continue;
    if (p.respawn > 0) {
      p.respawn -= dt;
      if (p.respawn <= 0) spawn(w, p.id, 'hero', { x: MAP.bases[p.id].x * 0.92, z: MAP.bases[p.id].z * 0.92 });
    }
  }
}
