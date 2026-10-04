import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/game/world';
import { ITEMS, MAP, STATS } from '../src/game/config';
import { equipItem, grantItem, unequipItem, buyItem, buyConsumable, sellItem, maxMana, startCraft, trainHero } from '../src/game/items';
import { stepObjectives } from '../src/game/objectives';
import { cast } from '../src/game/abilities';
import { damageUnit, stepCombat } from '../src/game/combat';
import { learnedAbilities } from '../src/game/hotkeys';
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
test('hero close attacks deal three times basic ranged damage', () => {
  const dealt = (x: number, style: 'melee' | 'ranged') => {
    const w = createWorld(), h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, enemy = w.units.find(u => u.team === 1 && u.kind === 'footman')!;
    w.units = [h, enemy]; h.x = 0; h.z = 0; enemy.x = x; enemy.z = 0; h.target = enemy.id; h.order = 'attack'; w.players[0].combatStyle = style;
    const hp = enemy.hp; stepCombat(w, 0.05); return hp - enemy.hp;
  };
  assert.equal(dealt(1.8, 'melee'), 135); assert.equal(dealt(5, 'ranged'), 45);
});
