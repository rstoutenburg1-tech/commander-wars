import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/game/world';
import { ITEMS, MAP, STATS } from '../src/game/config';
import { equipItem, grantItem, unequipItem, buyItem, buyConsumable, sellItem, maxMana, startCraft, trainHero, abilityRank } from '../src/game/items';
import { stepObjectives } from '../src/game/objectives';
import { cast } from '../src/game/abilities';
import { damageUnit, stepCombat } from '../src/game/combat';
import { learnedAbilities } from '../src/game/hotkeys';
import { spawn } from '../src/game/world';
import { gatherArmy, stepRegiments } from '../src/game/formations';
import { command } from '../src/game/commands';
import { trainSkill, skillPoints, grantLevelPoints } from '../src/game/skills';
test('equipment slots apply real bonuses, replace gear without stacking, and unequip cleanly', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  const base = h.meleeDamage; grantItem(w, 0, 'sword'); assert.equal(h.meleeDamage, base + 40);
  grantItem(w, 0, 'kingsblade'); assert.equal(h.meleeDamage, base + 40); equipItem(w, 0, 'kingsblade'); assert.equal(h.meleeDamage, base + 240);
  assert.equal(p.items.sword, true); unequipItem(w, 0, 'melee'); assert.equal(h.meleeDamage, base);
  grantItem(w, 0, 'dragonbow'); assert.equal(h.damage, STATS.hero.damage + 130); assert.equal(h.range, STATS.hero.range + 7);
  grantItem(w, 0, 'archmage'); assert.equal(maxMana(p), 260);
  grantItem(w, 0, 'bulwark'); const hp = h.hp; damageUnit(w, h, w.units.find(u => u.team === 1 && u.kind === 'hero')!, 100); assert.ok(Math.abs(h.hp - hp + 60) < 0.01);
});
test('workshop recipes enforce tiers, costs and completion, and hero training is paid', () => {
  const w = createWorld(), p = w.players[0]; p.gold = 3000; p.wood = 1000; p.ore = 1000; p.crafting = 1;
  assert.equal(startCraft(w, 0, 'captainblade'), false); p.crafting = 2;
  assert.equal(startCraft(w, 0, 'captainblade'), true); assert.equal(p.gold, 3000 - ITEMS.captainblade.cost.gold);
  assert.equal(startCraft(w, 0, 'bow'), false); stepObjectives(w, 18.1); assert.equal(p.equipment.melee, 'captainblade');
  const h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, before = h.meleeDamage;
  assert.equal(trainHero(w, 'warfare'), true); assert.equal(h.meleeDamage, before + 15); assert.equal(trainHero(w, 'warfare'), false);
});
test('merchant enforces proximity and price, trades relics, and unlocks castable tome abilities', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!; p.gold = 10000;
  assert.equal(buyItem(w, 'dragonbow'), false); Object.assign(h, MAP.merchant);
  assert.equal(buyItem(w, 'dragonbow'), true); assert.equal(p.gold, 10000 - ITEMS.dragonbow.buy); assert.equal(buyItem(w, 'dragonbow'), false);
  assert.equal(sellItem(w, 'dragonbow'), true); assert.equal(p.equipment.ranged, undefined); assert.equal(p.items.dragonbow, false);
  assert.equal(buyConsumable(w, 'warcry'), true); assert.ok(learnedAbilities(p).includes('warcry')); assert.equal(cast(w, 0, 'warcry'), true); assert.equal(buyConsumable(w, 'warcry'), false);
  p.gold = 1; assert.equal(buyItem(w, 'kingsblade'), false);
});
test('tome abilities can be improved without consuming a normal slot or paying for the granted rank twice', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  Object.assign(h, MAP.merchant); p.gold = 10000; assert.equal(buyConsumable(w, 'warcry'), true);
  p.tier = 2; p.level = 18; grantLevelPoints(p); p.abilityOrder = ['rally', 'wind', 'cleave']; p.skills.rally = p.skills.wind = p.skills.cleave = 1; p.skills.martial = 2;
  const points = skillPoints(p); assert.equal(trainSkill(w, 0, 'warcry'), true); assert.equal(abilityRank(p, 'warcry'), 2); assert.equal(skillPoints(p), points - 1); assert.equal(p.abilityOrder.length, 3);
  assert.equal(trainSkill(w, 0, 'warcry'), true); assert.equal(abilityRank(p, 'warcry'), 3); assert.equal(trainSkill(w, 0, 'warcry'), false);
});
test('hero close attacks deal three times basic ranged damage', () => {
  const dealt = (x: number, style: 'melee' | 'ranged') => {
    const w = createWorld(), h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, enemy = w.units.find(u => u.team === 1 && u.kind === 'footman')!;
    w.units = [h, enemy]; h.x = 0; h.z = 0; enemy.x = x; enemy.z = 0; h.target = enemy.id; h.order = 'attack'; w.players[0].combatStyle = style;
    const hp = enemy.hp; stepCombat(w, 0.05); return hp - enemy.hp;
  };
  assert.equal(dealt(1.8, 'melee'), 135); assert.equal(dealt(5, 'ranged'), 45);
});
test('tracking retains moving targets, obeys type priorities and explicit orders, and reacquires after death', () => {
  const w = createWorld(), h = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  Object.assign(h, { x: 0, z: 0, order: 'advance', goal: { x: 25, z: 0 } }); w.players[0].marchWithArmy = false;
  const a = spawn(w, 1, 'footman', { x: 6, z: 0 }), b = spawn(w, 1, 'archer', { x: 7, z: 0 }); w.units = [h, a, b]; a.attackTimer = b.attackTimer = 100;
  stepCombat(w, 0.05); assert.equal(h.autoTarget, a.id);
  a.x = 10; b.x = 3; stepCombat(w, 0.05); assert.equal(h.autoTarget, a.id);
  w.players[0].heroPriority = 'archer'; stepCombat(w, 0.05); assert.equal(h.autoTarget, b.id);
  command(w, new Set([h.id]), 'attack', a, a.id); const x = h.x; stepCombat(w, 0.05); assert.equal(h.target, a.id); assert.ok(h.x > x);
  command(w, new Set([h.id]), 'move', { x: -20, z: 0 }); stepCombat(w, 0.05); assert.equal(h.autoTarget, undefined);
  command(w, new Set([h.id]), 'advance', { x: 25, z: 0 }); b.hp = 0; stepCombat(w, 0.05); assert.equal(h.autoTarget, a.id);
  w.players[0].autoTracking = false; h.autoTarget = undefined; stepCombat(w, 0.05); assert.equal(h.autoTarget, undefined);
});
test('automatic engagement resumes once a plain move reaches its destination', () => {
  const w = createWorld(), h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, enemy = spawn(w, 1, 'footman', { x: 6, z: 0 });
  w.units = [h, enemy]; Object.assign(h, { x: 0, z: 0 }); command(w, new Set([h.id]), 'move', { x: 0, z: 0 }); stepCombat(w, .05);
  assert.equal(h.order, 'advance'); assert.equal(h.autoTarget, enemy.id);
});
test('paid command training buffs nearby troops and the hero march toggle controls actual speed', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, a = w.units.find(u => u.team === 0 && u.kind === 'footman')!, b = spawn(w, 1, 'footman', { x: 2, z: 0 });
  w.units = [h, a, b]; Object.assign(h, { x: -5, z: 0, order: 'hold', goal: { x: -5, z: 0 } }); Object.assign(a, { x: 0, z: 0, target: b.id, order: 'attack' }); b.facing = Math.PI; b.attackTimer = 100; w.regiments.find(r => r.team === 1 && r.index === 0)!.facing = Math.PI;
  p.gold = 1000; p.ore = 1000; assert.equal(trainHero(w, 'command'), true); const hp = b.hp; stepCombat(w, .05); assert.ok(Math.abs(hp - b.hp - a.damage * 1.05) < .001);
  w.units = [h, a]; Object.assign(h, { x: 0, z: 0, order: 'move', goal: { x: 20, z: 0 } }); Object.assign(a, { x: -8, z: 0, goal: { x: -8, z: 0 }, order: 'hold', target: undefined }); w.regiments[0].movement = 'follow';
  p.marchWithArmy = true; stepCombat(w, .05); const march = h.x;
  h.x = 0; p.marchWithArmy = false; stepCombat(w, .05); assert.ok(h.x > march * 1.5);
});
test('army escorts occupy distinct positions and an independent regiment detaches', () => {
  const w = createWorld(), h = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  Object.assign(h, { x: 0, z: 0, facing: 0, goal: { x: 0, z: 0 }, order: 'hold' });
  w.units = w.units.filter(u => u.team === 0);
  const troops = w.units.filter(u => u.team === 0 && u.kind === 'footman'); troops.slice(2).forEach(u => u.regiment = 1);
  gatherArmy(w);
  assert.ok(Math.hypot(w.regiments[0].goal.x - w.regiments[1].goal.x, w.regiments[0].goal.z - w.regiments[1].goal.z) > 16);
  for (let i = 0; i < 2000; i++) { stepRegiments(w, 0.05); stepCombat(w, 0.05); }
  assert.ok(Math.hypot(w.regiments[0].anchor.x - w.regiments[1].anchor.x, w.regiments[0].anchor.z - w.regiments[1].anchor.z) > 16);
  command(w, new Set(troops.slice(2).map(u => u.id)), 'move', { x: 30, z: 30 });
  assert.equal(w.regiments[1].movement, 'move'); assert.equal(w.regiments[0].movement, 'follow');
});
test('boss is contained even after separation, rejects outside targets and returns home', () => {
  const w = createWorld(), boss = w.units.find(u => u.kind === 'boss')!, h = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  w.units = [boss, h]; boss.x = MAP.boss.x + 19; h.x = MAP.boss.x + 22; h.z = MAP.boss.z; h.order = 'hold'; boss.target = h.id;
  const before = h.hp; stepObjectives(w, 20); assert.equal(h.hp, before);
  stepCombat(w, 0.05); assert.equal(boss.target, undefined);
  assert.ok(Math.hypot(boss.x - MAP.boss.x, boss.z - MAP.boss.z) <= MAP.boss.radius - STATS.boss.radius + 0.0001);
  const d = Math.hypot(boss.x - MAP.boss.x, boss.z - MAP.boss.z); for (let i = 0; i < 100; i++) stepCombat(w, 0.05);
  assert.ok(Math.hypot(boss.x - MAP.boss.x, boss.z - MAP.boss.z) < d);
});
