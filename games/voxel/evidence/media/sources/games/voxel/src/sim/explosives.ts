import type { WorldPort } from '../shared/engine-port.ts';
import type { ExplosiveRule, ContentManifest } from '../shared/content.ts';
import type { ExplosiveView } from '../shared/explosives.ts';
import { around } from '../shared/protocol.ts';
import {
  checkpointObject,
  checkpointInteger,
  checkpointIdentity,
  checkpointPosition,
  checkpointVelocity,
  checkpointCounterId,
} from './checkpoint-values.ts';
export type ExplosivesCheckpoint = Readonly<{
  schema: 1;
  contentHash: string;
  next: number;
  entries: readonly Readonly<{
    id: string;
    revision: number;
    state: number;
    position: readonly [number, number, number];
    velocity: readonly [number, number, number];
    remaining: number;
    total: number;
    owner: string;
  }>[];
}>;
export type Primed = ExplosiveView & Readonly<{ owner: string; rule: ExplosiveRule }>;
type Body = { -readonly [K in keyof Primed]: Primed[K] } & { velocity: number[] };
/** Fixed-room-time bodies. Readiness can delay a due blast, never fabricate empty terrain. */
export class Explosives {
  private values = new Map<string, Body>();
  private next = 0;
  owners(): readonly string[] {
    return [...new Set([...this.values.values()].map((body) => body.owner))].sort();
  }
  checkpoint(content: ContentManifest): ExplosivesCheckpoint {
    return Object.freeze({
      schema: 1,
      contentHash: content.hash,
      next: this.next,
      entries: Object.freeze(
        [...this.values.values()].map((body) => {
          const family = content.blocks[body.state]?.name,
            rule = content.behavior.find((block) => block.family === family)?.explosive;
          if (
            !rule ||
            rule.fuse !== body.rule.fuse ||
            rule.radius !== body.rule.radius ||
            rule.damage !== body.rule.damage
          )
            throw new Error('explosive checkpoint content mismatch');
          return Object.freeze({
            id: body.id,
            revision: body.revision,
            state: body.state,
            position: Object.freeze([...body.position]) as readonly [number, number, number],
            velocity: Object.freeze([...body.velocity]) as readonly [number, number, number],
            remaining: body.remaining,
            total: body.total,
            owner: body.owner,
          });
        }),
      ),
    });
  }
  static fromCheckpoint(content: ContentManifest, value: unknown): Explosives {
    const invalid = (): never => {
      throw new Error('invalid explosives checkpoint');
    };
    if (
      !checkpointObject(value, ['schema', 'contentHash', 'next', 'entries']) ||
      value.schema !== 1 ||
      value.contentHash !== content.hash ||
      !checkpointInteger(value.next) ||
      !Array.isArray(value.entries)
    )
      return invalid();
    const restored = new Explosives(),
      entries = new Map<string, Body>();
    for (const b of value.entries) {
      if (
        !checkpointObject(b, [
          'id',
          'revision',
          'state',
          'position',
          'velocity',
          'remaining',
          'total',
          'owner',
        ]) ||
        !checkpointCounterId(b.id, 'tnt', value.next) ||
        entries.has(b.id) ||
        !checkpointInteger(b.revision) ||
        !checkpointInteger(b.state, 1, content.blocks.length - 1) ||
        !checkpointPosition(b.position) ||
        !checkpointVelocity(b.velocity) ||
        !checkpointInteger(b.total, 30, 900) ||
        !checkpointInteger(b.remaining, 0, b.total) ||
        b.remaining !== Math.max(0, b.total - b.revision) ||
        !checkpointIdentity(b.owner)
      )
        return invalid();
      const rule = content.behavior.find(
        (block) => block.family === content.blocks[b.state as number].name,
      )?.explosive;
      if (!rule) return invalid();
      entries.set(b.id, {
        id: b.id,
        revision: b.revision,
        state: b.state,
        position: [...b.position],
        velocity: [...b.velocity],
        remaining: b.remaining,
        total: b.total,
        owner: b.owner,
        rule: { ...rule },
      });
    }
    restored.values = entries;
    restored.next = value.next;
    return restored;
  }
  get size(): number {
    return this.values.size;
  }
  get positions(): readonly (readonly number[])[] {
    return [...this.values.values()].map((body) => body.position);
  }
  add(
    owner: string,
    state: number,
    position: readonly [number, number, number],
    rule: ExplosiveRule,
    fuse = rule.fuse,
  ): string {
    if (
      !checkpointIdentity(owner) ||
      this.next === Number.MAX_SAFE_INTEGER ||
      !Number.isInteger(state) ||
      state < 1 ||
      state >= 65535 ||
      !checkpointPosition(position) ||
      !Number.isInteger(fuse) ||
      fuse < 30 ||
      fuse > 900 ||
      !Number.isInteger(rule.fuse) ||
      rule.fuse < 30 ||
      rule.fuse > 900 ||
      !Number.isInteger(rule.radius) ||
      rule.radius < 1 ||
      rule.radius > 4 ||
      !Number.isInteger(rule.damage) ||
      rule.damage < 1 ||
      rule.damage > 20
    )
      throw new Error('invalid primed explosive');
    const id = `tnt-${++this.next}`;
    this.values.set(id, {
      id,
      revision: 0,
      state,
      position: [...position],
      remaining: fuse,
      total: fuse,
      owner,
      rule: { ...rule },
      velocity: [0, 2, 0],
    });
    return id;
  }
  step(world: WorldPort): void {
    for (const body of this.values.values()) {
      body.remaining = Math.max(0, body.remaining - 1);
      body.revision++;
      const [x, y, z] = body.position;
      if (
        !around(Math.floor(x / 16), Math.floor(z / 16), 1).every((p) => world.has_column(p.x, p.z))
      )
        continue;
      body.velocity[1] = Math.max(-12, body.velocity[1] - 18 / 30);
      const moved = world.sweep_body(
        x,
        y,
        z,
        body.velocity[0] / 30,
        body.velocity[1] / 30,
        body.velocity[2] / 30,
        0.45,
        0.9,
      );
      body.position = [
        Math.max(-255.55, Math.min(255.55, moved[0])),
        Math.max(0, Math.min(255.1, moved[1])),
        Math.max(-255.55, Math.min(255.55, moved[2])),
      ];
      for (let axis = 0; axis < 3; axis++)
        if (moved[axis + 3] || body.position[axis] !== moved[axis]) body.velocity[axis] = 0;
    }
  }
  due(): Primed[] {
    return [...this.values.values()]
      .filter((body) => body.remaining === 0)
      .map(({ velocity, ...body }) => ({ ...body, position: [...body.position] }));
  }
  remove(id: string): void {
    this.values.delete(id);
  }
  nearby(position: ArrayLike<number>, radius: number): ExplosiveView[] {
    return [...this.values.values()]
      .filter(
        (body) =>
          Math.hypot(...body.position.map((value, axis) => value - position[axis])) <= radius,
      )
      .map(({ owner, rule, velocity, ...body }) => ({ ...body, position: [...body.position] }));
  }
  dispose(): void {
    this.values.clear();
  }
}
