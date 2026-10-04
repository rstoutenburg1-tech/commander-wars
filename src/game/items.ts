import { ITEMS, MAP, POTION, RULES, SHOP_TOMES, type ItemId, type ItemSlot, type ItemSpec, type ItemBonuses, type Ability } from './config';
import type { Player, World } from './types';
import { afford, pay } from './economy';
import { refreshStats } from './hero';
import { distance } from './math';
export function equipmentBonuses(p: Player): Required<ItemBonuses> {
  const b = { melee: 0, ranged: 0, hp: 0, mitigation: 0, speed: 0, range: 0, mana: 0, manaRegen: 0, hpRegen: 0 };
  for (const id of Object.values(p.equipment)) if (id && p.items[id]) for (const [key, value] of Object.entries(ITEMS[id].bonuses)) b[key as keyof ItemBonuses] += value;
  return b;
}
export const maxMana = (p: Player) => RULES.hero.mana + equipmentBonuses(p).mana;
export const abilityRank = (p: Player, ability: Ability) => p.skills[ability] + (p.itemAbilities.includes(ability) ? 1 : 0);
export function equipItem(w: World, team: number, id: ItemId) {
  const p = w.players[team]; if (p.eliminated || !p.items[id]) return false;
  p.equipment[ITEMS[id].slot] = id; refreshStats(w, team); p.mana = Math.min(p.mana, maxMana(p)); return true;
}
export function unequipItem(w: World, team: number, slot: ItemSlot) {
  const p = w.players[team]; delete p.equipment[slot]; refreshStats(w, team); p.mana = Math.min(p.mana, maxMana(p));
}
export function grantItem(w: World, team: number, id: ItemId) {
  const p = w.players[team]; p.items[id] = true;
  if (!p.equipment[ITEMS[id].slot]) equipItem(w, team, id);
}
export function craftReason(p: Player, id: ItemId) {
  const recipe: ItemSpec = ITEMS[id];
  return p.eliminated ? 'Keep destroyed' : !recipe.cost ? 'Merchant exclusive' : p.crafting < (recipe.tier ?? 1) ? `Requires Workshop ${recipe.tier}` : p.craft ? 'Crafting in progress' : p.items[id] ? 'Already owned' : !afford(p, recipe.cost) ? 'Insufficient resources' : null;
}
export function startCraft(w: World, team: number, id: ItemId) {
  const p = w.players[team], recipe: ItemSpec = ITEMS[id]; if (craftReason(p, id) || !recipe.cost) return false;
  pay(p, recipe.cost); p.craft = { item: id, remaining: recipe.craftTime! }; return true;
}
export function atMerchant(w: World, team = 0) { const hero = w.units.find(u => u.team === team && u.kind === 'hero' && u.hp > 0); return !!hero && distance(hero, MAP.merchant) < MAP.merchant.radius; }
export function buyItem(w: World, id: ItemId) {
  const p = w.players[0], spec = ITEMS[id]; if (w.winner !== null || p.eliminated || !atMerchant(w) || p.items[id] || p.gold < spec.buy) return false;
  p.gold -= spec.buy; w.merchantGold += spec.buy; grantItem(w, 0, id); return true;
}
export function sellItem(w: World, id: ItemId) {
  const p = w.players[0], spec = ITEMS[id]; if (!atMerchant(w) || !p.items[id] || w.merchantGold < spec.sell) return false;
  p.items[id] = false; if (p.equipment[spec.slot] === id) unequipItem(w, 0, spec.slot);
  p.gold += spec.sell; w.merchantGold -= spec.sell; return true;
}
export function buyConsumable(w: World, id: 'healing' | 'mana' | keyof typeof SHOP_TOMES) {
  const p = w.players[0], hero = w.units.find(u => u.team === 0 && u.kind === 'hero' && u.hp > 0);
  if (!hero || !atMerchant(w) || p.eliminated || w.winner !== null) return false;
  const cost = id === 'healing' ? POTION.buy : id === 'mana' ? 120 : SHOP_TOMES[id].buy;
  if (p.gold < cost || (id === 'warcry' || id === 'standfast') && abilityRank(p, id) > 0) return false;
  p.gold -= cost; w.merchantGold += cost;
  if (id === 'healing') hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * POTION.heal);
  else if (id === 'mana') p.mana = Math.min(maxMana(p), p.mana + maxMana(p) * 0.5);
  else p.itemAbilities.push(id);
  return true;
}
export type Training = keyof Player['training'];
export function trainingReason(p: Player, kind: Training) { const rank = p.training[kind]; return rank >= 3 ? 'Maximum rank' : rank >= p.tier ? `Requires Keep Tier ${rank + 1}` : p.gold < 200 * (rank + 1) || p.ore < 30 * (rank + 1) ? 'Insufficient gold / ore' : null; }
export function trainHero(w: World, kind: Training) {
  const p = w.players[0]; if (p.eliminated || trainingReason(p, kind)) return false;
  const next = p.training[kind] + 1; p.gold -= 200 * next; p.ore -= 30 * next; p.training[kind]++; refreshStats(w, 0); return true;
}
