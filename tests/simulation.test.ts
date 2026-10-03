import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/game/world.ts';
import { step } from '../src/game/simulation.ts';
import { stepEconomy, startUpgrade } from '../src/game/economy.ts';
import { kill } from '../src/game/combat.ts';
import { progressHero, levelFloor } from '../src/game/hero.ts';

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
  assert.equal(p.level, 10); assert.equal(p.xp, 5000);
  p.tier = 2; p.level = 11; progressHero(w, 0.05); assert.ok(p.level > 11); p.level = 11;
  const hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!, enemy = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  kill(w, hero, enemy); assert.equal(p.level, levelFloor(2)); assert.equal(p.respawn, 22);
});
test('base destruction eliminates army and produces victory', () => {
  const w = createWorld(), hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  for (const team of [1, 2, 3]) kill(w, w.units.find(u => u.team === team && u.kind === 'base')!, hero);
  assert.equal(w.winner, 0); assert.equal(w.units.some(u => u.team > 0 && u.hp > 0), false);
});
test('three AIs progress and fight during a five-minute simulation', () => {
  const w = createWorld(); w.invulnerable = true;
  for (let i = 0; i < 6000 && w.winner === null; i++) step(w, 0.05);
  assert.ok(w.players.slice(1).some(p => p.tier >= 2)); assert.ok(w.players.slice(1).some(p => p.level > 1 || p.eliminated));
  for (const p of w.players) assert.ok(p.gold >= 0 && p.wood >= 0 && p.ore >= 0);
  assert.ok(w.units.length <= 4 * 42); assert.ok(w.units.every(u => Number.isFinite(u.hp) && Number.isFinite(u.x)));
});
