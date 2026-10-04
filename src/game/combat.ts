import { STATS, MAP, TEAMS, RULES, FORMATIONS, DOCTRINE, ABILITIES, COHESION, BOSS } from './config';
import { distance, moveToward, clamp } from './math';
import type { World, Unit, Priority } from './types';
import { notify, spawn } from './world';
import { levelFloor, refreshStats } from './hero';
import { inSafeZone } from './objectives';
import { moveOnMap, walkable, projectWalkable } from './navigation';
import { abilityRank, equipmentBonuses } from './items';
export const matchesPriority = (u: Unit, priority: Priority) => priority === 'ranged' ? u.kind === 'archer' || u.kind === 'musketeer' : u.kind === priority;
export function clampBoss(boss: Unit) {
  const radius = MAP.boss.radius - STATS.boss.radius, d = distance(boss, MAP.boss);
  if (d > radius) { boss.x = MAP.boss.x + (boss.x - MAP.boss.x) / d * radius; boss.z = MAP.boss.z + (boss.z - MAP.boss.z) / d * radius; }
}
export function damageUnit(w: World, victim: Unit, attacker: Unit, amount: number) {
  if (victim.hp <= 0 || inSafeZone(victim) || inSafeZone(attacker) || w.invulnerable && victim.team === 0) return;
  const r = w.regiments.find(r => r.team === victim.team && r.index === victim.regiment);
  const frontal = r && Math.cos(Math.atan2(attacker.x - victim.x, attacker.z - victim.z) - r.facing) > 0.45;
  if (r && victim.kind !== 'hero' && victim.kind !== 'base' && frontal) {
    const reduction = victim.kind === 'footman' ? FORMATIONS[r.formation].frontalReduction : FORMATIONS[r.formation].frontalReduction * 0.25;
    amount *= 1 - reduction * r.cohesion / 100;
  }
  if (victim.kind === 'hero') amount *= 1 - equipmentBonuses(w.players[victim.team]).mitigation;
  const defender = w.players[victim.team], commander = w.units.find(u => u.team === victim.team && u.kind === 'hero' && u.hp > 0);
  if (defender && commander && defender.standfastUntil > w.time && distance(victim, commander) < ABILITIES.standfast.radius) amount *= 1 - (0.2 + abilityRank(defender, 'standfast') * 0.05);
  victim.hp -= amount;
  if (victim.kind === 'boss' && w.players[attacker.team]) w.players[attacker.team].xp += Math.min(amount, victim.hp + amount) * 0.025;
  if (victim.hp <= 0) kill(w, victim, attacker);
}
export function kill(w: World, victim: Unit, attacker: Unit) {
  victim.hp = 0;
  const p = w.players[attacker.team];
  if (p && attacker.team !== victim.team) { p.gold += STATS[victim.kind].cost * RULES.killBounty; p.xp += STATS[victim.kind].xp; }
  const regiment = w.regiments.find(r => r.team === victim.team && r.index === victim.regiment);
  if (regiment && victim.kind !== 'base' && victim.kind !== 'hero') regiment.cohesion = clamp(regiment.cohesion - COHESION.casualtyLoss, 0, 100);
  if (victim.kind === 'boss' && p) { p.gold += BOSS.gold; p.ore += BOSS.ore; notify(w, `${TEAMS[p.id].name} defeated the Iron Golem: +${BOSS.gold} gold, +${BOSS.ore} ore.`); }
  if (victim.kind === 'hero') {
    const owner = w.players[victim.team];
    owner.respawn = RULES.hero.respawn[owner.tier - 1];
    owner.level = Math.max(levelFloor(owner.tier), owner.level - RULES.hero.deathLevels); refreshStats(w, victim.team);
    owner.xp = 0; owner.rallyUntil = 0;
    for (const r of w.regiments.filter(r => r.team === victim.team)) r.cohesion = clamp(r.cohesion - COHESION.heroDeathLoss, 0, 100);
    notify(w, `${TEAMS[victim.team].name} commander fell. Respawning in ${owner.respawn}s.`);
  }
  if (victim.kind === 'base') {
    w.players[victim.team].eliminated = true;
    for (const u of w.units) if (u.team === victim.team) u.hp = 0;
    notify(w, `${TEAMS[victim.team].name} base destroyed.`);
    const survivors = w.players.filter(p => !p.eliminated);
    if (survivors.length === 1) w.winner = survivors[0].id;
    if (victim.team === 0) w.winner = survivors[0]?.id ?? -1;
  }
}
export function stepCombat(w: World, dt: number) {
  const living = w.units.filter(u => u.hp > 0);
  for (const u of living) {
    if (u.hp <= 0) continue;
    u.attackTimer = Math.max(0, u.attackTimer - dt);
    const r = u.kind !== 'hero' && u.kind !== 'base' && u.kind !== 'boss' ? w.regiments.find(r => r.team === u.team && r.index === u.regiment) : undefined;
    const hero = w.units.find(h => h.team === u.team && h.kind === 'hero');
    const rally = !!hero && w.players[u.team].rallyUntil > w.time && distance(hero, u) < ABILITIES.rally.radius;
    const targetValid = (t: Unit) => t.hp > 0 && t.team !== u.team && !inSafeZone(t) && (u.kind !== 'boss' || t.kind !== 'base' && distance(t, MAP.boss) <= MAP.boss.radius);
    if (u.kind === 'boss') { clampBoss(u); if (u.target && !living.some(t => t.id === u.target && targetValid(t))) u.target = undefined; }
    const explicit = !inSafeZone(u) ? living.find(t => t.id === u.target && targetValid(t)) : undefined;
    let enemy = explicit;
    if (!enemy && !inSafeZone(u) && u.order !== 'move' && u.order !== 'retreat' && (u.kind === 'boss' || u.kind === 'base' || w.players[u.team].autoTracking)) {
      const aggro = u.kind === 'base' ? u.range : u.kind === 'boss' ? 11 : u.order === 'hold' ? u.range + 1 : r ? DOCTRINE[r.engagement].aggro : 13;
      const priority = u.kind === 'hero' ? w.players[u.team].heroPriority : r?.priority ?? 'closest';
      const retained = living.find(t => t.id === u.autoTarget && targetValid(t) && distance(u, t) <= aggro * 1.7 && (!r || u.tactical || distance(t, r.anchor) <= DOCTRINE[r.engagement].leash + u.range));
      enemy = retained;
      let best = Infinity;
      for (const t of living) {
        if (!targetValid(t)) continue;
        // Neutral boss responds to nearby attackers; ordinary units need an explicit boss order.
        if (t.kind === 'boss' && u.kind !== 'base') continue;
        const d = distance(u, t) - STATS[t.kind].radius;
        if (d > aggro || r && distance(t, r.anchor) > DOCTRINE[r.engagement].leash + u.range && !u.tactical) continue;
        const preferred = matchesPriority(t, priority);
        const score = d - (preferred ? 30 : 0);
        if (score < best && (!retained || preferred && !matchesPriority(retained, priority))) { enemy = t; best = score; }
      }
      u.autoTarget = enemy?.id;
    }
    const d = enemy ? distance(u, enemy) - STATS[enemy.kind].radius : Infinity;
    const melee = u.kind === 'hero' && w.players[u.team].combatStyle === 'melee', attackRange = melee ? 2.5 : u.range;
    if (enemy && d <= attackRange) {
      u.facing = Math.atan2(enemy.x - u.x, enemy.z - u.z);
      if (u.attackTimer === 0) {
        const charge = u.kind === 'knight' && r?.engagement === 'charge' && u.travel > 8;
        const warcry = hero && w.players[u.team].warcryUntil > w.time && distance(hero, u) < ABILITIES.warcry.radius;
        const aura = hero && u.kind !== 'hero' && u.kind !== 'base' && distance(u, hero) < 18 ? 1 + w.players[u.team].training.command * 0.05 : 1;
        const damage = (u.kind === 'hero' && (melee || d < 2.5) ? u.meleeDamage : u.damage) * (charge ? r?.formation === 'wedge' ? 2.4 : 1.8 : 1) * (warcry ? 1.2 + abilityRank(w.players[u.team], 'warcry') * 0.1 : 1) * aura;
        damageUnit(w, enemy, u, damage);
        if (charge) {
          const defender = w.regiments.find(r => r.team === enemy!.team && r.index === enemy!.regiment);
          if (defender) defender.cohesion = clamp(defender.cohesion - COHESION.chargeLoss, 0, 100);
          w.effects.push({ x: enemy.x, z: enemy.z, radius: 3, life: 0.4, color: '#ffd676' });
        }
        u.travel = 0;
        u.attackTimer = u.cooldown / (rally ? ABILITIES.rally.attackSpeed + (w.players[u.team].skills.rally - 1) * 0.08 : 1);
        w.effects.push({ x: u.x, z: u.z, to: { x: enemy.x, z: enemy.z }, color: TEAMS[u.team]?.color ?? '#ffc872', life: 0.2, radius: 0.3 });
      }
    } else if (u.speed > 0) {
      const goal = u.kind === 'boss' ? enemy ?? MAP.boss : enemy && u.order !== 'hold' ? enemy : u.goal;
      u.facing = distance(u, goal) > 0.1 ? Math.atan2(goal.x - u.x, goal.z - u.z) : r?.facing ?? u.facing;
      let speed = u.speed * (r && !u.tactical ? FORMATIONS[r.formation].speed : 1) * (rally ? ABILITIES.rally.movement : 1) * (u.order === 'retreat' ? 1.15 : 1);
      if (u.kind === 'hero' && w.players[u.team].marchWithArmy && !inSafeZone(u)) {
        const escorts = w.units.filter(t => t.hp > 0 && t.team === u.team && t.kind !== 'hero' && t.kind !== 'base' && distance(t, u) < 22 && !t.tactical && w.regiments.some(group => group.team === u.team && group.index === t.regiment && group.movement === 'follow'));
        if (escorts.length) speed = Math.min(speed, Math.min(...escorts.map(t => t.speed * FORMATIONS[w.regiments.find(group => group.team === t.team && group.index === t.regiment)!.formation].speed)));
      }
      u.travel = Math.min(12, u.travel + Math.min(distance(u, goal), speed * dt));
      moveOnMap(u, goal, speed * dt);
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
    if (a.hp <= 0 || b.hp <= 0 || a.kind === 'base' || b.kind === 'base') continue;
    const d = distance(a, b), min = (STATS[a.kind].radius + STATS[b.kind].radius) * 0.8;
    if (d >= min) continue;
    const angle = d > 0.01 ? Math.atan2(b.z - a.z, b.x - a.x) : (a.id * 1.618) % (Math.PI * 2);
    const push = (min - d) * 0.3;
    a.x -= Math.cos(angle) * push; a.z -= Math.sin(angle) * push;
    b.x += Math.cos(angle) * push; b.z += Math.sin(angle) * push;
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
