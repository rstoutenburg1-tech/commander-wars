import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world.ts';
import { step } from '../src/game/simulation.ts';
import { stepEconomy, startUpgrade } from '../src/game/economy.ts';
import { kill, damageUnit, stepCombat } from '../src/game/combat.ts';
import { progressHero, levelFloor } from '../src/game/hero.ts';
import { command, commandRegiment } from '../src/game/commands.ts';
import { formationSlot, stepRegiments } from '../src/game/formations.ts';
import { cast } from '../src/game/abilities.ts';
import { merchant, startCraft, stepObjectives, inSafeZone } from '../src/game/objectives.ts';
import { MAP } from '../src/game/config.ts';

test('automatic spawning pays for each unit, respects reserve, never creates debt', () => {
  const w = createWorld(), p = w.players[0];
  p.gold = 60; p.production.reserve = 50; p.production.timer = 0; stepEconomy(w, 0.05);
  assert.equal(w.units.filter(u => u.team === 0 && u.kind === 'footman').length, 8); assert.ok(p.gold >= 50);
  p.gold = 90; p.production.timer = 0; stepEconomy(w, 0.05);
  assert.equal(w.units.filter(u => u.team === 0 && u.kind === 'footman').length, 10); assert.ok(p.gold >= 50);
});
test('upgrades charge once, remain at previous level until timer expires', () => {
  const w = createWorld(), p = w.players[0]; const before = p.gold;
  assert.equal(startUpgrade(w, 0, 'forest'), true); assert.equal(p.gold, before - 75);
  assert.equal(startUpgrade(w, 0, 'forest'), false);
  stepEconomy(w, 14); assert.equal(p.forest, 0); stepEconomy(w, 1.1); assert.equal(p.forest, 1);
});
test('roster changes affect only future units and require barracks unlock', () => {
  const w = createWorld(), p = w.players[0];
  p.production.counts = { footman: 0, archer: 2, musketeer: 0, knight: 0 };
  p.production.timer = 0; stepEconomy(w, 0.05); assert.equal(w.units.some(u => u.team === 0 && u.kind === 'archer'), false);
  p.tier = 2; p.barracks = 2; p.production.timer = 0; stepEconomy(w, 0.05);
  assert.equal(w.units.filter(u => u.team === 0 && u.kind === 'archer').length, 2);
  assert.equal(w.units.filter(u => u.team === 0 && u.kind === 'footman').length, 8);
});
test('XP banks at cap and commander death respects tier minimum', () => {
  const w = createWorld(), p = w.players[0]; p.level = 10; p.xp = 5000; progressHero(w, 0.05);
  assert.equal(p.level, 10); assert.equal(p.bankedXP, 5000);
  p.crafting = 1; p.gold = 1000; p.wood = 200; p.ore = 200;
  assert.equal(startUpgrade(w, 0, 'base'), true); stepEconomy(w, 30.1);
  progressHero(w, 0.05); assert.ok(p.level > 11); p.level = 11;
  const hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!, enemy = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  kill(w, hero, enemy); assert.equal(p.level, levelFloor(2)); assert.equal(p.respawn, 22);
});
test('base destruction eliminates army and produces victory', () => {
  const w = createWorld(), hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  for (const team of [1, 2, 3]) kill(w, w.units.find(u => u.team === team && u.kind === 'base')!, hero);
  assert.equal(w.winner, 0); assert.equal(w.units.some(u => u.team > 0 && u.team < 4 && u.hp > 0), false);
});
test('three AIs progress and fight during a five-minute simulation', () => {
  const w = createWorld(); w.invulnerable = true;
  for (let i = 0; i < 6000 && w.winner === null; i++) step(w, 0.05);
  assert.ok(w.players.slice(1).some(p => p.tier >= 2)); assert.ok(w.players.slice(1).some(p => p.level > 1 || p.eliminated));
  for (const p of w.players) assert.ok(p.gold >= 0 && p.wood >= 0 && p.ore >= 0);
  assert.ok(w.units.length <= 4 * 42 + 1); assert.ok(w.units.every(u => Number.isFinite(u.hp) && Number.isFinite(u.x)));
});

test('shield wall protection depends on frontage and cohesion', () => {
  const w = createWorld(), victim = w.units.find(u => u.team === 0 && u.kind === 'footman')!, attacker = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  victim.x = 0; victim.z = 0; attacker.x = 0; attacker.z = 5;
  const r = w.regiments[0]; r.formation = 'wall'; r.facing = 0; r.cohesion = 100;
  const hp = victim.hp; damageUnit(w, victim, attacker, 20); assert.ok(Math.abs(hp - victim.hp - 10.4) < 0.001);
  attacker.z = -5; const backHp = victim.hp; damageUnit(w, victim, attacker, 20); assert.equal(backHp - victim.hp, 20);
  attacker.z = 5; r.cohesion = 0; const brokenHp = victim.hp; damageUnit(w, victim, attacker, 20); assert.equal(brokenHp - victim.hp, 20);
});
test('regiment movement follows hero while individual orders remain independent', () => {
  const w = createWorld(), hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  hero.x = 0; hero.z = 0; hero.facing = 0;
  commandRegiment(w, 0, 0, 'follow'); stepRegiments(w, 20);
  assert.ok(Math.abs(w.regiments[0].anchor.z + 5) < 0.1);
  const troop = w.units.find(u => u.team === 0 && u.kind === 'footman')!;
  command(w, new Set([troop.id]), 'move', { x: 20, z: 20 }); stepRegiments(w, 0.1);
  assert.equal(troop.tactical, true); assert.equal(troop.goal.x, 20);
  assert.notDeepEqual(formationSlot('line', 5, 8, 0), formationSlot('wedge', 5, 8, 0));
});
test('ranged target priority changes which in-range enemy is attacked', () => {
  const w = createWorld(), friendly = w.units.find(u => u.team === 0 && u.kind === 'footman')!, enemyHero = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  const archer = spawn(w, 1, 'archer', { x: 2, z: 0 });
  w.units = [friendly, enemyHero, archer]; friendly.x = 0; friendly.z = 0; friendly.order = 'advance';
  enemyHero.x = 1; enemyHero.z = 0; enemyHero.attackTimer = 10; archer.attackTimer = 10;
  w.regiments[0].anchor = { x: 0, z: 0 }; w.regiments[0].priority = 'ranged';
  const before = archer.hp; stepCombat(w, 0.05); assert.ok(archer.hp < before);
});
test('mana and cooldowns gate abilities, Rally restores cohesion', () => {
  const w = createWorld(), p = w.players[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  w.regiments[0].anchor = { x: hero.x, z: hero.z }; w.regiments[0].cohesion = 30;
  assert.equal(cast(w, 0, 'rally'), true); assert.equal(p.mana, 75); assert.equal(w.regiments[0].cohesion, 60);
  assert.equal(cast(w, 0, 'rally'), false);
  hero.hp = 100; assert.equal(cast(w, 0, 'wind'), true); assert.ok(hero.hp > 100); assert.equal(p.mana, 35);
});
test('merchant blocks combat, allows trade, and heroes can leave the safe zone', () => {
  const w = createWorld(), hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!, enemy = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  hero.x = MAP.merchant.x; hero.z = MAP.merchant.z; hero.goal = { x: 0, z: 0 }; hero.order = 'move';
  hero.hp = 300; enemy.x = 2; enemy.z = MAP.merchant.z;
  damageUnit(w, hero, enemy, 100); assert.equal(hero.hp, 300);
  const gold = w.players[0].gold; assert.equal(merchant(w, 'buy'), true); assert.equal(w.players[0].gold, gold - 90);
  stepCombat(w, 1); assert.equal(inSafeZone(hero), false);
});
test('crafting requires workshop, charges once, equips after five seconds', () => {
  const w = createWorld(), p = w.players[0]; p.wood = 100; p.ore = 100;
  assert.equal(startCraft(w, 0, 'sword'), false); p.crafting = 1;
  assert.equal(startCraft(w, 0, 'sword'), true); assert.equal(startCraft(w, 0, 'armor'), false);
  stepObjectives(w, 4); assert.equal(p.items.sword, false); stepObjectives(w, 1.1); assert.equal(p.items.sword, true);
  assert.ok(w.units.find(u => u.team === 0 && u.kind === 'hero')!.damage > 38);
});
test('commander respawns with equipment and death penalty remains after next tick', () => {
  const w = createWorld(), p = w.players[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!, enemy = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  p.level = 8; p.xp = 300; p.items.sword = true; p.production.interval = 0; w.aiEnabled = false;
  kill(w, hero, enemy); progressHero(w, 0.05); assert.equal(p.level, 6);
  for (let i = 0; i < 250; i++) step(w, 0.05);
  const respawn = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  assert.ok(respawn); assert.notEqual(respawn.id, hero.id); assert.ok(respawn.damage > 38);
});
test('boss is present, uses damaging AOE and grants a substantial kill reward', () => {
  const w = createWorld(), boss = w.units.find(u => u.kind === 'boss')!, hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  hero.x = boss.x + 4; hero.z = boss.z; const before = hero.hp; stepObjectives(w, 6.1); assert.ok(hero.hp < before);
  const gold = w.players[0].gold; damageUnit(w, boss, hero, 10000); assert.equal(boss.hp <= 0, true); assert.equal(w.players[0].gold, gold + 650);
});
