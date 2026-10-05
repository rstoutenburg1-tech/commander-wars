import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world';
import { command, commandRegiment } from '../src/game/commands';
import { stepRegiments, setSelectionFormation } from '../src/game/formations';
import { stepCombat } from '../src/game/combat';
import { FORMATIONS, STATS, isRangedTroop, type TroopKind } from '../src/game/config';
import { distance } from '../src/game/math';
import { gatePosition, gateSide } from '../src/game/gates';
import type { Formation, Point } from '../src/game/types';

function setup() {
  const w = createWorld(); w.units = []; w.gates = []; w.aiEnabled = false;
  for (const p of w.players) { p.production.interval = 0; p.autoTracking = false; }
  for (const r of w.regiments) { r.movement = 'hold'; r.goal = { x: 0, z: 0 }; }
  return w;
}
const forward = (p: Point, facing: number) => p.x * Math.sin(facing) + p.z * Math.cos(facing);

for (const formation of ['line', 'wall', 'wedge'] as Formation[]) {
  test(`mixed ${formation} puts every archer/musketeer behind melee, including short rows and turning`, () => {
    for (const [meleeCount, rangedCount] of [[1, 1], [4, 4], [9, 11]]) for (const facing of [0, Math.PI / 2, -Math.PI / 3]) {
      const w = setup(), r = w.regiments[0]; r.formation = formation;
      // Create ranged IDs first: spawn order must not determine the front rank.
      for (let i = 0; i < rangedCount; i++) spawn(w, 0, i % 2 ? 'archer' : 'musketeer', { x: i * 2, z: -15 });
      for (let i = 0; i < meleeCount; i++) spawn(w, 0, i % 2 ? 'footman' : 'knight', { x: i * 2, z: -10 });
      commandRegiment(w, 0, 0, 'move', { x: 15, z: 25 }); r.facing = facing; stepRegiments(w, .05);
      const front = w.units.filter(u => !isRangedTroop(u.kind)), rear = w.units.filter(u => isRangedTroop(u.kind));
      assert.ok(Math.min(...front.map(u => forward(u.goal, facing))) - Math.max(...rear.map(u => forward(u.goal, facing))) >= FORMATIONS[formation].spacing - 1e-6);
      assert.equal(new Set(w.units.map(u => `${u.goal.x}:${u.goal.z}`)).size, w.units.length, 'all troops have distinct slots');
    }
  });
}

test('partial mixed selection keeps ranged behind melee without pulling unselected troops', () => {
  const w = setup(), archer = spawn(w, 0, 'archer', { x: -5, z: -10 }), footman = spawn(w, 0, 'footman', { x: 5, z: -10 }), spare = spawn(w, 0, 'footman', { x: -15, z: -10 });
  const before = { order: spare.order, goal: { ...spare.goal } };
  command(w, new Set([archer.id, footman.id]), 'move', { x: 0, z: 25 });
  assert.ok(archer.goal.z < footman.goal.z); assert.equal(archer.goal.x, footman.goal.x);
  assert.deepEqual({ order: spare.order, goal: spare.goal }, before);
});

test('new melee recruits and formation switches keep ranged ranks behind the frontline', () => {
  const w = setup(), archer = spawn(w, 0, 'archer', { x: 0, z: 0 });
  commandRegiment(w, 0, 0, 'move', { x: 0, z: 30 });
  const footman = spawn(w, 0, 'footman', { x: 0, z: -10 });
  assert.ok(archer.goal.z < footman.goal.z);
  const musket = spawn(w, 0, 'musketeer', { x: -5, z: -10 });
  setSelectionFormation(w, new Set([archer.id, footman.id, musket.id]), 'wedge');
  assert.ok(archer.goal.z < footman.goal.z && musket.goal.z < footman.goal.z);
  assert.equal(archer.order, 'move'); assert.equal(musket.order, 'move');
});

test('mixed vanguard/rearguard footprints stay entirely on their intended side of the hero', () => {
  for (const layout of ['vanguard', 'rearguard'] as const) for (const formation of ['line', 'wall', 'wedge'] as Formation[]) {
    const w = setup(), hero = spawn(w, 0, 'hero', { x: 0, z: 0 }); hero.facing = 0;
    w.players[0].escortLayout = layout; w.regiments[0].formation = formation;
    for (let i = 0; i < 14; i++) spawn(w, 0, i < 3 ? 'footman' : 'archer', { x: 0, z: -20 });
    commandRegiment(w, 0, 0, 'follow'); stepRegiments(w, .05);
    const troops = w.units.filter(u => u.kind !== 'hero');
    assert.ok(troops.every(u => layout === 'vanguard' ? u.goal.z >= 7.99 : u.goal.z <= -7.99));
    assert.ok(Math.min(...troops.filter(u => u.kind === 'footman').map(u => u.goal.z)) > Math.max(...troops.filter(u => u.kind === 'archer').map(u => u.goal.z)));
  }
});

function firingSetup(kind: TroopKind) {
  const w = setup(), ranged = spawn(w, 0, kind, { x: 0, z: 0 }), enemy = spawn(w, 1, 'footman', { x: 0, z: 25 });
  Object.assign(enemy, { hp: 1e6, maxHp: 1e6, speed: 0, attackTimer: 1000 });
  return { w, ranged, enemy };
}
for (const kind of ['archer', 'musketeer'] as const) {
  test(`${kind} stops at weapon reach, holds during cooldown and follows only when the target leaves range`, () => {
    const { w, ranged, enemy } = firingSetup(kind);
    commandRegiment(w, 0, 0, 'attack', enemy, enemy.id);
    for (let i = 0; i < 300; i++) {
      stepRegiments(w, .05); stepCombat(w, .05);
      assert.ok(distance(ranged, enemy) - STATS[enemy.kind].radius >= ranged.range - 1e-6, 'movement must never overshoot weapon reach');
    }
    assert.ok(enemy.hp < enemy.maxHp); assert.ok(Math.abs(distance(ranged, enemy) - STATS[enemy.kind].radius - ranged.range) < 1e-6);
    const stopped = { x: ranged.x, z: ranged.z }; ranged.attackTimer = 100;
    for (let i = 0; i < 20; i++) { stepRegiments(w, .05); stepCombat(w, .05); }
    assert.deepEqual({ x: ranged.x, z: ranged.z }, stopped);
    enemy.z += 6; enemy.goal = { ...enemy }; stepRegiments(w, .05); stepCombat(w, .05);
    assert.ok(ranged.z > stopped.z, 'a moving target outside reach should be pursued');
    assert.ok(w.regiments[0].cohesion >= 99.9, 'firing from range is not a formation separation penalty');
  });
  test(`${kind} under defensive doctrine engages an in-range enemy before reaching an attack-move destination`, () => {
    const { w, ranged, enemy } = firingSetup(kind); enemy.z = ranged.range + STATS[enemy.kind].radius - .1; enemy.goal = { ...enemy };
    w.players[0].autoTracking = true; w.regiments[0].engagement = 'defensive';
    commandRegiment(w, 0, 0, 'advance', { x: 0, z: 35 }); stepCombat(w, .05);
    assert.equal(ranged.autoTarget, enemy.id); assert.ok(enemy.hp < enemy.maxHp);
    assert.deepEqual({ x: ranged.x, z: ranged.z }, { x: 0, z: 0 });
  });
}

test('a large movement tick stops a ranged soldier at reach rather than walking into its target', () => {
  const { w, ranged, enemy } = firingSetup('archer');
  commandRegiment(w, 0, 0, 'attack', enemy, enemy.id); stepCombat(w, 30);
  assert.ok(Math.abs(distance(ranged, enemy) - STATS[enemy.kind].radius - ranged.range) < 1e-6);
  stepCombat(w, .05); assert.ok(enemy.hp < enemy.maxHp);
});

test('a hero using a bow also stops at firing reach without changing melee combat behavior', () => {
  const w = setup(), hero = spawn(w, 0, 'hero', { x: 0, z: 0 }), enemy = spawn(w, 1, 'footman', { x: 0, z: 25 });
  w.players[0].combatStyle = 'ranged'; Object.assign(enemy, { hp: 1e6, maxHp: 1e6, speed: 0, attackTimer: 1000 });
  command(w, new Set([hero.id]), 'attack', enemy, enemy.id);
  for (let i = 0; i < 200; i++) { stepCombat(w, .05); assert.ok(distance(hero, enemy) - STATS[enemy.kind].radius >= hero.range - 1e-6); }
  assert.ok(enemy.hp < enemy.maxHp);
  const stopped = hero.z; w.players[0].combatStyle = 'melee'; stepCombat(w, .05); assert.ok(hero.z > stopped);
});

test('plain move interrupts ranged combat and reaches the clicked ground point', () => {
  const { w, ranged, enemy } = firingSetup('archer'); ranged.z = 16;
  commandRegiment(w, 0, 0, 'attack', enemy, enemy.id); stepCombat(w, .05);
  const health = enemy.hp;
  commandRegiment(w, 0, 0, 'move', { x: 20, z: 16 });
  for (let i = 0; i < 160; i++) { stepRegiments(w, .05); stepCombat(w, .05); }
  assert.ok(distance(ranged, { x: 20, z: 16 }) < .1);
  assert.equal(enemy.hp, health); assert.equal(ranged.target, undefined);
});

test('an allied closed gate blocks ranged attacks until the owner opens it', () => {
  const w = setup(), point = gatePosition(0), gate = spawn(w, 0, 'gate', point);
  w.gates.push({ id: gate.id, site: 0, owner: 0, open: false, tower: false, towerRemaining: 0, garrison: [] });
  const ranged = spawn(w, 0, 'musketeer', { x: point.x - 4, z: point.z + 4 }), enemy = spawn(w, 1, 'footman', { x: point.x + 4, z: point.z - 4 });
  Object.assign(enemy, { speed: 0, attackTimer: 1000 }); const hp = enemy.hp;
  commandRegiment(w, 0, 0, 'attack', enemy, enemy.id);
  for (let i = 0; i < 20; i++) stepCombat(w, .05);
  assert.equal(enemy.hp, hp); assert.ok(gateSide(0, ranged) > 0);
  w.gates[0].open = true; stepCombat(w, .05); assert.ok(enemy.hp < hp);
});
