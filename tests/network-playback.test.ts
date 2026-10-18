import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotPlayback } from '../src/network/playback';
import { createWorld } from '../src/game/world';

test('10Hz snapshots produce continuous movement/shortest-angle turns without changing game state', () => {
  const playback = new SnapshotPlayback(), world = createWorld();
  const hero = world.units.find(unit => unit.kind === 'hero')!;
  hero.x = 0; hero.z = 0; hero.facing = Math.PI - .1;
  const samples: number[] = [];
  for (let ms = 0; ms <= 1000; ms += 10) {
    if (ms % 100 === 0) { world.time = ms / 1000; hero.x = world.time * 4; hero.facing = ms ? -Math.PI + .1 : Math.PI - .1; playback.push(world, ms); }
    const rendered = playback.sample(world, ms), unit = rendered.units.find(unit => unit.id === hero.id)!;
    samples.push(unit.x);
    assert.equal(hero.x, world.time * 4, 'visual smoothing must not change authoritative coordinates');
    assert.ok(Math.abs(unit.facing) > 3, 'turn through pi instead of spinning around through zero');
  }
  const steps = samples.slice(1).map((position, index) => position - samples[index]);
  assert.ok(steps.filter(step => step > .001).length > 75, 'movement advances between snapshots rather than just 10 times per second');
  assert.ok(steps.every(step => step >= -1e-8 && step < .1), 'no backwards correction or full snapshot-sized jumps');
});

test('jitter, missing packets and reconnects never rewind or extrapolate through unseen combat', () => {
  const playback = new SnapshotPlayback(), world = createWorld(), hero = world.units.find(unit => unit.kind === 'hero')!;
  hero.x = 0; hero.z = 0; playback.push(world, 0);
  let time = 0;
  for (let ms = 10; ms <= 1400; ms += 10) {
    if ([120, 190, 370, 440].includes(ms)) { world.time += .1; hero.x = world.time * 4; playback.push(world, ms); }
    const frame = playback.sample(world, ms);
    assert.ok(frame.time >= time); assert.ok(frame.time <= world.time);
    assert.ok(frame.units.find(unit => unit.id === hero.id)!.x <= hero.x);
    time = frame.time;
  }
  assert.equal(time, world.time, 'a stopped connection freezes at the last real update');
  world.time = 30; hero.x = 80; playback.push(world, 1500, true);
  const resumed = playback.sample(world, 1500);
  assert.equal(resumed.time, 30); assert.equal(resumed.units.find(unit => unit.id === hero.id)!.x, 80);
});

test('spell/projectile playback advances between packets, preserves identity and ends once', () => {
  const playback = new SnapshotPlayback(), world = createWorld();
  world.time = 1; world.effects = [{ x: 0, z: 0, to: { x: 5, z: 5 }, source: 1, target: 2, kind: 'arrow', life: .4, duration: .5, radius: .3, color: '#ffffff' }];
  playback.push(world, 0);
  const originalLife = world.effects[0].life, effect = playback.sample(world, 0).effects[0];
  world.time = 1.1; world.effects[0].life = .3; playback.push(world, 100);
  const first = playback.sample(world, 100).effects[0], life = first.life;
  const next = playback.sample(world, 116).effects[0];
  assert.equal(effect, first); assert.equal(next, first); assert.ok(next.life < life);
  assert.equal(world.effects[0].life, .3); assert.equal(originalLife, .4);
  world.time = 1.6; world.effects = []; playback.push(world, 600);
  for (let ms = 600; ms <= 1400; ms += 16) playback.sample(world, ms);
  assert.equal(playback.sample(world, 1400).effects.length, 0);
});

test('garrison transitions and genuine teleports do not interpolate through walls or towers', () => {
  const playback = new SnapshotPlayback(), world = createWorld(), hero = world.units.find(unit => unit.kind === 'hero')!;
  playback.push(world, 0); hero.x += 40; world.time = .1; playback.push(world, 100);
  assert.equal(playback.sample(world, 110).units.find(unit => unit.id === hero.id)!.x, hero.x);
  hero.garrison = 20; hero.x += 1; world.time = .2; playback.push(world, 200);
  assert.equal(playback.sample(world, 210).units.find(unit => unit.id === hero.id)!.x, hero.x);
});
