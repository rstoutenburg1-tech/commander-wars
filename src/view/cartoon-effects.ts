import * as THREE from 'three';
import type { Effect } from '../game/types';
import { CartoonArt, PALETTE as C } from './cartoon-art';

interface Particle { mesh: THREE.Object3D; angle: number; distance: number; height: number; speed: number }
export interface EffectView {
  root: THREE.Group; kind: string; duration: number; rings: THREE.Mesh[]; particles: Particle[];
  projectile?: THREE.Group; impact?: THREE.Group; emblem?: THREE.Group; beam?: THREE.Mesh;
  materials: THREE.MeshBasicMaterial[]; geometries: THREE.BufferGeometry[];
}

export class CartoonEffects {
  private slash = new THREE.TorusGeometry(1, 0.06, 5, 20, Math.PI * 1.2);
  constructor(private art: CartoonArt) {}
  create(e: Effect): EffectView {
    const v: EffectView = { root: new THREE.Group(), kind: e.kind ?? (e.to ? 'arrow' : 'rally'), duration: e.duration ?? e.life,
      rings: [], particles: [], materials: [], geometries: [] };
    const root = v.root, kind = v.kind;
    if (e.to) {
      const start = new THREE.Vector3(e.x, (e.height ?? 0) + 1.75, e.z), end = new THREE.Vector3(e.to.x, (e.toHeight ?? 0) + 1.75, e.to.z);
      v.impact = this.art.group(root, end.x, end.y, end.z);
      for (let i = 0; i < 6; i++) {
        const shard = this.art.shape(v.impact, this.art.cone, i % 2 ? '#fff2bd' : '#ffb75d', [Math.sin(i) * 0.22, Math.cos(i) * 0.22, 0], [0.12, 0.8, 0.11], [0, 0, i]);
        shard.userData.flash = true;
      }
      this.art.bake(v.impact);
      if (kind === 'melee') {
        const arc = new THREE.Mesh(this.slash, this.glow(v, '#fff2b0', 0.85));
        arc.position.copy(start.clone().lerp(end, 0.65)); arc.rotation.x = Math.PI / 2 - 0.25;
        arc.userData.baseScale = Math.min(2.7, Math.max(1.2, start.distanceTo(end) * 0.55));
        arc.scale.setScalar(arc.userData.baseScale); root.add(arc); v.rings.push(arc);
      } else {
        const projectile = this.art.group(root); v.projectile = projectile;
        if (kind === 'shot') {
          this.art.shape(projectile, this.art.ball, '#fff3b4', [0, 0, 0], [0.14, 0.14, 0.3]);
          this.art.shape(projectile, this.art.cone, '#ffc763', [0, 0, -0.7], [0.18, 1.5, 0.18], [-Math.PI / 2, 0, 0]);
          const flash = this.art.group(root, start.x, start.y, start.z);
          this.art.shape(flash, this.art.rock, '#ffca6b', [0, 0, 0], [0.52, 0.52, 0.52]);
          this.art.shape(flash, this.art.ball, '#fff8dc', [0, 0, 0], [0.26, 0.26, 0.26]);
          flash.userData.muzzle = true; this.art.bake(flash);
        } else {
          this.art.shape(projectile, this.art.cylinder, '#d4a36b', [0, 0, 0], [0.04, 1.15, 0.04], [Math.PI / 2, 0, 0]);
          this.art.shape(projectile, this.art.cone, '#d6e7e5', [0, 0, 0.74], [0.12, 0.35, 0.11], [Math.PI / 2, 0, 0]);
          for (const r of [0, Math.PI / 2]) this.art.block(projectile, e.color, [0, 0, -0.46], [0.23, 0.04, 0.27], [0, 0, r]);
        }
        this.art.bake(projectile);
      }
      return v;
    }
    root.position.set(e.x, (e.height ?? 0) + 0.38, e.z);
    if (kind === 'boss-warning') {
      const disc = new THREE.Mesh(this.art.disc, this.glow(v, '#ee773e', 0.25)); disc.rotation.x = -Math.PI / 2; disc.scale.setScalar(e.radius); root.add(disc);
      this.addRing(v, '#ffb763', e.radius, 0.01);
      this.addRing(v, '#ffe394', e.radius * 0.55, 0.025);
      return v;
    }
    this.addRing(v, e.color, 1, 0.03);
    this.addRing(v, '#fff3bf', 1, 0.12);
    const emblem = this.art.group(root, 0, 1.6, 0); v.emblem = emblem;
    if (kind === 'wind') {
      this.cross(emblem, '#b8ffb8', 1.3);
      for (let i = 0; i < 8; i++) {
        const p = this.art.group(root); this.cross(p, i % 2 ? '#dbffb4' : '#89edac', 0.34);
        v.particles.push({ mesh: p, angle: i / 8 * Math.PI * 2, distance: 1.25 + i % 3, height: i % 3, speed: 1.9 });
      }
    } else if (kind === 'cleave') {
      for (let i = 0; i < 3; i++) {
        const arc = new THREE.Mesh(this.slash, this.glow(v, i % 2 ? '#fff1b0' : '#ffa44c', 0.8));
        arc.rotation.x = -Math.PI / 2; arc.userData.baseRotation = i * 2.1;
        arc.rotation.z = arc.userData.baseRotation; arc.position.y = 0.8 + i * 0.22; root.add(arc); v.rings.push(arc);
      }
      emblem.visible = false; this.burst(v, '#ffd578', 14);
    } else if (kind === 'warcry') {
      // A rising red sun and radiating chevrons make the offensive buff unmistakable.
      this.art.shape(emblem, this.art.rock, '#ffcf88', [0, 0.4, 0], [0.75, 0.9, 0.75]);
      for (let i = 0; i < 12; i++) {
        const ray = this.art.group(root);
        this.art.shape(ray, this.art.cone, i % 2 ? '#ffb57c' : '#ed7157', [0, 0, 0], [0.3, 1.4, 0.28], [0, 0, -Math.PI / 2]);
        v.particles.push({ mesh: ray, angle: i / 12 * Math.PI * 2, distance: 1.5, height: 0.5, speed: 0.9 });
      }
    } else if (kind === 'standfast') {
      this.art.block(emblem, '#85cfee', [0, 0.1, 0], [1.6, 1.95, 0.3]);
      this.art.block(emblem, '#d8f5ee', [0, 0.1, 0.2], [1.28, 1.58, 0.12]);
      this.art.block(emblem, '#529cce', [0, 0.1, 0.31], [0.3, 1.28, 0.08]);
      this.art.block(emblem, '#529cce', [0, 0.25, 0.31], [0.89, 0.27, 0.08]);
      for (let i = 0; i < 10; i++) {
        const shield = this.art.group(root); this.art.block(shield, '#8fcdee', [0, 0, 0], [0.48, 0.69, 0.11]);
        v.particles.push({ mesh: shield, angle: i / 10 * Math.PI * 2, distance: Math.min(e.radius * 0.7, 7), height: 0.6, speed: 0.75 });
      }
    } else if (kind === 'ultimate') {
      this.art.shape(emblem, this.art.ring, '#ffd884', [0, 0.35, 0], [1.16, 1.16, 1.16]);
      for (let i = 0; i < 5; i++) this.art.shape(emblem, this.art.cone, '#ffe9a8', [Math.sin(i * 1.26) * 0.87, 0.65, Math.cos(i * 1.26) * 0.87], [0.2, 0.79, 0.2]);
      this.cross(emblem, '#fff4c2', 0.9);
      const pillar = new THREE.Mesh(this.art.cylinder, this.glow(v, '#ffeaa5', 0.12));
      pillar.position.y = 3; pillar.scale.set(1.25, 6, 1.25); root.add(pillar); v.beam = pillar;
      this.burst(v, '#fff3b0', 20);
    } else if (kind === 'rally') {
      this.art.flag(emblem, '#ffdf86', -0.35, -0.4, 0, 2.1);
      for (let i = 0; i < 8; i++) {
        const flag = this.art.group(root); this.art.flag(flag, i % 2 ? '#ffe5a0' : '#ffd36e', 0, 0, 0, 0.75);
        v.particles.push({ mesh: flag, angle: i / 8 * Math.PI * 2, distance: Math.min(e.radius * 0.55, 9), height: 0.2, speed: 0.8 });
      }
    } else {
      emblem.visible = false; this.burst(v, kind === 'boss-smash' ? '#d5a564' : '#ffe5a1', kind === 'boss-smash' ? 18 : 10);
    }
    for (const p of v.particles) this.art.bake(p.mesh as THREE.Group);
    this.art.bake(emblem);
    return v;
  }
  private glow(v: EffectView, color: string, opacity: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    mat.userData.opacity = opacity; v.materials.push(mat); return mat;
  }
  private addRing(v: EffectView, color: string, radius: number, y: number) {
    const ring = new THREE.Mesh(this.art.ring, this.glow(v, color, 0.8));
    ring.rotation.x = -Math.PI / 2; ring.position.y = y; ring.scale.setScalar(radius); v.root.add(ring); v.rings.push(ring);
  }
  private cross(parent: THREE.Group, color: string, size: number) {
    this.art.block(parent, color, [0, 0, 0], [0.27 * size, 1.1 * size, 0.2 * size]);
    this.art.block(parent, color, [0, 0, 0], [1.1 * size, 0.27 * size, 0.2 * size]);
  }
  private burst(v: EffectView, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const mesh = this.art.group(v.root);
      this.art.shape(mesh, this.art.rock, color, [0, 0, 0], [0.15 + i % 3 * 0.05, 0.3, 0.15]);
      v.particles.push({ mesh, angle: i / count * Math.PI * 2, distance: 0.75 + i % 3 * 0.3, height: i % 4 * 0.15, speed: 2 + i % 3 });
    }
  }
  update(v: EffectView, e: Effect) {
    const t = Math.min(1, Math.max(0, 1 - e.life / Math.max(v.duration, 0.001))), fade = Math.min(1, (1 - t) * 3);
    for (const mat of v.materials) mat.opacity = mat.userData.opacity * fade;
    if (e.to) {
      const start = new THREE.Vector3(e.x, (e.height ?? 0) + 1.75, e.z), end = new THREE.Vector3(e.to.x, (e.toHeight ?? 0) + 1.75, e.to.z);
      const flight = Math.min(1, t / 0.78);
      if (v.projectile) {
        v.projectile.visible = flight < 1;
        v.projectile.position.copy(start.clone().lerp(end, flight));
        const arc = v.kind === 'arrow' ? Math.min(2.6, start.distanceTo(end) * 0.12) : 0;
        v.projectile.position.y += Math.sin(flight * Math.PI) * arc;
        const tangent = end.clone().sub(start); tangent.y += Math.cos(flight * Math.PI) * arc * Math.PI;
        v.projectile.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent.normalize());
      }
      if (v.impact) { v.impact.visible = v.kind === 'melee' || t > 0.65; v.impact.scale.setScalar(0.2 + Math.sin(Math.max(0, t - 0.58) / 0.42 * Math.PI) * 0.75); v.impact.rotation.z = t * 2; }
      for (const arc of v.rings) { arc.rotation.z = -1.4 + t * 3.3; arc.scale.setScalar(arc.userData.baseScale * (1 + t * 0.2)); }
      for (const child of v.root.children) if (child.userData.muzzle) { child.visible = t < 0.25; child.scale.setScalar(1 - t * 2.5); }
      return;
    }
    if (v.kind === 'boss-warning') {
      for (let i = 0; i < v.rings.length; i++) v.rings[i].scale.setScalar(e.radius * (i ? 0.38 + t * 0.58 : 1));
      return;
    }
    const eased = 1 - Math.pow(1 - t, 3);
    for (let i = 0; i < v.rings.length; i++) {
      const r = v.rings[i], radius = v.kind === 'cleave' && i > 1 ? e.radius * (0.35 + eased * 0.65) : e.radius * Math.max(0.15, eased - i * 0.07);
      r.scale.setScalar(radius); if (v.kind === 'cleave' && i > 1) r.rotation.z = r.userData.baseRotation + t * 4.6;
    }
    if (v.emblem) { v.emblem.position.y = 1.6 + t * 1.25; v.emblem.scale.setScalar(Math.min(1.05, 0.35 + t * 4) * Math.min(1, (1 - t) * 3)); v.emblem.rotation.y = t * 0.45; }
    for (const p of v.particles) {
      const burst = v.kind === 'boss-smash' || v.kind === 'charge' || v.kind === 'cleave' || v.kind === 'ultimate';
      const radius = burst ? p.distance + t * Math.min(e.radius, 8) : p.distance * (0.65 + eased * 0.35);
      const angle = p.angle + (v.kind === 'wind' ? t * 3 : t * 0.2);
      p.mesh.position.set(Math.sin(angle) * radius, p.height + (burst ? Math.sin(t * Math.PI) * p.speed : t * p.speed), Math.cos(angle) * radius);
      p.mesh.rotation.set(t * p.speed, -angle, burst ? t * 3 : 0);
      p.mesh.scale.setScalar(fade * (burst ? 1 - t * 0.4 : 1));
    }
    if (v.beam) { v.beam.scale.x = v.beam.scale.z = 1.25 + Math.sin(t * Math.PI) * 0.8; v.beam.scale.y = 6 + t * 2; }
  }
  dispose(v: EffectView) {
    this.art.disposeObject(v.root); for (const mat of v.materials) mat.dispose(); for (const geom of v.geometries) geom.dispose();
  }
}
