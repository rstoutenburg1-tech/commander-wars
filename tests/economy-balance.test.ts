import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world';
import { cycleCost, productionBurn, resourceIncome, recruit, startUpgrade, stepEconomy, unlocked } from '../src/game/economy';
import { progressHero, refreshStats } from '../src/game/hero';
import { stepOutposts } from '../src/game/outposts';
import { supportReason, useSupport } from '../src/game/support';
import { RULES, SUPPORT, isTroop } from '../src/game/config';
import { step } from '../src/game/simulation';

test('early barracks choices unlock archers and musketeers before keep promotion', () => {
  const w = createWorld(), p = w.players[0];
  assert.equal(unlocked(p, 'archer'), true); assert.equal(unlocked(p, 'musketeer'), false);
  assert.equal(startUpgrade(w, 0, 'barracks'), true); stepEconomy(w, 15.1);
  assert.equal(p.tier, 1); assert.equal(unlocked(p, 'musketeer'), true); assert.equal(unlocked(p, 'knight'), false);
  p.tier = 2; p.gold = p.wood = p.ore = 1000; assert.equal(startUpgrade(w, 0, 'barracks'), true); stepEconomy(w, 25.1);
  assert.equal(unlocked(p, 'knight'), true);
});

test('mixed waves pay all three resources once and expose their full ongoing burn', () => {
  const w = createWorld(), p = w.players[0]; p.barracks = 3;
  p.production.counts = { footman: 1, archer: 1, musketeer: 1, knight: 1 };
  assert.deepEqual(cycleCost(p), { gold: 129, wood: 18, ore: 28 });
  assert.deepEqual(productionBurn(w, p), { gold: 387, wood: 54, ore: 84 });
  Object.assign(p, { gold: 1000, wood: 100, ore: 100 }); p.production.timer = 0;
  stepEconomy(w, 0);
  assert.deepEqual([p.gold, p.wood, p.ore], [871, 82, 72]);
  assert.equal(w.units.filter(u => u.team === 0 && isTroop(u.kind)).length, RULES.startingFootmen + 4);
});

test('resource shortages skip only unaffordable recruits without partial charges or debt', () => {
  const w = createWorld(), p = w.players[0]; p.barracks = 3;
  Object.assign(p, { gold: 1000, wood: 10, ore: 0 });
  assert.equal(recruit(p, 'knight'), false); assert.deepEqual([p.gold, p.wood, p.ore], [1000, 10, 0]);
  p.production.counts = { footman: 1, archer: 2, musketeer: 1, knight: 1 }; p.production.timer = 0;
  stepEconomy(w, 0);
  assert.deepEqual([p.gold, p.wood, p.ore], [962, 0, 0]);
  assert.match(p.production.status, /wood, ore/);
  assert.equal(recruit(p, 'footman'), true);
  p.gold = p.production.reserve + 15; assert.equal(recruit(p, 'footman'), false);
});

test('captured barracks shares material costs, reserves and budget with the home roster', () => {
  const w = createWorld(), p = w.players[0], t = w.territories[1];
  Object.assign(t, { captured: true, owner: 0, spawnTimer: 0 }); t.buildings.barracks = 1;
  p.production.counts = { footman: 0, archer: 2, musketeer: 0, knight: 0 };
  Object.assign(p, { gold: 1000, wood: 10, ore: 0 }); stepOutposts(w, 0);
  assert.equal(p.gold, 978); assert.equal(p.wood, 0);
  assert.equal(w.units.filter(u => u.team === 0 && u.kind === 'archer').length, 1);
  assert.deepEqual(productionBurn(w, p), { gold: 264, wood: 120, ore: 0 });
  t.buildings.forest = 1; t.buildings.quarry = 1; t.buildings.goldmine = 1;
  assert.deepEqual(resourceIncome(w, p), { gold: 8, wood: 1.2, ore: 0.9 });
});

test('sustained heavy waves strain ore while a stronger quarry supports the same roster', () => {
  const run = (quarry: number) => {
    const w = createWorld(), p = w.players[0]; Object.assign(p, { gold: 10000, wood: 10000, ore: 0, goldmine: 2, forest: 2, quarry, barracks: 3 });
    p.production.counts = { footman: 1, archer: 1, musketeer: 1, knight: 1 };
    let raised = 0;
    for (let i = 0; i < 18; i++) {
      w.units = w.units.filter(u => u.team !== 0 || !isTroop(u.kind));
      p.production.timer = 0; stepEconomy(w, 20);
      raised += w.units.filter(u => u.team === 0 && (u.kind === 'knight' || u.kind === 'musketeer')).length;
      assert.ok(p.gold >= p.production.reserve && p.wood >= 0 && p.ore >= 0);
    }
    return { raised, ore: p.ore };
  };
  const strained = run(1), supported = run(2);
  assert.ok(strained.raised < 36); assert.equal(supported.raised, 36);
  assert.ok(supported.ore < 50, 'ongoing ore spending prevents a huge unused stockpile');
});

test('keep promotion grants technology but no free hero levels or skill points', () => {
  const w = createWorld(), p = w.players[0]; p.crafting = 1; p.production.interval = 0;
  Object.assign(p, { gold: 1000, wood: 200, ore: 200 });
  const h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, t = w.units.find(u => u.team === 0 && u.kind === 'footman')!;
  const hp = h.maxHp, damage = h.meleeDamage, troopHP = t.maxHp;
  assert.equal(startUpgrade(w, 0, 'base'), true); stepEconomy(w, 45.1); progressHero(w, 0);
  assert.equal(p.tier, 2); assert.equal(p.level, 1); assert.equal(p.highestLevel, 1);
  assert.equal(h.maxHp, hp); assert.equal(h.meleeDamage, damage);
  assert.ok(Math.abs(t.maxHp / troopHP - 1.08) < 0.001);
  p.xp = 300; progressHero(w, 0); assert.equal(p.level, 5); assert.equal(p.highestLevel, 5);
  assert.ok(h.maxHp > hp);
});

test('hero experience and keep technology have independent stat effects', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, t = w.units.find(u => u.team === 0 && u.kind === 'footman')!;
  const hp = h.maxHp, troopHP = t.maxHp; p.level = 20; p.tier = 2; refreshStats(w, 0);
  assert.ok(Math.abs(h.maxHp / hp - 1.475) < .001);
  assert.ok(Math.abs(t.maxHp / troopHP - 1.08) < .001);
});

test('field resupply requires withdrawal, heals nearby living army only and restores cohesion', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  p.crafting = 1; p.gold = p.wood = p.ore = 1000;
  Object.assign(h, { x: 20, z: 20, hp: 500 });
  const nearby = spawn(w, 0, 'footman', { x: 22, z: 20 }), far = spawn(w, 0, 'footman', { x: 45, z: 20 }, 1);
  nearby.hp = 100; far.hp = 100; w.regiments[0].cohesion = 40; w.regiments[1].cohesion = 40;
  const enemy = spawn(w, 1, 'footman', { x: 30, z: 20 });
  assert.match(supportReason(w, 0, 'resupply')!, /Withdraw/); assert.equal(useSupport(w, 0, 'resupply'), false);
  assert.equal(p.wood, 1000); enemy.x = 60;
  assert.equal(useSupport(w, 0, 'resupply'), true);
  assert.equal(h.hp, 860); assert.equal(nearby.hp, 148); assert.equal(far.hp, 100);
  assert.equal(w.regiments[0].cohesion, 60); assert.equal(w.regiments[1].cohesion, 40);
  assert.deepEqual([p.gold, p.wood, p.ore], [940, 950, 965]);
  assert.equal(useSupport(w, 0, 'resupply'), false); assert.match(supportReason(w, 0, 'resupply')!, /45s/);
  w.time = 45; assert.equal(useSupport(w, 0, 'resupply'), true);
});

test('supply actions have independent timers, obey workshop tiers and pause with simulation', () => {
  const w = createWorld(), p = w.players[0]; p.gold = p.wood = p.ore = 1000; p.crafting = 1;
  assert.equal(useSupport(w, 0, 'siege'), false); assert.match(supportReason(w, 0, 'siege')!, /Workshop 2/);
  p.crafting = 2; assert.equal(useSupport(w, 0, 'siege'), true);
  assert.equal(p.siegeUntil, SUPPORT.siege.duration); assert.equal(p.supportReady.siege, SUPPORT.siege.cooldown); assert.equal(p.supportReady.resupply, 0);
  w.paused = true; step(w, 20); assert.equal(w.time, 0); assert.equal(p.siegeUntil, 35);
  w.time = 35; assert.equal(useSupport(w, 0, 'siege'), false); assert.match(supportReason(w, 0, 'siege')!, /40s/);
});

test('full-health supplied armies and insufficient materials cannot consume support', () => {
  const w = createWorld(), p = w.players[0]; p.crafting = 2; p.gold = p.wood = p.ore = 1000;
  assert.equal(useSupport(w, 0, 'resupply'), false); assert.deepEqual([p.gold, p.wood, p.ore], [1000, 1000, 1000]);
  p.wood = 49; assert.equal(useSupport(w, 0, 'siege'), false); assert.equal(p.gold, 1000);
});
