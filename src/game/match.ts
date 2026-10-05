import { TEAMS, RULES } from './config';
import type { World } from './types';

export type MatchController = 'human' | 'ai' | 'closed';
export type AIDifficulty = 'easy' | 'normal' | 'hard';
export interface MatchSlot { controller: MatchController; alliance: number; difficulty: AIDifficulty; name: string }
export interface MatchSettings { slots: MatchSlot[] }

export function defaultSettings(): MatchSettings {
  return { slots: TEAMS.slice(0, 4).map((team, index) => ({ controller: index === 0 ? 'human' : 'ai', alliance: index, difficulty: 'normal', name: team.name })) };
}

/** Validate external lobby data before it reaches simulation state. */
export function validateSettings(value: unknown): MatchSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'slots')) throw new Error('Invalid match settings');
  const slots = (value as { slots?: unknown }).slots;
  if (!Array.isArray(slots) || slots.length !== 4) throw new Error('A match requires exactly four slots');
  return { slots: slots.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['controller', 'alliance', 'difficulty', 'name'].includes(key))) throw new Error(`Invalid slot ${index + 1}`);
    const slot = value as Record<string, unknown>;
    if (!['human', 'ai', 'closed'].includes(slot.controller as string)) throw new Error(`Invalid controller in slot ${index + 1}`);
    if (!Number.isInteger(slot.alliance) || (slot.alliance as number) < 0 || (slot.alliance as number) > 3) throw new Error(`Invalid team in slot ${index + 1}`);
    if (!['easy', 'normal', 'hard'].includes(slot.difficulty as string)) throw new Error(`Invalid AI difficulty in slot ${index + 1}`);
    if (typeof slot.name !== 'string' || !slot.name.trim() || slot.name.trim().length > 32 || /[\u0000-\u001f\u007f]/.test(slot.name)) throw new Error(`Invalid name in slot ${index + 1}`);
    return { controller: slot.controller as MatchController, alliance: slot.alliance as number, difficulty: slot.difficulty as AIDifficulty, name: slot.name.trim() };
  }) };
}

export const localPlayer = (w: World) => w.localPlayer ?? 0;
export function allied(w: World, a: number, b: number) {
  if (a === b) return true;
  const left = w.players[a], right = w.players[b];
  return !!left && !!right && left.controller !== 'closed' && right.controller !== 'closed' && left.alliance === right.alliance;
}
export function enemies(w: World, a: number, b: number) {
  return a !== b && (a === 4 || !!w.players[a] && w.players[a].controller !== 'closed') && (b === 4 || !!w.players[b] && w.players[b].controller !== 'closed') && !allied(w, a, b);
}

/** Winning seat represents its entire surviving alliance. */
export function updateVictory(w: World) {
  const survivors = w.players.filter(player => player.controller !== 'closed' && !player.eliminated);
  const alliances = new Set(survivors.map(player => player.alliance));
  if (alliances.size === 1) w.winner = survivors[0].id;
  else if (!survivors.length) w.winner = -1;
}

export const AI_DIFFICULTIES = {
  easy: { thinkInterval: 6, firstAttack: 240, baseAssault: 540, minAttackArmy: 16, retreatHp: .4, adapt: false, tactics: false, upgradeDelay: 1.4 },
  normal: { thinkInterval: RULES.ai.thinkInterval, firstAttack: RULES.ai.firstAttack, baseAssault: RULES.ai.baseAssault, minAttackArmy: RULES.ai.minAttackArmy, retreatHp: RULES.ai.retreatHp, adapt: true, tactics: true, upgradeDelay: 1 },
  hard: { thinkInterval: 1.5, firstAttack: 100, baseAssault: 240, minAttackArmy: 10, retreatHp: .35, adapt: true, tactics: true, upgradeDelay: .7 },
} as const;
