import { MAP, RULES, STATS, SKILLS, isTroop, type Kind, type SkillId } from './config';
import type { World, Unit, Point } from './types';
import { refreshStats } from './hero';
import { createStructures } from './structures';
import { gatePosition } from './gates';
import { updateRegimentGoals } from './regiment-movement';
import { defaultSettings, validateSettings, type MatchSettings } from './match';
export function spawn(w: World, team: number, kind: Kind, pos: Point, regiment = 0): Unit {
  const s = STATS[kind];
  const unit: Unit = { ...pos, id: w.nextId++, team, kind, hp: s.hp, maxHp: s.hp, damage: s.damage, meleeDamage: s.damage,
    speed: s.speed, range: s.range, cooldown: s.cooldown, attackTimer: 0,
    order: 'hold', goal: { ...pos }, facing: 0, regiment, travel: 0, tactical: false };
  w.units.push(unit); refreshStats(w, team);
  const r = isTroop(kind) && w.regiments.find(r => r.team === team && r.index === regiment);
  if (r) updateRegimentGoals(w, r, { newMember: unit });
  return unit;
}
export function createWorld(settings?: MatchSettings): World {
  const match = validateSettings(settings ?? defaultSettings());
  const w: World = { time: 0, units: [], players: [], effects: [], events: ['Choose an opening: wood for archers, ore for musketeers, or workshop gear for your hero.'], nextId: 1, winner: null, paused: false,
    regiments: [], structures: [], gates: [], territories: MAP.bases.map((_, site) => ({ site, owner: match.slots[site].controller === 'closed' ? null : site, captured: false, buildings: { barracks: 0, goldmine: 0, forest: 0, quarry: 0 }, spawnTimer: RULES.spawnInterval, regiment: 0 })), aiEnabled: true, invulnerable: false, bossTimer: 0, merchantGold: 250, settings: match };
  MAP.bases.forEach((base, team) => {
    const slot = match.slots[team];
    w.players.push({ id: team, ...slot, gold: RULES.startingGold, wood: RULES.startingWood, ore: RULES.startingOre,
      level: 1, xp: 0, respawn: 0, eliminated: slot.controller === 'closed', tier: 1, barracks: 1, crafting: 0, goldmine: 1, forest: 0, quarry: 0,
      upgrades: [], production: { interval: RULES.spawnInterval, counts: { footman: RULES.startingCycleUnits, archer: 0, musketeer: 0, knight: 0 }, reserve: 50, timer: RULES.spawnInterval, regiment: 0, status: 'Ready' },
      mana: RULES.hero.mana, rallyUntil: 0, warcryUntil: 0, standfastUntil: 0,
      cooldowns: { rally: 0, wind: 0, cleave: 0, warcry: 0, standfast: 0, ultimate: 0 },
      highestLevel: 1, skills: Object.fromEntries(Object.keys(SKILLS).map(id => [id, 0])) as Record<SkillId, number>, abilityOrder: [],
      aiTimer: 0, aiState: 'Muster', bankedXP: 0, items: {}, equipment: {}, itemAbilities: [], combatStyle: 'melee', training: { warfare: 0, vitality: 0, command: 0 },
      autoTracking: true, heroPriority: 'closest', escortLayout: 'ring', marchWithArmy: true, siegeUntil: 0, supportReady: { resupply: 0, siege: 0 } });
    for (let index = 0; index < RULES.regimentCount; index++) w.regiments.push({ team, index, formation: 'line', movement: slot.controller === 'human' && index === 0 ? 'follow' : 'hold', engagement: 'aggressive', priority: 'closest', cohesion: 100, facing: Math.atan2(-base.x, -base.z),
      anchor: { x: base.x * 0.82, z: base.z * 0.82 }, goal: { x: base.x * 0.82, z: base.z * 0.82 } });
    if (slot.controller === 'closed') return;
    spawn(w, team, 'base', base);
    createStructures(w, team);
    const gate = spawn(w, team, 'gate', gatePosition(team)); gate.facing = Math.atan2(base.x, base.z);
    w.gates.push({ id: gate.id, site: team, owner: team, open: slot.controller === 'human', tower: false, towerRemaining: 0, garrison: [] });
    spawn(w, team, 'hero', { x: base.x * 0.92, z: base.z * 0.92 });
    for (let i = 0; i < RULES.startingFootmen; i++) {
      spawn(w, team, 'footman', { x: base.x * 0.82 + (i % 4) * 1.7 - 2.5, z: base.z * 0.82 + Math.floor(i / 4) * 1.7 });
    }
  });
  spawn(w, 4, 'boss', MAP.boss);
  return w;
}
export function notify(w: World, message: string) { w.events.unshift(message); w.events = w.events.slice(0, 5); }
