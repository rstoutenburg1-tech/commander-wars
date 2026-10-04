import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world';
import { damageUnit, stepCombat } from '../src/game/combat';
import { refreshStats } from '../src/game/hero';
import { STATS, type Kind } from '../src/game/config';

function attack(kind: Kind, target: Kind, siege = false) {
  const w = createWorld(), a = spawn(w, 0, kind, { x: 20, z: 20 }), b = spawn(w, 1, target, { x: 21.5, z: 20 });
  w.units = [a, b]; w.players[1].autoTracking = false;
  a.target = b.id; a.order = 'attack'; b.attackTimer = 100;
  if (target === 'gate') w.gates = []; // This matchup test does not exercise lane collision.
  if (siege) w.players[0].siegeUntil = 35;
  const hp = b.hp; stepCombat(w, .05); return hp - b.hp;
}

test('ordinary troop attacks have distinct infantry, armor and ranged matchups', () => {
  assert.ok(Math.abs(attack('archer', 'footman') - STATS.archer.damage * 1.3) < .001);
  assert.ok(Math.abs(attack('archer', 'knight') - STATS.archer.damage * .75) < .001);
  assert.ok(Math.abs(attack('musketeer', 'knight') - STATS.musketeer.damage * 1.35) < .001);
  assert.ok(Math.abs(attack('musketeer', 'hero') - STATS.musketeer.damage * 1.15) < .001);
  assert.ok(Math.abs(attack('musketeer', 'footman') - STATS.musketeer.damage * .85) < .001);
  assert.ok(Math.abs(attack('footman', 'knight') - STATS.footman.damage * 1.4) < .001);
  assert.ok(Math.abs(attack('knight', 'archer') - STATS.knight.damage * 1.35) < .001);
  assert.ok(Math.abs(attack('knight', 'musketeer') - STATS.knight.damage * 1.35) < .001);
});

test('ranged siege penalties and paid ammunition change actual keep and gate damage', () => {
  for (const target of ['base', 'gate'] as const) {
    assert.ok(Math.abs(attack('archer', target) - STATS.archer.damage * .55) < .001);
    assert.ok(Math.abs(attack('musketeer', target) - STATS.musketeer.damage * .8) < .001);
    assert.ok(Math.abs(attack('archer', target, true) - STATS.archer.damage * 1.5) < .001);
    assert.ok(Math.abs(attack('musketeer', target, true) - STATS.musketeer.damage * 1.5) < .001);
  }
});

test('siege ammunition expires and does not alter ordinary unit or spell damage', () => {
  const w = createWorld(), a = spawn(w, 0, 'archer', { x: 20, z: 20 }), base = spawn(w, 1, 'base', { x: 22, z: 20 });
  w.units = [a, base]; base.attackTimer = 100; a.target = base.id; a.order = 'attack'; w.players[0].siegeUntil = 35;
  w.time = 35; const before = base.hp; stepCombat(w, .05); assert.ok(Math.abs(before - base.hp - a.damage * .55) < .001);
  const hp = base.hp; damageUnit(w, base, a, 100); assert.equal(hp - base.hp, 100);
  assert.equal(attack('archer', 'hero', true), attack('archer', 'hero'));
});

function charge(side: number, cohesion: number, formation: 'wall' | 'line' = 'wall') {
  const w = createWorld(), knight = spawn(w, 1, 'knight', { x: 20, z: 20 + side * 2 }), foot = spawn(w, 0, 'footman', { x: 20, z: 20 });
  w.units = [knight, foot]; w.players[0].autoTracking = false;
  const attacker = w.regiments.find(r => r.team === 1 && r.index === 0)!, defender = w.regiments[0];
  attacker.formation = 'wedge'; attacker.engagement = 'charge'; defender.formation = formation; defender.facing = 0; defender.cohesion = cohesion;
  knight.travel = 12; knight.order = 'attack'; knight.target = foot.id; foot.attackTimer = 100;
  const hp = foot.hp; stepCombat(w, .05);
  return { damage: hp - foot.hp, cohesion: defender.cohesion, effects: w.effects.map(e => e.kind) };
}

test('cohesive frontal shield walls stop charge bonuses and charge cohesion loss', () => {
  const frontal = charge(1, 100);
  assert.ok(Math.abs(frontal.damage - STATS.knight.damage * .52) < .001);
  assert.equal(frontal.cohesion, 100); assert.equal(frontal.effects.includes('charge'), false);
  const threshold = charge(1, 50); assert.ok(Math.abs(threshold.damage - STATS.knight.damage * .76) < .001);
});

test('flanking, broken walls and ordinary lines remain vulnerable to cavalry charges', () => {
  const flank = charge(-1, 100); assert.ok(Math.abs(flank.damage - STATS.knight.damage * 2.4) < .001); assert.equal(flank.cohesion, 78); assert.ok(flank.effects.includes('charge'));
  const broken = charge(1, 49); assert.ok(Math.abs(broken.damage - STATS.knight.damage * 2.4 * (1 - .48 * .49)) < .001); assert.equal(broken.cohesion, 27);
  const line = charge(1, 100, 'line'); assert.ok(Math.abs(line.damage - STATS.knight.damage * 2.4 * .9) < .001);
});

test('a cheaper tier-one shield infantry group can defeat a tier-three cavalry charge', () => {
  const w = createWorld(); w.players[1].tier = 3;
  const knight = spawn(w, 1, 'knight', { x: 20, z: 22 }), troops = [-1, 0, 1].map(x => spawn(w, 0, 'footman', { x: 20 + x, z: 20 }));
  w.units = [knight, ...troops]; refreshStats(w, 1);
  const enemy = w.regiments.find(r => r.team === 1 && r.index === 0)!; enemy.formation = 'wedge'; enemy.engagement = 'charge';
  w.regiments[0].formation = 'wall'; w.regiments[0].facing = 0; knight.travel = 12;
  knight.order = 'attack'; knight.target = troops[0].id;
  for (const u of troops) { u.order = 'attack'; u.target = knight.id; }
  for (let i = 0; i < 1800 && knight.hp > 0 && troops.some(u => u.hp > 0); i++) { w.time += .05; stepCombat(w, .05); }
  assert.equal(knight.hp, 0); assert.ok(troops.some(u => u.hp > 0));
  assert.ok(troops.length * STATS.footman.cost < STATS.knight.cost);
});
