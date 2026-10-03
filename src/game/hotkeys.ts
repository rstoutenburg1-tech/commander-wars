import type { Ability } from './config';
import type { Player, Point } from './types';
export const ABILITY_KEYS = ['q', 'e', 'r', 'z', 'c', 'v', 'g'] as const;
export type AbilityKey = typeof ABILITY_KEYS[number];
export type AbilityBindings = Partial<Record<Ability, AbilityKey | null>>;
export const learnedAbilities = (p: Player): Ability[] => [...p.abilityOrder, ...(p.skills.ultimate ? ['ultimate' as const] : [])];
export function movementDirection(keys: Set<string>): Point {
  const x = Number(keys.has('d')) - Number(keys.has('a')), z = Number(keys.has('s')) - Number(keys.has('w'));
  const length = Math.hypot(x, z); return length ? { x: x / length, z: z / length } : { x: 0, z: 0 };
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
