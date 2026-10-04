import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, BOSS, MAP, type Ability, type Kind } from '../src/game/config';
import { cast } from '../src/game/abilities';
import { stepCombat } from '../src/game/combat';
import { gatePosition, garrisonUnit } from '../src/game/gates';
import { distance } from '../src/game/math';
import { stepObjectives } from '../src/game/objectives';
import { step } from '../src/game/simulation';
import { createWorld, spawn } from '../src/game/world';

function isolatedWorld() {
  const w = createWorld();
  w.aiEnabled = false;
  for (const p of w.players) { p.production.interval = 0; p.autoTracking = false; }
  w.units = []; w.effects = [];
  return w;
}

test('boss spawns at the arena center, equally distant from all four gated approaches', () => {
  const w = createWorld(), boss = w.units.find(u => u.kind === 'boss')!;
  assert.equal(boss.x, 0); assert.equal(boss.z, 0);
  const approachDistances = MAP.bases.map((_, site) => distance(boss, gatePosition(site)));
  assert.ok(Math.max(...approachDistances) - Math.min(...approachDistances) < 1e-6);
  assert.ok(approachDistances.every(d => d > MAP.boss.radius));
});

for (const ability of Object.keys(ABILITIES) as Ability[]) {
  test(`${ability} cast emits its own effect at the caster, matches its gameplay area and expires on schedule`, () => {
    const w = isolatedWorld(), p = w.players[0];
    const hero = spawn(w, 0, 'hero', { x: 15, z: 15 });
    const ally = spawn(w, 0, 'footman', { x: 18, z: 15 });
    const enemy = spawn(w, 1, 'hero', { x: 19, z: 15 });
    hero.hp = hero.maxHp / 2; ally.hp = ally.maxHp / 2;
    p.skills[ability] = 1; p.mana = 120;
    w.regiments[0].anchor = { x: hero.x, z: hero.z }; w.regiments[0].cohesion = 25;
    const hp = hero.hp, allyHp = ally.hp, enemyHp = enemy.hp;

    assert.equal(cast(w, 0, ability), true);
    const effects = w.effects.filter(e => e.kind === ability);
    assert.equal(effects.length, 1);
    const effect = effects[0];
    assert.equal(effect.source, hero.id); assert.equal(effect.height, 0);
    assert.deepEqual({ x: effect.x, z: effect.z }, { x: hero.x, z: hero.z });
    if (ability === 'wind') assert.ok(effect.radius > 0 && effect.radius < ABILITIES.cleave.radius);
    else assert.equal(effect.radius, ABILITIES[ability].radius);
    assert.ok(effect.duration! > 0 && effect.duration! < 2);
    assert.equal(effect.life, effect.duration);
    assert.equal(p.cooldowns[ability], ABILITIES[ability].cooldown);
    assert.equal(p.mana, 120 - ABILITIES[ability].cost);
    if (ability === 'rally') { assert.ok(p.rallyUntil > w.time); assert.ok(w.regiments[0].cohesion > 25); }
    if (ability === 'wind') assert.ok(hero.hp > hp);
    if (ability === 'cleave') assert.ok(enemy.hp < enemyHp);
    if (ability === 'warcry') assert.ok(p.warcryUntil > w.time);
    if (ability === 'standfast') assert.ok(p.standfastUntil > w.time);
    if (ability === 'ultimate') { assert.ok(hero.hp > hp); assert.ok(ally.hp > allyHp); assert.equal(w.regiments[0].cohesion, 100); }

    step(w, effect.duration! - .001);
    assert.ok(w.effects.includes(effect) && effect.life > 0);
    step(w, .002);
    assert.ok(!w.effects.includes(effect));
    assert.equal(cast(w, 0, ability), false);
    assert.equal(w.effects.filter(e => e.kind === ability).length, 0);
  });
}

test('basic combat emits melee strikes, arrows and musket shots from actual attacks', () => {
  const cases: { kind: Kind; style?: 'melee' | 'ranged'; separation: number; effect: 'melee' | 'arrow' | 'shot' }[] = [
    { kind: 'footman', separation: 2, effect: 'melee' },
    { kind: 'knight', separation: 2, effect: 'melee' },
    { kind: 'archer', separation: 6, effect: 'arrow' },
    { kind: 'musketeer', separation: 8, effect: 'shot' },
    { kind: 'hero', style: 'melee', separation: 2, effect: 'melee' },
    { kind: 'hero', style: 'ranged', separation: 2, effect: 'melee' },
    { kind: 'hero', style: 'ranged', separation: 6, effect: 'arrow' },
    { kind: 'boss', separation: 3, effect: 'melee' },
  ];
  for (const c of cases) {
    const w = isolatedWorld(), team = c.kind === 'boss' ? 4 : 0;
    const attacker = spawn(w, team, c.kind, { x: 0, z: 0 });
    const target = spawn(w, 1, 'hero', { x: c.separation, z: 0 });
    attacker.order = 'attack'; attacker.target = target.id; target.attackTimer = 100;
    if (c.style) w.players[0].combatStyle = c.style;
    const hp = target.hp;
    stepCombat(w, .05);
    assert.ok(target.hp < hp, `${c.kind}/${c.style ?? 'default'} must actually deal damage`);
    const effect = w.effects.find(e => e.source === attacker.id && e.target === target.id)!;
    assert.ok(effect); assert.equal(effect.kind, c.effect);
    assert.deepEqual(effect.to, { x: c.separation, z: 0 });
    assert.equal(effect.height, 0); assert.equal(effect.toHeight, 0);
    assert.equal(effect.life, effect.duration); assert.ok(effect.duration! > 0);
    w.effects = []; stepCombat(w, .05);
    assert.equal(w.effects.filter(e => e.source === attacker.id).length, 0, 'cooldown must prevent duplicate swing/projectile events');
  }
});

test('charged cavalry creates an impact event as well as its melee strike', () => {
  const w = isolatedWorld(), attacker = spawn(w, 0, 'knight', { x: 0, z: 0 });
  const target = spawn(w, 1, 'hero', { x: 2, z: 0 }); target.attackTimer = 100;
  w.regiments[0].engagement = 'charge'; w.regiments[0].formation = 'wedge';
  attacker.order = 'attack'; attacker.target = target.id; attacker.travel = 10;
  const hp = target.hp, cohesion = w.regiments.find(r => r.team === 1 && r.index === target.regiment)!.cohesion;
  stepCombat(w, .05);
  assert.ok(hp - target.hp > attacker.damage * 2);
  assert.ok(w.regiments.find(r => r.team === 1 && r.index === target.regiment)!.cohesion < cohesion);
  const impact = w.effects.find(e => e.kind === 'charge')!;
  assert.ok(impact); assert.equal(impact.source, attacker.id); assert.equal(impact.target, target.id);
  assert.equal(impact.x, 2); assert.equal(impact.z, 0);
  assert.ok(w.effects.some(e => e.kind === 'melee' && e.source === attacker.id));
});

test('tower projectiles preserve elevated origin and destination heights', () => {
  for (const elevatedShooter of [true, false]) {
    const w = createWorld(); w.aiEnabled = false;
    for (const p of w.players) { p.production.interval = 0; p.autoTracking = false; }
    const site = elevatedShooter ? 0 : 1, gate = w.gates[site], gateUnit = w.units.find(u => u.id === gate.id)!;
    gate.tower = true; gate.open = true;
    w.units = [gateUnit];
    const towerUnit = spawn(w, site, elevatedShooter ? 'hero' : 'archer', gatePosition(site));
    assert.equal(garrisonUnit(w, site, towerUnit.id, site), true);
    const groundUnit = spawn(w, elevatedShooter ? 1 : 0, 'musketeer', { x: towerUnit.x + 8, z: towerUnit.z });
    const attacker = elevatedShooter ? towerUnit : groundUnit, target = elevatedShooter ? groundUnit : towerUnit;
    attacker.order = 'attack'; attacker.target = target.id; target.attackTimer = 100;
    const hp = target.hp;
    stepCombat(w, .05);
    assert.ok(target.hp < hp);
    const effect = w.effects.find(e => e.source === attacker.id && e.target === target.id)!;
    assert.ok(effect); assert.equal(effect.kind, elevatedShooter ? 'arrow' : 'shot');
    assert.equal(effect.height, elevatedShooter ? 6.5 : 0);
    assert.equal(effect.toHeight, elevatedShooter ? 0 : 6.5);
  }
});

test('a tower hero casts an elevated special-ability effect', () => {
  const w = createWorld(), gate = w.gates[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero')!;
  gate.tower = true; Object.assign(hero, gatePosition(0));
  assert.equal(garrisonUnit(w, 0, hero.id), true);
  w.players[0].skills.standfast = 1;
  assert.equal(cast(w, 0, 'standfast'), true);
  const effect = w.effects.find(e => e.kind === 'standfast')!;
  assert.ok(effect); assert.equal(effect.source, hero.id); assert.equal(effect.height, 6.5);
});

test('boss warning precedes a bounded smash and uses the actual damage radius', () => {
  const w = isolatedWorld(), boss = spawn(w, 4, 'boss', MAP.boss);
  const nearby = spawn(w, 0, 'hero', { x: 4, z: 0 });
  const outside = spawn(w, 1, 'hero', { x: BOSS.smashRadius + 1, z: 0 });
  const hp = nearby.hp, outsideHp = outside.hp;
  w.bossTimer = BOSS.smashInterval - 1 - .05;
  stepObjectives(w, .1);
  const warning = w.effects.find(e => e.kind === 'boss-warning')!;
  assert.ok(warning); assert.equal(warning.source, boss.id); assert.equal(warning.radius, BOSS.smashRadius);
  assert.equal(warning.life, 1); assert.equal(warning.duration, 1);
  assert.equal(nearby.hp, hp); assert.ok(!w.effects.some(e => e.kind === 'boss-smash'));
  stepObjectives(w, .9);
  assert.equal(nearby.hp, hp);
  stepObjectives(w, .1);
  assert.equal(nearby.hp, hp - BOSS.smashDamage); assert.equal(outside.hp, outsideHp);
  const smash = w.effects.find(e => e.kind === 'boss-smash')!;
  assert.ok(smash); assert.equal(smash.source, boss.id); assert.equal(smash.radius, BOSS.smashRadius);
  assert.equal(smash.life, smash.duration); assert.ok(smash.duration! > 0);
  assert.equal(w.bossTimer, 0);
});
