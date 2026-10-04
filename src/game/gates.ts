import { MAP, GATES } from './config';
import type { Gate, Point, Unit, World } from './types';
import { distance } from './math';
import { moveOnMap, projectWalkable } from './navigation';
import { afford, pay } from './economy';
import { notify, spawn } from './world';
export const gatePosition = (site: number): Point => ({ x: MAP.bases[site].x * 0.64, z: MAP.bases[site].z * 0.64 });
export function gateSide(site: number, p: Point) {
  const center = gatePosition(site), base = MAP.bases[site], length = Math.hypot(base.x, base.z);
  return ((p.x - center.x) * base.x + (p.z - center.z) * base.z) / length;
}
// Every gate spans the only walkable approach between a corner and the arena.
export function blockingGate(w: World, a: Point, b: Point, ignore?: number | number[]): Unit | undefined {
  let nearest: Unit | undefined, best = Infinity;
  for (const g of w.gates) {
    if (g.open || (Array.isArray(ignore) ? ignore.includes(g.id) : g.id === ignore)) continue;
    const unit = w.units.find(u => u.id === g.id && u.hp > 0); if (!unit) continue;
    const from = gateSide(g.site, a), to = gateSide(g.site, b);
    if (from * to > 0 || Math.abs(from - to) < 0.0001) continue;
    const t = from / (from - to), cross = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    if (distance(cross, unit) > MAP.laneWidth / 2 + 1.5) continue;
    const d = distance(a, cross); if (d < best) { nearest = unit; best = d; }
  }
  return nearest;
}
export function moveWithGates(w: World, a: Point, destination: Point, amount: number) {
  const before = { ...a }; moveOnMap(a, destination, amount);
  if (blockingGate(w, before, a)) { a.x = before.x; a.z = before.z; }
}
export function toggleGate(w: World, site: number, team = 0) {
  const g = w.gates.find(g => g.site === site), p = w.players[team];
  if (!g || g.owner !== team || p.eliminated || !w.units.some(u => u.id === g.id && u.hp > 0) || p.gold < GATES.toggleGold) return false;
  p.gold -= GATES.toggleGold; g.open = !g.open;
  if (team === 0) notify(w, `Gate ${g.open ? 'opened' : 'closed'} · ${GATES.toggleGold} gold.`); return true;
}
export function towerReason(w: World, site: number, team = 0) {
  const g = w.gates.find(g => g.site === site);
  return !g || g.owner !== team || w.players[team].eliminated ? 'Not your gate' : !w.units.some(u => u.id === g.id && u.hp > 0) ? 'Rebuild the gate first' : g.tower ? 'Tower already built' : g.towerRemaining > 0 ? 'Tower under construction' : !afford(w.players[team], GATES.tower) ? 'Need 900 gold / 150 wood / 120 ore' : null;
}
export function buildTower(w: World, site: number, team = 0) {
  if (towerReason(w, site, team)) return false;
  pay(w.players[team], GATES.tower); w.gates.find(g => g.site === site)!.towerRemaining = GATES.towerTime; return true;
}
export function repairGate(w: World, site: number, team = 0) {
  const g = w.gates.find(g => g.site === site);
  if (!g || g.owner !== team || w.players[team].eliminated || w.units.some(u => u.id === g.id && u.hp > 0) || !afford(w.players[team], GATES.repair)) return false;
  pay(w.players[team], GATES.repair);
  const u = spawn(w, team, 'gate', gatePosition(site)); u.facing = Math.atan2(MAP.bases[site].x, MAP.bases[site].z);
  g.id = u.id; g.open = true; g.tower = false; g.towerRemaining = 0; return true;
}
export const canGarrison = (u: Unit) => u.kind === 'hero' || u.kind === 'archer' || u.kind === 'musketeer';
export function leaveTower(w: World, u: Unit) {
  if (u.garrison === undefined) return;
  const g = w.gates.find(g => g.id === u.garrison);
  if (g) g.garrison = g.garrison.filter(id => id !== u.id);
  if (g && u.hp > 0) { const center = gatePosition(g.site), base = MAP.bases[g.site], length = Math.hypot(base.x, base.z); Object.assign(u, projectWalkable({ x: center.x + base.x / length * 3, z: center.z + base.z / length * 3 })); }
  u.garrison = undefined; u.order = 'hold'; u.goal = { x: u.x, z: u.z }; u.target = undefined; u.autoTarget = undefined; u.tactical = true;
}
export function garrisonUnit(w: World, site: number, id: number, team = 0) {
  const g = w.gates.find(g => g.site === site), u = w.units.find(u => u.id === id && u.hp > 0);
  const gate = g && w.units.find(u => u.id === g.id && u.hp > 0);
  if (!g || !gate || g.owner !== team || !g.tower || !u || u.team !== team || !canGarrison(u) || u.garrison !== undefined || g.garrison.length >= GATES.capacity || distance(u, gate) > 14) return false;
  u.garrison = g.id; g.garrison.push(u.id); u.order = 'hold'; u.target = undefined; u.autoTarget = undefined; u.tactical = true; positionGarrison(g, u); return true;
}
function positionGarrison(g: Gate, u: Unit) {
  const center = gatePosition(g.site), base = MAP.bases[g.site], angle = Math.atan2(base.x, base.z), offset = (g.garrison.indexOf(u.id) - 1) * 2.2;
  Object.assign(u, projectWalkable({ x: center.x + Math.cos(angle) * offset, z: center.z - Math.sin(angle) * offset })); u.goal = { x: u.x, z: u.z };
}
export function stepGates(w: World, dt: number) {
  for (const g of w.gates) {
    const gate = w.units.find(u => u.id === g.id && u.hp > 0);
    g.garrison = g.garrison.filter(id => w.units.some(u => u.id === id && u.hp > 0 && u.garrison === g.id));
    if (!gate) {
      g.open = true; g.tower = false; g.towerRemaining = 0;
      for (const id of [...g.garrison]) { const u = w.units.find(u => u.id === id); if (u) leaveTower(w, u); }
      continue;
    }
    if (g.towerRemaining > 0 && (g.towerRemaining -= dt) <= 0) { g.tower = true; g.towerRemaining = 0; if (g.owner === 0) notify(w, 'Gate tower ready · station up to three archers, musketeers or heroes.'); }
    for (const id of g.garrison) { const u = w.units.find(u => u.id === id)!; positionGarrison(g, u); }
  }
}
