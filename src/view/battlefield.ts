import * as THREE from 'three';
import { MAP, STATS, TEAMS } from '../game/config';
import type { Effect, Point, Unit, World } from '../game/types';
import { clamp } from '../game/math';

interface UnitView { root: THREE.Group; ring: THREE.Mesh; bar: THREE.Group; fill: THREE.Mesh }
export class Battlefield {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-50, 50, 40, -40, 0.1, 600);
  readonly canvas = this.renderer.domElement;
  readonly focus = new THREE.Vector3(-84, 0, 88);
  readonly keys = new Set<string>();
  zoom = 45;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private views = new Map<number, UnitView>();
  private effects = new Map<Effect, THREE.Object3D>();
  private materials = new Map<string, THREE.MeshLambertMaterial>();
  private ringGeometry = new THREE.RingGeometry(0.85, 1, 28);
  private cube = new THREE.BoxGeometry(1, 1, 1);
  private helmet = new THREE.IcosahedronGeometry(0.5, 0);
  private cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  private cone = new THREE.ConeGeometry(1, 1, 6);

  constructor(private container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor('#202e35');
    this.scene.add(new THREE.HemisphereLight('#d2f1fa', '#405a40', 2.3));
    const sun = new THREE.DirectionalLight('#ffe4b4', 2.6); sun.position.set(-25, 60, 30); this.scene.add(sun);
    container.append(this.canvas);
    this.createMap();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }
  private mat(color: string) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
    return this.materials.get(color)!;
  }
  private shape(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, p: number[], s: number[]) {
    const mesh = new THREE.Mesh(geometry, this.mat(color));
    mesh.position.set(p[0], p[1], p[2]); mesh.scale.set(s[0], s[1], s[2]); parent.add(mesh); return mesh;
  }
  private label(text: string, x: number, z: number, y = 2) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 64;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#16272de0'; c.fillRect(0, 0, 512, 64);
    c.font = 'bold 28px system-ui'; c.textAlign = 'center'; c.fillStyle = '#f1f2db'; c.fillText(text, 256, 43);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
    sprite.position.set(x, y, z); sprite.scale.set(15, 1.875, 1); this.scene.add(sprite);
  }
  private createMap() {
    this.shape(this.scene, this.cube, '#253c40', [0, -1, 0], [MAP.half * 2, 1, MAP.half * 2]);
    this.shape(this.scene, this.cube, '#73816b', [0, -0.04, 0], [MAP.arenaHalf * 2, 0.2, MAP.arenaHalf * 2]);
    const grid = new THREE.GridHelper(MAP.arenaHalf * 2, 20, '#8c9783', '#7c8a72'); grid.position.y = 0.08; this.scene.add(grid);
    MAP.bases.forEach((b, i) => {
      this.shape(this.scene, this.cube, '#536647', [b.x, -0.05, b.z], [MAP.baseHalf * 2, 0.2, MAP.baseHalf * 2]);
      const path = this.shape(this.scene, this.cube, '#858269', [b.x / 2, 0.03, b.z / 2], [MAP.laneWidth, 0.12, Math.hypot(b.x, b.z)]);
      path.rotation.y = b.x * b.z > 0 ? Math.PI / 4 : -Math.PI / 4;
      this.label(`${TEAMS[i].name.toUpperCase()} KEEP`, b.x, b.z + 7, 1);
      for (let j = 0; j < 6; j++) {
        const x = b.x + (b.x < 0 ? -8 : 8) + Math.sin(j * 2) * 3;
        const z = b.z - 7 + j * 2.5;
        this.shape(this.scene, this.cylinder, '#594c36', [x, 1, z], [0.3, 2, 0.3]);
        this.shape(this.scene, this.cone, '#294c3d', [x, 3, z], [1.7, 4, 1.7]);
      }
      for (let j = 0; j < 3; j++) this.shape(this.scene, this.helmet, j === 0 ? '#d4ad59' : '#81918e', [b.x + 6 + j, 0.8, b.z + (b.z > 0 ? 8 : -8)], [2.4, 2, 2]);
      this.shape(this.scene, this.cube, '#a39b7c', [b.x - Math.sign(b.x) * 8, 1, b.z], [3, 2, 4]);
      this.shape(this.scene, this.cone, TEAMS[i].color, [b.x - Math.sign(b.x) * 8, 3, b.z], [3, 2, 3]);
    });
    this.shape(this.scene, this.cylinder, '#6a897a', [MAP.merchant.x, 0.12, MAP.merchant.z], [MAP.merchant.radius, 0.2, MAP.merchant.radius]);
    this.shape(this.scene, this.cube, '#ac9266', [MAP.merchant.x, 1, MAP.merchant.z], [5, 2, 4]);
    this.shape(this.scene, this.cone, '#e0cb8d', [MAP.merchant.x, 3, MAP.merchant.z], [5, 2, 5]);
    this.label('MERCHANT · SAFE', MAP.merchant.x, MAP.merchant.z - 6, 2);
    this.shape(this.scene, this.cylinder, '#776859', [MAP.boss.x, 0.1, MAP.boss.z], [MAP.boss.radius, 0.2, MAP.boss.radius]);
    this.label('BOSS ARENA · CONTESTED', MAP.boss.x, MAP.boss.z + MAP.boss.radius - 2, 1);
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
    if (this.keys.has('w')) this.focus.z -= step;
    if (this.keys.has('s')) this.focus.z += step;
    if (this.keys.has('a')) this.focus.x -= step;
    if (this.keys.has('d')) this.focus.x += step;
    this.focus.x = clamp(this.focus.x, -MAP.half, MAP.half); this.focus.z = clamp(this.focus.z, -MAP.half, MAP.half);
    this.updateCamera();
  }
  center(p: Point) { this.focus.set(p.x, 0, p.z); this.updateCamera(); }
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
    const hit = this.ray.intersectObjects([...this.views.values()].map(v => v.root), true)[0];
    let o: THREE.Object3D | undefined = hit?.object;
    while (o && o.userData.id === undefined) o = o.parent ?? undefined;
    return o?.userData.id;
  }
  screen(p: Point) {
    const v = new THREE.Vector3(p.x, 1, p.z).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) * r.width / 2, y: r.top + (1 - v.y) * r.height / 2 };
  }
  private createUnit(u: Unit): UnitView {
    const root = new THREE.Group(); root.userData.id = u.id;
    const color = TEAMS[u.team]?.color ?? '#e09a55';
    if (u.kind === 'base') {
      this.shape(root, this.cube, '#a5a28e', [0, 2, 0], [5, 4, 5]);
      for (const x of [-2.5, 2.5]) for (const z of [-2.5, 2.5]) {
        this.shape(root, this.cylinder, '#c2bda5', [x, 3, z], [1.1, 6, 1.1]);
        this.shape(root, this.cone, color, [x, 6.5, z], [1.6, 2, 1.6]);
      }
      this.shape(root, this.cube, color, [0, 4.5, 0], [2.5, 2, 2.5]);
    } else if (u.kind === 'boss') {
      this.shape(root, this.helmet, '#807e71', [0, 2, 0], [5, 5, 3]);
      this.shape(root, this.cube, '#f1a248', [0, 4.6, 0.5], [1.8, 1.1, 1.3]);
      for (const x of [-2, 2]) this.shape(root, this.cube, '#646e69', [x, 1.7, 0], [1.5, 3, 1.5]);
    } else {
      const scale = u.kind === 'hero' ? 1.55 : 1;
      this.shape(root, this.cube, color, [0, 1, 0], [0.85, 1.4, 0.6]);
      this.shape(root, this.helmet, '#dad3ae', [0, 2, 0], [0.8, 0.9, 0.8]);
      if (u.kind === 'hero') {
        this.shape(root, this.cone, '#ead47b', [0, 2.6, 0], [0.5, 0.6, 0.5]);
        this.shape(root, this.cube, '#ead47b', [0.8, 1.3, 0.3], [0.2, 1.8, 0.2]);
        this.shape(root, this.cube, color, [0, 1.2, -0.5], [0.9, 1.6, 0.15]);
      } else if (u.kind === 'footman') {
        this.shape(root, this.cube, '#596e79', [-0.65, 1, 0.4], [0.7, 1.1, 0.2]);
        this.shape(root, this.cube, '#e0dfc7', [0.65, 1.4, 0.2], [0.12, 1.5, 0.12]);
      } else if (u.kind === 'archer') {
        this.shape(root, this.cone, color, [0, 2.4, 0], [0.7, 0.8, 0.7]);
        this.shape(root, this.cube, '#ccb98d', [0.7, 1.2, 0.3], [0.14, 1.6, 0.2]);
      } else if (u.kind === 'musketeer') {
        this.shape(root, this.cube, '#393e3c', [0.6, 1.4, 0.8], [0.22, 0.22, 2]);
      } else {
        this.shape(root, this.cube, '#745b42', [0, 0.5, 0.3], [0.9, 1.2, 2.5]);
        this.shape(root, this.cone, '#bfcac9', [0.6, 2, 0.8], [0.2, 2.4, 0.2]);
      }
      root.scale.setScalar(scale);
    }
    const ring = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ color: '#b9fff5', side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; ring.scale.setScalar(STATS[u.kind].radius * 1.6); root.add(ring);
    const bar = new THREE.Group(); bar.position.y = u.kind === 'base' ? 8.5 : u.kind === 'boss' ? 6 : 3;
    const width = u.kind === 'base' ? 6 : u.kind === 'boss' ? 5 : 1.8;
    this.shape(bar, this.cube, '#27312f', [0, 0, 0], [width, 0.18, 0.05]);
    const fill = this.shape(bar, this.cube, color, [0, 0, 0.04], [width, 0.14, 0.05]);
    fill.userData.width = width; root.add(bar);
    this.scene.add(root); return { root, ring, bar, fill };
  }
  render(w: World, selected: Set<number>) {
    const ids = new Set(w.units.map(u => u.id));
    for (const [id, v] of this.views) if (!ids.has(id)) {
      this.scene.remove(v.root); (v.ring.material as THREE.Material).dispose(); this.views.delete(id);
    }
    for (const u of w.units) {
      let v = this.views.get(u.id);
      if (!v) { v = this.createUnit(u); this.views.set(u.id, v); }
      v.root.position.set(u.x, 0, u.z);
      if (u.kind !== 'base') v.root.rotation.y = u.facing;
      v.ring.visible = selected.has(u.id);
      v.bar.quaternion.copy(v.root.quaternion.clone().invert().multiply(this.camera.quaternion));
      const ratio = clamp(u.hp / u.maxHp, 0, 1);
      v.fill.scale.x = v.fill.userData.width * ratio;
      v.fill.position.x = -v.fill.userData.width * (1 - ratio) / 2;
    }
    for (const [e, mesh] of this.effects) if (!w.effects.includes(e)) {
      this.scene.remove(mesh);
      if (mesh instanceof THREE.Line) mesh.geometry.dispose();
      ((mesh as THREE.Mesh).material as THREE.Material).dispose(); this.effects.delete(e);
    }
    for (const e of w.effects) {
      if (this.effects.has(e)) continue;
      let obj: THREE.Object3D;
      if (e.to) {
        const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e.x, 1.5, e.z), new THREE.Vector3(e.to.x, 1.5, e.to.z)]);
        obj = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: e.color }));
      } else {
        const mesh = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ color: e.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(e.x, 0.3, e.z); mesh.scale.setScalar(e.radius); obj = mesh;
      }
      this.scene.add(obj); this.effects.set(e, obj);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
