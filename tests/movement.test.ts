import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world';
import { command, commandRegiment } from '../src/game/commands';
import { stepRegiments, setSelectionFormation, gatherArmy } from '../src/game/formations';
import { stepCombat } from '../src/game/combat';
import { stepEconomy } from '../src/game/economy';
import { captureTerritory, stepOutposts } from '../src/game/outposts';
import { distance } from '../src/game/math';

function setup() {
  const w = createWorld();
  w.aiEnabled = false;
  for (const p of w.players) { p.production.interval = 0; p.autoTracking = false; }
  w.units = w.units.filter(u => u.team === 0 && u.kind === 'footman');
  const troops = [...w.units], r = w.regiments[0];
  troops.forEach((u, i) => Object.assign(u, { x: -12 + i * 8, z: 0, goal: { x: -12 + i * 8, z: 0 }, order: 'hold' }));
  r.movement = 'hold'; r.goal = { x: 0, z: 0 };
  return { w, troops, r };
}

test('scattered troops immediately head to destination slots without visiting an old formation center', () => {
  const { w, troops, r } = setup(), destination = { x: 30, z: 25 };
  r.anchor = { x: -45, z: -35 };
  commandRegiment(w, 0, 0, 'move', destination);
  assert.ok(troops.every(u => distance(u.goal, destination) < 8 && u.goal.x > 25));
  const before = troops.map(u => ({ x: u.x, distance: distance(u, u.goal) }));
  stepRegiments(w, .05); stepCombat(w, .05);
  troops.forEach((u, i) => { assert.ok(u.x > before[i].x); assert.ok(distance(u, u.goal) < before[i].distance); });
});

test('a replacement order interrupts the old destination and target on the next movement tick', () => {
  const { w, troops, r } = setup(), enemy = spawn(w, 1, 'hero', { x: 35, z: 0 });
  commandRegiment(w, 0, 0, 'attack', enemy, enemy.id);
  stepRegiments(w, .05); stepCombat(w, .05);
  troops[0].autoTarget = enemy.id;
  commandRegiment(w, 0, 0, 'move', { x: -35, z: 25 });
  assert.equal(r.target, undefined);
  assert.ok(troops.every(u => u.target === undefined && u.autoTarget === undefined && u.goal.x < -30));
  const before = troops.map(u => u.x);
  stepRegiments(w, .05); stepCombat(w, .05);
  troops.forEach((u, i) => assert.ok(u.x < before[i]));
});

test('a partial selection uses one facing and distinct slots without pulling unselected troops along', () => {
  const { w, troops } = setup();
  Object.assign(troops[0], { x: -10, z: 0 }); Object.assign(troops[1], { x: 10, z: 0 });
  const unselected = troops.slice(2).map(u => ({ order: u.order, goal: { ...u.goal } }));
  command(w, new Set(troops.slice(0, 2).map(u => u.id)), 'move', { x: 0, z: 0 });
  stepRegiments(w, .05);
  assert.ok(distance(troops[0].goal, troops[1].goal) > 1);
  assert.ok(troops.slice(0, 2).every(u => u.tactical && u.order === 'move'));
  troops.slice(2).forEach((u, i) => { assert.equal(u.order, unselected[i].order); assert.deepEqual(u.goal, unselected[i].goal); });
});

test('troops settle into the chosen formation at the destination without a moving anchor', () => {
  const { w, troops, r } = setup(), destination = { x: 15, z: 25 };
  r.formation = 'wedge';
  commandRegiment(w, 0, 0, 'move', destination);
  const slots = troops.map(u => ({ ...u.goal }));
  for (let i = 0; i < 600; i++) { stepRegiments(w, .05); stepCombat(w, .05); }
  troops.forEach((u, i) => { assert.deepEqual(u.goal, slots[i]); assert.ok(distance(u, slots[i]) < .1); });
  assert.deepEqual(r.goal, destination);
});

test('recruits inherit current destinations and explicit targets, including orders for empty regiments', () => {
  const { w, troops } = setup(), enemy = spawn(w, 1, 'hero', { x: 35, z: 20 });
  const ids = new Set(troops.map(u => u.id));
  command(w, ids, 'attack', enemy, enemy.id, [0, 8]);
  const a = spawn(w, 0, 'footman', { x: -40, z: 0 }), b = spawn(w, 0, 'archer', { x: -40, z: 5 }, 8);
  for (const u of [a, b]) { assert.equal(u.order, 'attack'); assert.equal(u.target, enemy.id); assert.ok(distance(u.goal, enemy) < 10); }
  command(w, ids, 'move', { x: 0, z: 30 }, undefined, [0, 8]);
  for (const u of [a, b]) { assert.equal(u.order, 'move'); assert.equal(u.target, undefined); assert.ok(distance(u.goal, { x: 0, z: 30 }) < 10); }
});

test('hold freezes existing troops immediately while reinforcements join at their held location', () => {
  const { w, troops } = setup();
  commandRegiment(w, 0, 0, 'move', { x: 25, z: 25 });
  stepRegiments(w, .05); stepCombat(w, .05);
  commandRegiment(w, 0, 0, 'hold');
  const positions = troops.map(u => ({ x: u.x, z: u.z }));
  const recruit = spawn(w, 0, 'footman', { x: 30, z: -20 });
  for (let i = 0; i < 20; i++) { stepRegiments(w, .05); stepCombat(w, .05); }
  troops.forEach((u, i) => { assert.deepEqual(u.goal, positions[i]); assert.equal(distance(u, positions[i]), 0); });
  assert.ok(recruit.z > -20);
  setSelectionFormation(w, new Set(troops.map(u => u.id)), 'wall');
  assert.ok(troops.some((u, i) => distance(u.goal, positions[i]) > 1));
});

test('attack-moving troops engage nearby enemies while separated from their regiment', () => {
  const { w, troops } = setup(), soldier = troops[3];
  Object.assign(soldier, { x: 30, z: 0 });
  const enemy = spawn(w, 1, 'footman', { x: 33, z: 0 }); enemy.attackTimer = 100;
  commandRegiment(w, 0, 0, 'advance', { x: 35, z: 35 });
  w.players[0].autoTracking = true;
  stepRegiments(w, .05); stepCombat(w, .05);
  assert.equal(soldier.autoTarget, enemy.id);
});

test('home and captured barracks waves use the regiment destination instead of their spawn point', () => {
  const { w } = setup(), p = w.players[0], destination = { x: 0, z: 35 };
  p.gold = 10000; p.production.interval = 20; p.production.timer = 0; p.production.regiment = 8;
  commandRegiment(w, 0, 8, 'move', destination);
  const firstId = w.nextId;
  stepEconomy(w, .05);
  captureTerritory(w, 1, 0); const t = w.territories[1]; t.buildings.barracks = 1; t.regiment = 8; t.spawnTimer = 0;
  stepOutposts(w, .05);
  const recruits = w.units.filter(u => u.team === 0 && u.id >= firstId);
  assert.equal(recruits.length, p.production.counts.footman * 2);
  assert.ok(recruits.every(u => u.regiment === 8 && u.order === 'move' && distance(u.goal, destination) < 12));
});

test('gathering the army includes empty production regiments so their future troops escort the hero', () => {
  const { w } = setup(), hero = spawn(w, 0, 'hero', { x: 10, z: 30 });
  gatherArmy(w);
  const recruit = spawn(w, 0, 'footman', { x: -40, z: 0 }, 8);
  assert.equal(recruit.order, 'follow'); assert.ok(distance(recruit.goal, hero) < 12);
  hero.x = 25; stepRegiments(w, .05);
  assert.ok(distance(recruit.goal, hero) < 12);
});
