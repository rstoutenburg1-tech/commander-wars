import type { Kind, Building, TroopKind } from './config';
export interface Point { x: number; z: number }
export type Order = 'move' | 'advance' | 'hold' | 'attack' | 'follow' | 'retreat';
export interface Unit extends Point {
  id: number; team: number; kind: Kind; hp: number; maxHp: number;
  damage: number; speed: number; range: number; cooldown: number; attackTimer: number;
  order: Order; goal: Point; target?: number; facing: number; regiment: number; travel: number; tactical: boolean;
}
export interface Effect extends Point { to?: Point; color: string; life: number; radius: number }
export interface Player {
  id: number; gold: number; wood: number; ore: number; level: number; xp: number; respawn: number; eliminated: boolean;
  tier: number; barracks: number; crafting: number; goldmine: number; forest: number; quarry: number;
  upgrades: { building: Building; to: number; remaining: number; total: number }[];
  production: { interval: number; counts: Record<TroopKind, number>; reserve: number; timer: number; regiment: number; status: string };
  mana: number; rallyUntil: number; cooldowns: { rally: number; wind: number }; aiTimer: number; aiState: string;
  bankedXP: number; items: { sword: boolean; armor: boolean }; craft?: { item: 'sword' | 'armor'; remaining: number };
}
export type Formation = 'line' | 'wall' | 'wedge';
export type Engagement = 'aggressive' | 'defensive' | 'charge';
export type Priority = 'closest' | 'hero' | 'ranged';
export interface Regiment {
  team: number; index: number; formation: Formation; movement: Order;
  engagement: Engagement; priority: Priority; cohesion: number; facing: number; anchor: Point; goal: Point;
}
export interface World {
  time: number; units: Unit[]; players: Player[]; effects: Effect[]; events: string[];
  nextId: number; winner: number | null; paused: boolean; regiments: Regiment[];
  aiEnabled: boolean; invulnerable: boolean; bossTimer: number; merchantGold: number;
}
