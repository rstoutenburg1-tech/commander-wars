import type { Kind, Building, TroopKind, SkillId, Ability, ItemId, ItemSlot, OutpostBuilding } from './config';
export interface Point { x: number; z: number }
export type Order = 'move' | 'advance' | 'hold' | 'attack' | 'follow' | 'retreat';
export interface Unit extends Point {
  id: number; team: number; kind: Kind; hp: number; maxHp: number;
  damage: number; meleeDamage: number; speed: number; range: number; cooldown: number; attackTimer: number;
  order: Order; goal: Point; target?: number; autoTarget?: number; facing: number; regiment: number; travel: number; tactical: boolean; garrison?: number;
}
export interface Effect extends Point { to?: Point; color: string; life: number; radius: number }
export interface Player {
  id: number; gold: number; wood: number; ore: number; level: number; xp: number; respawn: number; eliminated: boolean;
  tier: number; barracks: number; crafting: number; goldmine: number; forest: number; quarry: number;
  upgrades: { building: Building; to: number; remaining: number; total: number }[];
  production: { interval: number; counts: Record<TroopKind, number>; reserve: number; timer: number; regiment: number; status: string };
  mana: number; rallyUntil: number; warcryUntil: number; standfastUntil: number; cooldowns: Record<Ability, number>; aiTimer: number; aiState: string;
  highestLevel: number; skills: Record<SkillId, number>; abilityOrder: Ability[];
  bankedXP: number; items: Partial<Record<ItemId, boolean>>; equipment: Partial<Record<ItemSlot, ItemId>>; itemAbilities: Ability[];
  combatStyle: 'melee' | 'ranged'; training: { warfare: number; vitality: number; command: number };
  autoTracking: boolean; heroPriority: Priority; escortLayout: 'ring' | 'vanguard' | 'rearguard'; marchWithArmy: boolean;
  craft?: { item: ItemId; remaining: number };
}
export type Formation = 'line' | 'wall' | 'wedge';
export type Engagement = 'aggressive' | 'defensive' | 'charge';
export type Priority = 'closest' | 'hero' | 'ranged' | 'footman' | 'archer' | 'musketeer' | 'knight' | 'base';
export interface Regiment {
  team: number; index: number; formation: Formation; movement: Order;
  engagement: Engagement; priority: Priority; cohesion: number; facing: number; anchor: Point; goal: Point; target?: number;
}
export interface World {
  time: number; units: Unit[]; players: Player[]; effects: Effect[]; events: string[];
  nextId: number; winner: number | null; paused: boolean; regiments: Regiment[];
  aiEnabled: boolean; invulnerable: boolean; bossTimer: number; merchantGold: number;
  structures: Structure[]; gates: Gate[]; territories: Territory[];
}
export interface Structure extends Point { id: number; team: number; site: number; building: Building }
export interface Gate { id: number; site: number; owner: number; open: boolean; tower: boolean; towerRemaining: number; garrison: number[] }
export interface Territory { site: number; owner: number | null; captured: boolean; buildings: Record<OutpostBuilding, number>; construction?: { building: OutpostBuilding; remaining: number; total: number }; spawnTimer: number; regiment: number }
