import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/game/config';
import { createWorld } from '../src/game/world';
import { command, steerSelection } from '../src/game/commands';
import { step } from '../src/game/simulation';
import { bindAbility, movementDirection, syncAbilityBindings, type AbilityBindings } from '../src/game/hotkeys';
import { trainSkill, grantLevelPoints } from '../src/game/skills';
import { walkable } from '../src/game/navigation';

test('WASD cancels opposite keys and normalizes diagonal movement', () => {
  assert.deepEqual(movementDirection(new Set(['w', 's', 'a', 'd'])), { x: 0, z: 0 });
  assert.deepEqual(movementDirection(new Set(['w'])), { x: 0, z: -1 });
  const diagonal = movementDirection(new Set(['w', 'd']));
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-10);
});
test('held steering moves hero at normal speed and hold stops the order', () => {
  const travel = (keys: string[]) => {
    const w = createWorld(); w.aiEnabled = false;
    const hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
    hero.x = 0; hero.z = 0; hero.goal = { x: 0, z: 0 }; const ids = new Set([hero.id]);
    for (let i = 0; i < 20; i++) { steerSelection(w, ids, movementDirection(new Set(keys))); step(w, RULES.tick); }
    const distance = Math.hypot(hero.x, hero.z); assert.ok(Math.abs(distance - hero.speed) < 0.01);
    command(w, ids, 'hold'); const end = { x: hero.x, z: hero.z };
    for (let i = 0; i < 20; i++) step(w, RULES.tick);
    assert.ok(Math.hypot(hero.x - end.x, hero.z - end.z) < 0.01); return distance;
  };
  assert.ok(Math.abs(travel(['w']) - travel(['w', 'd'])) < 0.01);
});
test('all nine regiments exist and steering keeps separate anchors and unselected orders', () => {
  const w = createWorld(); assert.equal(w.regiments.filter(r => r.team === 0).length, 9);
  const troops = w.units.filter(u => u.team === 0 && u.kind === 'footman');
  troops[0].regiment = 8; troops[0].x = 8; troops[0].z = 0;
  const r1 = w.regiments.find(r => r.team === 0 && r.index === 0)!, r9 = w.regiments.find(r => r.team === 0 && r.index === 8)!;
  r1.anchor = { x: -10, z: 0 }; r9.anchor = { x: 8, z: 0 };
  const hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!, order = hero.order;
  steerSelection(w, new Set(troops.map(u => u.id)), { x: 1, z: 0 });
  assert.equal(r1.goal.x, -4); assert.equal(r9.goal.x, 14); assert.equal(hero.order, order);
  assert.ok(troops.every(u => u.order === 'move' && !u.tactical));
});
test('steering respects ravines, pause and match end', () => {
  const w = createWorld(); w.aiEnabled = false;
  const hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!, ids = new Set([hero.id]);
  hero.x = -49; hero.z = 0; hero.goal = { x: -49, z: 0 };
  for (let i = 0; i < 80; i++) { steerSelection(w, ids, { x: -1, z: 0 }); step(w, RULES.tick); assert.ok(walkable(hero)); }
  const goal = { ...hero.goal }; w.paused = true; steerSelection(w, ids, { x: 1, z: 0 }); assert.deepEqual(hero.goal, goal);
  w.paused = false; w.winner = 0; steerSelection(w, ids, { x: 1, z: 0 }); assert.deepEqual(hero.goal, goal);
});
test('ability defaults, swaps and later unlocks have unique keys', () => {
  const w = createWorld(), p = w.players[0], bindings: AbilityBindings = {};
  p.level = 20; p.tier = 2; grantLevelPoints(p);
  trainSkill(w, 0, 'cleave'); syncAbilityBindings(p, bindings); assert.equal(bindings.cleave, 'q');
  assert.equal(bindAbility(p, bindings, 'cleave', 'e'), true);
  trainSkill(w, 0, 'wind'); trainSkill(w, 0, 'rally'); trainSkill(w, 0, 'ultimate'); syncAbilityBindings(p, bindings);
  assert.equal(bindings.wind, 'q'); assert.equal(bindings.rally, 'r'); assert.equal(bindings.ultimate, 'v');
  assert.equal(bindAbility(p, bindings, 'cleave', 'q'), true); assert.equal(bindings.wind, 'e');
  assert.equal(new Set(Object.values(bindings)).size, 4);
  assert.equal(bindAbility(p, bindings, 'cleave', 'w'), false); assert.equal(bindAbility(p, bindings, 'warcry', 'g'), false);
  assert.equal(bindAbility(p, bindings, 'wind', ''), true); assert.equal(bindings.wind, null);
});
test('saved keys for unlearned abilities cannot duplicate newly assigned keys', () => {
  const w = createWorld(), p = w.players[0], bindings: AbilityBindings = { wind: 'e' };
  trainSkill(w, 0, 'cleave'); syncAbilityBindings(p, bindings);
  bindAbility(p, bindings, 'cleave', 'e'); assert.equal(bindings.wind, 'q');
  p.level = 5; grantLevelPoints(p); trainSkill(w, 0, 'wind'); syncAbilityBindings(p, bindings);
  assert.equal(bindings.cleave, 'e'); assert.equal(bindings.wind, 'q');
});
