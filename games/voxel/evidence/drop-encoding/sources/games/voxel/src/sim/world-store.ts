import { around, columnKey, inBounds, BOUNDS } from '../shared/protocol.ts';
import { localIndex, worldCell, MAX_COLUMN_REVISION } from '../shared/chunk-wire.ts';
import type { ContentManifest } from '../shared/content.ts';
import { checkpointObject, checkpointInteger } from './checkpoint-values.ts';
import type { WorldPort, GeneratorPort } from '../shared/engine-port.ts';
import type { Cell } from '../shared/protocol.ts';
export type WorldCheckpoint = Readonly<{
  schema: 1;
  contentHash: string;
  columns: readonly Readonly<{
    x: number;
    z: number;
    revision: number;
    edits: readonly (readonly [number, number, number])[];
  }>[];
}>;
export class WorldStore {
  readonly world: WorldPort;
  readonly generator: GeneratorPort;
  readonly changed = new Map<
    string,
    { revision: number; edits: Map<number, number>; versions: Map<number, number> }
  >();
  private heights = new Map<string, Uint8Array>();
  private needed = new Map<string, { x: number; z: number; priority: number }>();
  constructor(world: WorldPort, generator: GeneratorPort) {
    this.world = world;
    this.generator = generator;
  }
  checkpoint(content: ContentManifest): WorldCheckpoint {
    return Object.freeze({
      schema: 1,
      contentHash: content.hash,
      columns: Object.freeze(
        [...this.changed]
          .map(([key, entry]) => {
            const [x, z] = key.split(',').map(Number);
            return Object.freeze({
              x,
              z,
              revision: entry.revision,
              edits: Object.freeze(
                [...entry.edits]
                  .sort(([a], [b]) => a - b)
                  .map(([local, state]) =>
                    Object.freeze([local, state, entry.versions.get(local)!] as const),
                  ),
              ),
            });
          })
          .sort((a, b) => a.x - b.x || a.z - b.z),
      ),
    });
  }
  /** Install validated metadata into a fresh compute world; terrain still loads through normal jobs. */
  static fromCheckpoint(
    world: WorldPort,
    generator: GeneratorPort,
    content: ContentManifest,
    value: unknown,
  ): WorldStore {
    const invalid = (): never => {
      throw new Error('invalid world checkpoint');
    };
    if (
      !checkpointObject(value, ['schema', 'contentHash', 'columns']) ||
      value.schema !== 1 ||
      value.contentHash !== content.hash ||
      !Array.isArray(value.columns)
    )
      return invalid();
    const columns = new Map<
      string,
      { revision: number; edits: Map<number, number>; versions: Map<number, number> }
    >();
    for (const c of value.columns) {
      if (
        !checkpointObject(c, ['x', 'z', 'revision', 'edits']) ||
        !checkpointInteger(c.x, BOUNDS.minX >> 4, (BOUNDS.maxX >> 4) - 1) ||
        !checkpointInteger(c.z, BOUNDS.minZ >> 4, (BOUNDS.maxZ >> 4) - 1) ||
        !checkpointInteger(c.revision, 1, MAX_COLUMN_REVISION) ||
        !Array.isArray(c.edits) ||
        !c.edits.length ||
        columns.has(columnKey(c.x, c.z))
      )
        return invalid();
      const edits = new Map<number, number>(),
        versions = new Map<number, number>();
      let latest = 0;
      for (const row of c.edits) {
        if (
          !Array.isArray(row) ||
          row.length !== 3 ||
          !checkpointInteger(row[0], 0, 65535) ||
          !checkpointInteger(row[1], 0, content.blocks.length - 1) ||
          !checkpointInteger(row[2], 1, c.revision) ||
          edits.has(row[0])
        )
          return invalid();
        edits.set(row[0], row[1]);
        versions.set(row[0], row[2]);
        latest = Math.max(latest, row[2]);
      }
      if (latest !== c.revision) return invalid();
      columns.set(columnKey(c.x, c.z), { revision: c.revision, edits, versions });
    }
    if (world.column_count() !== 0)
      throw new Error('world checkpoint requires a fresh compute world');
    const restored = new WorldStore(world, generator);
    for (const [key, column] of columns) restored.changed.set(key, column);
    return restored;
  }
  revision(x: number, z: number): number {
    return this.changed.get(columnKey(x, z))?.revision ?? 0;
  }
  edits(x: number, z: number): [number, number][] {
    return [...(this.changed.get(columnKey(x, z))?.edits.entries() ?? [])];
  }
  cellRevision(x: number, y: number, z: number): number {
    return this.changed.get(columnKey(x >> 4, z >> 4))?.versions.get(localIndex(x, y, z)) ?? 0;
  }
  require(positions: readonly ArrayLike<number>[]): void {
    const desired = new Map<string, { x: number; z: number; priority: number }>();
    for (const pos of positions)
      for (const p of around(Math.floor(pos[0] / 16), Math.floor(pos[2] / 16), 1)) {
        const key = columnKey(p.x, p.z),
          priority = (p.x * 16 + 8 - pos[0]) ** 2 + (p.z * 16 + 8 - pos[2]) ** 2;
        if (!desired.has(key) || desired.get(key)!.priority > priority)
          desired.set(key, { ...p, priority });
      }
    for (const [key, p] of this.needed)
      if (!desired.has(key) && this.world.has_column(p.x, p.z)) {
        this.world.forget_column(p.x, p.z);
        this.heights.delete(key);
      }
    this.needed = desired;
  }
  /** A room worker schedules bounded jobs between simulation turns. No hot query generates. */
  generateOne(): boolean {
    const next = [...this.needed.values()]
      .filter((p) => !this.world.has_column(p.x, p.z))
      .sort((a, b) => a.priority - b.priority)[0];
    if (!next) return false;
    const data = this.generator.generate(next.x, next.z),
      heights = data.slice(776, 1032);
    this.world.insert_column(next.x, next.z, data);
    this.heights.set(columnKey(next.x, next.z), heights);
    try {
      for (const [local, state] of this.edits(next.x, next.z)) {
        const cell = worldCell(next.x, next.z, local);
        if (this.world.get_block(...cell) !== state && !this.world.set_block(...cell, state))
          throw new Error('column edit replay failed');
        if (state) heights[local & 255] = Math.max(heights[local & 255], local >>> 8);
      }
    } catch (error) {
      this.world.forget_column(next.x, next.z);
      this.heights.delete(columnKey(next.x, next.z));
      throw error;
    }
    return true;
  }
  heightAt(x: number, z: number): number {
    return this.heights.get(columnKey(x >> 4, z >> 4))?.[((z & 15) << 4) | (x & 15)] ?? 252;
  }
  ready(x: number, z: number): boolean {
    return around(x, z, 1).every((p) => this.world.has_column(p.x, p.z));
  }
  set(
    x: number,
    y: number,
    z: number,
    state: number,
  ): { x: number; z: number; revision: number; edits: [number, number][] } | null {
    if (
      !inBounds(x, y, z) ||
      this.revision(x >> 4, z >> 4) >= MAX_COLUMN_REVISION ||
      !this.world.has_column(x >> 4, z >> 4) ||
      this.world.get_block(x, y, z) === state
    )
      return null;
    if (!this.world.set_block(x, y, z, state)) return null;
    const cx = x >> 4,
      cz = z >> 4,
      key = columnKey(cx, cz),
      entry = this.changed.get(key) ?? {
        revision: 0,
        edits: new Map<number, number>(),
        versions: new Map<number, number>(),
      };
    const heights = this.heights.get(key);
    if (state && heights) {
      const index = ((z & 15) << 4) | (x & 15);
      heights[index] = Math.max(heights[index], y);
    }
    const local = localIndex(x, y, z);
    entry.edits.set(local, state);
    entry.revision++;
    entry.versions.set(local, entry.revision);
    this.changed.set(key, entry);
    return { x: cx, z: cz, revision: entry.revision, edits: [[local, state]] };
  }
  /** Validate a complete blast before writing; one revision per affected column. */
  clearMany(
    cells: readonly Cell[],
  ): { x: number; z: number; revision: number; edits: [number, number][] }[] | null {
    if (
      cells.some(
        (cell) =>
          !Array.isArray(cell) ||
          cell.length !== 3 ||
          !cell.every(Number.isInteger) ||
          !inBounds(cell[0], cell[1], cell[2]),
      )
    )
      return null;
    const before = cells.map((cell) => ({ cell, state: this.world.get_block(...cell) }));
    if (
      new Set(cells.map((cell) => cell.join(','))).size !== cells.length ||
      before.some(
        ({ cell, state }) =>
          !cell.every(Number.isInteger) ||
          !inBounds(...cell) ||
          !this.world.has_column(cell[0] >> 4, cell[2] >> 4) ||
          this.revision(cell[0] >> 4, cell[2] >> 4) >= MAX_COLUMN_REVISION ||
          state === 0 ||
          state === 65535,
      )
    )
      return null;
    const written: typeof before = [];
    for (const entry of before) {
      if (!this.world.set_block(...entry.cell, 0)) {
        for (const prior of written)
          if (!this.world.set_block(...prior.cell, prior.state))
            throw new Error('world transaction rollback failed');
        return null;
      }
      written.push(entry);
    }
    const columns = new Map<
      string,
      { x: number; z: number; revision: number; edits: [number, number][] }
    >();
    for (const {
      cell: [x, y, z],
    } of before) {
      const key = columnKey(x >> 4, z >> 4),
        local = localIndex(x, y, z);
      let patch = columns.get(key);
      const entry = this.changed.get(key) ?? {
        revision: 0,
        edits: new Map<number, number>(),
        versions: new Map<number, number>(),
      };
      if (!patch) {
        entry.revision++;
        patch = { x: x >> 4, z: z >> 4, revision: entry.revision, edits: [] };
        columns.set(key, patch);
      }
      entry.edits.set(local, 0);
      entry.versions.set(local, entry.revision);
      this.changed.set(key, entry);
      patch.edits.push([local, 0]);
    }
    return [...columns.values()];
  }
  dispose(): void {
    this.world.free();
    this.generator.free();
    this.needed.clear();
    this.changed.clear();
    this.heights.clear();
  }
}
