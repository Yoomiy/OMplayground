import { readFileSync } from 'node:fs';
import { initSync, set_content, VoxelWorld, TerrainGen } from '../../engine/pkg/voxel_engine.js';
import { WorldStore } from '../../src/sim/world-store.ts';
import { GameRoom } from '../../src/sim/game-room.ts';
import { around, STREAM_RADIUS } from '../../src/shared/protocol.ts';
import type { BuildIdentity } from '../../src/shared/protocol.ts';
import type { ContentManifest } from '../../src/shared/content.ts';
import { CheckpointStorage } from '../../src/server/checkpoint-storage.ts';
import { MemoryCheckpoints } from './checkpoint-storage.ts';

/** Preparation-only excavation metadata. No inventory grants or test-only live
 * transport behavior; the actual restore/stream uses ordinary checkpoint objects.
 */
export async function editedCheckpoint(
  backend: MemoryCheckpoints,
  roomId: string,
  content: ContentManifest,
  build: BuildIdentity,
  entries = 16384,
) {
  initSync({
    module: readFileSync(new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url)),
  });
  set_content(JSON.stringify(content));
  const lease = (await backend.acquire(roomId, 'edited-fixture'))!;
  const store = new WorldStore(new VoxelWorld(), new TerrainGen(4242)),
    room = new GameRoom(
      store,
      content,
      build,
      { send() {}, close() {} },
      lease.worldId,
      4242,
      0,
      0,
    );
  try {
    const base = room.checkpoint(0),
      cx = Math.floor(base.spawn[0] / 16),
      cz = Math.floor(base.spawn[2] / 16);
    for (const c of around(cx, cz, STREAM_RADIUS)) {
      const edits = new Map<number, number>(),
        versions = new Map<number, number>();
      for (let n = 0; n < entries; n++) {
        edits.set(256 + n, 0);
        versions.set(256 + n, n + 1);
      }
      store.changed.set(`${c.x},${c.z}`, { revision: entries, edits, versions });
    }
    const checkpoint = room.checkpoint(0);
    await new CheckpointStorage(lease.worldId, backend, backend, content, build).save(
      lease,
      1,
      checkpoint,
    );
    await backend.release(lease);
    return {
      worldId: lease.worldId,
      columns: checkpoint.world.columns.length,
      entries,
      baselineBytes: checkpoint.world.columns.length * (24 + entries * 6),
    };
  } finally {
    room.dispose();
  }
}
