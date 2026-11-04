import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as engine from '../../engine/pkg/voxel_engine.js';
import { source } from '../../content/index.ts';
import { compileContent } from '../../tools/compile-content.ts';
import { GameRoom } from '../../src/sim/game-room.ts';
import { WorldStore } from '../../src/sim/world-store.ts';
import { CheckpointStorage } from '../../src/server/checkpoint-storage.ts';
import { MemoryCheckpoints } from '../fixtures/checkpoint-storage.ts';
import { compatibleCheckpointContent } from '../../src/shared/checkpoint-content.ts';
import type { ContentManifest } from '../../src/shared/content.ts';
import type { BuildIdentity } from '../../src/shared/protocol.ts';
const content = JSON.parse(
  readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
) as ContentManifest;
const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
) as BuildIdentity;
// Reconstruct the preceding authored tuning, rather than relabeling a new save.
const old = compileContent({
  ...source,
  blocks: source.blocks.map((block) =>
    ['torch', 'ladder'].includes(block.family)
      ? { ...block, mining: { seconds: 1 } }
      : block.family.endsWith('_leaves')
        ? {
            ...block,
            mining: { ...block.mining, seconds: 1 },
            drops: [...block.drops, { itemType: 'apple', count: 1 }],
            forage: { none: 95, entries: [{ itemType: 'sapling', count: 1, weight: 5 }] },
          }
        : block,
  ),
}).manifest;

test('reviewed loot/mining tuning preserves prior native checkpoint data without accepting unrelated content', async () => {
  assert.equal(old.hash, '2d930b06841018cd0cb4adc65905432e4ffedc3ea2d112bb7ff65a811165307c');
  for (const key of ['blocks', 'items', 'recipes', 'terrain', 'terrainFallback'] as const)
    assert.deepEqual(content[key], old[key], key);
  assert.equal(compatibleCheckpointContent(old.hash, content), true);
  assert.equal(
    compatibleCheckpointContent(
      '05809e4f10d630b5446d0872e38b1ba7f40263d0a3fb59f5ea3e7c023d190ddc',
      content,
    ),
    true,
  );
  assert.equal(compatibleCheckpointContent('0'.repeat(64), content), false);
  assert.equal(compatibleCheckpointContent(old.hash, { ...content, hash: '0'.repeat(64) }), false);
  engine.initSync({
    module: readFileSync(new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url)),
  });
  engine.set_content(JSON.stringify(content));
  const actor = {
    id: 'compat-player',
    role: 'participant' as const,
    capabilities: { build: true, fly: false, observe: false, combat: true, explosives: true },
  };
  const backend = new MemoryCheckpoints(),
    lease = (await backend.acquire('tuned-save', 'owner'))!;
  const world = new engine.VoxelWorld(),
    generator = new engine.TerrainGen(4242);
  const store = new WorldStore(world, generator),
    ports = { send() {}, close() {} };
  const oldBuild = { ...build, contentHash: old.hash };
  const room = new GameRoom(store, old, oldBuild, ports, lease.worldId, 4242, 0, 0, 'survival');
  let restored: GameRoom | undefined;
  try {
    room.join(actor, 'connection', 0);
    room.inventories.receive(actor.id, { itemType: 'apple', count: 2 });
    room.inventories.receive(actor.id, {
      itemType: 'wooden_pickaxe',
      count: 1,
      instance: { durability: 12 },
    });
    const state = world.player_state(room.actors.get(actor.id)!.slot);
    while (store.generateOne()) {}
    assert(
      store.set(
        Math.floor(state[0]),
        200,
        Math.floor(state[2]),
        old.blocks.findIndex((b) => b.name === 'stone'),
      ),
    );
    room.drops.add({ itemType: 'apple', count: 1 }, [state[0], state[1] + 1, state[2]], 0);
    const saved = room.checkpoint(0);
    const pointer = await new CheckpointStorage(
      lease.worldId,
      backend,
      backend,
      old,
      oldBuild,
    ).save(lease, 1, saved);
    const loaded = await new CheckpointStorage(
      lease.worldId,
      backend,
      backend,
      content,
      build,
    ).load(pointer);
    restored = GameRoom.fromCheckpoint(
      new engine.VoxelWorld(),
      new engine.TerrainGen(saved.seed),
      content,
      build,
      ports,
      loaded,
      0,
      new Map([[actor.id, actor]]),
    );
    const next = restored.checkpoint(0);
    assert.equal(next.contentHash, content.hash);
    assert.equal(next.seed, saved.seed);
    assert.deepEqual(next.players[0].state, saved.players[0].state);
    assert.deepEqual(next.inventories.players, saved.inventories.players);
    assert.deepEqual(next.world.columns, saved.world.columns);
    assert.deepEqual(next.drops.entries, saved.drops.entries);
  } finally {
    room.dispose();
    restored?.dispose();
  }
});
