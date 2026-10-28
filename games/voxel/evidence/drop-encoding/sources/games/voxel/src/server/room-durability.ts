import { CheckpointStorage, CheckpointFenced } from './checkpoint-storage.ts';
import type {
  CheckpointObjects,
  RoomMetadata,
  RoomLease,
  CheckpointPointer,
} from './checkpoint-storage.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { BuildIdentity } from '../shared/protocol.ts';
import type { RoomCheckpoint } from '../sim/room-checkpoint.ts';
import type { FromRoom, ToRoom } from './room-worker-protocol.ts';

export type PersistencePorts = Readonly<{ objects: CheckpointObjects; metadata: RoomMetadata }>;
type SaveRequest = {
  pause: boolean;
  promise: Promise<CheckpointPointer>;
  resolve: (pointer: CheckpointPointer) => void;
  reject: (error: Error) => void;
};
/** Async IO lives in the supervisor. One captured snapshot and one coalesced request may wait. */
export class RoomDurability {
  readonly storage: CheckpointStorage;
  private lease: RoomLease;
  private metadata: RoomMetadata;
  private onLost: () => void;
  private deadline: number;
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private renewal: ReturnType<typeof setTimeout> | null = null;
  private lost = false;
  private closed = false;
  private closing: Promise<void> | null = null;
  private post: ((message: ToRoom) => void) | null = null;
  private requestId = 0;
  private capture: {
    requestId: number;
    resolve: (value: RoomCheckpoint) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private running = false;
  private active: SaveRequest | null = null;
  private queued: SaveRequest | null = null;
  private unconfirmed: RoomCheckpoint | null = null;
  private constructor(
    ports: PersistencePorts,
    content: ContentManifest,
    build: BuildIdentity,
    lease: RoomLease,
    started: number,
    onLost: () => void,
  ) {
    this.lease = lease;
    this.metadata = ports.metadata;
    this.onLost = onLost;
    this.deadline = started + lease.validForMs - 1000;
    this.storage = new CheckpointStorage(
      lease.worldId,
      ports.objects,
      ports.metadata,
      content,
      build,
    );
    this.watchDeadline();
    this.scheduleRenewal(lease.validForMs);
  }
  static async acquire(
    ports: PersistencePorts,
    content: ContentManifest,
    build: BuildIdentity,
    room: string,
    owner: string,
    onLost: () => void,
  ): Promise<RoomDurability> {
    const started = performance.now(),
      lease = await ports.metadata.acquire(room, owner);
    if (
      !lease ||
      lease.room !== room ||
      lease.owner !== owner ||
      !lease.worldId ||
      !Number.isSafeInteger(lease.epoch) ||
      lease.epoch < 1 ||
      !Number.isSafeInteger(lease.sequence) ||
      lease.sequence < 0 ||
      (lease.checkpoint
        ? lease.checkpoint.sequence !== lease.sequence ||
          !Number.isSafeInteger(lease.checkpoint.ownerEpoch) ||
          lease.checkpoint.ownerEpoch < 1 ||
          lease.checkpoint.ownerEpoch > lease.epoch
        : lease.sequence !== 0) ||
      !Number.isFinite(lease.validForMs) ||
      lease.validForMs <= 1000 ||
      started + lease.validForMs - 1000 <= performance.now()
    )
      throw new Error('room ownership unavailable');
    return new RoomDurability(ports, content, build, lease, started, onLost);
  }
  get ownership(): RoomLease {
    if (!this.owned()) throw new Error('room ownership lost');
    return Object.freeze({ ...this.lease });
  }
  get worldId() {
    return this.lease.worldId;
  }
  get ownershipDeadline() {
    return this.deadline;
  }
  get sequence() {
    return this.lease.sequence;
  }
  owned(): boolean {
    if (!this.closed && !this.lost && performance.now() < this.deadline) return true;
    if (!this.closed) this.lose();
    return false;
  }
  async load() {
    if (!this.owned()) throw new Error('room ownership lost');
    const snapshot = this.lease.checkpoint ? await this.storage.load(this.lease.checkpoint) : null;
    if (!this.owned()) throw new Error('room ownership lost');
    return snapshot;
  }
  attach(post: (message: ToRoom) => void) {
    if (!this.owned() || this.post) throw new Error('room ownership unavailable');
    this.post = post;
    post({ type: 'ownership', deadline: this.deadline });
  }
  private watchDeadline() {
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    this.deadlineTimer = setTimeout(
      () => this.lose(),
      Math.max(0, this.deadline - performance.now()),
    );
  }
  private scheduleRenewal(validForMs: number) {
    this.renewal = setTimeout(() => void this.renew(), Math.min(10000, (validForMs - 1000) / 3));
  }
  private async renew() {
    if (!this.owned()) return;
    const started = performance.now();
    try {
      const result = await this.metadata.renew(this.lease);
      if (!this.owned()) return;
      if (!result || !Number.isFinite(result.validForMs) || result.validForMs <= 1000) {
        this.lose();
        return;
      }
      const deadline = started + result.validForMs - 1000;
      if (deadline <= performance.now()) {
        this.lose();
        return;
      }
      this.deadline = deadline;
      this.watchDeadline();
      this.post?.({ type: 'ownership', deadline });
      this.scheduleRenewal(result.validForMs);
    } catch {
      // A transient outage never extends the last confirmed deadline.
      if (this.owned()) this.renewal = setTimeout(() => void this.renew(), 500);
    }
  }
  private lose() {
    if (this.lost || this.closed) return;
    this.lost = true;
    this.cancel(new Error('room ownership lost'));
    this.onLost();
  }
  private cancel(error: Error) {
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    if (this.renewal) clearTimeout(this.renewal);
    if (this.capture) {
      clearTimeout(this.capture.timer);
      this.capture.reject(error);
      this.capture = null;
    }
    this.queued?.reject(error);
    this.queued = null;
    this.active?.reject(error);
  }
  receive(message: FromRoom) {
    if (message.type !== 'checkpoint' && message.type !== 'checkpoint-failed') return;
    const capture = this.capture;
    if (!capture || capture.requestId !== message.requestId) return;
    clearTimeout(capture.timer);
    this.capture = null;
    if (!this.owned()) capture.reject(new Error('room ownership lost'));
    else if (message.type === 'checkpoint-failed')
      capture.reject(new Error('room checkpoint capture failed'));
    else capture.resolve(message.checkpoint);
  }
  private async takeSnapshot(pause: boolean): Promise<RoomCheckpoint> {
    if (!this.owned() || !this.post) throw new Error('room ownership unavailable');
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.capture = null;
        reject(new Error('room checkpoint capture timed out'));
      }, 5000);
      this.capture = { requestId, resolve, reject, timer };
      try {
        this.post!({ type: 'checkpoint', requestId, pause });
      } catch (error) {
        clearTimeout(timer);
        this.capture = null;
        reject(error);
      }
    });
  }
  save(pause = false): Promise<CheckpointPointer> {
    if (!this.owned()) return Promise.reject(new Error('room ownership lost'));
    // Pause simulation immediately, even while the previous graph is awaiting IO.
    // The queued save will capture it later without retaining a second snapshot.
    if (pause) {
      try {
        this.post?.({ type: 'pause' });
      } catch (error) {
        return Promise.reject(error);
      }
    }
    if (!this.queued) {
      let resolve!: SaveRequest['resolve'], reject!: SaveRequest['reject'];
      const promise = new Promise<CheckpointPointer>((r, j) => {
        resolve = r;
        reject = j;
      });
      this.queued = { pause, promise, resolve, reject };
    } else this.queued.pause ||= pause;
    const promise = this.queued.promise;
    if (!this.running) void this.run();
    return promise;
  }
  private async commit(snapshot: RoomCheckpoint): Promise<CheckpointPointer> {
    if (!this.owned()) throw new Error('room ownership lost');
    const pointer = await this.storage.save(this.lease, this.lease.sequence + 1, snapshot);
    this.lease = { ...this.lease, sequence: pointer.sequence, checkpoint: pointer };
    this.unconfirmed = null;
    if (!this.owned()) throw new Error('room ownership lost');
    return pointer;
  }
  private async run() {
    const request = this.queued!;
    this.active = request;
    this.queued = null;
    this.running = true;
    try {
      // A lost commit response must retry the identical graph before accepting a newer capture.
      if (this.unconfirmed) await this.commit(this.unconfirmed);
      const snapshot = await this.takeSnapshot(request.pause);
      this.unconfirmed = snapshot;
      request.resolve(await this.commit(snapshot));
    } catch (error) {
      if (error instanceof CheckpointFenced) this.lose();
      request.reject(error instanceof Error ? error : new Error('room checkpoint failed'));
    } finally {
      this.running = false;
      this.active = null;
      if (this.queued) void this.run();
    }
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.cancel(new Error('room persistence closed'));
    this.closing = Promise.resolve().then(() => this.metadata.release(this.lease));
    return this.closing;
  }
}
