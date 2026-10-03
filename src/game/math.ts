import type { Point } from './types';
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function moveToward(a: Point, b: Point, amount: number) {
  const d = distance(a, b);
  if (d < 0.01) return;
  const t = Math.min(1, amount / d);
  a.x += (b.x - a.x) * t; a.z += (b.z - a.z) * t;
}
