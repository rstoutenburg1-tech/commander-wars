import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world';
import { stepAI } from '../src/game/ai';
import { stepEconomy } from '../src/game/economy';
import { stepOutposts } from '../src/game/outposts';
import { stepGates } from '../src/game/gates';
import { stepObjectives } from '../src/game/objectives';
import { progressHero } from '../src/game/hero';
import { MAP, RULES, isTroop } from '../src/game/config';

function developed(w: ReturnType<typeof createWorld>, team: number, tier = 1) {
  const p = w.players[team];
  Object.assign(p, { tier, barracks: tier === 1 ? 2 : 3, forest: Math.min(3, tier), quarry: Math.min(3, tier), goldmine: Math.min(3, tier), crafting: tier === 1 ? 1 : 2, gold: 3000, wood: 2000, ore: 2000, aiTimer: 0 });
  return p;
}

test('bots choose distinct affordable openings without granting hero levels', () => {
  const w = createWorld(); w.time = 100;
  for (const team of [1, 2, 3]) developed(w, team);
  stepAI(w, .05);
  assert.deepEqual(w.players[1].production.counts, { footman: 3, archer: 1, musketeer: 0, knight: 0 });
  assert.deepEqual(w.players[2].production.counts, { footman: 2, archer: 0, musketeer: 2, knight: 0 });
  assert.deepEqual(w.players[3].production.counts, { footman: 2, archer: 2, musketeer: 0, knight: 0 });
  assert.equal(w.players[1].production.interval, 20);
  assert.equal(w.players[2].production.interval, 30);
  assert.ok(w.players.slice(1).every(p => p.level === 1 && p.highestLevel === 1));
});

test('nearby cavalry changes reinforcements but distant enemy composition does not', () => {
  const w = createWorld(), p = developed(w, 3, 2); w.time = 250;
  const enemies = [spawn(w, 0, 'knight', { x: 100, z: 95 }), spawn(w, 0, 'knight', { x: 102, z: 95 })];
  stepAI(w, .05);
  assert.deepEqual(p.production.counts, { footman: 2, archer: 0, musketeer: 2, knight: 0 });
  assert.equal(w.regiments.find(r => r.team === 3 && r.index === 0)!.formation, 'wall');
  assert.equal(w.regiments.find(r => r.team === 3 && r.index === 1)!.formation, 'line');
  for (const u of enemies) Object.assign(u, MAP.bases[0]);
  p.aiTimer = 0; stepAI(w, .05);
  assert.deepEqual(p.production.counts, { footman: 1, archer: 2, musketeer: 0, knight: 1 });
});

test('bots save upgrade materials while retaining gold-only reinforcements', () => {
  const w = createWorld(), p = developed(w, 2); w.time = 220;
  Object.assign(p, { gold: 100, wood: 75, ore: 55 });
  stepAI(w, .05);
  assert.equal(p.production.reserve, 240);
  assert.deepEqual(p.production.counts, { footman: 4, archer: 0, musketeer: 0, knight: 0 });
  assert.equal(p.upgrades.length, 0);
  w.time += 30; stepEconomy(w, 30); stepAI(w, 30);
  w.time += 8; stepEconomy(w, 8); stepAI(w, 8);
  assert.ok(p.upgrades.some(j => j.building === 'base'));
  assert.ok(p.gold >= 0 && p.wood >= 0 && p.ore >= 0);
});

test('attacking bots place ranged regiments behind infantry and cavalry on a flank', () => {
  const w = createWorld(); developed(w, 3, 2); w.time = 250;
  const hero = w.units.find(u => u.team === 3 && u.kind === 'hero')!;
  Object.assign(hero, { x: 0, z: 45 });
  for (let i = 0; i < 8; i++) spawn(w, 3, i < 4 ? 'archer' : 'knight', { x: i, z: 45 });
  stepAI(w, .05);
  const front = w.regiments.find(r => r.team === 3 && r.index === 0)!;
  const ranged = w.regiments.find(r => r.team === 3 && r.index === 1)!;
  const cavalry = w.regiments.find(r => r.team === 3 && r.index === 2)!;
  assert.deepEqual(front.goal, { x: 32, z: 32 });
  const length = Math.hypot(front.goal.x - hero.x, front.goal.z - hero.z);
  const direction = { x: (front.goal.x - hero.x) / length, z: (front.goal.z - hero.z) / length };
  assert.ok(Math.abs((ranged.goal.x - front.goal.x) * direction.x + (ranged.goal.z - front.goal.z) * direction.z + 8) < .001);
  assert.ok(Math.abs((cavalry.goal.x - front.goal.x) * direction.x + (cavalry.goal.z - front.goal.z) * direction.z) < .001);
  assert.ok(Math.abs(Math.hypot(cavalry.goal.x - front.goal.x, cavalry.goal.z - front.goal.z) - 8) < .001);
  assert.ok(Math.hypot(front.goal.x - MAP.boss.x, front.goal.z - MAP.boss.z) > MAP.boss.radius + 10);
  assert.equal(front.formation, 'line'); assert.equal(ranged.formation, 'line'); assert.equal(cavalry.formation, 'wedge');
});

test('AI resupply heals a withdrawn army and waits when an enemy remains nearby', () => {
  const w = createWorld(), p = developed(w, 2); w.time = 100;
  const hero = w.units.find(u => u.team === 2 && u.kind === 'hero')!;
  const troops = w.units.filter(u => u.team === 2 && isTroop(u.kind));
  for (const u of troops) u.hp = u.maxHp * .5;
  stepAI(w, .05);
  assert.ok(troops.every(u => u.hp > u.maxHp * .5));
  assert.ok(p.supportReady.resupply > w.time);
  w.time = 200; p.aiTimer = 0;
  for (const u of troops) u.hp = u.maxHp * .3;
  spawn(w, 0, 'footman', { x: hero.x + 20, z: hero.z });
  const ready = p.supportReady.resupply; stepAI(w, .05);
  assert.equal(p.supportReady.resupply, ready);
  assert.ok(troops.every(u => u.hp === u.maxHp * .3));
});

test('AI buys siege ammunition near an enemy structure with a ranged assault force', () => {
  const w = createWorld(), p = developed(w, 1, 4); w.time = 400;
  const hero = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  Object.assign(hero, { x: MAP.bases[3].x - 16, z: MAP.bases[3].z });
  for (let i = 0; i < 3; i++) spawn(w, 1, 'archer', { x: hero.x - i, z: hero.z });
  stepAI(w, .05);
  assert.ok(p.siegeUntil > w.time);
  const until = p.siegeUntil;
  p.crafting = 1; p.aiTimer = 0; p.supportReady.siege = 0; w.time = 500;
  stepAI(w, .05);
  assert.equal(p.siegeUntil, until);
});

test('twenty-minute bot economy sustains replacements and advances material production without debt', () => {
  const w = createWorld(); w.players[0].production.interval = 0;
  // Exercise real purchasing and recruitment with steady troop losses. Movement
  // and combat are covered separately; one-second ticks avoid a long renderless match.
  for (let second = 1; second <= 1200; second++) {
    w.time = second;
    if (second >= 240 && second % 30 === 0) {
      for (const team of [1, 2, 3]) {
        const lost = new Set(w.units.filter(u => u.team === team && isTroop(u.kind)).slice(0, 4).map(u => u.id));
        w.units = w.units.filter(u => !lost.has(u.id));
      }
    }
    stepEconomy(w, 1); stepOutposts(w, 1); stepGates(w, 1); stepAI(w, 1); progressHero(w, 1); stepObjectives(w, 1);
    for (const p of w.players) assert.ok(p.gold >= 0 && p.wood >= 0 && p.ore >= 0);
  }
  for (const p of w.players.slice(1)) {
    assert.ok(p.tier >= 3, `team ${p.id} stalled at keep ${p.tier}`);
    assert.ok(p.forest >= 2 && p.quarry >= 2 && p.goldmine >= 2);
    assert.equal(p.level, 1); assert.equal(p.highestLevel, 1);
    const army = w.units.filter(u => u.team === p.id && isTroop(u.kind));
    assert.ok(army.length >= RULES.ai.minAttackArmy && army.length <= RULES.armyCap);
    assert.ok(new Set(army.map(u => u.kind)).size >= 2);
  }
});
