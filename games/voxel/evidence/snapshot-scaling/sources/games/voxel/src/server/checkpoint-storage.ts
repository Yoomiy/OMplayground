import { createHash } from 'node:crypto';
import { readRoomCheckpoint } from '../sim/room-checkpoint.ts';
import type { RoomCheckpoint, RoomCheckpointInput } from '../sim/room-checkpoint.ts';
import { checkpointInteger, checkpointObject } from '../sim/checkpoint-values.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { BuildIdentity } from '../shared/protocol.ts';

export type StoredObject = Readonly<{ key: string; sha256: string; bytes: number }>;
export type CheckpointPointer = Readonly<{
  ownerEpoch: number;
  sequence: number;
  object: StoredObject;
}>;
export type RoomLease = Readonly<{
  room: string;
  worldId: string;
  owner: string;
  epoch: number;
  sequence: number;
  /** Remaining lease time measured by the metadata service, not its wall-clock timestamp. */
  validForMs: number;
  checkpoint: CheckpointPointer | null;
}>;
export interface CheckpointObjects {
  /** Create only. Existing keys must contain identical bytes; never overwrite an object. */
  put(object: StoredObject, bytes: Uint8Array): Promise<void>;
  get(object: StoredObject): Promise<Uint8Array>;
}
export interface RoomMetadata {
  acquire(room: string, owner: string): Promise<RoomLease | null>;
  renew(lease: RoomLease): Promise<{ validForMs: number } | null>;
  /** Compare the live owner/epoch, unexpired lease and previous sequence in one transaction.
   * Retrying an identical committed pointer is idempotent while that owner still holds the lease.
   */
  commit(
    lease: RoomLease,
    previousSequence: number,
    pointer: CheckpointPointer,
    objects: readonly StoredObject[],
  ): Promise<boolean>;
  release(lease: RoomLease): Promise<void>;
}
type Manifest = Readonly<{
  schema: 1;
  worldId: string;
  ownerEpoch: number;
  sequence: number;
  room: Omit<RoomCheckpoint, 'world'>;
  world: Readonly<{ schema: 1; contentHash: string; columns: readonly StoredObject[] }>;
}>;
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8');
const prefix = (worldId: string) => `v1/${hash(worldId)}/`;
function objectFor(worldId: string, bytes: Uint8Array): StoredObject {
  const sha256 = hash(bytes);
  return Object.freeze({
    key: `${prefix(worldId)}${sha256}.json`,
    sha256,
    bytes: bytes.byteLength,
  });
}
function validObject(value: unknown, worldId: string): value is StoredObject {
  return (
    checkpointObject(value, ['key', 'sha256', 'bytes']) &&
    typeof value.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(value.sha256) &&
    value.key === `${prefix(worldId)}${value.sha256}.json` &&
    checkpointInteger(value.bytes, 1)
  );
}
/** Bound IO concurrency, independently of the number of actors, columns or rooms. */
async function eachObject<T, R>(values: readonly T[], run: (value: T) => Promise<R>): Promise<R[]> {
  const result: R[] = new Array(values.length);
  let next = 0;
  const pending = await Promise.allSettled(
    Array.from({ length: Math.min(4, values.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= values.length) return;
        result[index] = await run(values[index]);
      }
    }),
  );
  const failed = pending.find((entry) => entry.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  return result;
}
export class CheckpointFenced extends Error {
  constructor() {
    super('checkpoint owner or sequence fenced');
  }
}
/** One room's immutable object graph. Only a metadata commit makes a staged graph active. */
export class CheckpointStorage {
  private columns = new Set<string>();
  private saving = false;
  readonly worldId: string;
  private objects: CheckpointObjects;
  private metadata: RoomMetadata;
  private content: ContentManifest;
  private build: BuildIdentity;
  constructor(
    worldId: string,
    objects: CheckpointObjects,
    metadata: RoomMetadata,
    content: ContentManifest,
    build: BuildIdentity,
  ) {
    this.worldId = worldId;
    this.objects = objects;
    this.metadata = metadata;
    this.content = content;
    this.build = build;
  }
  private async read(object: StoredObject): Promise<unknown> {
    if (!validObject(object, this.worldId)) throw new Error('invalid checkpoint object reference');
    const bytes = await this.objects.get(object);
    if (bytes.byteLength !== object.bytes || hash(bytes) !== object.sha256)
      throw new Error('checkpoint object integrity failure');
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      throw new Error('invalid checkpoint object JSON');
    }
  }
  async load(pointer: CheckpointPointer): Promise<RoomCheckpointInput> {
    if (
      !checkpointObject(pointer, ['ownerEpoch', 'sequence', 'object']) ||
      !checkpointInteger(pointer.ownerEpoch, 1) ||
      !checkpointInteger(pointer.sequence, 1)
    )
      throw new Error('invalid checkpoint pointer');
    const manifest = await this.read(pointer.object);
    if (
      !checkpointObject(manifest, [
        'schema',
        'worldId',
        'ownerEpoch',
        'sequence',
        'room',
        'world',
      ]) ||
      manifest.schema !== 1 ||
      manifest.worldId !== this.worldId ||
      manifest.ownerEpoch !== pointer.ownerEpoch ||
      manifest.sequence !== pointer.sequence ||
      !checkpointObject(manifest.world, ['schema', 'contentHash', 'columns']) ||
      manifest.world.schema !== 1 ||
      manifest.world.contentHash !== this.content.hash ||
      !manifest.room ||
      typeof manifest.room !== 'object' ||
      Array.isArray(manifest.room) ||
      Object.hasOwn(manifest.room, 'world') ||
      !Array.isArray(manifest.world.columns) ||
      !manifest.world.columns.every((ref) => validObject(ref, this.worldId))
    )
      throw new Error('invalid checkpoint manifest');
    const room = readRoomCheckpoint(
      { ...(manifest.room as object), world: null },
      this.content,
      this.build,
    );
    if (room.worldId !== this.worldId) throw new Error('checkpoint world mismatch');
    const refs = manifest.world.columns as StoredObject[];
    const columns = await eachObject(refs, async (ref) => {
      const value = await this.read(ref);
      if (
        !checkpointObject(value, ['schema', 'contentHash', 'column']) ||
        value.schema !== 1 ||
        value.contentHash !== this.content.hash
      )
        throw new Error('invalid checkpoint column object');
      return value.column;
    });
    // Component ownership decoders still validate every column, stack and body before startup.
    const snapshot = readRoomCheckpoint(
      {
        ...room,
        world: {
          schema: 1,
          contentHash: this.content.hash,
          columns,
        },
      },
      this.content,
      this.build,
    );
    this.columns = new Set(refs.map((ref) => ref.sha256));
    return snapshot;
  }
  async save(
    lease: RoomLease,
    sequence: number,
    snapshot: RoomCheckpoint,
  ): Promise<CheckpointPointer> {
    if (this.saving) throw new Error('checkpoint save already in flight');
    if (
      lease.worldId !== this.worldId ||
      !checkpointInteger(lease.epoch, 1) ||
      !checkpointInteger(sequence, 1) ||
      sequence !== lease.sequence + 1 ||
      snapshot.worldId !== this.worldId ||
      snapshot.contentHash !== this.content.hash ||
      snapshot.engineHash !== this.build.engineHash
    )
      throw new Error('incompatible checkpoint save');
    readRoomCheckpoint(snapshot, this.content, this.build);
    if (snapshot.world.schema !== 1 || snapshot.world.contentHash !== this.content.hash)
      throw new Error('incompatible checkpoint terrain');
    // Copy all bytes before the first await. An in-flight save never follows later mutations.
    const { world, ...room } = snapshot;
    const rows = world.columns.map((column) => {
      const bytes = jsonBytes({ schema: 1, contentHash: world.contentHash, column });
      return { bytes, object: objectFor(this.worldId, bytes) };
    });
    const manifest: Manifest = {
      schema: 1,
      worldId: this.worldId,
      ownerEpoch: lease.epoch,
      sequence,
      room,
      world: { schema: 1, contentHash: world.contentHash, columns: rows.map((row) => row.object) },
    };
    const bytes = jsonBytes(manifest),
      object = objectFor(this.worldId, bytes);
    const pointer = Object.freeze({ ownerEpoch: lease.epoch, sequence, object });
    this.saving = true;
    try {
      await eachObject(rows, async (row) => {
        if (!this.columns.has(row.object.sha256)) await this.objects.put(row.object, row.bytes);
      });
      await this.objects.put(object, bytes);
      if (
        !(await this.metadata.commit(lease, sequence - 1, pointer, [
          object,
          ...rows.map((row) => row.object),
        ]))
      )
        throw new CheckpointFenced();
      this.columns = new Set(rows.map((row) => row.object.sha256));
      return pointer;
    } finally {
      this.saving = false;
    }
  }
}
