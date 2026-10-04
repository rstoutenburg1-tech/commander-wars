import * as THREE from 'three';
import { MAP, TEAMS } from '../game/config';
import { walkable } from '../game/navigation';
import { CartoonArt, PALETTE as C } from './cartoon-art';

const noise = (i: number) => { const a = Math.sin(i * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };

export function createCartoonMap(art: CartoonArt) {
  const root = new THREE.Group(), floor = art.group(root), decor = art.group(root);
  art.shape(floor, art.box, '#418f96', [0, -2.75, 0], [MAP.half * 2 + 10, 1, MAP.half * 2 + 10]);
  art.shape(floor, art.box, '#74bfc1', [0, -2.16, 0], [MAP.half * 2 + 10, 0.13, MAP.half * 2 + 10]);
  const island = (x: number, z: number, sx: number, sz: number, color: string, rotation = 0, height = 0) => {
    art.shape(floor, art.box, '#8b744f', [x, -1.3, z], [sx, 2.5, sz], [0, rotation, 0]);
    art.shape(floor, art.box, '#bdd181', [x, -0.17, z], [sx, 0.45, sz], [0, rotation, 0]);
    art.shape(floor, art.box, color, [x, height, z], [sx - 0.4, 0.2, sz - 0.4], [0, rotation, 0]);
  };
  for (const b of MAP.bases) {
    const angle = b.x * b.z > 0 ? Math.PI / 4 : -Math.PI / 4;
    island(b.x / 2, b.z / 2, MAP.laneWidth, Math.hypot(b.x, b.z) + 3, '#91bf5c', angle);
    art.shape(floor, art.box, '#cfbb86', [b.x / 2, 0.14, b.z / 2], [MAP.laneWidth - 7, 0.08, Math.hypot(b.x, b.z)], [0, angle, 0]);
  }
  island(0, 0, MAP.arenaHalf * 2, MAP.arenaHalf * 2, '#93bf60', 0, 0.02);
  MAP.bases.forEach((b, i) => {
    island(b.x, b.z, MAP.baseHalf * 2, MAP.baseHalf * 2, '#83b957', 0, 0.04);
    art.shape(floor, art.box, '#a3c972', [b.x, 0.15, b.z], [42, 0.1, 42]);
    // Interlocking pavers connect the production buildings without hiding the grass.
    for (let p = -17; p <= 17; p += 3) {
      art.block(floor, p % 2 ? '#d7c18b' : '#c6b07a', [b.x + p, 0.19, b.z], [2.7, 0.17, 3.5]);
      art.block(floor, p % 2 ? '#d7c18b' : '#c6b07a', [b.x, 0.18, b.z + p], [3.5, 0.17, 2.7]);
    }
    const dx = Math.sign(b.x), dz = Math.sign(b.z);
    for (let p = -22; p <= 22; p += 5.5) {
      for (const axis of [0, 1]) {
        const x = axis ? b.x + dx * 24 : b.x + p, z = axis ? b.z + p : b.z + dz * 24;
        art.block(decor, C.stoneShade, [x, 0.75, z], [axis ? 1.4 : 5.15, 1.5, axis ? 5.15 : 1.4]);
        art.block(decor, C.stone, [x, 1.66, z], [axis ? 1.65 : 5.4, 0.35, axis ? 5.4 : 1.65]);
      }
    }
    for (const x of [-22, 22]) for (const z of [-22, 22]) {
      if (Math.sign(x) === -dx && Math.sign(z) === -dz) continue;
      art.tree(decor, b.x + x, b.z + z, 0.64, i);
    }
    for (const p of [-19, 19]) art.flag(decor, TEAMS[i].color, b.x + p, 0.2, b.z + dz * 21, 3.8);
  });
  // Shallow cliff strata reveal why the four approaches are separated.
  for (let i = 0; i < 180; i++) {
    const x = -122 + noise(i * 3) * 244, z = -122 + noise(i * 3 + 1) * 244;
    if (walkable({ x, z })) continue;
    const nearLand = walkable({ x: x + 3, z }) || walkable({ x: x - 3, z }) || walkable({ x, z: z + 3 }) || walkable({ x, z: z - 3 });
    if (nearLand) art.shape(decor, art.rock, i % 3 ? '#8e9c8b' : '#b6b3a0', [x, -1.42, z], [1.4 + noise(i) * 1.2, 1.7, 1.5], [0, i, 0]);
    else if (i % 8 === 0) art.shape(decor, art.disc, '#94cdcb', [x, -2.06, z], [1.9, 1.9, 1.9], [-Math.PI / 2, 0, 0]);
  }
  for (let i = 0; i < 56; i++) {
    const side = i % 4, a = -45 + noise(i * 5) * 90, b = 45.5 + noise(i * 5 + 1) * 2.8;
    const x = side < 2 ? a : (side === 2 ? b : -b), z = side < 2 ? (side === 0 ? b : -b) : a;
    // Keep entrances, the boss arena and the merchant completely legible.
    if (Math.abs(Math.abs(x) - Math.abs(z)) < 17 || Math.hypot(x - MAP.merchant.x, z - MAP.merchant.z) < 14) continue;
    if (i % 3) art.tree(decor, x, z, 0.55 + noise(i + 3) * 0.3, i);
    else art.rockAt(decor, x, z, 1.1 + noise(i + 3), '#a3ac95', i);
  }
  // Small tufts, flower patches and stones replace the old engineering grid.
  for (let i = 0; i < 125; i++) {
    const x = -47 + noise(i * 7) * 94, z = -47 + noise(i * 7 + 1) * 94;
    if (Math.hypot(x - MAP.boss.x, z - MAP.boss.z) < MAP.boss.radius + 2 || Math.hypot(x - MAP.merchant.x, z - MAP.merchant.z) < 12 || Math.abs(Math.abs(x) - Math.abs(z)) < 7) continue;
    if (i % 5 === 0) art.rockAt(decor, x, z, 0.4, '#c0bf9b', i);
    else {
      art.shape(decor, art.cone, i % 2 ? '#70a747' : '#add36e', [x, 0.34, z], [0.18, 0.63, 0.2], [0, i, 0.12]);
      if (i % 3 === 0) art.shape(decor, art.ball, i % 2 ? '#ffd981' : '#e9a8b8', [x, 0.5, z], [0.13, 0.13, 0.13]);
    }
  }
  createMerchant(art, decor);
  createArena(art, floor, decor);
  art.bake(floor); art.bake(decor); return root;
}

function createMerchant(art: CartoonArt, root: THREE.Group) {
  const { x, z, radius } = MAP.merchant, g = art.group(root, x, 0, z);
  art.shape(g, art.cylinder, '#d6bc86', [0, 0.15, 0], [radius, 0.22, radius]);
  art.shape(g, art.ring, '#8bb77c', [0, 0.3, 0], [radius - 0.4, radius - 0.4, radius - 0.4], [-Math.PI / 2, 0, 0]);
  art.block(g, C.woodDark, [0, 0.72, -1.5], [5.8, 1.1, 3.9]);
  for (const x of [-2.55, 2.55]) for (const z of [-3, 1.1]) art.shape(g, art.cylinder, C.wood, [x, 2.15, z], [0.17, 4.2, 0.17]);
  for (let i = 0; i < 7; i++) {
    art.shape(g, art.roof, i % 2 ? '#f5d7a0' : '#b46bba', [i * 0.91 - 2.73, 4.5, -0.9], [0.94, 2.0, 4.85]);
    art.block(g, i % 2 ? '#f5d7a0' : '#b46bba', [i * 0.91 - 2.73, 3.43, 1.55], [0.91, 0.49, 0.18]);
  }
  art.block(g, '#d8944e', [0, 1.15, 1.85], [5.8, 0.72, 1.5]);
  art.block(g, '#f0c477', [0, 1.55, 1.85], [6.15, 0.16, 1.75]);
  for (const i of [-1, 0, 1]) {
    art.shape(g, art.ball, ['#df76d6', '#8de1e8', '#a0e478'][i + 1], [i * 0.77 - 0.8, 1.93, 1.65], [0.24, 0.33, 0.24]);
    art.shape(g, art.cylinder, C.gold, [i * 0.77 - 0.8, 2.21, 1.65], [0.1, 0.15, 0.1]);
  }
  art.block(g, C.woodDark, [1.72, 1.87, 1.8], [1.42, 0.66, 0.83]);
  for (const x of [1.12, 2.32]) art.block(g, C.gold, [x, 1.93, 1.8], [0.16, 0.85, 0.93]);
  art.block(g, C.gold, [1.72, 1.92, 2.29], [0.27, 0.3, 0.14]);
  for (const x of [-4.1, 4.2]) {
    art.block(g, C.wood, [x, 0.68, -0.2], [1.62, 1.35, 1.49]);
    for (const sign of [-1, 1]) art.block(g, '#d59d61', [x, 0.68, 0.62], [1.52, 0.13, 0.1], [0, 0, sign * 0.62]);
    art.shape(g, art.cylinder, C.woodDark, [x, 0.79, 2.3], [0.7, 1.5, 0.7]);
    for (const y of [0.3, 1.2]) art.shape(g, art.ring, C.iron, [x, y, 2.3], [0.71, 0.71, 0.71], [-Math.PI / 2, 0, 0]);
  }
  // The shopkeeper is deliberately a friendly, easily recognized miniature.
  art.block(g, '#73478c', [0, 2.0, -0.1], [0.82, 1, 0.7]);
  art.shape(g, art.ball, C.skin, [0, 2.88, -0.1], [0.46, 0.48, 0.4]);
  art.shape(g, art.cone, '#8259a4', [0, 3.5, -0.1], [0.65, 0.83, 0.58]);
  art.block(g, '#fff0d1', [0, 2.59, 0.22], [0.39, 0.48, 0.12]);
  for (const x of [-0.18, 0.18]) art.block(g, C.ink, [x, 2.96, 0.26], [0.06, 0.08, 0.04]);
  art.flag(g, '#b46bba', -5.35, 0.2, -3, 4.3);
}

function createArena(art: CartoonArt, floor: THREE.Group, decor: THREE.Group) {
  const { x, z, radius } = MAP.boss;
  art.shape(floor, art.cylinder, '#bfae88', [x, 0.12, z], [radius, 0.19, radius]);
  art.shape(floor, art.cylinder, '#d8c493', [x, 0.24, z], [radius - 1.5, 0.09, radius - 1.5]);
  const rune = art.shape(floor, art.ring, '#e7cf91', [x, 0.31, z], [radius * 0.61, radius * 0.61, radius * 0.61], [-Math.PI / 2, 0, 0]);
  rune.material = art.basic('#ba9869');
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2, px = x + Math.sin(angle) * (radius - 0.6), pz = z + Math.cos(angle) * (radius - 0.6);
    art.block(decor, i % 2 ? '#96a3a1' : '#b4bcad', [px, 0.39, pz], [2.7, 0.52, 1.3], [0, angle, 0]);
  }
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2, px = x + Math.sin(angle) * (radius + 1), pz = z + Math.cos(angle) * (radius + 1);
    art.block(decor, '#778c93', [px, 1.05, pz], [1.8, 2.1, 1.8]);
    art.block(decor, '#b9c5b3', [px, 2.24, pz], [2.3, 0.45, 2.3]);
    art.shape(decor, art.rock, '#ffa35b', [px, 2.97, pz], [0.67, 0.88, 0.67], [0, angle, 0]);
  }
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2, px = x + Math.sin(angle) * 6.8, pz = z + Math.cos(angle) * 6.8;
    art.block(floor, '#baa375', [px, 0.3, pz], [1.25, 0.035, 2.3], [0, angle, 0]);
  }
}
