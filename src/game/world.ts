import { MAP, RULES, STATS, type Kind } from './config';
import type { World, Unit, Point } from './types';
import { refreshStats } from './hero';
export function spawn(w: World, team: number, kind: Kind, pos: Point, regiment = 0): Unit {
  const s = STATS[kind];
  const unit: Unit = { ...pos, id: w.nextId++, team, kind, hp: s.hp, maxHp: s.hp, damage: s.damage,
    speed: s.speed, range: s.range, cooldown: s.cooldown, attackTimer: 0,
    order: 'hold', goal: { ...pos }, facing: 0, regiment, travel: 0, tactical: false };
  w.units.push(unit); refreshStats(w, team); return unit;
}
export function createWorld(): World {
  const w: World = { time: 0, units: [], players: [], effects: [], events: ['Develop forest + quarry, build workshop, then advance to Tier II.'], nextId: 1, winner: null, paused: false,
    regiments: [], aiEnabled: true, invulnerable: false, bossTimer: 0, merchantGold: 250 };
  MAP.bases.forEach((base, team) => {
    w.players.push({ id: team, gold: RULES.startingGold, wood: RULES.startingWood, ore: RULES.startingOre,
      level: 1, xp: 0, respawn: 0, eliminated: false, tier: 1, barracks: 1, crafting: 0, goldmine: 1, forest: 0, quarry: 0,
      upgrades: [], production: { interval: 10, counts: { footman: 4, archer: 0, musketeer: 0, knight: 0 }, reserve: 50, timer: 10, regiment: 0, status: 'Ready' },
      mana: RULES.hero.mana, rallyUntil: 0, cooldowns: { rally: 0, wind: 0 }, aiTimer: 0, aiState: 'Muster', bankedXP: 0, items: { sword: false, armor: false } });
    for (let index = 0; index < 4; index++) w.regiments.push({ team, index, formation: 'line', movement: 'hold', engagement: 'aggressive', priority: 'closest', cohesion: 100, facing: Math.atan2(-base.x, -base.z),
      anchor: { x: base.x * 0.7, z: base.z * 0.7 }, goal: { x: base.x * 0.7, z: base.z * 0.7 } });
    spawn(w, team, 'base', base);
    spawn(w, team, 'hero', { x: base.x * 0.82, z: base.z * 0.82 });
    for (let i = 0; i < RULES.startingFootmen; i++) {
      spawn(w, team, 'footman', { x: base.x * 0.7 + (i % 4) * 1.7 - 2.5, z: base.z * 0.7 + Math.floor(i / 4) * 1.7 });
    }
  });
  spawn(w, 4, 'boss', MAP.boss);
  return w;
}
export function notify(w: World, message: string) { w.events.unshift(message); w.events = w.events.slice(0, 5); }
