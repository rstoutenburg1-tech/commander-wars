import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/game/world';
import { command } from '../src/game/commands';
import { advanceCursor, bindAbility, cursorDirection, syncAbilityBindings, type AbilityBindings } from '../src/game/hotkeys';
import { trainSkill, grantLevelPoints } from '../src/game/skills';
import { setSelectionFormation, selectedRegiments } from '../src/game/formations';

test('cursor movement cancels opposite WASD keys and normalizes diagonals', () => {
  assert.deepEqual(cursorDirection(new Set(['w', 's', 'a', 'd'])), { x: 0, y: 0 });
  assert.deepEqual(cursorDirection(new Set(['w'])), { x: 0, y: -1 });
  const diagonal = cursorDirection(new Set(['w', 'd']));
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
});
test('screen cursor has consistent pixel speed, stops on release and stays inside resized views', () => {
  const start = { x: 0.5, y: 0.5 }, width = 1100, height = 900;
  const cardinal = advanceCursor(start, new Set(['w']), 0.5, width, height), diagonal = advanceCursor(start, new Set(['w', 'd']), 0.5, width, height);
  assert.ok(Math.abs(Math.hypot((cardinal.x - start.x) * width, (cardinal.y - start.y) * height) - 210) < 1e-10);
  assert.ok(Math.abs(Math.hypot((diagonal.x - start.x) * width, (diagonal.y - start.y) * height) - 210) < 1e-10);
  assert.deepEqual(advanceCursor(diagonal, new Set(), 1, width, height), diagonal);
  const edge = advanceCursor(start, new Set(['d', 's']), 10, width, height);
  assert.equal(edge.x, 1 - 16 / width); assert.equal(edge.y, 1 - 16 / height);
  const resized = advanceCursor(edge, new Set(), 0, 400, 300);
  assert.ok(resized.x <= 1 - 16 / 400 && resized.y <= 1 - 16 / 300);
  assert.deepEqual(advanceCursor(start, new Set(['a']), 1, 0, 0), start);
});
test('quick formation change preserves an existing attack order and target', () => {
  const w = createWorld(), troops = w.units.filter(u => u.team === 0 && u.kind === 'footman'), ids = new Set(troops.map(u => u.id));
  const boss = w.units.find(u => u.kind === 'boss')!, r = w.regiments.find(r => r.team === 0 && r.index === 0)!;
  command(w, ids, 'attack', boss, boss.id); const goal = { ...r.goal }, anchor = { ...r.anchor }, cohesion = r.cohesion;
  setSelectionFormation(w, ids, 'wall');
  assert.equal(r.formation, 'wall'); assert.equal(r.movement, 'attack'); assert.deepEqual(r.goal, goal); assert.deepEqual(r.anchor, anchor); assert.equal(r.cohesion, cohesion);
  assert.ok(troops.every(u => u.target === boss.id && u.order === 'attack'));
  assert.equal(w.regiments.find(r => r.team === 1 && r.index === 0)!.formation, 'line');
});
test('formation shortcuts affect selected regiments together and support empty groups', () => {
  const w = createWorld(); assert.equal(w.regiments.filter(r => r.team === 0).length, 9);
  const troops = w.units.filter(u => u.team === 0 && u.kind === 'footman');
  troops[0].regiment = 8;
  const r1 = w.regiments.find(r => r.team === 0 && r.index === 0)!, r9 = w.regiments.find(r => r.team === 0 && r.index === 8)!;
  setSelectionFormation(w, new Set(troops.map(u => u.id)), 'wedge'); assert.equal(r1.formation, 'wedge'); assert.equal(r9.formation, 'wedge');
  const empty = w.regiments.find(r => r.team === 0 && r.index === 4)!;
  setSelectionFormation(w, new Set(), 'wall', 4); assert.equal(empty.formation, 'wall');
  const hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  assert.deepEqual(selectedRegiments(w, new Set([hero.id])), []);
  setSelectionFormation(w, new Set([hero.id]), 'line'); assert.equal(r9.formation, 'wedge');
  w.winner = 0; setSelectionFormation(w, new Set(), 'line', 4); assert.equal(empty.formation, 'wall');
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
