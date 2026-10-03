import { MAP, RULES, STATS, type Kind } from './config';
import type { World, Unit, Point } from './types';
export function spawn(w: World, team: number, kind: Kind, pos: Point, regiment = 0): Unit {
  const s = STATS[kind];
  const unit: Unit = { ...pos, id: w.nextId++, team, kind, hp: s.hp, maxHp: s.hp, damage: s.damage,
    speed: s.speed, range: s.range, cooldown: s.cooldown, attackTimer: 0,
    order: 'hold', goal: { ...pos }, facing: 0, regiment };
  w.units.push(unit); return unit;
}
export function createWorld(): World {
  const w: World = { time: 0, units: [], players: [], effects: [], events: ['Select your commander and right-click to move.'], nextId: 1, winner: null, paused: false };
  MAP.bases.forEach((base, team) => {
    w.players.push({ id: team, gold: RULES.startingGold, level: 1, xp: 0, respawn: 0, eliminated: false });
    spawn(w, team, 'base', base);
    spawn(w, team, 'hero', { x: base.x * 0.82, z: base.z * 0.82 });
    for (let i = 0; i < RULES.startingFootmen; i++) {
      spawn(w, team, 'footman', { x: base.x * 0.7 + (i % 4) * 1.7 - 2.5, z: base.z * 0.7 + Math.floor(i / 4) * 1.7 });
    }
  });
  return w;
}
export function notify(w: World, message: string) { w.events.unshift(message); w.events = w.events.slice(0, 5); }
