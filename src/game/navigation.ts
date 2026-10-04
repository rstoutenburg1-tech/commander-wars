import { MAP } from './config';
import { clamp, distance, moveToward } from './math';
import type { Point } from './types';
const center: Point = { x: 0, z: 0 };
export function projectSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return { x: a.x + dx * t, z: a.z + dz * t };
}
export function walkable(p: Point) {
  if (Math.abs(p.x) <= MAP.arenaHalf && Math.abs(p.z) <= MAP.arenaHalf) return true;
  for (const b of MAP.bases) {
    if (Math.abs(p.x - b.x) <= MAP.baseHalf && Math.abs(p.z - b.z) <= MAP.baseHalf) return true;
    if (distance(p, projectSegment(p, b, center)) <= MAP.laneWidth / 2) return true;
  }
  return false;
}
export function accessible(a: Point, b: Point) {
  const n = Math.max(1, Math.ceil(distance(a, b) / 3));
  for (let i = 0; i <= n; i++) if (!walkable({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n })) return false;
  return true;
}
export function projectWalkable(p: Point): Point {
  if (walkable(p)) return { x: p.x, z: p.z };
  const candidates = [{ x: clamp(p.x, -MAP.arenaHalf + 0.4, MAP.arenaHalf - 0.4), z: clamp(p.z, -MAP.arenaHalf + 0.4, MAP.arenaHalf - 0.4) }];
  for (const b of MAP.bases) {
    candidates.push({ x: clamp(p.x, b.x - MAP.baseHalf + 0.4, b.x + MAP.baseHalf - 0.4), z: clamp(p.z, b.z - MAP.baseHalf + 0.4, b.z + MAP.baseHalf - 0.4) });
    const q = projectSegment(p, b, center), d = distance(p, q), t = Math.min(1, (MAP.laneWidth / 2 - 0.4) / d);
    candidates.push({ x: q.x + (p.x - q.x) * t, z: q.z + (p.z - q.z) * t });
  }
  candidates.sort((a, b) => distance(a, p) - distance(b, p)); return candidates[0];
}
// Nine waypoints are enough for this four-corner layout; ravines cannot be crossed.
const nodes: Point[] = [center, ...MAP.bases.flatMap(b => [0.85, 0.45].map(t => ({ x: b.x * t, z: b.z * t })))];
const edges = nodes.map(a => nodes.map(b => accessible(a, b) ? distance(a, b) : Infinity));
export function route(a: Point, destination: Point): Point[] {
  const b = projectWalkable(destination);
  if (accessible(a, b)) return [b];
  const costs = nodes.map(n => accessible(a, n) ? distance(a, n) : Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
  for (let iter = 0; iter < nodes.length; iter++) {
    let at = -1; for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (at < 0 || costs[i] < costs[at])) at = i;
    if (at < 0 || !Number.isFinite(costs[at])) break;
    visited.add(at);
    for (let j = 0; j < nodes.length; j++) if (costs[at] + edges[at][j] < costs[j]) { costs[j] = costs[at] + edges[at][j]; previous[j] = at; }
  }
  let end = -1, best = Infinity;
  for (let i = 0; i < nodes.length; i++) if (accessible(nodes[i], b) && costs[i] + distance(nodes[i], b) < best) { end = i; best = costs[i] + distance(nodes[i], b); }
  const path = [b]; while (end >= 0) { path.unshift(nodes[end]); end = previous[end]; }
  return path;
}
// Reuse routes until their destination changes materially. Formation slots move every tick.
const routes = new WeakMap<Point, { target: Point; path: Point[] }>();
export function clearRoute(a: Point) { routes.delete(a); }
export function moveOnMap(a: Point, destination: Point, amount: number) {
  if (distance(a, destination) < 0.05) return;
  let cached = routes.get(a);
  if (!cached || distance(cached.target, destination) > 1.5) { cached = { target: { ...destination }, path: route(a, destination) }; routes.set(a, cached); }
  while (cached.path.length > 1 && distance(a, cached.path[0]) < 1) cached.path.shift();
  const waypoint = cached.path.length === 1 ? projectWalkable(destination) : cached.path[0];
  moveToward(a, waypoint, amount);
  if (!walkable(a)) Object.assign(a, projectWalkable(a));
}
