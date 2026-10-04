import type { Ability } from './config';
import type { Player } from './types';
import { clamp } from './math';
export const ABILITY_KEYS = ['q', 'e', 'r', 'z', 'c', 'v', 'g'] as const;
export type AbilityKey = typeof ABILITY_KEYS[number];
export type AbilityBindings = Partial<Record<Ability, AbilityKey | null>>;
export const learnedAbilities = (p: Player): Ability[] => [...p.abilityOrder, ...(p.skills.ultimate ? ['ultimate' as const] : [])];
export interface ScreenCursor { x: number; y: number }
export function cursorDirection(keys: Set<string>): ScreenCursor {
  const x = Number(keys.has('d')) - Number(keys.has('a')), y = Number(keys.has('s')) - Number(keys.has('w'));
  const length = Math.hypot(x, y); return length ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}
export function advanceCursor(cursor: ScreenCursor, keys: Set<string>, dt: number, width: number, height: number): ScreenCursor {
  const direction = cursorDirection(keys), speed = 420;
  width = Math.max(1, width); height = Math.max(1, height);
  const marginX = Math.min(16 / width, 0.5), marginY = Math.min(16 / height, 0.5);
  return { x: clamp(cursor.x + direction.x * speed * dt / width, marginX, 1 - marginX), y: clamp(cursor.y + direction.y * speed * dt / height, marginY, 1 - marginY) };
}
export function syncAbilityBindings(p: Player, bindings: AbilityBindings) {
  for (const [index, ability] of learnedAbilities(p).entries()) {
    if (bindings[ability] !== undefined) continue;
    const preferred = ability === 'ultimate' ? 'v' : ABILITY_KEYS[index];
    const available = [preferred, ...ABILITY_KEYS].find(key => key && !Object.values(bindings).includes(key));
    bindings[ability] = available ?? null;
  }
}
export function bindAbility(p: Player, bindings: AbilityBindings, ability: Ability, key: string): boolean {
  if (!learnedAbilities(p).includes(ability) || key !== '' && !ABILITY_KEYS.includes(key as AbilityKey)) return false;
  syncAbilityBindings(p, bindings);
  const previous = bindings[ability] ?? null;
  const other = (Object.keys(bindings) as Ability[]).find(a => a !== ability && key && bindings[a] === key);
  if (other) bindings[other] = previous;
  bindings[ability] = (key || null) as AbilityKey | null; return true;
}
