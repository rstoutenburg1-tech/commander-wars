import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, spawn } from '../src/game/world.ts';
import { allied, enemies, defaultSettings, validateSettings, AI_DIFFICULTIES, localPlayer } from '../src/game/match.ts';
import { damageUnit, kill, stepCombat } from '../src/game/combat.ts';
import { cast } from '../src/game/abilities.ts';
import { stepAI } from '../src/game/ai.ts';
import { useSupport, supportReason } from '../src/game/support.ts';
import { step } from '../src/game/simulation.ts';

function teams() {
  const settings = defaultSettings();
  settings.slots.forEach((slot, index) => { slot.alliance = Math.floor(index / 2); });
  return settings;
}

test('match settings are validated, copied and preserve single-player defaults', () => {
  const settings = defaultSettings(), w = createWorld();
  assert.deepEqual(w.players.map(p => p.controller), ['human', 'ai', 'ai', 'ai']);
  assert.deepEqual(w.players.map(p => p.alliance), [0, 1, 2, 3]);
  assert.equal(localPlayer(w), 0); w.localPlayer = 2; assert.equal(localPlayer(w), 2);
  const copy = validateSettings(settings); copy.slots[0].name = 'Changed'; assert.notEqual(settings.slots[0].name, 'Changed');
  const invalid: unknown[] = [null, {}, { slots: [] }, { ...settings, extra: true }];
  for (const field of ['controller', 'alliance', 'difficulty', 'name'] as const) {
    const bad = structuredClone(settings);
    Object.assign(bad.slots[0], { [field]: field === 'alliance' ? 4 : '' }); invalid.push(bad);
  }
  for (const value of invalid) assert.throws(() => validateSettings(value));
  settings.slots[2].name = '<Alice>'; assert.equal(validateSettings(settings).slots[2].name, '<Alice>');
});

test('closed sections contain no attackable units, buildings or capturable territory', () => {
  const settings = defaultSettings(); settings.slots[2].controller = 'closed'; settings.slots[3].controller = 'closed';
  const w = createWorld(settings);
  assert.ok(w.players[2].eliminated && w.players[3].eliminated);
  assert.ok(w.units.every(u => u.team !== 2 && u.team !== 3));
  assert.ok(w.structures.every(s => s.team !== 2 && s.team !== 3));
  assert.ok(w.gates.every(g => g.site !== 2 && g.site !== 3));
  assert.equal(w.territories[2].owner, null); assert.equal(w.territories[2].captured, false);
  assert.equal(enemies(w, 0, 2), false); assert.equal(enemies(w, 0, 4), true);
  const gold = w.players[2].gold; step(w, .05); assert.equal(w.players[2].gold, gold);
});

test('allied direct damage, kills and exact or automatic attack targets are rejected', () => {
  const w = createWorld(teams()), hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!, ally = w.units.find(u => u.team === 1 && u.kind === 'hero')!;
  w.units = [hero, ally]; Object.assign(hero, { x: 0, z: 25, goal: { x: 0, z: 25 }, target: ally.id }); Object.assign(ally, { x: 0, z: 27, goal: { x: 0, z: 27 } });
  assert.equal(allied(w, 0, 1), true); assert.equal(enemies(w, 0, 1), false);
  const hp = ally.hp, gold = w.players[0].gold;
  damageUnit(w, ally, hero, 10000); kill(w, ally, hero); stepCombat(w, .05);
  assert.equal(ally.hp, hp); assert.equal(hero.hp, hero.maxHp); assert.equal(w.players[0].gold, gold); assert.equal(w.players[1].respawn, 0);
  assert.equal(hero.autoTarget, undefined);
  const enemy = spawn(w, 2, 'hero', { x: 0, z: 28 }); enemy.attackTimer = 100;
  stepCombat(w, .05); assert.ok(enemy.hp < enemy.maxHp); assert.equal(hero.autoTarget, enemy.id);
});

test('cleave excludes allied seats while ultimate and supplies heal nearby teammates', () => {
  const w = createWorld(teams()), hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!, ally = w.units.find(u => u.team === 1 && u.kind === 'footman')!, enemy = w.units.find(u => u.team === 2 && u.kind === 'footman')!;
  w.units = [hero, ally, enemy]; Object.assign(hero, { x: 0, z: 25 }); Object.assign(ally, { x: 2, z: 25 }); Object.assign(enemy, { x: -2, z: 25 });
  w.players[0].skills.cleave = 1; const hp = ally.hp;
  assert.equal(cast(w, 0, 'cleave'), true); assert.equal(ally.hp, hp); assert.ok(enemy.hp < enemy.maxHp);
  w.units = [hero, ally]; ally.hp = ally.maxHp / 2;
  w.players[0].skills.ultimate = 1; w.players[0].mana = 120;
  assert.equal(cast(w, 0, 'ultimate'), true); assert.equal(ally.hp, ally.maxHp * .75);
  w.players[0].crafting = 1; w.players[0].wood = 200; w.players[0].ore = 200;
  const r = w.regiments.find(r => r.team === 1 && r.index === ally.regiment)!; r.cohesion = 20;
  assert.equal(supportReason(w, 0, 'resupply'), null); assert.equal(useSupport(w, 0, 'resupply'), true);
  assert.equal(ally.hp, ally.maxHp * .95); assert.ok(r.cohesion > 20);
});

test('allied timed combat auras work across seats and do not stack', () => {
  const w = createWorld(teams()), hero0 = w.units.find(u => u.team === 0 && u.kind === 'hero')!, hero1 = w.units.find(u => u.team === 1 && u.kind === 'hero')!, ally = w.units.find(u => u.team === 1 && u.kind === 'footman')!, attacker = w.units.find(u => u.team === 2 && u.kind === 'hero')!;
  w.units = [hero0, hero1, ally, attacker];
  for (const [index, u] of w.units.entries()) Object.assign(u, { x: index * 2, z: 25 });
  ally.regiment = 8; w.regiments.find(r => r.team === 1 && r.index === 8)!.cohesion = 0;
  w.players[0].skills.standfast = 1; w.players[0].standfastUntil = 10;
  w.players[1].skills.standfast = 1; w.players[1].standfastUntil = 10;
  const hp = ally.hp; damageUnit(w, ally, attacker, 100); assert.equal(hp - ally.hp, 75);
  w.players[0].skills.rally = 1; w.players[0].rallyUntil = 10; w.players[1].rallyUntil = 0;
  w.players[0].skills.warcry = 1; w.players[0].warcryUntil = 10;
  ally.target = attacker.id; attacker.attackTimer = 100; hero0.attackTimer = hero1.attackTimer = 100;
  ally.x = attacker.x - 1; const targetHp = attacker.hp; stepCombat(w, .05);
  assert.ok(attacker.hp < targetHp - ally.damage); assert.ok(ally.attackTimer < ally.cooldown);
});

test('2v2 keeps playing after either allied keep falls and wins only after opposing alliance falls', () => {
  const w = createWorld(teams()), attacker = w.units.find(u => u.team === 2 && u.kind === 'hero')!;
  kill(w, w.units.find(u => u.team === 0 && u.kind === 'base')!, attacker);
  assert.equal(w.winner, null); assert.equal(w.players[0].eliminated, true); assert.equal(w.players[1].eliminated, false);
  assert.equal(w.territories[0].owner, 2);
  kill(w, w.units.find(u => u.team === 1 && u.kind === 'base')!, attacker);
  assert.equal(w.winner, 2); assert.equal(w.players[3].eliminated, false);
});

test('all human seats are never AI-controlled and the first seat can be an AI', () => {
  const settings = defaultSettings(); settings.slots.forEach(slot => slot.controller = 'human');
  const w = createWorld(settings), before = structuredClone(w.players);
  stepAI(w, .05); assert.deepEqual(w.players, before);
  settings.slots[0].controller = 'ai'; settings.slots[0].difficulty = 'hard';
  const ai = createWorld(settings); ai.time = 120;
  for (let i = 0; i < 10; i++) spawn(ai, 0, 'footman', { x: -78, z: 78 });
  stepAI(ai, .05); assert.equal(ai.players[0].aiState, 'Attack'); assert.equal(ai.players[1].aiState, 'Muster');
});

test('AI difficulty changes reaction and attack timing without changing starting resources or unit strength', () => {
  const states: string[] = [];
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const settings = defaultSettings(); settings.slots[1].difficulty = difficulty;
    const w = createWorld(settings), p = w.players[1], baseline = createWorld().players[1];
    assert.deepEqual([p.gold, p.wood, p.ore], [baseline.gold, baseline.wood, baseline.ore]);
    assert.equal(w.units.find(u => u.team === 1 && u.kind === 'hero')!.damage, createWorld().units.find(u => u.team === 1 && u.kind === 'hero')!.damage);
    for (let i = 0; i < 12; i++) spawn(w, 1, 'footman', { x: -78, z: -78 });
    w.time = 120; stepAI(w, .05); states.push(p.aiState);
    assert.equal(p.aiTimer, AI_DIFFICULTIES[difficulty].thinkInterval);
  }
  assert.deepEqual(states, ['Muster', 'Muster', 'Attack']);
});

test('AI treats allied armies as friendly instead of defending or adapting against them', () => {
  const w = createWorld(teams()), hero = w.units.find(u => u.team === 1 && u.kind === 'hero')!, ally = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  Object.assign(ally, { x: hero.x - 2, z: hero.z });
  stepAI(w, .05); assert.equal(w.players[1].aiState, 'Muster');
  assert.equal(w.units.find(u => u.team === 1 && u.kind === 'hero')!.target, undefined);
});
