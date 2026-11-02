import { sweepDrop } from '../shared/drop-physics.ts';
import { compatibleCheckpointContent } from '../shared/checkpoint-content.ts';
import { BOUNDS } from '../shared/world-bounds.ts';
import type { ContentManifest, Stack } from '../shared/content.ts';
import { copyStack, sameStack, validStack } from '../shared/inventory.ts';
import type { WorldPort } from '../shared/engine-port.ts';
import type { DropView } from '../shared/gameplay.ts';
import {
  MAGNET_RADIUS,
  DROP_LIFETIME_TICKS,
  DROP_HALF_WIDTH,
  DROP_HEIGHT,
  DROP_MERGE_RADIUS,
  DROP_MERGE_TICKS,
  DROP_PICKUP_TICKS,
  DROP_MAGNET_SPEED,
} from '../shared/gameplay.ts';
import {
  checkpointObject,
  checkpointInteger,
  checkpointIdentity,
  checkpointPosition,
  checkpointVelocity,
  checkpointCounterId,
  freezeStack,
} from './checkpoint-values.ts';
export type DropsCheckpoint = Readonly<{
  schema: 1;
  contentHash: string;
  tick: number;
  nextId: number;
  entries: readonly Readonly<{
    id: string;
    revision: number;
    stack: Stack;
    position: readonly [number, number, number];
    velocity: readonly [number, number, number];
    expiresIn: number;
    pickupIn: number;
    owner: string | null;
    ownerPickupIn: number;
  }>[];
}>;
type Drop = DropView & {
  velocity: number[];
  expires: number;
  pickupAt: number;
  owner: string | null;
  ownerPickupAt: number;
};
/** Room-owned bodies and simulation-time expiry. No client coordinates or pickup awards enter. */
export class Drops {
  private values = new Map<string, Drop>();
  private views = new WeakMap<Drop, DropView>();
  private nextId = 0;
  private items: Map<string, ContentManifest['items'][number]>;
  private contentHash: string;
  private blocks: ContentManifest['blocks'];
  constructor(content: ContentManifest) {
    this.items = new Map(content.items.map((item) => [item.itemType, item]));
    this.contentHash = content.hash;
    this.blocks = content.blocks;
  }
  checkpoint(tick: number): DropsCheckpoint {
    if (!checkpointInteger(tick, 0, Number.MAX_SAFE_INTEGER - DROP_LIFETIME_TICKS))
      throw new Error('invalid drops checkpoint tick');
    if ([...this.values.values()].some((drop) => tick < drop.expires - DROP_LIFETIME_TICKS))
      throw new Error('drops checkpoint predates a live body');
    return Object.freeze({
      schema: 1,
      contentHash: this.contentHash,
      tick,
      nextId: this.nextId,
      entries: Object.freeze(
        [...this.values.values()].map((drop) =>
          Object.freeze({
            id: drop.id,
            revision: drop.revision,
            stack: freezeStack(drop.stack)!,
            position: Object.freeze([...drop.position]) as readonly [number, number, number],
            velocity: Object.freeze([...drop.velocity]) as readonly [number, number, number],
            expiresIn: Math.max(0, drop.expires - tick),
            pickupIn: Math.max(0, drop.pickupAt - tick),
            owner: drop.owner,
            ownerPickupIn: Math.max(0, drop.ownerPickupAt - tick),
          }),
        ),
      ),
    });
  }
  static fromCheckpoint(content: ContentManifest, value: unknown): Drops {
    const invalid = (): never => {
      throw new Error('invalid drops checkpoint');
    };
    if (
      !checkpointObject(value, ['schema', 'contentHash', 'tick', 'nextId', 'entries']) ||
      value.schema !== 1 ||
      !compatibleCheckpointContent(value.contentHash, content) ||
      !checkpointInteger(value.tick, 0, Number.MAX_SAFE_INTEGER - DROP_LIFETIME_TICKS) ||
      !checkpointInteger(value.nextId) ||
      !Array.isArray(value.entries)
    )
      return invalid();
    const restored = new Drops(content),
      entries = new Map<string, Drop>();
    for (const d of value.entries) {
      if (
        !checkpointObject(d, [
          'id',
          'revision',
          'stack',
          'position',
          'velocity',
          'expiresIn',
          'pickupIn',
          'owner',
          'ownerPickupIn',
        ]) ||
        !checkpointCounterId(d.id, 'drop', value.nextId) ||
        entries.has(d.id) ||
        !checkpointInteger(d.revision) ||
        !validStack(d.stack, restored.items) ||
        !checkpointPosition(d.position) ||
        !checkpointVelocity(d.velocity) ||
        !checkpointInteger(d.expiresIn, 0, DROP_LIFETIME_TICKS) ||
        !checkpointInteger(d.pickupIn, 0, 6) ||
        !checkpointInteger(d.ownerPickupIn, 0, 30) ||
        d.ownerPickupIn < d.pickupIn ||
        d.ownerPickupIn > d.expiresIn ||
        (d.owner !== null && !checkpointIdentity(d.owner))
      )
        return invalid();
      entries.set(d.id, {
        id: d.id,
        revision: d.revision,
        stack: copyStack(d.stack)!,
        position: [...d.position],
        velocity: [...d.velocity],
        expires: value.tick + d.expiresIn,
        pickupAt: value.tick + d.pickupIn,
        owner: d.owner,
        ownerPickupAt: value.tick + d.ownerPickupIn,
      });
    }
    restored.values = entries;
    restored.nextId = value.nextId;
    return restored;
  }
  get size(): number {
    return this.values.size;
  }
  add(
    stack: Stack,
    position: readonly number[],
    tick: number,
    owner: string | null = null,
    velocity: readonly number[] = [0, 2, 0],
  ): string {
    if (
      !validStack(stack, this.items) ||
      !checkpointPosition(position) ||
      !checkpointVelocity(velocity) ||
      !checkpointInteger(tick, 0, Number.MAX_SAFE_INTEGER - DROP_LIFETIME_TICKS) ||
      (owner !== null && !checkpointIdentity(owner)) ||
      this.nextId === Number.MAX_SAFE_INTEGER
    )
      throw new Error('invalid dropped body');
    const id = `drop-${++this.nextId}`;
    this.values.set(id, {
      id,
      revision: 0,
      stack: copyStack(stack)!,
      position: [...position] as [number, number, number],
      velocity: [...velocity],
      expires: tick + DROP_LIFETIME_TICKS,
      pickupAt: tick + 6,
      owner,
      ownerPickupAt: tick + 30,
    });
    return id;
  }
  /** Stable scatter survives deterministic replays without global random state. */
  scatter(
    stack: Stack,
    cell: readonly number[],
    tick: number,
    owner: string | null = null,
  ): string {
    const angle = (this.nextId + 1) * 2.399963229728653;
    const radius = 0.1 + ((this.nextId * 7) % 23) / 100;
    return this.add(
      stack,
      [
        cell[0] + 0.5 + Math.sin(angle) * radius,
        cell[1] + 0.25,
        cell[2] + 0.5 + Math.cos(angle) * radius,
      ],
      tick,
      owner,
      [Math.sin(angle) * 1.3, 1.6 + (this.nextId % 7) * 0.2, Math.cos(angle) * 1.3],
    );
  }
  releaseThrower(actor: string, origin: readonly number[]): void {
    for (const drop of this.values.values())
      if (
        drop.owner === actor &&
        Math.hypot(...drop.position.map((v, i) => v - origin[i])) >= MAGNET_RADIUS
      )
        drop.owner = null;
  }
  pull(id: string, origin: readonly number[], world: WorldPort): void {
    const drop = this.values.get(id);
    if (!drop) return;
    const distance = Math.hypot(...drop.position.map((v, i) => v - origin[i]));
    if (distance < 0.00001) return;
    const step = Math.min(distance, (DROP_MAGNET_SPEED * DROP_PICKUP_TICKS) / 30);
    this.move(
      drop,
      world,
      drop.position.map((v, i) => ((origin[i] - v) / distance) * step),
    );
    drop.velocity.fill(0);
  }
  private move(drop: Drop, world: WorldPort, delta: readonly number[]): void {
    const state = sweepDrop(world, this.blocks, ...drop.position, delta[0], delta[1], delta[2]);
    const position = [
      Math.max(BOUNDS.minX + DROP_HALF_WIDTH, Math.min(BOUNDS.maxX - DROP_HALF_WIDTH, state[0])),
      Math.max(0, Math.min(256 - DROP_HEIGHT, state[1])),
      Math.max(BOUNDS.minZ + DROP_HALF_WIDTH, Math.min(BOUNDS.maxZ - DROP_HALF_WIDTH, state[2])),
    ] as [number, number, number];
    for (let i = 0; i < 3; i++) if (state[i + 3] || state[i] !== position[i]) drop.velocity[i] = 0;
    if (position.some((v, i) => Math.abs(v - drop.position[i]) > 0.00001)) {
      drop.position = position;
      drop.revision++;
    }
  }
  /** Only non-full, compatible stacks enter the per-material spatial search.
   * Distinct drops may overlap; merging never moves either body's position. */
  private mergeNearby(world: WorldPort, tick: number): void {
    const materials = new Map<string, Map<string, Drop[]>>();
    for (const drop of this.values.values()) {
      const maxStack = this.items.get(drop.stack.itemType)!.maxStack;
      if (
        maxStack <= 1 ||
        drop.stack.count >= maxStack ||
        tick < drop.pickupAt ||
        !world.has_column(Math.floor(drop.position[0] / 16), Math.floor(drop.position[2] / 16))
      )
        continue;
      let buckets = materials.get(drop.stack.itemType);
      if (!buckets) materials.set(drop.stack.itemType, (buckets = new Map()));
      const cx = Math.floor(drop.position[0] / 0.5),
        cy = Math.floor(drop.position[1] / 0.5),
        cz = Math.floor(drop.position[2] / 0.5);
      search: for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (let z = -1; z <= 1; z++) {
            for (const other of buckets.get(`${cx + x},${cy + y},${cz + z}`) ?? []) {
              if (
                other.stack.count >= maxStack ||
                drop.owner !== other.owner ||
                !sameStack(drop.stack, other.stack)
              )
                continue;
              const distanceSquared = drop.position.reduce(
                (sum, v, i) => sum + (v - other.position[i]) ** 2,
                0,
              );
              if (
                distanceSquared > DROP_MERGE_RADIUS ** 2 ||
                !world.line_clear(
                  drop.position[0],
                  drop.position[1] + DROP_HEIGHT / 2,
                  drop.position[2],
                  other.position[0],
                  other.position[1] + DROP_HEIGHT / 2,
                  other.position[2],
                )
              )
                continue;
              const count = Math.min(drop.stack.count, maxStack - other.stack.count);
              other.stack = { ...other.stack, count: other.stack.count + count };
              other.pickupAt = Math.max(other.pickupAt, drop.pickupAt);
              other.ownerPickupAt = Math.max(other.ownerPickupAt, drop.ownerPickupAt);
              other.expires = Math.min(other.expires, drop.expires);
              other.revision++;
              this.take(drop.id, count);
              if (!this.values.has(drop.id)) break search;
            }
          }
      if (!this.values.has(drop.id)) continue;
      const key = `${cx},${cy},${cz}`;
      const list = buckets.get(key) ?? [];
      list.push(drop);
      buckets.set(key, list);
    }
  }
  step(world: WorldPort, tick: number): void {
    for (const [id, drop] of this.values) {
      if (tick >= drop.expires) {
        this.values.delete(id);
        continue;
      }
      const [x, y, z] = drop.position;
      if (!world.has_column(Math.floor(x / 16), Math.floor(z / 16))) continue;
      drop.velocity[1] = Math.max(-12, drop.velocity[1] - 18 / 30);
      this.move(
        drop,
        world,
        drop.velocity.map((v) => v / 30),
      );
      drop.velocity[0] *= 0.9;
      drop.velocity[2] *= 0.9;
    }
    if (tick % DROP_MERGE_TICKS === 0) this.mergeNearby(world, tick);
  }
  /** Immutable public replicas, reused across viewers until this body's revision
   * changes. Query arrays remain caller-owned; private physics/pickup data never leave.
   */
  snapshot(position: ArrayLike<number>, radius: number): DropView[] {
    const result: DropView[] = [];
    for (const drop of this.values.values()) {
      if (
        !(
          Math.hypot(
            drop.position[0] - position[0],
            drop.position[1] - position[1],
            drop.position[2] - position[2],
          ) <= radius
        )
      )
        continue;
      let view = this.views.get(drop);
      if (!view || view.revision !== drop.revision) {
        view = Object.freeze({
          id: drop.id,
          revision: drop.revision,
          stack: freezeStack(drop.stack)!,
          position: Object.freeze([...drop.position]) as readonly [number, number, number],
        });
        this.views.set(drop, view);
      }
      result.push(view);
    }
    return result;
  }
  nearby(position: ArrayLike<number>, radius: number): DropView[] {
    return [...this.values.values()]
      .filter(
        (drop) =>
          Math.hypot(
            drop.position[0] - position[0],
            drop.position[1] - position[1],
            drop.position[2] - position[2],
          ) <= radius,
      )
      .map((drop) => ({
        id: drop.id,
        revision: drop.revision,
        stack: copyStack(drop.stack)!,
        position: [...drop.position] as [number, number, number],
      }));
  }
  eligible(id: string, actor: string, tick: number): boolean {
    const drop = this.values.get(id);
    return !!drop && tick >= drop.pickupAt && drop.owner !== actor;
  }
  take(id: string, count: number): void {
    const drop = this.values.get(id);
    if (!drop || !Number.isInteger(count) || count < 1 || count > drop.stack.count)
      throw new Error('invalid pickup commit');
    if (count === drop.stack.count) this.values.delete(id);
    else {
      drop.stack = { ...drop.stack, count: drop.stack.count - count };
      drop.revision++;
    }
  }
  dispose(): void {
    this.values.clear();
    this.views = new WeakMap();
  }
}
