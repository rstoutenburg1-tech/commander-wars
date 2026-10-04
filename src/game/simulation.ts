import type { World } from './types';
import { stepCombat } from './combat';
import { stepEconomy } from './economy';
import { stepAI } from './ai';
import { progressHero } from './hero';
import { stepRegiments } from './formations';
import { stepObjectives } from './objectives';
import { stepGates } from './gates';
import { stepOutposts } from './outposts';
export function step(w: World, dt: number) {
  if (w.paused || w.winner !== null) return;
  w.time += dt;
  stepEconomy(w, dt);
  stepOutposts(w, dt);
  stepGates(w, dt);
  stepAI(w, dt);
  stepRegiments(w, dt);
  stepCombat(w, dt);
  progressHero(w, dt);
  stepObjectives(w, dt);
  w.effects = w.effects.filter(e => (e.life -= dt) > 0);
}
