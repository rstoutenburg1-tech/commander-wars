import { SKILLS, type SkillId, type Ability } from './config';
import type { Player, World } from './types';
import { refreshStats } from './hero';
export const activeSlots = (level: number) => level >= 12 ? 3 : level >= 5 ? 2 : 1;
export const skillPoints = (p: Player) => p.highestLevel - Object.values(p.skills).reduce((a, b) => a + b, 0);
export function skillReason(p: Player, id: SkillId): string | null {
  const s = SKILLS[id], fromTome = p.itemAbilities.includes(id as Ability), rank = p.skills[id] + (fromTome ? 1 : 0);
  if (p.eliminated) return 'Keep destroyed';
  if (rank >= s.max) return 'Maximum rank';
  if (p.tier < s.tier) return `Requires Tier ${s.tier}`;
  const level = s.level + rank * 3;
  if (p.level < level) return `Requires level ${level}`;
  if (s.prerequisite && p.skills[s.prerequisite] < (s.prerequisiteRank ?? 1)) return `Requires ${SKILLS[s.prerequisite].name} ${s.prerequisiteRank ?? 1}`;
  if (s.active && id !== 'ultimate' && rank === 0 && p.abilityOrder.length >= activeSlots(p.level)) return p.level < 12 ? `Next ability slot at level ${p.level < 5 ? 5 : 12}` : 'All 3 normal ability slots are filled';
  if (skillPoints(p) < 1) return 'Earn another skill point through leveling';
  return null;
}
export function trainSkill(w: World, team: number, id: SkillId) {
  const p = w.players[team]; if (skillReason(p, id)) return false;
  if (p.skills[id] === 0 && SKILLS[id].active && id !== 'ultimate' && !p.itemAbilities.includes(id as Ability)) p.abilityOrder.push(id as Ability);
  p.skills[id]++; refreshStats(w, team); return true;
}
export function grantLevelPoints(p: Player) { p.highestLevel = Math.max(p.highestLevel, p.level); }
