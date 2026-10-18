import type { Effect, Unit, World } from '../game/types';

export const effectIdentity = (effect: Effect, time: number) => JSON.stringify([
  effect.kind, effect.source, effect.target, effect.x, effect.z, effect.to?.x, effect.to?.z, effect.radius, effect.color,
  Math.round((time - (effect.duration ?? effect.life) + effect.life) * 1000),
]);

interface Frame { time: number; units: Map<number, Unit> }

/** Presentation only. Orders, hit points, costs and targeting use the current server state. */
export class SnapshotPlayback {
  private frames: Frame[] = [];
  private effects = new Map<string, { effect: Effect; born: number; until: number }>();
  private receivedAt = 0;
  private renderedAt = 0;
  private time = 0;

  reset() { this.frames = []; this.effects.clear(); this.renderedAt = 0; }

  push(world: World, now: number, reset = false) {
    if (reset || this.frames.length && world.time < this.frames.at(-1)!.time) this.reset();
    if (!this.frames.length) { this.time = world.time; this.renderedAt = now; }
    const frame = { time: world.time, units: new Map(world.units.map(unit => [unit.id, { ...unit }])) };
    if (this.frames.at(-1)?.time === world.time) this.frames[this.frames.length - 1] = frame;
    else this.frames.push(frame);
    this.frames = this.frames.slice(-12); this.receivedAt = now;
    for (const [id, entry] of this.effects) if (entry.until < world.time - 1.2) this.effects.delete(id);
    for (const effect of world.effects) {
      const id = effectIdentity(effect, world.time), until = world.time + effect.life;
      const existing = this.effects.get(id);
      if (existing) Object.assign(existing.effect, effect);
      else this.effects.set(id, { effect: { ...effect }, born: until - (effect.duration ?? effect.life), until });
    }
  }

  sample(world: World, now: number): World {
    if (!this.frames.length) return world;
    const latest = this.frames.at(-1)!;
    // Browsers suspend animation frames in background tabs. Resume near the
    // current server state instead of replaying a minute of stale presentation.
    if (now - this.renderedAt > 1000 || latest.time - this.time > 1) this.time = Math.max(this.time, latest.time - 0.1);
    const elapsed = Math.max(0, Math.min((now - this.renderedAt) / 1000, 0.1)); this.renderedAt = now;
    // Play about one snapshot behind. Adjust gently for jitter, never run time
    // backwards, and freeze at the latest state rather than inventing combat.
    const desired = Math.min(latest.time, latest.time - 0.1 + Math.max(0, now - this.receivedAt) / 1000);
    const rate = Math.max(0.5, Math.min(1.5, 1 + (desired - this.time) * 4));
    this.time = Math.min(latest.time, Math.max(this.time, Math.min(desired, this.time + elapsed * rate)));
    let before = this.frames[0], after = latest;
    for (const frame of this.frames) {
      if (frame.time <= this.time) before = frame;
      if (frame.time >= this.time) { after = frame; break; }
    }
    const span = after.time - before.time;
    const t = span > 0 ? Math.max(0, Math.min(1, (this.time - before.time) / span)) : 1;
    const units = world.units.map(unit => {
      const a = before.units.get(unit.id), b = after.units.get(unit.id);
      // Real teleports (including tower mounting) must not slide through terrain.
      if (!a || !b || a.garrison !== b.garrison || Math.hypot(b.x - a.x, b.z - a.z) > Math.max(3, unit.speed * span * 3)) return unit;
      const angle = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
      return { ...unit, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, facing: a.facing + angle * t };
    });
    const effects: Effect[] = [];
    for (const [id, entry] of this.effects) {
      if (entry.until <= this.time) { this.effects.delete(id); continue; }
      if (entry.born <= this.time + 0.001) { entry.effect.life = entry.until - this.time; effects.push(entry.effect); }
    }
    return { ...world, time: this.time, units, effects };
  }
}
