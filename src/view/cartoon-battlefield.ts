import * as THREE from 'three';
import { ABILITIES, MAP, STATS, TEAMS } from '../game/config';
import type { Effect, Point, Unit, World, Structure, Gate } from '../game/types';
import { buildingNames, structureLevel } from '../game/structures';
import { clamp } from '../game/math';
import { CartoonArt, PALETTE } from './cartoon-art';
import { createGolem, createGate, createKeep, createStructure, createTroop, type UnitRig } from './cartoon-models';
import { createCartoonMap } from './cartoon-map';
import { CartoonEffects, type EffectView } from './cartoon-effects';

interface UnitView {
  root: THREE.Group; ring: THREE.Mesh; bar: THREE.Group; fill: THREE.Mesh; rig?: UnitRig; state: string;
  lastX: number; lastZ: number; lastTimer: number; lastHp: number; walkPhase: number; movingUntil: number; attackUntil: number; hitUntil: number; attackKind?: string;
  aura?: THREE.Group; buffRings?: THREE.Mesh[]; buffEmblems?: THREE.Group[];
}
interface BuildingView { root: THREE.Group; ring: THREE.Mesh; level: number; team: number; label: THREE.Sprite; smoke?: THREE.Group }

export class Battlefield {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-50, 50, 40, -40, 0.1, 600);
  readonly canvas = this.renderer.domElement;
  readonly focus = new THREE.Vector3(-92, 0, 94);
  readonly keys = new Set<string>();
  zoom = 60;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private views = new Map<number, UnitView>();
  private buildings = new Map<number, BuildingView>();
  private effects = new Map<Effect, EffectView>();
  private deaths: { root: THREE.Group; until: number; start: number; ring: THREE.Material; fill: THREE.Material; aura: THREE.Material[] }[] = [];
  private art = new CartoonArt();
  private effectArt = new CartoonEffects(this.art);
  private ringGeometry = new THREE.RingGeometry(0.85, 1, 32);
  private inverseRotation = new THREE.Quaternion();

  constructor(private container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor('#83bcc8');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.scene.add(new THREE.HemisphereLight('#d8ebf0', '#43654a', 1.35));
    const sun = new THREE.DirectionalLight('#fff0d0', 1.85); sun.position.set(-55, 85, 35); this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#c4e8ff', 0.45); rim.position.set(40, 35, -50); this.scene.add(rim);
    container.append(this.canvas);
    this.scene.add(createCartoonMap(this.art));
    this.label('TRADER’S HAVEN', MAP.merchant.x, MAP.merchant.z + 6.8, 1, 12);
    this.label('IRON GOLEM ARENA', MAP.boss.x, MAP.boss.z + MAP.boss.radius + 3, 0.8, 14);
    MAP.bases.forEach((b, i) => this.label(`${TEAMS[i].name.toUpperCase()} VILLAGE`, b.x, b.z + 11, 0.7, 12, TEAMS[i].color));
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }
  private makeLabel(text: string, width = 8, color = '#fff2cd') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 72;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#273a46d9'; c.beginPath(); c.roundRect(3, 3, 506, 66, 15); c.fill();
    c.strokeStyle = '#d9b778'; c.lineWidth = 3; c.stroke();
    c.font = 'bold 30px Trebuchet MS, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(text, 256, 38, 474);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, toneMapped: false }));
    sprite.scale.set(width, width * 72 / 512, 1); return sprite;
  }
  private label(text: string, x: number, z: number, y: number, width: number, color?: string) {
    const sprite = this.makeLabel(text, width, color); sprite.position.set(x, y, z); this.scene.add(sprite);
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width, height);
    const aspect = width / Math.max(height, 1);
    this.camera.left = -this.zoom * aspect / 2; this.camera.right = this.zoom * aspect / 2;
    this.camera.top = this.zoom / 2; this.camera.bottom = -this.zoom / 2;
    this.camera.updateProjectionMatrix(); this.updateCamera();
  }
  private updateCamera() {
    this.camera.position.set(this.focus.x, 80, this.focus.z + 65);
    this.camera.lookAt(this.focus); this.camera.updateMatrixWorld();
  }
  pan(dt: number) {
    const step = dt * this.zoom * 0.5;
    if (this.keys.has('arrowup')) this.focus.z -= step;
    if (this.keys.has('arrowdown')) this.focus.z += step;
    if (this.keys.has('arrowleft')) this.focus.x -= step;
    if (this.keys.has('arrowright')) this.focus.x += step;
    this.focus.x = clamp(this.focus.x, -MAP.half, MAP.half); this.focus.z = clamp(this.focus.z, -MAP.half, MAP.half);
    this.updateCamera();
  }
  center(p: Point) { this.focus.set(p.x, 0, p.z); this.updateCamera(); }
  dragPan(fromX: number, fromY: number, toX: number, toY: number) {
    this.setRay(fromX, fromY);
    const from = this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
    this.setRay(toX, toY);
    const to = this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
    if (!from || !to) return;
    this.focus.x = clamp(this.focus.x + from.x - to.x, -MAP.half, MAP.half);
    this.focus.z = clamp(this.focus.z + from.z - to.z, -MAP.half, MAP.half);
    this.updateCamera();
  }
  ground(clientX: number, clientY: number): Point | null {
    this.setRay(clientX, clientY);
    const point = this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
    return point ? { x: clamp(point.x, -MAP.half, MAP.half), z: clamp(point.z, -MAP.half, MAP.half) } : null;
  }
  private setRay(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1), this.camera);
  }
  pick(x: number, y: number): number | undefined {
    this.setRay(x, y);
    const hit = this.ray.intersectObjects([...this.views.values(), ...this.buildings.values()].map(v => v.root), true)[0];
    let o: THREE.Object3D | undefined = hit?.object;
    while (o && o.userData.id === undefined) o = o.parent ?? undefined;
    return o?.userData.id;
  }
  screen(p: Point) {
    const v = new THREE.Vector3(p.x, 1, p.z).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) * r.width / 2, y: r.top + (1 - v.y) * r.height / 2 };
  }
  private selectionRing(radius: number) {
    const ring = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ color: '#c8ff7a', side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.17; ring.scale.setScalar(radius); return ring;
  }
  private unitState(u: Unit, w: World, gate?: Gate) {
    return u.kind === 'gate' ? `${u.team}:${gate?.open}:${gate?.tower}` : u.kind === 'base' ? `${u.team}:${w.players[u.team].tier}` : u.kind;
  }
  private createUnit(u: Unit, w: World, gate?: Gate): UnitView {
    const root = new THREE.Group(); root.userData.id = u.id;
    let model: THREE.Group, rig: UnitRig | undefined;
    if (u.kind === 'base') model = createKeep(this.art, u.team, w.players[u.team].tier);
    else if (u.kind === 'gate') model = createGate(this.art, gate!, u.team);
    else { rig = u.kind === 'boss' ? createGolem(this.art) : createTroop(this.art, u); model = rig.root; }
    root.add(model);
    this.art.shadow(root, u.kind === 'base' ? 5.9 : u.kind === 'gate' ? 13 : u.kind === 'boss' ? 3.3 : u.kind === 'knight' ? 1.3 : u.kind === 'hero' ? 1.3 : 0.8, u.kind === 'gate' ? 2.2 : undefined);
    const ring = this.selectionRing(STATS[u.kind].radius * (u.kind === 'hero' ? 1.6 : 1.55)); root.add(ring);
    const bar = new THREE.Group(); bar.position.y = u.kind === 'base' ? 9.7 : u.kind === 'gate' ? 9 : u.kind === 'boss' ? 6.2 : u.kind === 'hero' ? 4.1 : u.kind === 'knight' ? 4.15 : 2.9;
    const width = u.kind === 'base' ? 6 : u.kind === 'gate' ? 10 : u.kind === 'boss' ? 5.7 : u.kind === 'hero' ? 2.3 : 1.75;
    const back = new THREE.Mesh(this.art.box, this.art.basic('#2d3b42')); back.scale.set(width + 0.13, 0.27, 0.04); bar.add(back);
    const fill = new THREE.Mesh(this.art.box, new THREE.MeshBasicMaterial({ color: '#9bdc58' }));
    fill.scale.set(width, 0.17, 0.05); fill.position.z = 0.035; fill.userData.width = width; bar.add(fill); root.add(bar);
    let aura: THREE.Group | undefined, buffRings: THREE.Mesh[] | undefined, buffEmblems: THREE.Group[] | undefined;
    if (u.kind === 'hero') {
      aura = this.art.group(root); buffRings = [];
      for (const [color, radius] of [['#f6d883', ABILITIES.rally.radius], ['#f49772', ABILITIES.warcry.radius], ['#8dd4f0', ABILITIES.standfast.radius]] as [string, number][]) {
        const ring = new THREE.Mesh(this.art.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.48, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.13 + buffRings.length * 0.03; ring.scale.setScalar(radius); aura.add(ring); buffRings.push(ring);
      }
      buffEmblems = [this.art.group(aura, -1.2, 3.8, 0), this.art.group(aura, 0, 4.3, 0), this.art.group(aura, 1.2, 3.9, 0)];
      this.art.flag(buffEmblems[0], PALETTE.gold, -0.2, 0, 0, 0.8);
      for (const x of [-0.23, 0.23]) this.art.block(buffEmblems[1], '#f49772', [x, 0, 0], [0.53, 0.14, 0.11], [0, 0, x > 0 ? -0.6 : 0.6]);
      this.art.block(buffEmblems[2], '#8dd4f0', [0, 0, 0], [0.7, 0.9, 0.16]);
      this.art.block(buffEmblems[2], '#e8f2d6', [0, 0, 0.12], [0.18, 0.68, 0.05]);
      buffEmblems.forEach(g => this.art.bake(g));
    }
    this.scene.add(root);
    return { root, ring, bar, fill, rig, state: this.unitState(u, w, gate), lastX: u.x, lastZ: u.z, lastTimer: u.attackTimer, lastHp: u.hp,
      walkPhase: u.id * 1.6, movingUntil: 0, attackUntil: 0, hitUntil: 0, aura, buffRings, buffEmblems };
  }
  private createBuilding(s: Structure, level: number): BuildingView {
    const root = new THREE.Group(); root.userData.id = s.id; root.position.set(s.x, 0.24, s.z);
    this.art.shadow(root, 5.3, 4.5);
    root.add(createStructure(this.art, s, level));
    const ring = this.selectionRing(5.3); root.add(ring);
    const label = this.makeLabel(s.building === 'base' ? 'CLAIMED OUTPOST' : `${buildingNames[s.building]}${level ? ` ${'I'.repeat(level)}` : ' · BUILD'}`, 7.5);
    label.position.set(0, s.building === 'crafting' ? 6.6 : 5.85, 0); root.add(label);
    let smoke: THREE.Group | undefined;
    if (s.building === 'crafting' && level) {
      smoke = this.art.group(root, 1.4, 5.9, -0.95);
      for (let i = 0; i < 3; i++) this.art.shape(smoke, this.art.ball, i % 2 ? '#d2cbc0' : '#bbbcb3', [0.13 * i, i * 0.6, 0], [0.35, 0.34, 0.35]);
    }
    this.scene.add(root); return { root, ring, level, team: s.team, label, smoke };
  }
  private animateUnit(v: UnitView, u: Unit, w: World) {
    const traveled = Math.hypot(u.x - v.lastX, u.z - v.lastZ);
    if (traveled > 0.001) v.movingUntil = w.time + 0.12;
    const moving = w.time < v.movingUntil;
    v.walkPhase += traveled * (u.kind === 'boss' ? 1.8 : u.kind === 'knight' ? 4.5 : 5.8);
    if (u.attackTimer > v.lastTimer + 0.1) v.attackUntil = w.time + (u.kind === 'boss' ? 0.55 : 0.36);
    if (u.hp < v.lastHp - 0.01) v.hitUntil = w.time + 0.18;
    v.lastX = u.x; v.lastZ = u.z; v.lastTimer = u.attackTimer; v.lastHp = u.hp;
    const rig = v.rig;
    if (!rig) return;
    const phase = v.walkPhase, attack = Math.max(0, (v.attackUntil - w.time) / (u.kind === 'boss' ? 0.55 : 0.36));
    const strike = attack > 0 ? Math.sin((1 - attack) * Math.PI) : 0;
    rig.body.position.y = moving ? Math.abs(Math.sin(phase)) * (u.kind === 'boss' ? 0.09 : 0.13) : Math.sin(w.time * 2 + u.id) * 0.023;
    rig.body.rotation.z = w.time < v.hitUntil ? Math.sin(w.time * 50) * 0.06 : 0;
    rig.head.rotation.y = !moving && !attack ? Math.sin(w.time * 0.9 + u.id) * 0.045 : 0;
    for (let i = 0; i < rig.legs.length; i++) rig.legs[i].rotation.x = moving ? Math.sin(phase + (i % 3 ? Math.PI : 0)) * (u.kind === 'boss' ? 0.18 : 0.58) : 0;
    if (rig.horse) { rig.horse.position.y = moving ? Math.abs(Math.sin(phase)) * 0.09 : 0; rig.body.position.y += moving ? Math.abs(Math.sin(phase)) * 0.09 : 0; }
    if (rig.cloak) rig.cloak.rotation.x = moving ? -0.18 + Math.sin(phase * 0.75) * 0.1 : Math.sin(w.time * 2.2 + u.id) * 0.035;
    const heroRanged = u.kind === 'hero' && (u.garrison !== undefined || w.players[u.team].combatStyle === 'ranged') && !(attack && v.attackKind === 'melee');
    if (rig.sword) rig.sword.visible = !heroRanged;
    if (u.kind === 'hero' && rig.bow) rig.bow.visible = heroRanged;
    if (u.kind === 'archer' || heroRanged) {
      rig.leftArm.rotation.set(-1.15 - strike * 0.2, -0.13, -0.07);
      rig.rightArm.rotation.set(-0.6 - strike * 0.65, strike * -0.55, 0.12);
    } else if (u.kind === 'musketeer') {
      rig.rightArm.rotation.set(-1.15 + strike * 0.25, 0.04, 0);
      rig.leftArm.rotation.set(-1.15 + strike * 0.1, -0.32, 0);
      rig.body.position.z = -strike * 0.09;
    } else {
      rig.body.position.z = strike * (u.kind === 'boss' ? 0.3 : 0.12);
      rig.rightArm.rotation.set(attack ? -0.5 - strike * 1.9 : moving ? Math.sin(phase + Math.PI) * 0.28 : -0.1, attack ? 0.3 - strike * 0.9 : 0, attack ? -strike * 0.2 : 0);
      rig.leftArm.rotation.set(u.kind === 'boss' && attack ? -strike * 1.8 : moving ? Math.sin(phase) * 0.23 : -0.08, 0, 0);
    }
    if (v.buffRings) {
      const p = w.players[u.team], untils = [p.rallyUntil, p.warcryUntil, p.standfastUntil];
      v.buffRings.forEach((ring, i) => {
        ring.visible = untils[i] > w.time; (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(w.time * 3 + i) * 0.1;
        const emblem = v.buffEmblems![i]; emblem.visible = ring.visible; emblem.rotation.y = Math.sin(w.time * 1.5 + i) * 0.15;
      });
      v.aura!.rotation.y = -u.facing;
    }
  }
  render(w: World, selected: Set<number>, cursorTarget?: number) {
    const structures = new Map(w.structures.map(s => [s.id, s]));
    for (const [id, b] of this.buildings) {
      const s = structures.get(id);
      if (!s || w.players[s.team].eliminated || b.team !== s.team || b.level !== structureLevel(w, s)) {
        this.scene.remove(b.root); this.art.disposeObject(b.root); (b.ring.material as THREE.Material).dispose(); this.buildings.delete(id);
      }
    }
    for (const s of w.structures) {
      if (s.building === 'base' && !w.territories[s.site].captured || w.players[s.team].eliminated) continue;
      let b = this.buildings.get(s.id); if (!b) { b = this.createBuilding(s, structureLevel(w, s)); this.buildings.set(s.id, b); }
      b.ring.visible = selected.has(s.id) || s.id === cursorTarget;
      b.label.visible = this.zoom < 110 || b.ring.visible;
      if (b.smoke) b.smoke.children.forEach((p, i) => { const t = (w.time * 0.55 + i / 3) % 1; p.position.set(t * 0.6, t * 2.3, 0); p.scale.setScalar(0.17 + Math.sin(t * Math.PI) * 0.45); });
    }
    const living = w.units.filter(u => u.hp > 0);
    const ids = new Set(living.map(u => u.id));
    for (const [id, v] of this.views) if (!ids.has(id)) {
      v.ring.visible = false; v.bar.visible = false; if (v.aura) v.aura.visible = false;
      this.deaths.push({ root: v.root, start: w.time, until: w.time + 0.4, ring: v.ring.material as THREE.Material, fill: v.fill.material as THREE.Material, aura: v.buffRings?.map(r => r.material as THREE.Material) ?? [] }); this.views.delete(id);
    }
    for (let i = this.deaths.length - 1; i >= 0; i--) {
      const d = this.deaths[i], t = clamp((w.time - d.start) / 0.4, 0, 1);
      d.root.scale.setScalar(1 - t * 0.9); d.root.position.y = 0.24 - t * 0.7;
      if (w.time >= d.until) { this.scene.remove(d.root); this.art.disposeObject(d.root); d.ring.dispose(); d.fill.dispose(); d.aura.forEach(m => m.dispose()); this.deaths.splice(i, 1); }
    }
    for (const u of living) {
      let v = this.views.get(u.id);
      const gate = u.kind === 'gate' ? w.gates.find(g => g.id === u.id) : undefined;
      if (v && v.state !== this.unitState(u, w, gate)) {
        this.scene.remove(v.root); this.art.disposeObject(v.root); (v.ring.material as THREE.Material).dispose(); (v.fill.material as THREE.Material).dispose(); v.buffRings?.forEach(r => (r.material as THREE.Material).dispose()); this.views.delete(u.id); v = undefined;
      }
      if (!v) { v = this.createUnit(u, w, gate); this.views.set(u.id, v); }
      v.root.position.set(u.x, u.garrison !== undefined ? 6.76 : 0.24, u.z);
      if (u.kind !== 'base') v.root.rotation.y = u.facing;
      v.ring.visible = selected.has(u.id) || u.id === cursorTarget;
      (v.ring.material as THREE.MeshBasicMaterial).color.set(u.id === cursorTarget ? '#ff9a6a' : '#c8ff7a');
      this.inverseRotation.copy(v.root.quaternion).invert();
      v.bar.quaternion.copy(this.inverseRotation.multiply(this.camera.quaternion));
      const ratio = clamp(u.hp / u.maxHp, 0, 1);
      v.fill.scale.x = v.fill.userData.width * ratio;
      v.fill.position.x = -v.fill.userData.width * (1 - ratio) / 2;
      v.bar.visible = selected.has(u.id) || u.id === cursorTarget || ratio < 0.995 || u.kind === 'hero' || u.kind === 'boss' || u.kind === 'base';
      (v.fill.material as THREE.MeshBasicMaterial).color.set(w.time < v.hitUntil ? '#fff5d0' : ratio < 0.25 ? '#f47d5c' : ratio < 0.55 ? '#f7c861' : '#9bdc58');
      this.animateUnit(v, u, w);
    }
    const liveEffects = new Set(w.effects);
    for (const [e, v] of this.effects) if (!liveEffects.has(e)) { this.scene.remove(v.root); this.effectArt.dispose(v); this.effects.delete(e); }
    for (const e of w.effects) {
      let v = this.effects.get(e);
      if (!v) {
        v = this.effectArt.create(e); this.scene.add(v.root); this.effects.set(e, v);
        if (e.source !== undefined && e.to) { const source = this.views.get(e.source); if (source) { source.attackUntil = w.time + (w.units.find(u => u.id === e.source)?.kind === 'boss' ? 0.55 : 0.36); source.attackKind = e.kind; } }
      }
      this.effectArt.update(v, e);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
