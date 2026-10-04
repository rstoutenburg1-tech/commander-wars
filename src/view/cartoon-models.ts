import * as THREE from 'three';
import { TEAMS } from '../game/config';
import type { Gate, Structure, Unit } from '../game/types';
import { CartoonArt, PALETTE as C } from './cartoon-art';

export interface UnitRig {
  root: THREE.Group; body: THREE.Group; head: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group;
  legs: THREE.Group[]; cloak?: THREE.Group; sword?: THREE.Group; bow?: THREE.Group; horse?: THREE.Group;
}

function sword(art: CartoonArt, parent: THREE.Group, big = false) {
  const g = art.group(parent, 0, -0.48, 0.22), length = big ? 1.55 : 1.05;
  art.block(g, C.woodDark, [0, 0, 0], [0.16, 0.45, 0.16]);
  art.block(g, C.gold, [0, 0.22, 0], [0.52, 0.13, 0.18]);
  art.block(g, C.steel, [0, 0.3 + length / 2, 0], [big ? 0.26 : 0.18, length, 0.1]);
  art.shape(g, art.cone, '#effbfa', [0, length + 0.42, 0], [big ? 0.19 : 0.13, 0.3, 0.07]);
  art.bake(g); g.userData.keepRig = true; return g;
}
function bow(art: CartoonArt, parent: THREE.Group, gold = false) {
  const g = art.group(parent, 0, -0.2, 0.35);
  art.shape(g, art.bow, gold ? C.gold : C.wood, [0, 0, 0], [1, 1.25, 1], [0, Math.PI / 2, Math.PI / 2]);
  art.beam(g, '#f8e6bd', [0, -0.81, 0], [0, 0.81, 0], 0.02);
  art.bake(g); g.userData.keepRig = true; return g;
}

export function createTroop(art: CartoonArt, u: Unit): UnitRig {
  const root = new THREE.Group(), body = art.group(root), torso = art.group(body);
  const color = TEAMS[u.team]?.color ?? '#f2ae60';
  const hero = u.kind === 'hero', knight = u.kind === 'knight', archer = u.kind === 'archer', musketeer = u.kind === 'musketeer';
  const torsoY = knight ? 2.2 : 1.05, headY = knight ? 3.1 : 1.98;
  art.block(torso, color, [0, torsoY, 0], [0.84, 1.04, 0.65]);
  art.block(torso, C.woodDark, [0, torsoY - 0.3, 0.35], [0.85, 0.12, 0.09]);
  art.block(torso, C.gold, [0, torsoY - 0.3, 0.41], [0.17, 0.16, 0.08]);
  if (!archer) {
    art.block(torso, hero ? '#e7d5a0' : C.steel, [0, torsoY + 0.14, 0.32], [0.68, 0.58, 0.12]);
    art.block(torso, hero ? C.gold : C.iron, [0, torsoY + 0.1, 0.41], [0.13, 0.5, 0.08]);
  }
  const head = art.group(body, 0, headY, 0.02);
  art.shape(head, art.ball, C.skin, [0, 0, 0], [0.4, 0.42, 0.35]);
  art.block(head, C.skin, [0, -0.01, 0.36], [0.13, 0.17, 0.13]);
  for (const x of [-0.14, 0.14]) {
    art.block(head, '#f9f3df', [x, 0.05, 0.305], [0.115, 0.13, 0.06]);
    art.block(head, C.ink, [x, 0.05, 0.35], [0.055, 0.09, 0.04]);
  }
  if (hero) {
    art.shape(head, art.ball, '#6d472d', [0, 0.22, -0.06], [0.43, 0.28, 0.38]);
    art.block(head, C.gold, [0, 0.35, 0.03], [0.82, 0.17, 0.63]);
    for (const x of [-0.31, 0, 0.31]) art.shape(head, art.cone, '#ffe699', [x, 0.54, 0.2], [0.15, 0.33, 0.12]);
    art.shape(head, art.rock, color, [0, 0.37, 0.4], [0.13, 0.17, 0.09]);
  } else if (archer) {
    art.shape(head, art.ball, '#be496e', [0, 0.19, -0.08], [0.43, 0.3, 0.38]);
    art.block(head, '#c85581', [-0.32, -0.12, -0.02], [0.2, 0.62, 0.55]);
    art.block(head, '#c85581', [0.32, -0.12, -0.02], [0.2, 0.62, 0.55]);
    art.block(head, color, [0, 0.17, 0.3], [0.79, 0.13, 0.13]);
  } else if (musketeer) {
    art.block(head, '#452c24', [0, -0.11, 0.36], [0.34, 0.13, 0.13]);
    art.shape(head, art.cylinder, C.iron, [0, 0.35, 0], [0.51, 0.34, 0.45]);
    art.block(head, color, [0, 0.46, 0], [0.85, 0.25, 0.6]);
    art.shape(head, art.cone, C.gold, [0.31, 0.73, -0.08], [0.15, 0.7, 0.11], [0, 0, -0.35]);
  } else {
    art.shape(head, art.ball, C.steel, [0, 0.13, -0.07], [0.46, 0.37, 0.42]);
    for (const x of [-0.34, 0.34]) art.block(head, C.steel, [x, -0.1, 0.06], [0.19, 0.5, 0.45]);
    art.block(head, C.iron, [0, 0.14, 0.32], [0.72, 0.16, 0.18]);
    art.block(head, color, [0, 0.54, -0.01], [0.14, 0.47, 0.58]);
  }
  const leftArm = art.group(body, -0.51, torsoY + 0.3, 0), rightArm = art.group(body, 0.51, torsoY + 0.3, 0);
  for (const arm of [leftArm, rightArm]) {
    art.shape(arm, art.ball, archer ? C.skin : hero ? C.gold : C.steel, [0, 0, 0], [0.26, 0.26, 0.29]);
    art.block(arm, archer ? C.skin : color, [0, -0.32, 0], [0.28, 0.5, 0.28]);
    art.shape(arm, art.ball, C.skin, [0, -0.56, 0.02], [0.19, 0.2, 0.19]);
  }
  let blade: THREE.Group | undefined, longbow: THREE.Group | undefined;
  if (archer) {
    longbow = bow(art, leftArm); leftArm.rotation.x = -1.2; rightArm.rotation.x = -0.8;
    art.block(torso, C.woodDark, [0.27, torsoY, -0.4], [0.3, 0.95, 0.29], [0, 0, -0.2]);
    for (const x of [0.14, 0.28, 0.4]) art.shape(torso, art.cone, '#f1ead2', [x, torsoY + 0.64, -0.43], [0.06, 0.24, 0.07]);
  } else if (musketeer) {
    rightArm.rotation.x = -1.2; leftArm.rotation.x = -1.1;
    art.block(rightArm, C.wood, [0, -0.5, 0.52], [0.25, 0.27, 1.06]);
    art.shape(rightArm, art.cylinder, C.iron, [0, -0.5, 1.1], [0.12, 0.96, 0.12], [Math.PI / 2, 0, 0]);
    art.shape(rightArm, art.cylinder, C.gold, [0, -0.5, 1.56], [0.17, 0.08, 0.17], [Math.PI / 2, 0, 0]);
  } else {
    blade = sword(art, rightArm, hero);
    art.block(leftArm, hero ? C.gold : C.iron, [0, -0.38, 0.2], [0.75, hero ? 0.96 : 0.9, 0.19]);
    art.block(leftArm, color, [0, -0.38, 0.31], [0.55, 0.69, 0.08]);
    art.block(leftArm, C.steel, [0, -0.38, 0.37], [0.15, 0.47, 0.05]);
    if (hero) { longbow = bow(art, leftArm, true); longbow.visible = false; }
  }
  const legs: THREE.Group[] = [];
  let horse: THREE.Group | undefined;
  if (knight) {
    horse = art.group(root);
    art.shape(horse, art.ball, '#bc8050', [0, 1.07, -0.07], [0.7, 0.68, 1.23]);
    art.block(horse, '#d19a63', [0, 1.72, 0.72], [0.58, 1.24, 0.48], [-0.4, 0, 0]);
    art.block(horse, '#e1b47d', [0, 2.15, 1.07], [0.64, 0.69, 0.94]);
    art.block(horse, C.woodDark, [0, 1.86, 1.25], [0.68, 0.13, 0.61]);
    art.block(horse, C.woodDark, [0, 1.7, 0.62], [0.17, 1.08, 0.32], [-0.4, 0, 0]);
    for (const x of [-0.24, 0.24]) {
      art.shape(horse, art.cone, '#bd814f', [x, 2.63, 0.87], [0.16, 0.42, 0.14]);
      art.shape(horse, art.ball, C.ink, [x * 1.27, 2.21, 1.21], [0.065, 0.09, 0.07]);
    }
    art.block(horse, color, [0, 1.46, -0.2], [1.46, 0.45, 1.2]);
    art.block(horse, C.woodDark, [0, 1.75, -0.2], [0.86, 0.22, 0.6]);
    art.block(horse, C.woodDark, [0, 0.81, -1.05], [0.19, 1.25, 0.2], [0.7, 0, 0]);
    for (const x of [-0.42, 0.42]) for (const z of [-0.73, 0.7]) {
      const leg = art.group(root, x, 1.1, z);
      art.block(leg, '#aa713f', [0, -0.38, 0], [0.24, 0.76, 0.25]);
      art.block(leg, C.woodDark, [0, -0.87, 0.07], [0.3, 0.32, 0.37]);
      art.bake(leg); legs.push(leg);
    }
    art.bake(horse);
  } else for (const x of [-0.23, 0.23]) {
    const leg = art.group(root, x, 0.64, 0);
    art.block(leg, hero ? C.iron : '#584d49', [0, -0.2, 0], [0.32, 0.52, 0.32]);
    art.block(leg, C.woodDark, [0, -0.52, 0.09], [0.4, 0.3, 0.53]); art.bake(leg); legs.push(leg);
  }
  let cloak: THREE.Group | undefined;
  if (hero || knight) {
    cloak = art.group(body, 0, torsoY + 0.38, -0.43);
    art.block(cloak, color, [0, -0.54, -0.14], [0.98, 1.38, 0.15], [0.12, 0, 0]);
    art.block(cloak, hero ? C.gold : C.steel, [0, -1.14, -0.2], [1.01, 0.15, 0.16]); art.bake(cloak);
  }
  for (const part of [torso, head, leftArm, rightArm]) art.bake(part);
  if (hero) root.scale.setScalar(1.32);
  return { root, body, head, leftArm, rightArm, legs, cloak, sword: blade, bow: longbow, horse };
}

export function createGolem(art: CartoonArt): UnitRig {
  const root = new THREE.Group(), body = art.group(root), torso = art.group(body);
  const head = art.group(body, 0, 4.45, 0.1), leftArm = art.group(body, -2.15, 3.65), rightArm = art.group(body, 2.15, 3.65);
  art.block(torso, '#7e90a3', [0, 2.85, 0], [3.5, 3.3, 2.2]);
  art.block(torso, '#acbec7', [0, 3.15, 1.12], [2.3, 1.5, 0.3]);
  art.shape(torso, art.rock, '#ffb85c', [0, 3.05, 1.42], [0.65, 0.78, 0.4]);
  art.block(torso, '#4f657e', [0, 1.65, 1.06], [3.2, 0.55, 0.38]);
  for (const x of [-1.3, 1.3]) art.block(torso, '#60758d', [x, 3.05, 0.7], [0.65, 1.48, 1.02]);
  art.block(head, '#9faeb9', [0, 0, 0], [1.92, 1.35, 1.48]);
  art.block(head, '#344660', [0, 0.05, 0.78], [1.65, 0.3, 0.17]);
  for (const x of [-0.46, 0.46]) art.block(head, '#ffd37c', [x, 0.05, 0.9], [0.36, 0.2, 0.16]);
  art.block(head, '#42526b', [0, -0.4, 0.77], [0.7, 0.17, 0.2]);
  for (const x of [-0.82, 0.82]) art.shape(head, art.cone, '#dae4dd', [x, 0.93, 0], [0.29, 1.2, 0.27], [0, 0, x * -0.45]);
  for (const arm of [leftArm, rightArm]) {
    art.shape(arm, art.rock, '#b1c2cc', [0, 0, 0], [1.15, 1.1, 1.15]);
    art.block(arm, '#788ba4', [0, -0.9, 0], [1.07, 1.88, 1.15]);
    art.block(arm, '#aebfca', [0, -2.05, 0.16], [1.58, 1.08, 1.46]);
    art.block(arm, '#edb159', [0, -1.02, 0.61], [0.3, 1.06, 0.12]); art.bake(arm);
  }
  const legs: THREE.Group[] = [];
  for (const x of [-0.91, 0.91]) {
    const leg = art.group(root, x, 1.5, 0);
    art.block(leg, '#61768f', [0, -0.39, 0], [1.16, 1.16, 1.28]);
    art.block(leg, '#a4b8c2', [0, -1.12, 0.26], [1.38, 0.72, 1.89]); art.bake(leg); legs.push(leg);
  }
  art.bake(torso); art.bake(head);
  return { root, body, head, leftArm, rightArm, legs };
}

export function createKeep(art: CartoonArt, team: number, tier: number) {
  const root = new THREE.Group(), color = TEAMS[team].color;
  art.block(root, C.stoneShade, [0, 0.45, 0], [8.7, 0.9, 7.7]);
  art.block(root, C.stone, [0, 2.4, 0], [6.7, 4, 5.7]);
  art.shape(root, art.roof, color, [0, 5.04, 0], [7.65, 3, 6.35]);
  art.block(root, C.gold, [0, 6.5, 0], [0.25, 0.22, 6.3]);
  for (const x of [-3.35, 3.35]) for (const z of [-2.85, 2.85]) {
    art.shape(root, art.cylinder, C.stoneShade, [x, 2.2, z], [1.45, 4.4, 1.45]);
    art.shape(root, art.cylinder, C.stone, [x, 4.45, z], [1.65, 0.75, 1.65]);
    art.shape(root, art.cone, color, [x, 5.7 + tier * 0.16, z], [1.95, 2.3 + tier * 0.3, 1.95]);
    art.block(root, C.iron, [x, 2.64, z + 1.22], [0.38, 0.85, 0.15]);
    if (tier >= 3) art.flag(root, color, x, 7, z, 1.4);
  }
  art.block(root, C.woodDark, [0, 1.65, 3.0], [1.9, 2.4, 0.3]);
  for (const x of [-0.9, 0.9]) art.block(root, C.stoneShade, [x, 1.72, 3.24], [0.27, 2.75, 0.36]);
  art.block(root, C.stoneShade, [0, 3.12, 3.25], [2.3, 0.5, 0.4]);
  art.block(root, C.gold, [0, 1.65, 3.2], [0.08, 2.17, 0.08]);
  for (const x of [-2, 2]) art.block(root, '#ffe29c', [x, 2.9, 2.94], [0.64, 0.85, 0.15]);
  for (let i = 0; i < 3; i++) art.block(root, C.stoneShade, [0, 0.12 + i * 0.12, 4.7 - i * 0.5], [2.65, 0.23, 1.1]);
  art.flag(root, color, 0, 6.7, 0, 2.3);
  art.bake(root); return root;
}

export function createGate(art: CartoonArt, gate: Gate, team: number) {
  const root = new THREE.Group(), color = TEAMS[team].color;
  for (const x of [-13, 13]) {
    art.block(root, C.stoneShade, [x, 0.35, 0], [3.5, 0.7, 4.2]);
    art.block(root, C.stone, [x, 2.6, 0], [2.85, 4.8, 3.4]);
    art.block(root, C.woodDark, [x, 4.9, 0], [3.3, 0.6, 3.9]);
    art.shape(root, art.roof, color, [x, 6.1, 0], [4.1, 2.1, 4.2]);
    art.flag(root, color, x, 7.2, 0, 1.45);
    for (const z of [-1.76, 1.76]) art.block(root, C.iron, [x, 2.8, z], [0.55, 1, 0.16]);
  }
  if (!gate.open) {
    for (let x = -11.5; x < 12; x += 1) {
      art.block(root, x % 2 ? '#ba814d' : C.wood, [x, 2.2, 0], [0.88, 4.4, 0.85]);
      art.shape(root, art.cone, C.iron, [x, 4.65, 0], [0.4, 0.65, 0.39]);
    }
    for (const y of [1.15, 3.18]) {
      art.block(root, C.iron, [0, y, 0.49], [24, 0.25, 0.17]);
      for (let x = -11; x <= 11; x += 2) art.shape(root, art.ball, C.gold, [x, y, 0.62], [0.09, 0.09, 0.08]);
    }
    for (const x of [-0.35, 0.35]) art.shape(root, art.ring, C.gold, [x, 2.0, 0.68], [0.26, 0.26, 0.26]);
  } else for (const x of [-10.4, 10.4]) {
    art.block(root, C.wood, [x, 2.2, 1.45], [3.6, 4.4, 0.65], [0, x > 0 ? -1.25 : 1.25, 0]);
    art.block(root, C.iron, [x, 3, 1.5], [3.7, 0.3, 0.7], [0, x > 0 ? -1.25 : 1.25, 0]);
  }
  if (gate.tower) {
    art.block(root, C.stoneShade, [0, 6.08, 0], [25.5, 0.85, 4.6]);
    art.block(root, C.wood, [0, 6.59, 0], [24.5, 0.19, 3.8]);
    for (let x = -11; x < 12; x += 2) for (const z of [-2.2, 2.2]) art.block(root, C.stone, [x, 7.04, z], [1.25, 1.2, 0.8]);
    for (const x of [-6, 0, 6]) art.block(root, color, [x, 6.71, 0], [3.1, 0.09, 2.5]);
    for (const x of [-12, 12]) art.block(root, C.woodDark, [x, 4, -1], [0.24, 5.2, 0.24]);
  }
  art.bake(root); return root;
}

export function createStructure(art: CartoonArt, s: Structure, level: number) {
  const root = new THREE.Group(), color = TEAMS[s.team].color;
  art.block(root, C.dirt, [0, 0.15, 0], [9, 0.35, 8]);
  art.block(root, '#d8bf85', [0, 0.32, 0], [8.1, 0.2, 7.1]);
  if (s.building === 'base') {
    art.block(root, C.stoneShade, [0, 0.9, 0], [6.1, 1.4, 5]);
    for (const x of [-2.5, 2.5]) art.block(root, C.stone, [x, 1.65, 0], [1.2, 2.5, 2.2]);
    art.flag(root, color, 0, 0.9, 0, 4.6);
    art.block(root, C.gold, [0, 0.75, 2.3], [2.2, 0.28, 0.35]);
  } else if (s.building === 'barracks') {
    art.block(root, C.stone, [0, 1.78, 0], [6.2, 3.1, 4.65]);
    art.shape(root, art.roof, color, [0, 4.09, 0], [7.1, 2.3, 5.4]);
    art.block(root, C.woodDark, [0, 1.48, 2.49], [1.75, 2.3, 0.26]);
    art.block(root, C.gold, [0, 3.34, 2.81], [1.3, 0.65, 0.18]);
    for (const sign of [-1, 1]) art.block(root, C.steel, [sign * 0.15, 3.4, 2.99], [0.13, 1.1, 0.06], [0, 0, sign * 0.55]);
    for (const x of [-2.36, 2.36]) art.block(root, C.iron, [x, 2.05, 2.47], [0.55, 0.85, 0.16]);
    art.flag(root, color, 2.8, 4.8, -1.8, 1.8);
    for (const x of [-3.1, 3.1]) { art.shape(root, art.cylinder, C.wood, [x, 0.81, 3.1], [0.42, 1.3, 0.42]); art.block(root, C.steel, [x, 1.23, 3.1], [0.9, 0.9, 0.15]); }
  } else if (s.building === 'crafting') {
    art.block(root, C.stoneShade, [0, 1.47, -0.3], [5.8, 2.6, 4.6]);
    art.shape(root, art.roof, color, [0, 3.58, -0.5], [6.6, 2.15, 5.3]);
    art.block(root, '#634a3b', [-1.3, 1.18, 2.12], [1.9, 1.75, 0.27]);
    art.block(root, '#f09848', [-1.3, 0.85, 2.32], [1.52, 0.5, 0.14]);
    art.shape(root, art.cone, '#ffcc65', [-1.3, 1.2, 2.41], [0.43, 0.81, 0.13]);
    art.block(root, C.darkStone, [1.4, 4.02, -0.95], [1.06, 3.6, 1.17]);
    for (let y = 3; y <= 5; y += 0.6) art.block(root, C.stoneShade, [1.4, y, -0.31], [1.1, 0.11, 0.16]);
    art.block(root, C.woodDark, [1.23, 0.72, 2.8], [1.15, 1, 0.9]);
    art.block(root, C.iron, [1.23, 1.45, 2.8], [1.65, 0.38, 0.69]);
    art.block(root, C.steel, [1.53, 1.65, 2.8], [2.2, 0.2, 0.76]);
    art.shape(root, art.rock, C.gold, [-2.85, 0.75, 1.35], [0.65, 0.72, 0.61]);
  } else if (s.building === 'goldmine') {
    for (let i = 0; i < 4; i++) art.rockAt(root, i % 2 * 3 - 1.5, Math.floor(i / 2) * 2 - 1, 2.65, i % 2 ? '#778c99' : '#9da9ab', i);
    art.block(root, C.ink, [0, 1.16, 2.06], [2.48, 2.22, 0.42]);
    for (const x of [-1.43, 1.43]) art.block(root, C.wood, [x, 1.27, 2.38], [0.45, 2.8, 0.43]);
    art.block(root, C.wood, [0, 2.57, 2.4], [3.35, 0.46, 0.55]);
    for (const x of [-0.6, 0.6]) art.block(root, C.iron, [x, 0.51, 3.05], [0.14, 0.08, 3.2]);
    art.block(root, C.woodDark, [0, 0.84, 3.18], [1.45, 0.78, 1.11]);
    for (const x of [-0.79, 0.79]) art.shape(root, art.cylinder, C.iron, [x, 0.58, 3.14], [0.28, 0.15, 0.28], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 5; i++) art.shape(root, art.rock, i % 2 ? '#f0aa39' : C.gold, [i % 3 * 0.42 - 0.4, 1.32, 3.14 + Math.floor(i / 3) * 0.25], [0.34, 0.38, 0.3]);
  } else if (s.building === 'forest') {
    for (let i = 0; i < 3; i++) art.tree(root, i * 2.65 - 2.65, -1 + i % 2 * 1.25, 0.74 + i * 0.08, i);
    for (let i = 0; i < 4; i++) art.shape(root, art.cylinder, '#af7446', [i % 2 * 1.1 - 0.55, 0.72 + Math.floor(i / 2) * 0.5, 2.5], [0.45, 3.1, 0.45], [Math.PI / 2, 0, 0]);
    art.block(root, C.woodDark, [2.8, 0.6, 2.7], [1.25, 0.8, 1.2]);
    art.block(root, C.steel, [2.8, 1.3, 2.7], [0.7, 0.7, 0.18], [0, 0, -0.5]);
    art.beam(root, C.wood, [2.8, 0.65, 2.7], [3.2, 2.1, 2.7], 0.07);
  } else {
    for (let i = 0; i < 5; i++) art.rockAt(root, i % 3 * 2.1 - 2.1, Math.floor(i / 3) * 2 - 1, 1.95 + i % 2 * 0.5, i % 2 ? '#9cabb1' : '#748c98', i * 0.7);
    for (const x of [-2.5, 2.5]) art.block(root, C.wood, [x, 2.1, 1.75], [0.32, 3.8, 0.36]);
    art.block(root, C.wood, [0, 3.95, 1.75], [5.6, 0.42, 0.42]);
    art.shape(root, art.cylinder, C.iron, [1.55, 3.91, 1.8], [0.44, 0.31, 0.44], [Math.PI / 2, 0, 0]);
    art.beam(root, '#e2c08b', [1.55, 3.75, 1.85], [1.55, 1.65, 1.85], 0.025);
    art.block(root, C.iron, [1.55, 1.47, 1.85], [0.89, 0.65, 0.95]);
    art.block(root, color, [-2.5, 3.05, 1.96], [0.9, 0.59, 0.12]);
  }
  if (level > 1) {
    art.flag(root, color, -3.9, 0.4, -3.05, 2.2 + level * 0.35);
    for (let i = 0; i < level - 1; i++) art.shape(root, art.rock, C.gold, [-2 + i * 0.75, 0.63, 3.48], [0.19, 0.21, 0.12]);
  }
  if (!level && s.building !== 'base') {
    // Neutral roofs and a small scaffold clearly mark an unbuilt production site.
    for (const x of [-4.2, 4.2]) art.block(root, C.wood, [x, 0.9, 3.7], [0.15, 1.5, 0.15]);
    art.block(root, '#e8d8ac', [0, 0.92, 3.7], [8.5, 0.13, 0.18]);
  }
  art.bake(root); return root;
}
