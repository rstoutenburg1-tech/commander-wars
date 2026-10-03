export type Kind = 'hero' | 'footman' | 'archer' | 'musketeer' | 'knight' | 'base' | 'boss';
export type TroopKind = Exclude<Kind, 'hero' | 'base' | 'boss'>;
export interface Stats { hp: number; damage: number; range: number; speed: number; cooldown: number; cost: number; xp: number; radius: number }
export const STATS: Record<Kind, Stats> = {
  hero: { hp: 1200, damage: 30, range: 5, speed: 4, cooldown: 1.15, cost: 0, xp: 180, radius: 1 },
  footman: { hp: 240, damage: 13, range: 1.8, speed: 2.4, cooldown: 1.7, cost: 16, xp: 16, radius: 0.6 },
  archer: { hp: 145, damage: 18, range: 9, speed: 3.3, cooldown: 1.8, cost: 22, xp: 22, radius: 0.5 },
  musketeer: { hp: 110, damage: 32, range: 13, speed: 2.7, cooldown: 2.5, cost: 36, xp: 32, radius: 0.5 },
  knight: { hp: 420, damage: 37, range: 2.2, speed: 4.8, cooldown: 1.6, cost: 55, xp: 48, radius: 0.8 },
  base: { hp: 6500, damage: 32, range: 15, speed: 0, cooldown: 1.7, cost: 0, xp: 300, radius: 4 },
  boss: { hp: 9000, damage: 70, range: 3.4, speed: 2, cooldown: 1.8, cost: 0, xp: 1400, radius: 2.5 },
};
export const MAP = {
  half: 125, baseHalf: 26, arenaHalf: 50, laneWidth: 24, overviewZoom: 250,
  bases: [{ x: -96, z: 96 }, { x: -96, z: -96 }, { x: 96, z: -96 }, { x: 96, z: 96 }],
  merchant: { x: -34, z: -12, radius: 10 },
  boss: { x: 23, z: 15, radius: 20 },
};
export const TEAMS = [
  { name: 'Azure', color: '#55d8db' }, { name: 'Crimson', color: '#ef6b68' },
  { name: 'Amber', color: '#e9b75e' }, { name: 'Violet', color: '#b596eb' },
];
export const RULES = {
  tick: 1 / 20, armyCap: 40, startingFootmen: 4, startingGold: 360, startingWood: 40, startingOre: 30,
  income: 4, spawnInterval: 20, startingCycleUnits: 2, maxCycleUnits: 8, killBounty: 0.5,
  incomeRates: { goldmine: [0, 4, 6, 9], forest: [0, 1.2, 2, 3], quarry: [0, 0.9, 1.5, 2.5] },
  hero: { xpPerLevel: 55, respawn: [16, 24, 32, 40], mana: 120, manaRegen: 3, hpRegen: 2, deathLevels: 2 },
  ai: { thinkInterval: 3, firstAttack: 150, baseAssault: 360, minAttackArmy: 12, retreatHp: 0.3, defendRadius: 32 },
};
export interface Cost { gold: number; wood: number; ore: number }
export type Building = 'base' | 'barracks' | 'crafting' | 'goldmine' | 'forest' | 'quarry';
export interface Upgrade { cost: Cost; time: number; requiresTier: number }
export const UPGRADES: Record<Building, Record<number, Upgrade>> = {
  base: {
    2: { cost: { gold: 240, wood: 80, ore: 60 }, time: 45, requiresTier: 1 },
    3: { cost: { gold: 480, wood: 160, ore: 120 }, time: 75, requiresTier: 2 },
    4: { cost: { gold: 900, wood: 260, ore: 220 }, time: 90, requiresTier: 3 },
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
export const ITEMS = {
  sword: { name: 'Longsword', cost: { gold: 0, wood: 40, ore: 35 }, sell: 100, craftTime: 5 },
  armor: { name: 'Reinforced armor', cost: { gold: 90, wood: 0, ore: 50 }, sell: 130, craftTime: 5 },
  potion: { name: 'Healing draught', buy: 90, heal: 0.4 },
};
export const troopKinds: TroopKind[] = ['footman', 'archer', 'musketeer', 'knight'];
