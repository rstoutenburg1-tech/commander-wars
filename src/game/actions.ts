import { ABILITIES, FORMATIONS, ITEMS, MAP, OUTPOSTS, RULES, SKILLS, SUPPORT, TARGET_PRIORITIES, UPGRADES, isTroop, type Ability, type Building, type ItemId, type ItemSlot, type OutpostBuilding, type SkillId, type Support, type TroopKind } from './config';
import type { Engagement, Formation, Order, Point, Priority, World } from './types';
import { buyConsumable, buyItem, equipItem, sellItem, startCraft, trainHero, unequipItem, type Training } from './items';
import { command, commandRegiment } from './commands';
import { gatherArmy, selectedRegiments } from './formations';
import { updateRegimentGoals } from './regiment-movement';
import { startUpgrade, unlocked } from './economy';
import { trainSkill } from './skills';
import { cast } from './abilities';
import { buildTower, garrisonUnit, leaveTower, repairGate, toggleGate } from './gates';
import { buildOutpost } from './outposts';
import { useSupport } from './support';
import { enemies } from './match';
import { clamp } from './math';
export type GameAction =
  | { type: 'order'; ids: number[]; regiments?: number[]; order: Order; point?: Point; target?: number }
  | { type: 'formation'; ids: number[]; regiments?: number[]; formation: Formation }
  | { type: 'assign'; ids: number[]; index: number }
  | { type: 'escort'; ids: number[]; regiments?: number[]; all?: boolean }
  | { type: 'stopEscorts' }
  | { type: 'ability'; ability: Ability }
  | { type: 'upgrade'; building: Building }
  | { type: 'production'; field: 'interval' | 'reserve' | 'regiment'; value: number }
  | { type: 'roster'; kind: TroopKind; delta: -1 | 1 }
  | { type: 'heroSetting'; field: 'combatStyle' | 'escortLayout' | 'heroPriority' | 'autoTracking' | 'marchWithArmy'; value: string | boolean }
  | { type: 'regimentSetting'; indices: number[]; field: 'engagement' | 'priority'; value: Engagement | Priority }
  | { type: 'skill'; skill: SkillId }
  | { type: 'training'; training: Training }
  | { type: 'craft'; item: ItemId }
  | { type: 'equip'; item: ItemId }
  | { type: 'unequip'; slot: ItemSlot }
  | { type: 'buy'; item: ItemId }
  | { type: 'sell'; item: ItemId }
  | { type: 'consumable'; item: 'healing' | 'mana' | 'warcry' | 'standfast' }
  | { type: 'support'; support: Support }
  | { type: 'gate'; action: 'toggle' | 'repair' | 'tower'; site: number }
  | { type: 'garrison'; unit: number; site: number }
  | { type: 'dismount'; unit: number }
  | { type: 'outpost'; site: number; building: OutpostBuilding }
  | { type: 'outpostRegiment'; site: number; index: number }
  | { type: 'pause' };

// All UI and network commands enter through this player-scoped dispatcher.
// The server derives the seat from the connection rather than trusting a client.
const ownKey = (object: object, key: unknown) => typeof key === 'string' && Object.hasOwn(object, key);
const index = (value: unknown, max = RULES.regimentCount) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < max;
const list = (value: unknown, max: number, valid: (value: unknown) => boolean): value is number[] => Array.isArray(value) && value.length <= max && value.every(valid);
export function applyAction(w: World, seat: number, input: unknown): boolean {
  const p = w.players[seat];
  if (!index(seat, 4) || !p || p.eliminated || p.controller === 'closed' || w.winner !== null || !input || typeof input !== 'object' || Array.isArray(input)) return false;
  if (w.networked && p.controller !== 'human') return false;
  const a = input as GameAction;
  if (typeof a.type !== 'string') return false;
  const selection = (ids: unknown) => list(ids, RULES.armyCap + 1, id => Number.isSafeInteger(id) && (id as number) > 0) &&
    !(ids as number[]).some(id => w.units.some(u => u.id === id && u.team !== seat));
  const groups = (ids: unknown) => ids === undefined || list(ids, RULES.regimentCount, value => index(value));
  switch (a.type) {
    case 'order': {
      if (!selection(a.ids) || !groups(a.regiments) || !['move', 'advance', 'hold', 'attack', 'follow', 'retreat'].includes(a.order)) return false;
      if (a.point && (typeof a.point !== 'object' || !Number.isFinite(a.point.x) || !Number.isFinite(a.point.z))) return false;
      if (['move', 'advance', 'attack'].includes(a.order) && !a.point) return false;
      if (a.target !== undefined && (!Number.isSafeInteger(a.target) || !w.units.some(u => u.id === a.target && u.hp > 0 && enemies(w, seat, u.team)))) return false;
      const point = a.point ? { x: clamp(a.point.x, -MAP.half, MAP.half), z: clamp(a.point.z, -MAP.half, MAP.half) } : undefined;
      command(w, new Set(a.ids), a.order, point, a.target, a.regiments, seat); return true;
    }
    case 'formation': {
      if (!selection(a.ids) || !groups(a.regiments) || !ownKey(FORMATIONS, a.formation)) return false;
      const indices = new Set([...(a.regiments ?? []), ...selectedRegiments(w, new Set(a.ids), null, seat).map(r => r.index)]);
      for (const r of w.regiments.filter(r => r.team === seat && indices.has(r.index))) { r.formation = a.formation; updateRegimentGoals(w, r, { reform: true }); }
      return true;
    }
    case 'assign': {
      if (!selection(a.ids) || !index(a.index)) return false;
      const troops = w.units.filter(u => a.ids.includes(u.id) && u.team === seat && u.hp > 0 && isTroop(u.kind) && u.garrison === undefined);
      if (!troops.length) return false;
      const occupied = w.units.some(u => u.team === seat && u.regiment === a.index && u.hp > 0 && isTroop(u.kind) && !troops.includes(u));
      const r = w.regiments.find(r => r.team === seat && r.index === a.index)!;
      const following = troops.every(u => u.order === 'follow') && (!occupied || r.movement === 'follow');
      for (const u of troops) { u.regiment = a.index; u.tactical = !following; if (!following && u.order === 'follow') u.order = 'move'; }
      if (!occupied) { r.anchor = { x: troops.reduce((s, u) => s + u.x, 0) / troops.length, z: troops.reduce((s, u) => s + u.z, 0) / troops.length }; r.goal = { ...r.anchor }; r.movement = following ? 'follow' : 'hold'; r.target = undefined; }
      return true;
    }
    case 'escort': {
      if (!selection(a.ids) || !groups(a.regiments) || a.all !== undefined && typeof a.all !== 'boolean') return false;
      if (!w.units.some(u => u.team === seat && u.kind === 'hero' && u.hp > 0)) return false;
      if (a.all) gatherArmy(w, seat);
      else { const indices = new Set([...(a.regiments ?? []), ...w.units.filter(u => a.ids.includes(u.id) && u.team === seat && isTroop(u.kind)).map(u => u.regiment)]); for (const n of indices) commandRegiment(w, seat, n, 'follow'); }
      return true;
    }
    case 'stopEscorts': {
      const hero = w.units.find(u => u.team === seat && u.kind === 'hero' && u.hp > 0);
      if (hero) command(w, new Set([hero.id]), 'hold', undefined, undefined, [], seat);
      for (const r of w.regiments.filter(r => r.team === seat && r.movement === 'follow')) commandRegiment(w, seat, r.index, 'hold'); return true;
    }
    case 'ability': return ownKey(ABILITIES, a.ability) && cast(w, seat, a.ability);
    case 'upgrade': return ownKey(UPGRADES, a.building) && startUpgrade(w, seat, a.building);
    case 'production': {
      if (!Number.isFinite(a.value)) return false;
      if (a.field === 'interval' && [0, 10, 15, 20, 30].includes(a.value)) { p.production.interval = a.value; p.production.timer = a.value; return true; }
      if (a.field === 'reserve' && a.value >= 0 && a.value <= 5000) { p.production.reserve = Math.floor(a.value); return true; }
      if (a.field === 'regiment' && index(a.value)) { p.production.regiment = a.value; return true; } return false;
    }
    case 'roster': {
      if (!['footman', 'archer', 'musketeer', 'knight'].includes(a.kind) || ![-1, 1].includes(a.delta) || !unlocked(p, a.kind)) return false;
      if (a.delta > 0 && Object.values(p.production.counts).reduce((s, n) => s + n, 0) >= RULES.maxCycleUnits) return false;
      p.production.counts[a.kind] = Math.max(0, p.production.counts[a.kind] + a.delta); return true;
    }
    case 'heroSetting': {
      if (a.field === 'autoTracking' || a.field === 'marchWithArmy') { if (typeof a.value !== 'boolean') return false; p[a.field] = a.value; }
      else if (a.field === 'combatStyle' && (a.value === 'melee' || a.value === 'ranged')) p.combatStyle = a.value;
      else if (a.field === 'escortLayout' && ['ring', 'vanguard', 'rearguard'].includes(a.value as string)) p.escortLayout = a.value as typeof p.escortLayout;
      else if (a.field === 'heroPriority' && ownKey(TARGET_PRIORITIES, a.value)) p.heroPriority = a.value as Priority;
      else return false;
      for (const u of w.units.filter(u => u.team === seat && u.kind === 'hero')) u.autoTarget = undefined; return true;
    }
    case 'regimentSetting': {
      if (!groups(a.indices) || !Array.isArray(a.indices)) return false;
      if (a.field === 'priority' ? !ownKey(TARGET_PRIORITIES, a.value) : a.field !== 'engagement' || !['aggressive', 'defensive', 'charge'].includes(a.value)) return false;
      for (const r of w.regiments.filter(r => r.team === seat && a.indices.includes(r.index))) { if (a.field === 'priority') r.priority = a.value as Priority; else r.engagement = a.value as Engagement; }
      for (const u of w.units.filter(u => u.team === seat)) u.autoTarget = undefined; return true;
    }
    case 'skill': return ownKey(SKILLS, a.skill) && trainSkill(w, seat, a.skill);
    case 'training': return ['warfare', 'vitality', 'command'].includes(a.training) && trainHero(w, a.training, seat);
    case 'craft': return ownKey(ITEMS, a.item) && startCraft(w, seat, a.item);
    case 'equip': return ownKey(ITEMS, a.item) && equipItem(w, seat, a.item);
    case 'unequip': if (!['melee', 'ranged', 'armor', 'boots', 'charm'].includes(a.slot)) return false; unequipItem(w, seat, a.slot); return true;
    case 'buy': return ownKey(ITEMS, a.item) && buyItem(w, a.item, seat);
    case 'sell': return ownKey(ITEMS, a.item) && sellItem(w, a.item, seat);
    case 'consumable': return ['healing', 'mana', 'warcry', 'standfast'].includes(a.item) && buyConsumable(w, a.item, seat);
    case 'support': return ownKey(SUPPORT, a.support) && useSupport(w, seat, a.support);
    case 'gate': {
      if (!index(a.site, 4)) return false;
      return a.action === 'toggle' ? toggleGate(w, a.site, seat) : a.action === 'repair' ? repairGate(w, a.site, seat) : a.action === 'tower' && buildTower(w, a.site, seat);
    }
    case 'garrison': return index(a.site, 4) && Number.isSafeInteger(a.unit) && garrisonUnit(w, a.site, a.unit, seat);
    case 'dismount': { const u = w.units.find(u => u.id === a.unit && u.team === seat && u.hp > 0); if (!u) return false; leaveTower(w, u); return true; }
    case 'outpost': return index(a.site, 4) && ownKey(OUTPOSTS, a.building) && buildOutpost(w, a.site, a.building, seat);
    case 'outpostRegiment': {
      if (!index(a.site, 4) || !index(a.index)) return false; const t = w.territories[a.site];
      if (!t.captured || t.owner !== seat) return false; t.regiment = a.index; return true;
    }
    case 'pause': if (w.networked) return false; w.paused = !w.paused; return true;
    default: return false;
  }
}
