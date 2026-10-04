import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world';
import { GATES, MAP, OUTPOSTS, RULES, STATS, isTroop } from '../src/game/config';
import { gatePosition, gateSide, toggleGate, moveWithGates, blockingGate, buildTower, stepGates, garrisonUnit, repairGate } from '../src/game/gates';
import { buildOutpost, stepOutposts } from '../src/game/outposts';
import { damageUnit, kill, stepCombat } from '../src/game/combat';
import { command } from '../src/game/commands';
import { refreshStats } from '../src/game/hero';
import { selectedStructure, structureLevel } from '../src/game/structures';
import { gatherArmy } from '../src/game/formations';
const point = (site: number, side: number, lateral = 0) => {
  const c = gatePosition(site), b = MAP.bases[site], n = Math.hypot(b.x, b.z);
  return { x: c.x + b.x / n * side + b.z / n * lateral, z: c.z + b.z / n * side - b.x / n * lateral };
};
test('gates charge only their owner, stop both directions across the full lane and reopen passage', () => {
  const w = createWorld(), p = w.players[0], gold = p.gold;
  assert.equal(toggleGate(w, 1), false); assert.equal(p.gold, gold);
  assert.equal(toggleGate(w, 0), true); assert.equal(p.gold, gold - GATES.toggleGold);
  for (const lateral of [-11, 0, 11]) for (const side of [-1, 1]) {
    const a = point(0, side * 5, lateral), b = point(0, -side * 5, lateral), before = { ...a };
    assert.equal(blockingGate(w, a, b)?.id, w.gates[0].id); moveWithGates(w, a, b, 100); assert.deepEqual(a, before);
  }
  p.gold = 0; assert.equal(toggleGate(w, 0), false); p.gold = 20; assert.equal(toggleGate(w, 0), true); assert.equal(p.gold, 0);
  const a = point(0, 5), b = point(0, -5); moveWithGates(w, a, b, 100); assert.ok(gateSide(0, a) < 0);
});
test('closed enemy gate absorbs keep attack orders, blocks damage through it and can be breached', () => {
  const w = createWorld(), h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, base = w.units.find(u => u.team === 1 && u.kind === 'base')!, gate = w.units.find(u => u.id === w.gates[1].id)!;
  w.units = [h, base, gate]; Object.assign(h, point(1, -10)); h.goal = { ...h }; const hp = base.hp;
  damageUnit(w, base, h, 1000); assert.equal(base.hp, hp);
  command(w, new Set([h.id]), 'attack', base, base.id); for (let i = 0; i < 120; i++) stepCombat(w, .05);
  assert.equal(base.hp, hp); assert.ok(gate.hp < STATS.gate.hp); assert.ok(gateSide(1, h) <= 0);
  damageUnit(w, gate, h, 20000); assert.equal(gate.hp, 0); assert.equal(w.gates[1].open, true);
  command(w, new Set([h.id]), 'move', MAP.bases[1]); for (let i = 0; i < 100; i++) stepCombat(w, .05);
  assert.ok(gateSide(1, h) > 5);
});
test('tower construction is paid once, allows only three eligible nearby occupants and excludes them from escorts', () => {
  const w = createWorld(), p = w.players[0]; Object.assign(p, { gold: 4000, wood: 1000, ore: 1000 });
  assert.equal(buildTower(w, 1), false); assert.equal(buildTower(w, 0), true); assert.equal(p.gold, 4000 - GATES.tower.gold); assert.equal(buildTower(w, 0), false);
  stepGates(w, 29); assert.equal(w.gates[0].tower, false); stepGates(w, 1.1); assert.equal(w.gates[0].tower, true);
  const pos = point(0, 3), h = w.units.find(u => u.team === 0 && u.kind === 'hero')!; Object.assign(h, pos);
  const a = spawn(w, 0, 'archer', pos), m = spawn(w, 0, 'musketeer', pos), extra = spawn(w, 0, 'archer', pos), footman = spawn(w, 0, 'footman', pos);
  assert.equal(garrisonUnit(w, 0, footman.id), false); assert.equal(garrisonUnit(w, 0, a.id), true); assert.equal(garrisonUnit(w, 0, m.id), true); assert.equal(garrisonUnit(w, 0, h.id), true); assert.equal(garrisonUnit(w, 0, extra.id), false);
  gatherArmy(w); assert.equal(a.garrison, w.gates[0].id);
  command(w, new Set([a.id]), 'move', { x: 0, z: 0 }); assert.equal(a.garrison, undefined); assert.equal(w.gates[0].garrison.length, 2);
});
test('tower range, damage and protection work in combat; losing a gate dismounts survivors', () => {
  const w = createWorld(); w.gates[0].tower = true; w.gates[0].open = false;
  const a = spawn(w, 0, 'archer', point(0, 3)), enemy = spawn(w, 1, 'footman', point(0, -14)); enemy.attackTimer = 100;
  assert.equal(garrisonUnit(w, 0, a.id), true); const hp = enemy.hp; const gate = w.units.find(u => u.id === w.gates[0].id)!;
  w.units = [a, enemy, gate]; stepCombat(w, .05); assert.ok(Math.abs(hp - enemy.hp - STATS.archer.damage * GATES.damageBonus) < .001);
  const before = a.hp; damageUnit(w, a, enemy, 100); assert.ok(Math.abs(before - a.hp - 65) < .001);
  kill(w, gate, enemy); assert.equal(a.garrison, undefined); assert.equal(w.gates[0].garrison.length, 0); assert.equal(w.gates[0].tower, false); assert.ok(a.hp > 0);
});
test('destroying a keep transfers its ruined sites and allows paid local construction without altering the home base', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, base = w.units.find(u => u.team === 1 && u.kind === 'base')!;
  Object.assign(p, { gold: 3000, wood: 1000, ore: 1000 }); assert.equal(buildOutpost(w, 1, 'goldmine'), false);
  kill(w, base, h); const t = w.territories[1]; assert.equal(t.owner, 0); assert.equal(t.captured, true); assert.equal(w.winner, null);
  assert.equal(selectedStructure(w, new Set([base.id]))?.site, 1); assert.equal(w.structures.filter(s => s.site === 1 && s.team === 0).length, 6);
  const homeMine = p.goldmine, before = p.gold; assert.equal(buildOutpost(w, 1, 'goldmine'), true); assert.equal(p.gold, before - OUTPOSTS.goldmine.cost.gold); assert.equal(buildOutpost(w, 1, 'forest'), false);
  stepOutposts(w, 19); assert.equal(t.buildings.goldmine, 0); stepOutposts(w, 1.1); assert.equal(t.buildings.goldmine, 1); assert.equal(p.goldmine, homeMine);
  const gold = p.gold; stepOutposts(w, 5); assert.equal(p.gold, gold + 20);
  assert.equal(structureLevel(w, w.structures.find(s => s.site === 1 && s.building === 'goldmine')!), 1);
  assert.equal(buildOutpost(w, 1, 'goldmine'), false); assert.equal(buildOutpost(w, 2, 'quarry'), false);
  assert.equal(repairGate(w, 1), true); assert.equal(w.units.find(u => u.id === w.gates[1].id)!.team, 0);
  const gateHP = w.units.find(u => u.id === w.gates[1].id)!.hp; p.tier = 4; refreshStats(w, 0); assert.equal(w.units.find(u => u.id === w.gates[1].id)!.hp, gateHP);
});
test('captured barracks spawns paid local waves to its own regiment while respecting reserves and shared cap', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!; kill(w, w.units.find(u => u.team === 1 && u.kind === 'base')!, h);
  Object.assign(p, { gold: 3000, wood: 1000, ore: 1000 }); assert.equal(buildOutpost(w, 1, 'barracks'), true); stepOutposts(w, 25.1);
  const t = w.territories[1]; t.regiment = 8; p.gold = 90; t.spawnTimer = 0; const before = w.units.filter(u => u.team === 0 && isTroop(u.kind)).length;
  stepOutposts(w, .05); const local = w.units.filter(u => u.team === 0 && u.regiment === 8 && isTroop(u.kind)); assert.equal(local.length, 2); assert.ok(local.every(u => Math.hypot(u.x - MAP.bases[1].x, u.z - MAP.bases[1].z) < 26)); assert.equal(p.gold, 58);
  t.spawnTimer = 0; p.gold = 60; stepOutposts(w, .05); assert.equal(w.units.filter(u => u.team === 0 && isTroop(u.kind)).length, before + 2);
  for (let i = before + 2; i < RULES.armyCap; i++) spawn(w, 0, 'footman', MAP.bases[0]); p.gold = 1000; t.spawnTimer = 0; stepOutposts(w, .05); assert.equal(w.units.filter(u => u.team === 0 && isTroop(u.kind)).length, RULES.armyCap);
  p.production.interval = 0; t.spawnTimer = 0; stepOutposts(w, 25); assert.equal(t.spawnTimer, 0);
});
