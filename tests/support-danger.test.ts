import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/game/world';
import { MAP } from '../src/game/config';
import { supportReason, useSupport } from '../src/game/support';
test('an enemy keep prevents field resupply even without defending troops', () => {
  const w = createWorld(), p = w.players[0], h = w.units.find(u => u.team === 0 && u.kind === 'hero')!, keep = w.units.find(u => u.team === 1 && u.kind === 'base')!;
  w.units = [h, keep]; p.crafting = 1; p.gold = p.wood = p.ore = 1000;
  Object.assign(h, { x: MAP.bases[1].x + 12, z: MAP.bases[1].z, hp: 500 });
  assert.match(supportReason(w, 0, 'resupply')!, /Withdraw/); assert.equal(useSupport(w, 0, 'resupply'), false);
  assert.equal(p.gold, 1000); h.x = MAP.bases[1].x + 23;
  assert.equal(useSupport(w, 0, 'resupply'), true);
});
