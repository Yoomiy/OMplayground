import { around, columnKey, GENERATOR_VERSION, MESH_RADIUS } from '../shared/protocol.ts';
import type { Revision } from '../shared/protocol.ts';
import { worldCell } from '../shared/chunk-wire.ts';
import type { ChunkFrame } from '../shared/chunk-wire.ts';
import type { WorldPort } from '../shared/engine-port.ts';
import type { EngineResult, JobIdentity } from './jobs.ts';
import { sameJob } from './jobs.ts';
export interface JobPool {
  readonly count: number;
  readonly available: number;
  readonly active: number;
  submit(kind: 'generate' | 'mesh', tag: JobIdentity, region?: Uint8Array): Promise<EngineResult>;
}
export interface TerrainPort {
  install(x: number, z: number, data: Uint32Array): void;
  remove(x: number, z: number): void;
  tint(x: number, z: number, data: Uint8Array): void;
}
export type StreamColumn = {
  x: number;
  z: number;
  subscription: number;
  incarnation: number;
  revision: number;
  edits: Map<number, number>;
  ready: boolean;
  recovering: boolean;
  generating: boolean;
  meshing: boolean;
  generation: JobIdentity | null;
  mesh: JobIdentity | null;
  version: number;
  shown: number;
  failures: number;
};
export class WorldStream {
  readonly columns = new Map<string, StreamColumn>();
  readonly world: WorldPort;
  private pool: JobPool;
  private renderer: TerrainPort;
  private worldId: string;
  private contentHash: string;
  private serial = 0;
  private completed: EngineResult[] = [];
  private center = { x: 0, z: 0, yaw: 0 };
  private disposed = false;
  private resync: (x: number, z: number, subscription: number) => void;
  private failure: (reason: string) => void;
  readonly stats = {
    discardedJobs: 0,
    installed: 0,
    meshJobs: 0,
    generationJobs: 0,
    mainWorkMs: 0,
  };
  constructor(
    world: WorldPort,
    pool: JobPool,
    renderer: TerrainPort,
    worldId: string,
    contentHash: string,
    resync: (x: number, z: number, subscription: number) => void,
    failure: (reason: string) => void,
  ) {
    this.world = world;
    this.pool = pool;
    this.renderer = renderer;
    this.worldId = worldId;
    this.contentHash = contentHash;
    this.resync = resync;
    this.failure = failure;
  }
  receive(frame: ChunkFrame): void {
    if (this.disposed) return;
    const key = columnKey(frame.x, frame.z),
      old = this.columns.get(key);
    if (frame.kind === 'baseline') {
      if (
        old &&
        (frame.subscription < old.subscription ||
          (frame.subscription === old.subscription && frame.revision < old.revision))
      )
        return;
      if (old) this.drop(old);
      const column: StreamColumn = {
        x: frame.x,
        z: frame.z,
        subscription: frame.subscription,
        incarnation: ++this.serial,
        revision: frame.revision,
        edits: new Map(frame.edits),
        ready: false,
        recovering: false,
        generating: false,
        meshing: false,
        generation: null,
        mesh: null,
        version: 1,
        shown: 0,
        failures: 0,
      };
      this.columns.set(key, column);
      return;
    }
    if (!old || old.subscription !== frame.subscription || frame.revision <= old.revision) return;
    if (old.recovering) return;
    if (frame.revision !== old.revision + 1) {
      old.recovering = true;
      this.resync(old.x, old.z, old.subscription);
      return;
    }
    old.revision = frame.revision;
    for (const [local, state] of frame.edits) {
      old.edits.set(local, state);
      if (old.ready) this.world.mirror_block(...worldCell(old.x, old.z, local), state);
    }
    this.dirty(old.x, old.z);
  }
  unload(x: number, z: number, subscription: number): void {
    const col = this.columns.get(columnKey(x, z));
    if (col?.subscription === subscription) this.drop(col);
  }
  private drop(col: StreamColumn): void {
    this.columns.delete(columnKey(col.x, col.z));
    this.world.forget_column(col.x, col.z);
    this.renderer.remove(col.x, col.z);
    this.dirty(col.x, col.z);
  }
  private dirty(x: number, z: number): void {
    for (const p of around(x, z, 1)) {
      const col = this.columns.get(columnKey(p.x, p.z));
      if (col) col.version++;
    }
  }
  setCenter(x: number, z: number, yaw: number): void {
    this.center = { x, z, yaw };
  }
  private priority(col: StreamColumn): number {
    const x = col.x * 16 + 8 - this.center.x,
      z = col.z * 16 + 8 - this.center.z;
    return x * x + z * z - (x * Math.sin(this.center.yaw) - z * Math.cos(this.center.yaw)) * 4;
  }
  private tag(col: StreamColumn, version: number): JobIdentity {
    return {
      worldId: this.worldId,
      contentHash: this.contentHash,
      generatorVersion: GENERATOR_VERSION,
      x: col.x,
      z: col.z,
      incarnation: col.incarnation,
      subscription: col.subscription,
      revision: col.revision,
      version,
    };
  }
  private current(result: EngineResult): StreamColumn | undefined {
    const col = this.columns.get(columnKey(result.tag.x, result.tag.z));
    if (
      !col ||
      col.incarnation !== result.tag.incarnation ||
      col.subscription !== result.tag.subscription ||
      result.tag.worldId !== this.worldId ||
      result.tag.contentHash !== this.contentHash ||
      result.tag.generatorVersion !== GENERATOR_VERSION
    )
      return;
    return col;
  }
  /** Install collision, schedule compute and submit mesh data within a measured main-thread budget. */
  pump(budgetMs = 2): void {
    if (this.disposed) return;
    const start = performance.now(),
      deadline = start + budgetMs;
    while (this.completed.length && performance.now() < deadline) {
      const result = this.completed.shift()!,
        col = this.current(result);
      if (!col) {
        this.stats.discardedJobs++;
        continue;
      }
      try {
        if (result.kind === 'generate') {
          if (!col.generation || !sameJob(col.generation, result.tag) || col.ready) {
            this.stats.discardedJobs++;
            continue;
          }
          col.generating = false;
          this.world.insert_column(col.x, col.z, result.data);
          // Edits received after this generation started are replayed before collision becomes ready.
          for (const [local, state] of col.edits)
            this.world.mirror_block(...worldCell(col.x, col.z, local), state);
          col.ready = true;
          col.failures = 0;
          this.renderer.tint(col.x, col.z, result.data);
          this.dirty(col.x, col.z);
          this.stats.installed++;
        } else {
          if (!col.mesh || !sameJob(col.mesh, result.tag)) {
            this.stats.discardedJobs++;
            continue;
          }
          col.meshing = false;
          if (result.tag.version !== col.version || result.tag.revision !== col.revision) {
            this.stats.discardedJobs++;
            continue;
          }
          this.renderer.install(col.x, col.z, result.data);
          col.shown = col.version;
          col.failures = 0;
        }
      } catch (error) {
        this.retry(col, error);
      }
    }
    while (
      this.pool.available > 0 &&
      this.completed.length + this.pool.active < this.pool.count * 2 &&
      performance.now() < deadline
    ) {
      const sorted = [...this.columns.values()]
        .filter((c) => !c.recovering && c.failures < 3)
        .sort((a, b) => this.priority(a) - this.priority(b));
      const generation = sorted.find((c) => !c.ready && !c.generating);
      const cx = Math.floor(this.center.x / 16),
        cz = Math.floor(this.center.z / 16);
      const mesh = sorted.find(
        (c) =>
          c.ready &&
          !c.meshing &&
          c.shown < c.version &&
          Math.abs(c.x - cx) <= MESH_RADIUS &&
          Math.abs(c.z - cz) <= MESH_RADIUS &&
          around(c.x, c.z, 1).every((p) => this.columns.get(columnKey(p.x, p.z))?.ready),
      );
      const collisionUrgent =
        generation && Math.abs(generation.x - cx) <= 1 && Math.abs(generation.z - cz) <= 1;
      if (
        generation &&
        (!mesh || collisionUrgent || this.priority(generation) <= this.priority(mesh) + 100)
      ) {
        generation.generating = true;
        const tag = this.tag(generation, 0);
        generation.generation = tag;
        this.stats.generationJobs++;
        this.submit(generation, 'generate', tag);
        continue;
      }
      if (!mesh) break;
      mesh.meshing = true;
      const tag = this.tag(mesh, mesh.version);
      mesh.mesh = tag;
      this.stats.meshJobs++;
      this.submit(mesh, 'mesh', tag, this.world.extract_region(mesh.x, mesh.z));
    }
    this.stats.mainWorkMs = performance.now() - start;
  }
  private submit(
    col: StreamColumn,
    kind: 'generate' | 'mesh',
    tag: JobIdentity,
    region?: Uint8Array,
  ): void {
    void this.pool.submit(kind, tag, region).then(
      (result) => {
        if (!this.disposed) this.completed.push(result);
      },
      (error) => {
        if (this.disposed) return;
        const current = this.columns.get(columnKey(col.x, col.z));
        if (current === col) this.retry(col, error);
      },
    );
  }
  private retry(col: StreamColumn, error: unknown): void {
    col.generating = false;
    col.meshing = false;
    col.failures++;
    if (col.failures >= 3) {
      col.recovering = true;
      this.failure(error instanceof Error ? error.message : 'world job failed');
    }
  }
  readyAround(position: ArrayLike<number>): Revision[] | null {
    const columns = around(Math.floor(position[0] / 16), Math.floor(position[2] / 16), 1).map((p) =>
      this.columns.get(columnKey(p.x, p.z)),
    );
    return columns.every((c) => c?.ready && !c.recovering)
      ? columns.map((c) => ({ x: c!.x, z: c!.z, revision: c!.revision }))
      : null;
  }
  revision(x: number, z: number): number {
    return this.columns.get(columnKey(x, z))?.revision ?? -1;
  }
  get collisionCount(): number {
    return [...this.columns.values()].filter((c) => c.ready).length;
  }
  get meshCount(): number {
    return [...this.columns.values()].filter((c) => c.shown > 0).length;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const c of [...this.columns.values()]) this.drop(c);
    this.completed = [];
  }
}
