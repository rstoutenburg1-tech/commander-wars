export type Kind = 'hero' | 'footman' | 'archer' | 'musketeer' | 'knight' | 'base' | 'boss';
export type TroopKind = Exclude<Kind, 'hero' | 'base' | 'boss'>;
export interface Stats { hp: number; damage: number; range: number; speed: number; cooldown: number; cost: number; xp: number; radius: number }
export const STATS: Record<Kind, Stats> = {
  hero: { hp: 700, damage: 38, range: 5, speed: 6, cooldown: 0.8, cost: 0, xp: 130, radius: 1 },
  footman: { hp: 160, damage: 13, range: 1.8, speed: 3.4, cooldown: 1.2, cost: 16, xp: 12, radius: 0.6 },
  archer: { hp: 95, damage: 18, range: 9, speed: 4.7, cooldown: 1.25, cost: 22, xp: 18, radius: 0.5 },
  musketeer: { hp: 75, damage: 32, range: 13, speed: 3.8, cooldown: 1.8, cost: 36, xp: 26, radius: 0.5 },
  knight: { hp: 280, damage: 37, range: 2.2, speed: 6.5, cooldown: 1.1, cost: 55, xp: 40, radius: 0.8 },
  base: { hp: 2400, damage: 28, range: 12, speed: 0, cooldown: 1.3, cost: 0, xp: 200, radius: 4 },
  boss: { hp: 6500, damage: 70, range: 3.4, speed: 2.6, cooldown: 1.5, cost: 0, xp: 1000, radius: 2.5 },
};
export const MAP = {
  half: 58,
  bases: [{ x: -43, z: 43 }, { x: -43, z: -43 }, { x: 43, z: -43 }, { x: 43, z: 43 }],
  merchant: { x: 0, z: -17, radius: 5.5 },
  boss: { x: 12, z: 5 },
};
export const TEAMS = [
  { name: 'Azure', color: '#55d8db' }, { name: 'Crimson', color: '#ef6b68' },
  { name: 'Amber', color: '#e9b75e' }, { name: 'Violet', color: '#b596eb' },
];
export const RULES = {
  tick: 1 / 20, armyCap: 40, startingFootmen: 8, startingGold: 320, startingWood: 40, startingOre: 30,
  income: 7, spawnInterval: 10, maxCycleUnits: 8, killBounty: 0.5,
  incomeRates: { goldmine: [0, 7, 10, 14], forest: [0, 2, 3, 4.5], quarry: [0, 1.5, 2.25, 3.5] },
  hero: { xpPerLevel: 40, respawn: [12, 22, 32], mana: 120, manaRegen: 4, hpRegen: 2, deathLevels: 2 },
  ai: { thinkInterval: 2, firstAttack: 35, minAttackArmy: 14, retreatHp: 0.3, defendRadius: 23 },
};
export interface Cost { gold: number; wood: number; ore: number }
export type Building = 'base' | 'barracks' | 'crafting' | 'goldmine' | 'forest' | 'quarry';
export interface Upgrade { cost: Cost; time: number; requiresTier: number }
export const UPGRADES: Record<Building, Record<number, Upgrade>> = {
  base: {
    2: { cost: { gold: 240, wood: 80, ore: 60 }, time: 30, requiresTier: 1 },
    3: { cost: { gold: 480, wood: 160, ore: 120 }, time: 45, requiresTier: 2 },
  },
  barracks: {
    2: { cost: { gold: 180, wood: 40, ore: 30 }, time: 15, requiresTier: 2 },
    3: { cost: { gold: 320, wood: 80, ore: 60 }, time: 25, requiresTier: 3 },
  },
  crafting: { 1: { cost: { gold: 70, wood: 25, ore: 15 }, time: 15, requiresTier: 1 } },
  goldmine: {
    2: { cost: { gold: 250, wood: 40, ore: 30 }, time: 15, requiresTier: 2 },
    3: { cost: { gold: 400, wood: 80, ore: 60 }, time: 25, requiresTier: 3 },
  },
  forest: {
    1: { cost: { gold: 75, wood: 0, ore: 0 }, time: 15, requiresTier: 1 },
    2: { cost: { gold: 150, wood: 40, ore: 20 }, time: 15, requiresTier: 2 },
    3: { cost: { gold: 240, wood: 70, ore: 40 }, time: 25, requiresTier: 3 },
  },
  quarry: {
    1: { cost: { gold: 75, wood: 0, ore: 0 }, time: 15, requiresTier: 1 },
    2: { cost: { gold: 150, wood: 30, ore: 25 }, time: 15, requiresTier: 2 },
    3: { cost: { gold: 240, wood: 60, ore: 50 }, time: 25, requiresTier: 3 },
  },
};
export const ranks = ['Captain', 'Commander', 'General'];
export const FORMATIONS = {
  line: { name: 'Battle line', speed: 1, spacing: 1.9, frontalReduction: 0.1 },
  wall: { name: 'Shield wall', speed: 0.65, spacing: 1.55, frontalReduction: 0.48 },
  wedge: { name: 'Cavalry wedge', speed: 1.12, spacing: 2.1, frontalReduction: 0 },
};
export const DOCTRINE = {
  aggressive: { aggro: 13, leash: 16 }, defensive: { aggro: 7, leash: 8 }, charge: { aggro: 18, leash: 22 },
};
export const COHESION = { casualtyLoss: 8, heroDeathLoss: 35, chargeLoss: 22, recovery: 2.5, separationLoss: 2, separationDistance: 7 };
export const ABILITIES = {
  rally: { name: 'Rally', cost: 45, cooldown: 24, duration: 10, radius: 16, attackSpeed: 1.4, movement: 1.25, cohesion: 30 },
  wind: { name: 'Second Wind', cost: 40, cooldown: 22, heal: 0.3 },
};
export const BOSS = { smashInterval: 6, smashRadius: 8, smashDamage: 115, gold: 650, ore: 100 };
export const ITEMS = {
  sword: { name: 'Longsword', cost: { gold: 0, wood: 40, ore: 35 }, sell: 100, craftTime: 5 },
  armor: { name: 'Reinforced armor', cost: { gold: 90, wood: 0, ore: 50 }, sell: 130, craftTime: 5 },
  potion: { name: 'Healing draught', buy: 90, heal: 0.4 },
};
export const troopKinds: TroopKind[] = ['footman', 'archer', 'musketeer', 'knight'];
