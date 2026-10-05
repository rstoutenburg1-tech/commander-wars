import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/game/world';
import { defaultSettings } from '../src/game/match';
import { applyAction } from '../src/game/actions';
import { MAP } from '../src/game/config';

function match() {
  const settings = defaultSettings();
  settings.slots.forEach((s, i) => { s.controller = 'human'; s.alliance = i < 2 ? 0 : 1; });
  const w = createWorld(settings); w.networked = true;
  return w;
}

test('orders from a nonzero seat affect its army and reject another player selection', () => {
  const w = match(), mine = w.units.find(u => u.team === 1 && u.kind === 'hero')!, other = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  const original = { ...other.goal };
  assert.equal(applyAction(w, 1, { type: 'order', ids: [mine.id], order: 'move', point: { x: -55, z: -65 } }), true);
  assert.deepEqual(mine.goal, { x: -55, z: -65 });
  assert.deepEqual(other.goal, original);
  assert.equal(applyAction(w, 1, { type: 'order', ids: [mine.id, other.id], order: 'move', point: { x: 5, z: 5 } }), false);
  assert.deepEqual(other.goal, original);
});

test('exact targeting rejects allies while allowing enemy units and the neutral boss', () => {
  const w = match(), hero = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  const ally = w.units.find(u => u.team === 0 && u.kind === 'hero')!, enemy = w.units.find(u => u.team === 2 && u.kind === 'hero')!, boss = w.units.find(u => u.team === 4)!;
  const attack = (u: typeof hero) => applyAction(w, 1, { type: 'order', ids: [hero.id], order: 'attack', point: { x: u.x, z: u.z }, target: u.id });
  assert.equal(attack(ally), false); assert.equal(attack(enemy), true); assert.equal(attack(boss), true);
});

test('network inputs reject malformed coordinates, identifiers and prototype enum values', () => {
  const w = match(), hero = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  const before = JSON.stringify(w);
  for (const a of [null, [], {}, { type: 'order', ids: [hero.id], order: 'move', point: { x: NaN, z: 1 } },
    { type: 'order', ids: [hero.id], order: 'move', point: { x: 1, z: '3' } },
    { type: 'order', ids: 'all', order: 'hold' }, { type: 'formation', ids: [hero.id], formation: '__proto__' },
    { type: 'upgrade', building: 'constructor' }, { type: 'craft', item: 'toString' },
    { type: 'production', field: 'regiment', value: -1 }, { type: 'production', field: 'interval', value: .01 },
    { type: 'heroSetting', field: '__proto__', value: 'bad' }, { type: 'regimentSetting', indices: [999], field: 'priority', value: 'hero' }]) assert.equal(applyAction(w, 1, a), false);
  assert.equal(JSON.stringify(w), before);
  assert.equal(applyAction(w, 1, { type: 'order', ids: [hero.id], order: 'move', point: { x: 1e9, z: -1e9 } }), true);
  assert.ok(Number.isFinite(hero.goal.x) && Number.isFinite(hero.goal.z));
  assert.ok(hero.goal.x > 0 && hero.goal.x <= MAP.half && hero.goal.z < 0 && hero.goal.z >= -MAP.half);
});

test('production, hero settings and formations use the connection seat', () => {
  const w = match(), before = JSON.stringify(w.players[0]);
  assert.equal(applyAction(w, 1, { type: 'production', field: 'regiment', value: 8 }), true);
  assert.equal(applyAction(w, 1, { type: 'roster', kind: 'archer', delta: 1 }), true);
  assert.equal(applyAction(w, 1, { type: 'heroSetting', field: 'escortLayout', value: 'vanguard' }), true);
  assert.equal(applyAction(w, 1, { type: 'formation', ids: [], regiments: [8], formation: 'wall' }), true);
  assert.equal(w.players[1].production.regiment, 8); assert.equal(w.players[1].production.counts.archer, 1);
  assert.equal(w.players[1].escortLayout, 'vanguard');
  assert.equal(w.regiments.find(r => r.team === 1 && r.index === 8)!.formation, 'wall');
  assert.equal(w.regiments.find(r => r.team === 0 && r.index === 8)!.formation, 'line');
  assert.equal(JSON.stringify(w.players[0]), before);
});

test('gate and captured-base actions cannot spend money on a teammate territory', () => {
  const w = match(), before = w.players[1].gold;
  assert.equal(applyAction(w, 1, { type: 'gate', site: 0, action: 'toggle' }), false);
  assert.equal(applyAction(w, 1, { type: 'outpostRegiment', site: 0, index: 1 }), false);
  assert.equal(applyAction(w, 1, { type: 'outpost', site: 0, building: 'goldmine' }), false);
  assert.equal(w.players[1].gold, before);
  const wasOpen = w.gates.find(g => g.site === 1)!.open;
  assert.equal(applyAction(w, 1, { type: 'gate', site: 1, action: 'toggle' }), true);
  assert.equal(w.gates.find(g => g.site === 1)!.open, !wasOpen);
  assert.equal(w.players[1].gold, before - 20);
});

test('shared merchant purchases and paid hero training apply to the buyer only', () => {
  const w = match(), hero = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  Object.assign(hero, MAP.merchant); hero.hp = hero.maxHp / 2;
  const gold = w.players[1].gold, pool = w.merchantGold, other = JSON.stringify(w.players[0]);
  assert.equal(applyAction(w, 1, { type: 'consumable', item: 'healing' }), true);
  assert.ok(hero.hp > hero.maxHp / 2); assert.equal(w.players[1].gold, gold - 90); assert.equal(w.merchantGold, pool + 90);
  w.players[1].gold = 1000; w.players[1].ore = 100;
  assert.equal(applyAction(w, 1, { type: 'training', training: 'warfare' }), true);
  assert.equal(w.players[1].training.warfare, 1); assert.equal(JSON.stringify(w.players[0]), other);
});

test('network pause, eliminated players and AI seats cannot submit gameplay actions', () => {
  const w = match();
  assert.equal(applyAction(w, 1, { type: 'pause' }), false); assert.equal(w.paused, false);
  w.players[1].eliminated = true;
  assert.equal(applyAction(w, 1, { type: 'production', field: 'reserve', value: 200 }), false);
  w.players[2].controller = 'ai';
  assert.equal(applyAction(w, 2, { type: 'production', field: 'reserve', value: 200 }), false);
});
