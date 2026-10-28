import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import * as engine from '../../engine/pkg/voxel_engine.js';
import { BOUNDS, around, parseClientMessage } from '../../src/shared/protocol.ts';
import type { BuildIdentity } from '../../src/shared/protocol.ts';
import { encodeChunk, decodeChunk, localIndex } from '../../src/shared/chunk-wire.ts';
import type { ChunkFrame } from '../../src/shared/chunk-wire.ts';
import type { ContentManifest } from '../../src/shared/content.ts';
import { stepBoundedMovement } from '../../src/shared/movement.ts';
import { WorldStore } from '../../src/sim/world-store.ts';
import { GameRoom } from '../../src/sim/game-room.ts';
import type { AdmittedActor } from '../../src/sim/game-room.ts';
import { Drops } from '../../src/sim/drops.ts';
import { CheckpointStorage } from '../../src/server/checkpoint-storage.ts';
import { MemoryCheckpoints } from './checkpoint-storage.ts';
import { SocketProbe, connectProbe } from './socket-probe.ts';

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const build = json('../../artifacts/build.json') as BuildIdentity;
const content = json('../../artifacts/content.json') as ContentManifest;
const size = json('../../config/world.json').size as number;
engine.initSync({
  module: readFileSync(new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url)),
});
engine.set_content(JSON.stringify(content));
assert.equal(BOUNDS.maxX - BOUNDS.minX, size);
assert.equal(BOUNDS.height, 256);
const maxColumn = BOUNDS.maxX / 16 - 1;
const stone = content.blocks.findIndex((block) => block.name === 'stone');
assert(stone > 0);
const frame: ChunkFrame = {
  kind: 'baseline',
  x: maxColumn,
  z: 0,
  subscription: 1,
  revision: 1,
  edits: [[0, stone]],
};
assert.deepEqual(decodeChunk(encodeChunk(frame), content.blocks.length), frame);
assert.equal(decodeChunk(encodeChunk({ ...frame, x: maxColumn + 1 }), content.blocks.length), null);
assert(parseClientMessage(JSON.stringify({ type: 'resync', x: maxColumn, z: 0, subscription: 1 })));
assert.equal(
  parseClientMessage(JSON.stringify({ type: 'resync', x: maxColumn + 1, z: 0, subscription: 1 })),
  null,
);
assert(
  around(maxColumn, 0, 3).every(
    (p) =>
      p.x <= maxColumn && p.x >= BOUNDS.minX / 16 && p.z <= maxColumn && p.z >= BOUNDS.minZ / 16,
  ),
);

const physics = new engine.VoxelWorld(),
  flat = new engine.TerrainGen(4242);
flat.set_void();
flat.set_void_ground(63, stone, stone, 1);
const physicsStore = new WorldStore(physics, flat),
  limits: { axis: number; direction: number; position: number }[] = [];
const slot = physics.player_add(0.5, 64.005, 0.5);
try {
  for (const [axis, direction] of [
    [0, 1],
    [0, -1],
    [2, 1],
    [2, -1],
  ] as const) {
    const state = physics.player_state(slot);
    state.set([0.5, 64.005, 0.5, 0, 0, 0]);
    state[axis] = direction > 0 ? BOUNDS.maxX - 4 : BOUNDS.minX + 4;
    physicsStore.require([state]);
    while (physicsStore.generateOne()) {}
    physics.player_restore(slot, state);
    physics.set_frozen(slot, false);
    const controls = {
      x: axis === 0 ? direction : 0,
      z: axis === 2 ? direction : 0,
      yaw: 0,
      pitch: 0,
      jump: false,
      sneak: false,
      sprint: false,
    };
    for (let step = 0; step < 300; step++) stepBoundedMovement(physics, slot, controls);
    const position = physics.player_state(slot)[axis];
    if (direction > 0)
      assert(
        position <= BOUNDS.maxX - 0.3 + 1e-6 && position >= BOUNDS.maxX - 1,
        'positive boundary',
      );
    else
      assert(
        position >= BOUNDS.minX + 0.3 - 1e-6 && position <= BOUNDS.minX + 1,
        'negative boundary',
      );
    limits.push({ axis, direction, position });
  }
  physics.player_remove(slot);
  const position = [BOUNDS.maxX - 4, 64.5, 0.5];
  physicsStore.require([position]);
  while (physicsStore.generateOne()) {}
  const drops = new Drops(content);
  drops.add({ itemType: 'stone', count: 1 }, position, 0, null, [6, 0, 0]);
  drops.step(physics, 0);
  assert(
    drops.checkpoint(0).entries[0].position[0] > position[0] - 0.01,
    'drop must not snap to the former 512 boundary',
  );
} finally {
  physics.free();
  flat.free();
}

const actor: AdmittedActor = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'participant',
  capabilities: { build: true, fly: false, observe: false, combat: true, explosives: true },
};
const owners = new Map([[actor.id, actor]]),
  ports = { send() {}, close() {} };
function restore(value: unknown) {
  const world = new engine.VoxelWorld(),
    generator = new engine.TerrainGen(4242);
  try {
    return GameRoom.fromCheckpoint(world, generator, content, build, ports, value, 0, owners);
  } catch (error) {
    world.free();
    generator.free();
    throw error;
  }
}
const previous = json('./default512-checkpoint.json');
assert.equal(
  previous.sourceBuildId,
  '7c770c2043d14dd98de19162a7f173e17c3b82a8fbb3e497ad0188089c721dcc',
);
if (size === 512) {
  const resumed = restore(previous);
  try {
    const saved = resumed.checkpoint(0);
    assert.deepEqual(saved.bounds, previous.bounds);
    assert.deepEqual(saved.inventories, previous.inventories);
    assert.deepEqual(saved.world, previous.world);
    assert.deepEqual(
      saved.players.map((p) => [p.id, p.state, p.vitals]),
      previous.players.map((p: { id: string; state: number[]; vitals: unknown }) => [
        p.id,
        p.state,
        p.vitals,
      ]),
    );
  } finally {
    resumed.dispose();
  }
} else
  assert.throws(
    () => restore(previous),
    /checkpoint/,
    'a different profile cannot silently resize a saved world',
  );

const backend = new MemoryCheckpoints(),
  roomId = '33333333-3333-4333-8333-333333333333';
const lease = (await backend.acquire(roomId, 'seed'))!;
const world = new engine.VoxelWorld(),
  generator = new engine.TerrainGen(4242);
const store = new WorldStore(world, generator),
  room = new GameRoom(store, content, build, ports, lease.worldId, 4242, 0, 0, 'survival');
const cell: [number, number, number] = [BOUNDS.maxX - 2, 200, 2];
let editedState = stone;
try {
  room.join(actor, 'fixture', 0);
  const current = room.actors.get(actor.id)!;
  const state = world.player_state(current.slot);
  state.set([BOUNDS.maxX - 4, 200, 0.5, 0, 0, 0]);
  store.require([state]);
  while (store.generateOne()) {}
  state[1] = Math.min(250, store.heightAt(Math.floor(state[0]), 0) + 2);
  world.player_restore(current.slot, state);
  if (world.get_block(...cell) === editedState) editedState = 0;
  assert(store.set(...cell, editedState));
  room.drops.add({ itemType: 'stone', count: 1 }, [state[0] + 0.5, state[1] + 0.5, 0.5], 0);
  const checkpoint = room.checkpoint(0),
    resumed = restore(checkpoint);
  try {
    const saved = resumed.checkpoint(0);
    assert.deepEqual(saved.bounds, BOUNDS);
    assert.deepEqual(saved.world, checkpoint.world);
    assert.deepEqual(saved.inventories, checkpoint.inventories);
    assert.deepEqual(saved.drops, checkpoint.drops);
    assert.deepEqual(saved.players[0].state, checkpoint.players[0].state);
  } finally {
    resumed.dispose();
  }
  await new CheckpointStorage(lease.worldId, backend, backend, content, build).save(
    lease,
    1,
    checkpoint,
  );
  await backend.release(lease);
} finally {
  room.dispose();
}

const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env.VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
const grant = () => ({ actor, expiresAt: Date.now() + 30000 });
const gateway = await createGateway({
  build,
  content,
  admit: async () => ({ ...grant(), revalidate: async () => grant() }),
  persistence: { objects: backend, metadata: backend, resolveOwner: async () => actor },
});
const probes: SocketProbe[] = [];
try {
  assert(gateway.address && typeof gateway.address === 'object');
  const origin = 'http://127.0.0.1:' + gateway.address.port;
  const admission = await fetch(origin + '/api/voxel/admission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: roomId }),
  });
  assert.equal(admission.status, 200);
  const ticket = (await admission.json()) as { ticket: string };
  const wrong = new SocketProbe(origin.replace('http:', 'ws:') + '/voxel', content.blocks.length);
  probes.push(wrong);
  await once(wrong.socket, 'open');
  wrong.send({ type: 'hello', ticket: ticket.ticket, buildId: previous.sourceBuildId });
  assert.equal((await wrong.event('error')).code, 'INCOMPATIBLE');
  assert.equal(gateway.rooms.size, 0);
  const probe = await connectProbe(origin, roomId, content.blocks.length, actor.id);
  probes.push(probe);
  const baseline = await probe.ready();
  assert(baseline.state[0] > BOUNDS.maxX - 16 && baseline.state[0] < BOUNDS.maxX);
  assert(
    probe.events.some(
      (event) =>
        'kind' in event &&
        event.x === maxColumn &&
        event.edits.some(
          ([local, state]) => local === localIndex(...cell) && state === editedState,
        ),
    ),
  );
} finally {
  for (const probe of probes) probe.socket.terminate();
  await gateway.close();
}
assert.equal(gateway.rooms.size, 0);
assert.equal(gateway.sockets.clients.size, 0);
console.log(
  JSON.stringify({
    result: 'CONFIGURED_WORLD_AUTHORITY_WIRE_DROPS_CHECKPOINT_AND_GATEWAY_PASS',
    size,
    buildId: build.buildId,
    limits,
    maxColumn,
    oldDefaultCheckpoint: size === 512 ? 'restored' : 'rejected-profile-mismatch',
    packaged: !!process.env.VOXEL_TEST_BUNDLE,
    cleanup: { rooms: 0, sockets: 0 },
  }),
);
