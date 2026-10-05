import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world';
import { command, commandRegiment } from '../src/game/commands';
import { stepRegiments } from '../src/game/formations';
import { stepCombat } from '../src/game/combat';
import { escortOffset } from '../src/game/regiment-movement';
import type { Formation } from '../src/game/types';

function setup(counts: number[], formation: Formation = 'line') {
  const w = createWorld();
  w.aiEnabled = false; w.units = [];
  for (const p of w.players) { p.production.interval = 0; p.autoTracking = false; }
  const hero = spawn(w, 0, 'hero', { x: 0, z: 0 });
  Object.assign(hero, { facing: 0, order: 'hold', goal: { x: 0, z: 0 } });
  const groups = counts.map((count, index) => {
    const r = w.regiments.find(r => r.team === 0 && r.index === index)!;
    r.formation = formation;
    const units = Array.from({ length: count }, (_, i) => spawn(w, 0, 'footman', { x: (i % 8 - 3.5) * 2, z: -15 - Math.floor(i / 8) * 2 }, index));
    commandRegiment(w, 0, index, 'follow');
    return { r, units };
  });
  return { w, hero, groups };
}

test('front and rear escort rows center single and partial rows', () => {
  assert.deepEqual(escortOffset('vanguard', 0, 1, 0), { x: 0, z: 8 });
  assert.deepEqual(escortOffset('rearguard', 0, 1, 0), { x: 0, z: -8 });
  assert.equal(escortOffset('vanguard', 0, 2, 0).x, -escortOffset('vanguard', 1, 2, 0).x);
  assert.equal(escortOffset('vanguard', 3, 4, 0).x, 0);
});

for (const formation of ['line', 'wall', 'wedge'] as const) {
  for (const layout of ['vanguard', 'rearguard'] as const) {
    test(`${layout} keeps all 40 ${formation} slots on the correct side of the hero`, () => {
      const { w, hero, groups } = setup([40], formation);
      w.players[0].escortLayout = layout;
      stepRegiments(w, .05);
      const goals = groups[0].units.map(u => u.goal);
      assert.ok(goals.every(goal => layout === 'vanguard' ? goal.z - hero.z >= 7.99 : goal.z - hero.z <= -7.99));
      const minX = Math.min(...goals.map(goal => goal.x)), maxX = Math.max(...goals.map(goal => goal.x));
      assert.ok(Math.abs(minX + maxX) < .01, 'the entire regiment footprint is centered');
      hero.order = 'move'; hero.goal = { x: 35, z: 0 };
      stepRegiments(w, .05);
      assert.ok(groups[0].units.every(u => layout === 'vanguard' ? u.goal.x - hero.x >= 7.99 : u.goal.x - hero.x <= -7.99));
    });
  }
}

test('different regiment sizes occupy separate centered columns and front/rear rows', () => {
  const { w, groups } = setup([4, 16, 6, 12], 'wall');
  for (const layout of ['vanguard', 'rearguard'] as const) {
    w.players[0].escortLayout = layout; stepRegiments(w, .05);
    const bounds = groups.map(({ units }) => ({ minX: Math.min(...units.map(u => u.goal.x)), maxX: Math.max(...units.map(u => u.goal.x)), minZ: Math.min(...units.map(u => u.goal.z)), maxZ: Math.max(...units.map(u => u.goal.z)) }));
    assert.ok(bounds[0].maxX < bounds[1].minX && bounds[1].maxX < bounds[2].minX);
    assert.ok(Math.abs(bounds[0].minX + bounds[2].maxX) < .01);
    assert.ok(Math.abs(bounds[3].minX + bounds[3].maxX) < .01);
    assert.ok(layout === 'vanguard' ? bounds[3].minZ > Math.max(...bounds.slice(0, 3).map(b => b.maxZ)) : bounds[3].maxZ < Math.min(...bounds.slice(0, 3).map(b => b.minZ)));
  }
});

test('escort heading responds to hero move commands and stays stable while attacking', () => {
  const { w, hero, groups } = setup([4]);
  w.players[0].escortLayout = 'vanguard'; stepRegiments(w, .05);
  command(w, new Set([hero.id]), 'move', { x: 30, z: 0 });
  stepRegiments(w, .05);
  assert.ok(groups[0].units.every(u => u.goal.x >= 7.99));
  const before = groups[0].units.map(u => ({ ...u.goal }));
  hero.order = 'advance'; hero.facing = Math.PI; hero.autoTarget = 999;
  stepRegiments(w, .05);
  groups[0].units.forEach((u, i) => assert.deepEqual(u.goal, before[i]));
  hero.facing = -Math.PI / 2; stepRegiments(w, .05);
  groups[0].units.forEach((u, i) => assert.deepEqual(u.goal, before[i]));
  command(w, new Set([hero.id]), 'move', { x: -30, z: 0 }); stepRegiments(w, .05);
  assert.ok(groups[0].units.every(u => u.goal.x <= -7.99));
});

test('an explicit hero attack turns the guard toward the commanded target once', () => {
  const { w, hero, groups } = setup([4]);
  const enemy = spawn(w, 1, 'footman', { x: -30, z: 0 });
  w.players[0].escortLayout = 'vanguard'; stepRegiments(w, .05);
  command(w, new Set([hero.id]), 'attack', { x: enemy.x, z: enemy.z }, enemy.id);
  stepRegiments(w, .05);
  assert.ok(groups[0].units.every(u => u.goal.x <= -7.99));
  const before = groups[0].units.map(u => ({ ...u.goal }));
  hero.facing = Math.PI / 2; stepRegiments(w, .05);
  groups[0].units.forEach((u, i) => assert.deepEqual(u.goal, before[i]));
});

test('escorts use actual travel direction around bends without reacting to combat shuffles', () => {
  const { w, hero, groups } = setup([4]);
  w.players[0].escortLayout = 'vanguard';
  command(w, new Set([hero.id]), 'move', { x: 30, z: 0 }); stepRegiments(w, .05);
  hero.x = 2; hero.z = 1; stepRegiments(w, .05);
  const heading = Math.atan2(2, 1);
  assert.ok(Math.abs(groups[0].r.facing - heading) < .001);
  hero.autoTarget = 999; hero.x = 1; hero.z = 2; hero.facing = -Math.PI / 2;
  stepRegiments(w, .05);
  assert.ok(Math.abs(groups[0].r.facing - heading) < .001);
});

test('front guard settles ahead of the hero while a detached regiment keeps its independent destination', () => {
  const { w, hero, groups } = setup([20, 4], 'wall');
  w.players[0].escortLayout = 'vanguard';
  commandRegiment(w, 0, 1, 'move', { x: 30, z: -25 });
  const detachedGoals = groups[1].units.map(u => ({ ...u.goal }));
  for (let i = 0; i < 1000; i++) { stepRegiments(w, .05); stepCombat(w, .05); }
  assert.ok(groups[0].units.every(u => u.z - hero.z > 7.8));
  groups[1].units.forEach((u, i) => assert.deepEqual(u.goal, detachedGoals[i]));
  assert.equal(groups[1].r.movement, 'move');
});
