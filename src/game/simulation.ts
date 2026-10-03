import type { World } from './types';
import { stepCombat } from './combat';
import { stepEconomy } from './economy';
import { stepAI } from './ai';
import { progressHero } from './hero';
export function step(w: World, dt: number) {
  if (w.paused || w.winner !== null) return;
  w.time += dt;
  stepEconomy(w, dt);
  stepAI(w, dt);
  stepCombat(w, dt);
  progressHero(w, dt);
  w.effects = w.effects.filter(e => (e.life -= dt) > 0);
}
