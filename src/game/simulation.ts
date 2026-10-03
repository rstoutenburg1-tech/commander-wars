import type { World } from './types';
import { stepCombat } from './combat';
export function step(w: World, dt: number) {
  if (w.paused || w.winner !== null) return;
  w.time += dt;
  stepCombat(w, dt);
  w.effects = w.effects.filter(e => (e.life -= dt) > 0);
}
