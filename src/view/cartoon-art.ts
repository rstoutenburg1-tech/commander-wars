import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PALETTE = {
  stone: '#e2d4ab', stoneShade: '#b7a881', darkStone: '#697689', wood: '#aa6940', woodDark: '#70442e',
  iron: '#465574', steel: '#b9d9e1', gold: '#ffd46e', skin: '#f2bd82', grass: '#7cb74b', grassLight: '#9cca62',
  leaf: '#388453', leafLight: '#65b956', dirt: '#c2a56c', sand: '#e1c28a', ink: '#243a4d',
};

/** Shared primitives and materials keep the miniature army inexpensive to draw. */
export class CartoonArt {
  readonly box = new THREE.BoxGeometry(1, 1, 1);
  readonly softBox: THREE.ExtrudeGeometry;
  readonly ball = new THREE.SphereGeometry(1, 10, 7);
  readonly rock = new THREE.IcosahedronGeometry(1, 0);
  readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  readonly cone = new THREE.ConeGeometry(1, 1, 8);
  readonly ring = new THREE.TorusGeometry(1, 0.065, 5, 28);
  readonly bow = new THREE.TorusGeometry(0.65, 0.055, 5, 10, Math.PI);
  readonly disc = new THREE.CircleGeometry(1, 20);
  readonly roof: THREE.BufferGeometry;
  private materials = new Map<string, THREE.Material>();
  private vertexMaterial = new THREE.MeshPhongMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, shininess: 14 });

  constructor() {
    const s = new THREE.Shape(), r = 0.09;
    s.moveTo(-0.5 + r, -0.5); s.lineTo(0.5 - r, -0.5); s.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r);
    s.lineTo(0.5, 0.5 - r); s.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5);
    s.lineTo(-0.5 + r, 0.5); s.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r);
    s.lineTo(-0.5, -0.5 + r); s.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
    this.softBox = new THREE.ExtrudeGeometry(s, { depth: 0.84, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, steps: 1, curveSegments: 2 });
    this.softBox.translate(0, 0, -0.42); this.softBox.clearGroups();
    const profile = new THREE.Shape(); profile.moveTo(-0.5, -0.5); profile.lineTo(0, 0.5); profile.lineTo(0.5, -0.5); profile.closePath();
    this.roof = new THREE.ExtrudeGeometry(profile, { depth: 1, bevelEnabled: false, steps: 1 });
    this.roof.translate(0, 0, -0.5); this.roof.clearGroups();
  }

  material(color: string) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 14 }));
    return this.materials.get(color)!;
  }
  basic(color: string, opacity = 1) {
    const key = `basic:${color}:${opacity}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, side: THREE.DoubleSide }));
    return this.materials.get(key)!;
  }
  shape(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, p: number[], s: number[], rotation?: number[]) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.set(p[0], p[1], p[2]); mesh.scale.set(s[0], s[1], s[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(mesh); return mesh;
  }
  block(parent: THREE.Object3D, color: string, p: number[], s: number[], rotation?: number[]) { return this.shape(parent, this.softBox, color, p, s, rotation); }
  group(parent: THREE.Object3D, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  shadow(parent: THREE.Object3D, rx: number, rz = rx) {
    const mesh = new THREE.Mesh(this.disc, this.basic('#24483a', 0.22));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.11; mesh.scale.set(rx, rz, 1); parent.add(mesh); return mesh;
  }
  beam(parent: THREE.Object3D, color: string, from: number[], to: number[], radius: number) {
    const a = new THREE.Vector3(...from as [number, number, number]), b = new THREE.Vector3(...to as [number, number, number]);
    const mesh = this.shape(parent, this.cylinder, color, a.clone().add(b).multiplyScalar(0.5).toArray(), [radius, a.distanceTo(b), radius]);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return mesh;
  }
  flag(parent: THREE.Object3D, color: string, x: number, y: number, z: number, height = 2) {
    this.shape(parent, this.cylinder, PALETTE.woodDark, [x, y + height / 2, z], [0.09, height, 0.09]);
    this.block(parent, color, [x + 0.45, y + height - 0.3, z], [0.85, 0.6, 0.09]);
    this.shape(parent, this.ball, PALETTE.gold, [x, y + height + 0.06, z], [0.15, 0.15, 0.15]);
  }
  tree(parent: THREE.Object3D, x: number, z: number, size = 1, seed = 0) {
    this.shadowAt(parent, x, z, size * 1.5);
    this.shape(parent, this.cylinder, PALETTE.wood, [x, size * 1.5, z], [size * 0.35, size * 3, size * 0.35]);
    this.shape(parent, this.cone, PALETTE.leaf, [x, size * 3.25, z], [size * 2.25, size * 4.25, size * 2.25]);
    this.shape(parent, this.cone, PALETTE.leafLight, [x, size * 4.45, z], [size * 1.55, size * 3.15, size * 1.55], [0, seed, 0]);
    this.shape(parent, this.cone, '#85c75e', [x, size * 5.4, z], [size * 0.88, size * 2, size * 0.88]);
  }
  shadowAt(parent: THREE.Object3D, x: number, z: number, radius: number) { const s = this.shadow(parent, radius, radius * 0.75); s.position.x = x; s.position.z = z; }
  rockAt(parent: THREE.Object3D, x: number, z: number, size: number, color = PALETTE.darkStone, seed = 0) {
    return this.shape(parent, this.rock, color, [x, size * 0.5, z], [size, size * 0.85, size * 0.8], [0.15, seed, 0.2]);
  }

  /** Bake only static pieces, leaving animated groups and their pivots intact. */
  bake(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const meshes: THREE.Mesh[] = [];
    group.traverse(o => { if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
      for (let p = o.parent; p && p !== group; p = p.parent) if (p.userData.keepRig) return;
      const geom = o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      // All primitives need the same vertex attributes before merging.
      geom.deleteAttribute('uv');
      let material = o.material;
      if (material instanceof THREE.MeshPhongMaterial && !material.transparent) {
        if (!geom.getAttribute('color')) {
          const colors = new Float32Array(geom.getAttribute('position').count * 3), color = material.color;
          for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
          geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        }
        material = this.vertexMaterial;
      }
      if (geom.index) { const plain = geom.toNonIndexed(); geom.dispose(); byMaterial.set(material, [...(byMaterial.get(material) ?? []), plain]); }
      else byMaterial.set(material, [...(byMaterial.get(material) ?? []), geom]);
      meshes.push(o);
    } });
    for (const mesh of meshes) { mesh.removeFromParent(); if (mesh.userData.ownedGeometry) mesh.geometry.dispose(); }
    for (const [material, geoms] of byMaterial) {
      const merged = mergeGeometries(geoms, false);
      for (const geom of geoms) geom.dispose();
      if (merged) { const mesh = new THREE.Mesh(merged, material); mesh.userData.ownedGeometry = true; group.add(mesh); }
    }
  }
  disposeObject(object: THREE.Object3D) {
    object.traverse(o => {
      if (o instanceof THREE.Mesh && o.userData.ownedGeometry) o.geometry.dispose();
      if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); }
    });
  }
}
