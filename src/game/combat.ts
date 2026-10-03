import { STATS, MAP, TEAMS } from './config';
import { distance, moveToward, clamp } from './math';
import type { World, Unit } from './types';
import { notify, spawn } from './world';
export function kill(w: World, victim: Unit, attacker: Unit) {
  victim.hp = 0;
  const p = w.players[attacker.team];
  if (p && attacker.team !== victim.team) { p.gold += STATS[victim.kind].cost * 0.5; p.xp += STATS[victim.kind].xp; }
  if (victim.kind === 'hero') {
    w.players[victim.team].respawn = 12;
    notify(w, `${TEAMS[victim.team].name} commander fell. Respawning in 12s.`);
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
    const explicit = living.find(t => t.id === u.target && t.hp > 0 && t.team !== u.team);
    let enemy = explicit;
    if (!enemy && u.order !== 'move' && u.order !== 'retreat') {
      let best = u.kind === 'base' ? u.range : u.order === 'hold' ? u.range + 1 : 12;
      for (const t of living) {
        if (t.team === u.team || t.hp <= 0) continue;
        const d = distance(u, t) - STATS[t.kind].radius;
        if (d < best) { enemy = t; best = d; }
      }
    }
    const d = enemy ? distance(u, enemy) - STATS[enemy.kind].radius : Infinity;
    if (enemy && d <= u.range) {
      u.facing = Math.atan2(enemy.x - u.x, enemy.z - u.z);
      if (u.attackTimer === 0) {
        enemy.hp -= u.damage * (u.kind === 'hero' && d < 2.5 ? 1.5 : 1);
        u.attackTimer = u.cooldown;
        w.effects.push({ x: u.x, z: u.z, to: { x: enemy.x, z: enemy.z }, color: TEAMS[u.team]?.color ?? '#ffc872', life: 0.2, radius: 0.3 });
        if (enemy.hp <= 0) kill(w, enemy, u);
      }
    } else if (u.speed > 0) {
      const goal = enemy && u.order !== 'hold' ? enemy : u.goal;
      u.facing = Math.atan2(goal.x - u.x, goal.z - u.z);
      moveToward(u, goal, u.speed * dt);
      u.x = clamp(u.x, -MAP.half + 1, MAP.half - 1); u.z = clamp(u.z, -MAP.half + 1, MAP.half - 1);
    }
  }
  w.units = w.units.filter(u => u.hp > 0);
  for (const p of w.players) {
    if (p.eliminated) continue;
    if (p.respawn > 0) {
      p.respawn -= dt;
      if (p.respawn <= 0) spawn(w, p.id, 'hero', { x: MAP.bases[p.id].x * 0.82, z: MAP.bases[p.id].z * 0.82 });
    }
    while (p.xp >= p.level * 40 && p.level < 10) { p.xp -= p.level * 40; p.level++; }
  }
}
