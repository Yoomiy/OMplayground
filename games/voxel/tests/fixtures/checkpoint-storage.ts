import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type {
  CheckpointObjects,
  RoomMetadata,
  RoomLease,
  CheckpointPointer,
  StoredObject,
} from '../../src/server/checkpoint-storage.ts';

/** Fault-injectable contract fixture. This is not a replacement for Postgres/Storage tests. */
export class MemoryCheckpoints implements CheckpointObjects, RoomMetadata {
  now = 0;
  objects = new Map<string, Uint8Array>();
  puts: StoredObject[] = [];
  commits: CheckpointPointer[] = [];
  failPut: ((object: StoredObject) => Promise<void>) | null = null;
  failCommit: (() => Promise<void>) | null = null;
  loseCommitResponse = false;
  rows = new Map<
    string,
    {
      worldId: string;
      owner: string;
      epoch: number;
      sequence: number;
      deadline: number;
      checkpoint: CheckpointPointer | null;
    }
  >();
  async put(object: StoredObject, bytes: Uint8Array) {
    this.puts.push(object);
    if (this.failPut) await this.failPut(object);
    assert.equal(bytes.byteLength, object.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), object.sha256);
    const existing = this.objects.get(object.key);
    if (existing)
      assert.deepEqual(existing, Uint8Array.from(bytes), 'immutable keys cannot be overwritten');
    else this.objects.set(object.key, Uint8Array.from(bytes));
  }
  async get(object: StoredObject) {
    const bytes = this.objects.get(object.key);
    if (!bytes) throw new Error('checkpoint object missing');
    return Uint8Array.from(bytes);
  }
  async acquire(room: string, owner: string): Promise<RoomLease | null> {
    let row = this.rows.get(room);
    if (!row) {
      row = {
        worldId: `world-${room}`,
        owner,
        epoch: 1,
        sequence: 0,
        deadline: this.now + 30000,
        checkpoint: null,
      };
      this.rows.set(room, row);
    } else if (row.deadline > this.now && row.owner !== owner) return null;
    else if (row.deadline <= this.now || row.owner !== owner) {
      row.owner = owner;
      row.epoch++;
    }
    row.deadline = this.now + 30000;
    return Object.freeze({
      room,
      owner,
      worldId: row.worldId,
      epoch: row.epoch,
      sequence: row.sequence,
      validForMs: 30000,
      checkpoint: row.checkpoint,
    });
  }
  private owned(lease: RoomLease) {
    const row = this.rows.get(lease.room);
    return row &&
      row.owner === lease.owner &&
      row.epoch === lease.epoch &&
      row.worldId === lease.worldId &&
      row.deadline > this.now
      ? row
      : null;
  }
  async renew(lease: RoomLease) {
    const row = this.owned(lease);
    if (!row) return null;
    row.deadline = this.now + 30000;
    return { validForMs: 30000 };
  }
  async commit(lease: RoomLease, previous: number, pointer: CheckpointPointer) {
    if (this.failCommit) await this.failCommit();
    const row = this.owned(lease);
    if (!row || pointer.ownerEpoch !== lease.epoch || pointer.sequence !== previous + 1)
      return false;
    if (JSON.stringify(row.checkpoint) === JSON.stringify(pointer)) return true;
    if (row.sequence !== previous) return false;
    row.sequence = pointer.sequence;
    row.checkpoint = pointer;
    this.commits.push(pointer);
    if (this.loseCommitResponse) {
      this.loseCommitResponse = false;
      throw new Error('commit response lost');
    }
    return true;
  }
  async release(lease: RoomLease) {
    const row = this.owned(lease);
    if (row) row.deadline = this.now;
  }
}
