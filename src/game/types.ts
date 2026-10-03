import type { Kind } from './config';
export interface Point { x: number; z: number }
export type Order = 'move' | 'advance' | 'hold' | 'attack' | 'follow' | 'retreat';
export interface Unit extends Point {
  id: number; team: number; kind: Kind; hp: number; maxHp: number;
  damage: number; speed: number; range: number; cooldown: number; attackTimer: number;
  order: Order; goal: Point; target?: number; facing: number; regiment: number;
}
export interface Effect extends Point { to?: Point; color: string; life: number; radius: number }
export interface Player { id: number; gold: number; level: number; xp: number; respawn: number; eliminated: boolean }
export interface World {
  time: number; units: Unit[]; players: Player[]; effects: Effect[]; events: string[];
  nextId: number; winner: number | null; paused: boolean;
}
