export type Kind = 'hero' | 'footman' | 'archer' | 'musketeer' | 'knight' | 'base' | 'boss' | 'gate';
export type TroopKind = 'footman' | 'archer' | 'musketeer' | 'knight';
export const isTroop = (kind: Kind): kind is TroopKind => kind === 'footman' || kind === 'archer' || kind === 'musketeer' || kind === 'knight';
export const isRangedTroop = (kind: Kind): kind is 'archer' | 'musketeer' => kind === 'archer' || kind === 'musketeer';
export interface Stats { hp: number; damage: number; range: number; speed: number; cooldown: number; cost: number; xp: number; radius: number }
export const STATS: Record<Kind, Stats> = {
  hero: { hp: 1800, damage: 45, range: 7, speed: 4.5, cooldown: 1.1, cost: 0, xp: 180, radius: 1 },
  footman: { hp: 240, damage: 13, range: 1.8, speed: 2.4, cooldown: 1.7, cost: 16, xp: 16, radius: 0.6 },
  archer: { hp: 145, damage: 18, range: 9, speed: 3.3, cooldown: 1.8, cost: 22, xp: 22, radius: 0.5 },
  musketeer: { hp: 110, damage: 32, range: 13, speed: 2.7, cooldown: 2.5, cost: 36, xp: 32, radius: 0.5 },
  knight: { hp: 420, damage: 37, range: 2.2, speed: 4.8, cooldown: 1.6, cost: 55, xp: 48, radius: 0.8 },
  base: { hp: 6500, damage: 32, range: 15, speed: 0, cooldown: 1.7, cost: 0, xp: 300, radius: 4 },
  boss: { hp: 9000, damage: 70, range: 3.4, speed: 2, cooldown: 1.8, cost: 0, xp: 1400, radius: 2.5 },
  gate: { hp: 12000, damage: 0, range: 0, speed: 0, cooldown: 1, cost: 0, xp: 150, radius: 2 },
};
export const MAP = {
  half: 125, baseHalf: 26, arenaHalf: 50, laneWidth: 24, overviewZoom: 250,
  bases: [{ x: -96, z: 96 }, { x: -96, z: -96 }, { x: 96, z: -96 }, { x: 96, z: 96 }],
  merchant: { x: -34, z: -12, radius: 10 },
  boss: { x: 0, z: 0, radius: 20 },
};
export const TEAMS = [
  { name: 'Azure', color: '#55d8db' }, { name: 'Crimson', color: '#ef6b68' },
  { name: 'Amber', color: '#e9b75e' }, { name: 'Violet', color: '#b596eb' },
];
export const RULES = {
  tick: 1 / 20, armyCap: 40, regimentCount: 9, startingFootmen: 4, startingGold: 360, startingWood: 40, startingOre: 30,
  income: 4, spawnInterval: 20, startingCycleUnits: 2, maxCycleUnits: 8, killBounty: 0.5,
  incomeRates: { goldmine: [0, 4, 6, 9], forest: [0, 1.2, 2, 3], quarry: [0, 0.9, 1.5, 2.5] },
  hero: { xpPerLevel: 30, respawn: [16, 24, 32, 40], mana: 120, manaRegen: 3, hpRegen: 2, deathLevels: 2 },
  ai: { thinkInterval: 3, firstAttack: 150, baseAssault: 360, minAttackArmy: 12, retreatHp: 0.3, defendRadius: 32 },
};
export interface Cost { gold: number; wood: number; ore: number }
export const TROOP_COSTS: Record<TroopKind, Cost> = {
  footman: { gold: STATS.footman.cost, wood: 0, ore: 0 },
  archer: { gold: STATS.archer.cost, wood: 10, ore: 0 },
  musketeer: { gold: STATS.musketeer.cost, wood: 0, ore: 12 },
  knight: { gold: STATS.knight.cost, wood: 8, ore: 16 },
};
export const TROOP_ROLES: Record<TroopKind, string> = {
  footman: 'Shield wall blocks frontal cavalry charges. +40% damage to knights.',
  archer: '+30% damage to footmen; weak against knights and structures.',
  musketeer: '+35% damage to knights, +15% to heroes; vulnerable to cavalry.',
  knight: '+35% damage to ranged troops. Flank shield walls to land charges.',
};
export const SUPPORT = {
  resupply: { name: 'Field resupply', cost: { gold: 60, wood: 50, ore: 35 }, tier: 1, cooldown: 45, radius: 18, heal: 0.2, cohesion: 20 },
  siege: { name: 'Siege ammunition', cost: { gold: 100, wood: 60, ore: 60 }, tier: 2, cooldown: 75, duration: 35 },
};
export type Support = keyof typeof SUPPORT;
export const GATES = { toggleGold: 20, repair: { gold: 400, wood: 100, ore: 100 }, tower: { gold: 900, wood: 150, ore: 120 }, towerTime: 30, capacity: 3, rangeBonus: 6, damageBonus: 1.25, mitigation: 0.35 };
export const OUTPOSTS = {
  barracks: { cost: { gold: 350, wood: 80, ore: 60 }, time: 25 },
  goldmine: { cost: { gold: 300, wood: 60, ore: 40 }, time: 20 },
  forest: { cost: { gold: 180, wood: 20, ore: 0 }, time: 15 },
  quarry: { cost: { gold: 200, wood: 20, ore: 30 }, time: 15 },
};
export type OutpostBuilding = keyof typeof OUTPOSTS;
export type Building = 'base' | 'barracks' | 'crafting' | 'goldmine' | 'forest' | 'quarry';
export interface Upgrade { cost: Cost; time: number; requiresTier: number }
export const UPGRADES: Record<Building, Record<number, Upgrade>> = {
  base: {
    2: { cost: { gold: 240, wood: 80, ore: 60 }, time: 45, requiresTier: 1 },
    3: { cost: { gold: 480, wood: 160, ore: 120 }, time: 75, requiresTier: 2 },
    4: { cost: { gold: 900, wood: 260, ore: 220 }, time: 90, requiresTier: 3 },
  },
  barracks: {
    2: { cost: { gold: 180, wood: 40, ore: 30 }, time: 15, requiresTier: 1 },
    3: { cost: { gold: 320, wood: 80, ore: 60 }, time: 25, requiresTier: 2 },
  },
  crafting: { 1: { cost: { gold: 70, wood: 25, ore: 15 }, time: 15, requiresTier: 1 }, 2: { cost: { gold: 400, wood: 80, ore: 100 }, time: 25, requiresTier: 2 } },
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
export const ranks = ['Captain', 'Commander', 'General', 'Marshal'];
export const FORMATIONS = {
  line: { name: 'Battle line', speed: 1, spacing: 1.9, frontalReduction: 0.1 },
  wall: { name: 'Shield wall', speed: 0.65, spacing: 1.55, frontalReduction: 0.48 },
  wedge: { name: 'Cavalry wedge', speed: 1.12, spacing: 2.1, frontalReduction: 0 },
};
export const DOCTRINE = {
  aggressive: { aggro: 13, leash: 16 }, defensive: { aggro: 7, leash: 8 }, charge: { aggro: 18, leash: 22 },
};
export const COHESION = { casualtyLoss: 8, heroDeathLoss: 35, chargeLoss: 22, recovery: 2.5, separationLoss: 2, separationDistance: 7 };
export const TARGET_PRIORITIES = { closest: 'Nearest', hero: 'Heroes', ranged: 'Ranged troops', footman: 'Footmen', archer: 'Archers', musketeer: 'Musketeers', knight: 'Knights', base: 'Keeps' };
export const ABILITIES = {
  rally: { name: 'Rally', cost: 45, cooldown: 24, duration: 10, radius: 16, attackSpeed: 1.4, movement: 1.25, cohesion: 30 },
  wind: { name: 'Second Wind', cost: 40, cooldown: 22, heal: 0.3 },
  cleave: { name: 'Sweeping Strike', cost: 35, cooldown: 18, radius: 6 },
  warcry: { name: 'War Cry', cost: 45, cooldown: 32, duration: 12, radius: 16 },
  standfast: { name: 'Stand Fast', cost: 45, cooldown: 32, duration: 12, radius: 16 },
  ultimate: { name: "Commander's Resolve", cost: 90, cooldown: 90, radius: 20 },
};
export type Ability = keyof typeof ABILITIES;
export type SkillId = Ability | 'discipline' | 'inspiration' | 'martial' | 'resilience';
export interface SkillSpec { name: string; branch: 'Command' | 'Warfare' | 'Endurance' | 'Ultimate'; description: string; max: number; level: number; tier: number; prerequisite?: SkillId; prerequisiteRank?: number; active?: boolean }
export const SKILLS: Record<SkillId, SkillSpec> = {
  rally: { name: 'Rally', branch: 'Command', description: 'Unlock troop speed and cohesion burst. Ranks improve speed and restoration.', max: 5, level: 1, tier: 1, active: true },
  discipline: { name: 'Discipline', branch: 'Command', description: '+5% troop HP and faster cohesion recovery per rank.', max: 5, level: 5, tier: 1, prerequisite: 'rally' },
  inspiration: { name: 'Command Aura', branch: 'Command', description: '+5% army damage per rank.', max: 3, level: 12, tier: 2, prerequisite: 'discipline', prerequisiteRank: 2 },
  cleave: { name: 'Sweeping Strike', branch: 'Warfare', description: 'Unlock a melee area attack. Each rank increases damage.', max: 5, level: 1, tier: 1, active: true },
  martial: { name: 'Martial Training', branch: 'Warfare', description: '+8% commander damage and +5% attack speed per rank.', max: 5, level: 5, tier: 1, prerequisite: 'cleave' },
  warcry: { name: 'War Cry', branch: 'Warfare', description: 'Unlock a nearby army damage buff. Ranks strengthen it.', max: 3, level: 12, tier: 2, prerequisite: 'martial', prerequisiteRank: 2, active: true },
  wind: { name: 'Second Wind', branch: 'Endurance', description: 'Unlock commander healing: 25% HP plus 5% per additional rank.', max: 5, level: 1, tier: 1, active: true },
  resilience: { name: 'Resilience', branch: 'Endurance', description: '+10% commander HP and +1 HP/s regeneration per rank.', max: 5, level: 5, tier: 1, prerequisite: 'wind' },
  standfast: { name: 'Stand Fast', branch: 'Endurance', description: 'Unlock temporary nearby troop protection. Ranks improve reduction.', max: 3, level: 12, tier: 2, prerequisite: 'resilience', prerequisiteRank: 2, active: true },
  ultimate: { name: "Commander's Resolve", branch: 'Ultimate', description: 'Restore 40% hero HP, 25% nearby troop HP and full cohesion.', max: 1, level: 20, tier: 2, active: true },
};
export const BOSS = { smashInterval: 8, smashRadius: 10, smashDamage: 90, gold: 650, ore: 100 };
export type ItemSlot = 'melee' | 'ranged' | 'armor' | 'boots' | 'charm';
export interface ItemBonuses { melee?: number; ranged?: number; hp?: number; mitigation?: number; speed?: number; range?: number; mana?: number; manaRegen?: number; hpRegen?: number }
export interface ItemSpec { name: string; slot: ItemSlot; description: string; buy: number; sell: number; bonuses: ItemBonuses; tier?: number; cost?: Cost; craftTime?: number }
export const ITEMS = {
  sword: { name: 'Longsword', slot: 'melee', description: '+40 melee damage', buy: 220, sell: 100, bonuses: { melee: 40 }, tier: 1, cost: { gold: 0, wood: 40, ore: 35 }, craftTime: 5 },
  armor: { name: 'Reinforced armor', slot: 'armor', description: '+400 HP, 15% damage reduction', buy: 300, sell: 130, bonuses: { hp: 400, mitigation: 0.15 }, tier: 1, cost: { gold: 90, wood: 0, ore: 50 }, craftTime: 5 },
  bow: { name: 'Hunter bow', slot: 'ranged', description: '+25 ranged damage, +2 range', buy: 300, sell: 140, bonuses: { ranged: 25, range: 2 }, tier: 1, cost: { gold: 60, wood: 70, ore: 20 }, craftTime: 8 },
  boots: { name: 'Pathfinder boots', slot: 'boots', description: '+25% movement speed', buy: 350, sell: 150, bonuses: { speed: 0.25 }, tier: 1, cost: { gold: 100, wood: 35, ore: 25 }, craftTime: 8 },
  amulet: { name: 'Mana amulet', slot: 'charm', description: '+40 mana, +1 mana/s', buy: 400, sell: 180, bonuses: { mana: 40, manaRegen: 1 }, tier: 1, cost: { gold: 130, wood: 20, ore: 60 }, craftTime: 10 },
  captainblade: { name: 'Captain blade', slot: 'melee', description: '+100 melee damage', buy: 850, sell: 350, bonuses: { melee: 100 }, tier: 2, cost: { gold: 300, wood: 80, ore: 140 }, craftTime: 18 },
  runicarmor: { name: 'Runic plate', slot: 'armor', description: '+800 HP, 25% reduction, +2 HP/s', buy: 1100, sell: 500, bonuses: { hp: 800, mitigation: 0.25, hpRegen: 2 }, tier: 2, cost: { gold: 380, wood: 80, ore: 160 }, craftTime: 20 },
  kingsblade: { name: 'Kingbreaker', slot: 'melee', description: '+240 melee damage, +300 HP', buy: 2400, sell: 1000, bonuses: { melee: 240, hp: 300 } },
  dragonbow: { name: 'Dragonbone bow', slot: 'ranged', description: '+130 ranged damage, +7 range', buy: 2600, sell: 1100, bonuses: { ranged: 130, range: 7 } },
  bulwark: { name: 'Titan bulwark', slot: 'armor', description: '+1600 HP, 40% damage reduction', buy: 2800, sell: 1200, bonuses: { hp: 1600, mitigation: 0.4 } },
  archmage: { name: 'Archmage sigil', slot: 'charm', description: '+140 mana, +5 mana/s, +5 HP/s', buy: 2100, sell: 900, bonuses: { mana: 140, manaRegen: 5, hpRegen: 5 } },
} satisfies Record<string, ItemSpec>;
export type ItemId = keyof typeof ITEMS;
export const POTION = { name: 'Healing draught', buy: 90, heal: 0.4 };
export const SHOP_TOMES = { warcry: { name: 'War Cry tome', buy: 1600 }, standfast: { name: 'Stand Fast tome', buy: 2000 } };
export const troopKinds: TroopKind[] = ['footman', 'archer', 'musketeer', 'knight'];
