import { MAP, OUTPOSTS, RULES, isTroop, troopKinds, type OutpostBuilding } from './config';
import type { World } from './types';
import { afford, pay, unlocked, recruit } from './economy';
import { spawn, notify } from './world';
import { buildingPosition } from './structures';
import { localPlayer } from './match';
export function captureTerritory(w: World, site: number, team: number) {
  const t = w.territories[site]; t.owner = team; t.captured = true;
  t.buildings = { barracks: 0, goldmine: 0, forest: 0, quarry: 0 }; t.construction = undefined; t.spawnTimer = RULES.spawnInterval;
  for (const s of w.structures.filter(s => s.site === site)) s.team = team;
  const g = w.gates.find(g => g.site === site); if (g) { g.owner = team; g.open = true; g.tower = false; g.towerRemaining = 0; g.garrison = []; }
  if (team === 0) notify(w, 'Enemy territory captured. Select its ruined keep or Captured bases to build an outpost.');
}
export function outpostReason(w: World, site: number, building: OutpostBuilding, team = localPlayer(w)) {
  const t = w.territories[site];
  return !t?.captured || t.owner !== team || w.players[team].eliminated ? 'Capture this keep first' : t.buildings[building] ? 'Already built' : t.construction ? 'Construction in progress' : !afford(w.players[team], OUTPOSTS[building].cost) ? 'Insufficient resources' : null;
}
export function buildOutpost(w: World, site: number, building: OutpostBuilding, team = localPlayer(w)) {
  if (outpostReason(w, site, building, team)) return false;
  pay(w.players[team], OUTPOSTS[building].cost); w.territories[site].construction = { building, remaining: OUTPOSTS[building].time, total: OUTPOSTS[building].time }; return true;
}
export function stepOutposts(w: World, dt: number) {
  for (const t of w.territories) {
    if (!t.captured || t.owner === null || w.players[t.owner].eliminated) continue;
    const p = w.players[t.owner];
    if (t.construction && (t.construction.remaining -= dt) <= 0) { t.buildings[t.construction.building] = 1; if (p.id === 0) notify(w, `Captured base ${t.site + 1}: ${t.construction.building} ready.`); t.construction = undefined; }
    p.gold += t.buildings.goldmine * RULES.incomeRates.goldmine[1] * dt; p.wood += t.buildings.forest * RULES.incomeRates.forest[1] * dt; p.ore += t.buildings.quarry * RULES.incomeRates.quarry[1] * dt;
    if (!t.buildings.barracks || p.production.interval === 0) continue;
    t.spawnTimer -= dt; if (t.spawnTimer > 0) continue; t.spawnTimer = p.production.interval;
    let count = w.units.filter(u => u.team === p.id && u.hp > 0 && isTroop(u.kind)).length;
    for (const kind of troopKinds) for (let i = 0; unlocked(p, kind) && i < p.production.counts[kind]; i++) {
      if (count >= RULES.armyCap || !recruit(p, kind)) continue;
      const pos = buildingPosition(t.site, 'barracks'); pos.x += (count % 4) * 1.8; pos.z += 6;
      spawn(w, p.id, kind, pos, t.regiment); count++;
    }
  }
}
