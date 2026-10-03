import { MAP, type Building } from './config';
import type { Point, Structure, World } from './types';
export const buildingNames: Record<Building, string> = { base: 'Keep', barracks: 'Barracks', crafting: 'Workshop', goldmine: 'Gold Mine', forest: 'Forest', quarry: 'Quarry' };
export function buildingPosition(team: number, building: Building): Point {
  const b = MAP.bases[team], sx = Math.sign(b.x), sz = Math.sign(b.z);
  const offsets: Record<Building, Point> = {
    base: { x: 0, z: 0 }, barracks: { x: -sx * 15, z: 0 }, crafting: { x: 0, z: -sz * 15 },
    goldmine: { x: sx * 13, z: sz * 12 }, forest: { x: sx * 14, z: -sz * 13 }, quarry: { x: -sx * 13, z: sz * 14 },
  };
  return { x: b.x + offsets[building].x, z: b.z + offsets[building].z };
}
export function createStructures(w: World, team: number) {
  for (const building of Object.keys(buildingNames) as Building[]) {
    const id = building === 'base' ? w.units.find(u => u.team === team && u.kind === 'base')!.id : w.nextId++;
    w.structures.push({ id, team, building, ...buildingPosition(team, building) });
  }
}
export function selectedStructure(w: World, ids: Set<number>): Structure | undefined {
  if (ids.size !== 1) return;
  return w.structures.find(s => ids.has(s.id) && s.team === 0 && !w.players[0].eliminated);
}
