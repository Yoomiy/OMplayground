import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { cpus, availableParallelism } from 'node:os';
import { performance } from 'node:perf_hooks';
import { GameRoom } from '../src/sim/game-room.ts';
import { WorldStore } from '../src/sim/world-store.ts';
import { SnapshotEncoder } from '../src/server/snapshot-encoder.ts';
import { around } from '../src/shared/protocol.ts';
import { encodeChunk } from '../src/shared/chunk-wire.ts';
import { makeStack } from '../src/shared/inventory.ts';
import type { InventoryCommand } from '../src/shared/inventory.ts';
import type { ServerMessage, BuildIdentity } from '../src/shared/protocol.ts';
import type { ContentManifest } from '../src/shared/content.ts';
import { initSync, set_content, VoxelWorld, TerrainGen } from '../engine/pkg/voxel_engine.js';

const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root));
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const build = JSON.parse(read('artifacts/build.json').toString()) as BuildIdentity;
const content = JSON.parse(read('artifacts/content.json').toString()) as ContentManifest;
const baselineName = process.env.VOXEL_BENCH_BASELINE ?? 'original';
assert(
  baselineName === 'original' ||
    baselineName === 'worker-timings' ||
    baselineName === 'room-reuse' ||
    baselineName === 'drop-encoding' ||
    baselineName === 'snapshot-pose',
);
const baseline =
  baselineName === 'original'
    ? {
        archive: 'media-composition',
        sha256: 'd500b9b4b5798d9e59b96dec35ed9ade8c60e6818bfc8292ce4c098f47133cbf',
        sharedEncoding: false,
      }
    : baselineName === 'worker-timings'
      ? {
          archive: 'worker-timings',
          sha256: '4d99be037c3f3136592b129827b914358f6a53bbdde091cd5a47a94bff9ce918',
          sharedEncoding: true,
        }
      : baselineName === 'room-reuse'
        ? {
            archive: 'room-reuse',
            sha256: '47410a364fc73bfd204cc3d3faf56fa7fb5ed5ad931acc834d8c895f8ff91d8d',
            sharedEncoding: true,
          }
        : baselineName === 'drop-encoding'
          ? {
              archive: 'drop-encoding',
              sha256: '47410a364fc73bfd204cc3d3faf56fa7fb5ed5ad931acc834d8c895f8ff91d8d',
              sharedEncoding: true,
            }
          : {
              archive: 'snapshot-pose',
              sha256: 'dd2024ea287870dae9690892e108bfe13169e493d4a9c37d092332b91c0d86ae',
              sharedEncoding: true,
            };
const baselinePath = new URL(
  `evidence/${baseline.archive}/sources/games/voxel/src/sim/game-room.ts`,
  root,
);
const { GameRoom: BaselineRoom } = (await import(baselinePath.href)) as {
  GameRoom: typeof GameRoom;
};
assert.equal(hash(readFileSync(baselinePath)), baseline.sha256);
let BaselineEncoder = SnapshotEncoder;
let baselineEncoderHash: string | null = null;
if (baseline.sharedEncoding) {
  const encoderPath = new URL(
    `evidence/${baseline.archive}/sources/games/voxel/src/server/snapshot-encoder.ts`,
    root,
  );
  baselineEncoderHash = hash(readFileSync(encoderPath));
  assert.equal(
    baselineEncoderHash,
    baselineName === 'drop-encoding' || baselineName === 'snapshot-pose'
      ? '07a2e205eb1abc1f040797d32025ba90eb0776f1e53fe878bc9f1680824594ed'
      : 'aca0009154b0ab2f321b7e51bbdb2874e227a0773fe5a0d5754f13ffdb3f747d',
  );
  BaselineEncoder = (await import(encoderPath.href)).SnapshotEncoder;
}
const engine = read('dist-server/engine.wasm');
assert.equal(hash(engine), build.engineHash);
const { memory } = initSync({ module: engine });
set_content(JSON.stringify(content));
const profiles = (process.env.VOXEL_BENCH_PLAYERS ?? '16,32,64,128').split(',').map(Number);
assert(profiles.length && profiles.every((n) => Number.isSafeInteger(n) && n > 0));
const repeats = Number(process.env.VOXEL_BENCH_REPEATS ?? 3),
  ticks = Number(process.env.VOXEL_BENCH_TICKS ?? 600);
assert(Number.isSafeInteger(repeats) && repeats >= 1);
assert(Number.isSafeInteger(ticks) && ticks >= 180);
const warmup = 90,
  items = new Map(content.items.map((i) => [i.itemType, i]));
const summary = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    p99: sorted[Math.ceil(sorted.length * 0.99) - 1],
    max: sorted.at(-1)!,
  };
};
type Scene = 'dense-motion' | 'craft-drops-tnt';
function run(players: number, scene: Scene, optimized: boolean) {
  let now = 0,
    measuring = false,
    messages = 0,
    wireBytes = 0,
    crafting = 0,
    explosions = 0;
  let outgoing: { connection: string; payload: string | Uint8Array }[] = [];
  const transcript = createHash('sha256'),
    encoder = new (optimized ? SnapshotEncoder : BaselineEncoder)(),
    actions = new Map<string, number>();
  const store = new WorldStore(new VoxelWorld(), new TerrainGen(4242));
  const replies = new Map<string, Extract<ServerMessage, { type: 'result' }>>();
  const room = new (optimized ? GameRoom : BaselineRoom)(
    store,
    content,
    build,
    {
      send(connection, event) {
        if ('type' in event && event.type === 'result') replies.set(connection, event);
        const payload =
          'kind' in event
            ? encodeChunk(event)
            : optimized || baseline.sharedEncoding
              ? encoder.encode(event)
              : JSON.stringify(event);
        if (measuring) {
          outgoing.push({ connection, payload });
          messages++;
          wireBytes +=
            typeof payload === 'string' ? Buffer.byteLength(payload) : payload.byteLength;
          if ('type' in event && event.type === 'explosion' && connection === 'a0') explosions++;
        }
      },
      close() {
        throw new Error('unexpected fixture connection close');
      },
    },
    'survival-benchmark',
    4242,
    now,
    0,
    'survival',
  );
  const command = (id: string, operation: InventoryCommand) => {
    const actor = room.actors.get(id)!;
    const sequence = (actions.get(id) ?? 0) + 1;
    actions.set(id, sequence);
    room.receive(id, { type: 'inventory', epoch: actor.epoch, sequence, operation }, now);
    const reply = replies.get(id);
    assert(reply);
    assert.equal(reply?.sequence, sequence);
    assert.equal(
      reply.outcome?.ok,
      true,
      JSON.stringify({ operation: operation.kind, outcome: reply.outcome }),
    );
  };
  try {
    for (let i = 0; i < players; i++)
      room.join(
        {
          id: 'a' + i,
          role: 'participant',
          capabilities: { build: true, fly: false, observe: false, combat: true, explosives: true },
        },
        'a' + i,
        now,
      );
    while (store.generateOne()) {}
    room.advance((now += 1000 / 30));
    for (const a of room.actors.values()) {
      const p = store.world.player_state(a.slot);
      room.receive(
        a.id,
        {
          type: 'ready',
          epoch: a.epoch,
          columns: around(Math.floor(p[0] / 16), Math.floor(p[2] / 16), 1).map((c) => ({
            ...c,
            revision: store.revision(c.x, c.z),
          })),
        },
        now,
      );
      room.receive(a.id, { type: 'focus', epoch: a.epoch, active: true }, now);
      assert.equal(a.phase, 'playing');
      if (scene === 'craft-drops-tnt') {
        room.inventories.receive(a.id, makeStack(items.get('stone_pickaxe')!, 1));
        room.inventories.receive(a.id, makeStack(items.get('spruce_log')!, 32));
        for (const [kind, slot] of [
          ['iron_vest', 1],
          ['trail_boots', 3],
        ] as const) {
          room.inventories.receive(a.id, makeStack(items.get(kind)!, 1));
          const v = room.inventories.view(a.id),
            from = v.bag.findIndex((s) => s?.itemType === kind);
          command(a.id, {
            kind: 'move',
            from: { area: 'bag', slot: from },
            to: { area: 'equipment', slot },
            count: 1,
            revision: v.revision,
            containerId: null,
            containerRevision: null,
          });
        }
      }
    }
    const samples: number[] = [],
      generation: number[] = [];
    let sequence = 0;
    const p = store.world.player_state(room.actors.get('a0')!.slot),
      tnt = content.blocks.findIndex((b) => b.name === 'tnt'),
      rule = content.behavior.find((b) => b.family === 'tnt')!.explosive!;
    for (let tick = 0; tick < warmup + ticks; tick++) {
      now += 1000 / 30;
      measuring = tick >= warmup;
      const started = performance.now();
      for (const a of room.actors.values())
        room.receive(
          a.id,
          {
            type: 'input',
            frames: [1, 2].map((n) => ({
              epoch: a.epoch,
              sequence: sequence + n,
              x: 0,
              z: 0,
              yaw: Math.sin(tick / 30) * 0.4,
              pitch: Math.cos(tick / 45) * 0.15,
              jump: tick % 60 === 0,
              sprint: false,
              sneak: false,
            })),
          },
          now,
        );
      sequence += 2;
      if (scene === 'craft-drops-tnt') {
        if (tick % 90 === 0)
          for (let i = 0; i < Math.ceil(players / 4); i++)
            room.drops.add(
              { itemType: 'coal', count: 1 },
              [p[0] + 4 + (i % 4), p[1] + 0.5, p[2] + (Math.floor(i / 4) % 4)],
              tick + 1,
            );
        if (tick % 180 === 0)
          for (let i = 0; i < 4; i++)
            room.explosives.add('a0', tnt, [p[0] + 15 + i * 2, p[1] + 0.2, p[2] + 6], rule, 30);
        if (tick % 30 === 0)
          for (let i = Math.floor(tick / 30) % 8; i < players; i += 8) {
            const id = 'a' + i,
              v = room.inventories.view(id),
              slot = v.bag.findIndex((s) => s?.itemType === 'spruce_log');
            assert(slot >= 0);
            command(id, {
              kind: 'move',
              from: { area: 'bag', slot },
              to: { area: 'craft2', slot: 0 },
              count: 1,
              revision: v.revision,
              containerId: null,
              containerRevision: null,
            });
            command(id, {
              kind: 'craft',
              grid: 2,
              count: 1,
              revision: room.inventories.view(id).revision,
            });
            if (measuring) crafting++;
          }
      }
      const advanced = room.advance(now);
      assert.equal(advanced.steps, 1);
      assert.equal(advanced.droppedMs, 0);
      if (measuring) samples.push(performance.now() - started);
      // Audit hashing is outside the measured simulation/encoding interval.
      for (const entry of outgoing)
        transcript.update(entry.connection + '\0').update(entry.payload);
      outgoing = [];
      const generating = performance.now();
      let jobs = 0;
      while (store.generateOne()) jobs++;
      if (measuring && jobs) generation.push(performance.now() - generating);
    }
    assert([...room.actors.values()].every((a) => a.phase === 'playing'));
    if (scene === 'craft-drops-tnt')
      assert(crafting > 0 && explosions > 0, 'activity must execute during measured ticks');
    return {
      players,
      scene,
      optimized,
      tickMs: summary(samples),
      messages,
      wireBytes,
      transcriptSha256: transcript.digest('hex'),
      crafting,
      explosions,
      generationBatches: generation.length,
      generationMs: generation.length ? summary(generation) : null,
      columns: store.world.column_count(),
      liveDrops: room.drops.size,
      wasmHighWaterBytes: memory.buffer.byteLength,
    };
  } finally {
    room.dispose();
    assert.equal(room.actors.size, 0);
  }
}
const result: Record<string, unknown> = {
  result: 'RUNNING',
  startedAt: new Date().toISOString(),
  scope:
    'Comparative direct GameRoom survival simulation/input/actual worker JSON and chunk encoding; synthetic time, natural terrain, dense jumping/turning actors, plus fixture-owned equipment/crafting/drops/TNT. Excludes sockets, real worker scheduling, IO, school Auth, browser/voice, network and deployment capacity.',
  buildId: build.buildId,
  baseline: { name: baselineName, ...baseline },
  engineHash: build.engineHash,
  contentHash: content.hash,
  sourceSha256: {
    baseline: hash(readFileSync(baselinePath)),
    current: hash(read('src/sim/game-room.ts')),
    encoder: hash(read('src/server/snapshot-encoder.ts')),
    baselineEncoder: baselineEncoderHash,
  },
  host: {
    node: process.version,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    availableParallelism: availableParallelism(),
  },
  warmupTicks: warmup,
  measuredTicks: ticks,
  repeats,
  profiles,
  results: [],
};
const destination = new URL('../test-results/survival-benchmark.json', import.meta.url);
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
try {
  for (const scene of ['dense-motion', 'craft-drops-tnt'] as const)
    for (const players of profiles)
      for (let repeat = 0; repeat < repeats; repeat++) {
        const variants = repeat % 2 ? [true, false] : [false, true],
          pair = variants.map((optimized) => ({ ...run(players, scene, optimized), repeat }));
        assert.equal(
          pair[0].transcriptSha256,
          pair[1].transcriptSha256,
          'optimization must preserve recipient-ordered wire bytes',
        );
        assert.equal(pair[0].wireBytes, pair[1].wireBytes);
        assert.equal(pair[0].messages, pair[1].messages);
        (result.results as unknown[]).push(...pair);
        console.log(
          JSON.stringify({
            scene,
            players,
            repeat,
            results: pair.map((r) => ({
              optimized: r.optimized,
              p95: r.tickMs.p95,
              p99: r.tickMs.p99,
              mean: r.tickMs.mean,
              wireBytes: r.wireBytes,
              crafting: r.crafting,
              explosions: r.explosions,
            })),
          }),
        );
        writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
      }
  result.result = 'WIRE_EQUIVALENT_SURVIVAL_COMPARISON_PASS';
} catch (error) {
  result.result = 'FAIL';
  result.failure = error instanceof Error ? error.message.slice(0, 300) : 'benchmark failed';
  throw error;
} finally {
  result.finishedAt = new Date().toISOString();
  writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
}
