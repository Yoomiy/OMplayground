import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';
import { initSync, set_content, TerrainGen, VoxelWorld } from '../engine/pkg/voxel_engine.js';
import { source } from '../content/index.ts';
import { compileContent } from './compile-content.ts';
import { Drops } from '../src/sim/drops.ts';
import { GameRoom } from '../src/sim/game-room.ts';
import { Inventories } from '../src/sim/inventory.ts';
import { DropRenderer } from '../src/render/drops.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const baselineRef = 'cb89065';
const paths = [
  'src/sim/drops.ts',
  'src/sim/game-room.ts',
  'src/render/drops.ts',
  'src/shared/gameplay.ts',
];
const baselineSources = new Map(
  paths.map((path) => [
    join(root, path),
    execFileSync('git', ['show', `${baselineRef}:games/voxel/${path}`], {
      cwd: repo,
      encoding: 'utf8',
    }),
  ]),
);
const temporary = mkdtempSync(join(tmpdir(), 'voxel-drop-comparison-'));
symlinkSync(join(root, 'node_modules'), join(temporary, 'node_modules'));
const summary = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    min: sorted[0],
  };
};
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const compiled = compileContent(source),
  content = compiled.manifest;
const wasm = readFileSync(new URL('../engine/pkg/voxel_engine_bg.wasm', import.meta.url));
initSync({ module: new WebAssembly.Module(wasm) });
set_content(JSON.stringify(content));
const world = new VoxelWorld(),
  generator = new TerrainGen(4242);
generator.set_void();
generator.set_void_ground(0, compiled.defaults.stone, compiled.defaults.stone, 1);
for (let z = -1; z <= 1; z++)
  for (let x = -1; x <= 1; x++) world.insert_column(x, z, generator.generate(x, z));
const materials = ['stone', 'dirt', 'oak_log', 'cobblestone'];
const counts = [10, 100, 500, 1000],
  repetitions = 15,
  serverSteps = 60,
  renderFrames = 60;
const results: any[] = [];

// These are private TS methods, but ordinary JS prototype methods. Calling them
// on a synthetic room executes the real collection/replication paths; no clock,
// socket, worker, gateway or development server is created.
type Version = {
  Drops: typeof Drops;
  GameRoom: typeof GameRoom;
  DropRenderer: typeof DropRenderer;
};
function port(positions: Float64Array[], counters?: Record<string, number>): any {
  const methods = ['has_column', 'get_block', 'target_boxes', 'sweep_body', 'line_clear'] as const;
  const value: any = { player_state: (slot: number) => positions[slot] };
  for (const name of methods) {
    const method = world[name].bind(world) as (...args: any[]) => any;
    value[name] = counters
      ? (...args: any[]) => {
          counters[name] = (counters[name] ?? 0) + 1;
          return method(...args);
        }
      : method;
  }
  return value;
}
function serverRun(version: Version, count: number, scenario: string, instrument = false) {
  const drops = new version.Drops(content);
  for (let i = 0; i < count; i++) {
    const position =
      scenario === 'spread-full'
        ? [0.5 + (i % 32) * 0.48, 1, 0.5 + Math.floor(i / 32) * 0.48]
        : [8.5 + (i % 4) * 0.02, 1, 8.5];
    drops.add(
      { itemType: materials[i % materials.length], count: scenario.endsWith('full') ? 64 : 1 },
      position,
      0,
      null,
      [0, 0, 0],
    );
  }
  const near = scenario === 'near-player';
  const positions = [new Float64Array(near ? [6, 1, 8.5] : [24.5, 1, 24.5])];
  const counters: Record<string, number> = {};
  const inventories = new Inventories(content, { station: () => null, canUse: () => false });
  inventories.join('viewer');
  const actor = {
    id: 'viewer',
    slot: 0,
    connection: 'viewer',
    phase: 'playing',
    role: 'participant',
    epoch: 1,
    capabilities: { build: true },
    visibleDrops: new Map(),
    dropsReset: true,
  };
  let bytes = 0,
    messages = 0;
  const proto = version.GameRoom.prototype as any;
  const context: any = {
    drops,
    actors: new Map([['viewer', actor]]),
    store: { world: port(positions, instrument ? counters : undefined) },
    inventories,
    mode: 'survival',
    tick: 0,
    send(_actor: unknown, event: unknown) {
      bytes += Buffer.byteLength(JSON.stringify(event));
      messages++;
    },
    inventoryView(a: unknown) {
      proto.inventoryView.call(context, a);
    },
  };
  const cpuStart = process.cpuUsage(),
    start = performance.now();
  for (let tick = 1; tick <= serverSteps; tick++) {
    context.tick = tick;
    drops.step(context.store.world, tick);
    if (tick % 3 === 0) {
      proto.pickups.call(context);
      proto.dropSnapshots.call(context);
    }
  }
  const elapsed = performance.now() - start,
    cpu = process.cpuUsage(cpuStart);
  const held = inventories.view('viewer').bag.reduce((n, s) => n + (s?.count ?? 0), 0);
  return {
    wallMsPerTick: elapsed / serverSteps,
    cpuMsPerTick: (cpu.user + cpu.system) / 1000 / serverSteps,
    remaining: drops.size,
    held,
    bytes,
    messages,
    ...(instrument
      ? {
          callsPerTick: Object.fromEntries(
            Object.entries(counters).map(([key, n]) => [key, n / serverSteps]),
          ),
        }
      : {}),
  };
}
function renderSetup(version: Version, count: number) {
  const scene = new THREE.Scene(),
    albedo = new THREE.Texture(),
    surface = new THREE.Texture();
  const renderer = new version.DropRenderer(scene, content.blocks, content.items, albedo, surface);
  const origin = new THREE.Vector3(),
    collision = port([]);
  const values = Array.from({ length: count }, (_, i) => ({
    id: `drop-${i + 1}`,
    revision: 0,
    stack: { itemType: materials[i % 4], count: 64 },
    position: [8.5, 1, 8.5] as const,
  }));
  let frame = 0;
  const update = (worldPort = collision) =>
    renderer.update(values, origin, ++frame / 60, 1, worldPort);
  update(); // Material/geometry construction is deliberately outside the measurement.
  return {
    scene,
    update,
    close() {
      renderer.dispose();
      albedo.dispose();
      surface.dispose();
    },
  };
}
try {
  const outfile = join(temporary, 'before.mjs');
  await build({
    stdin: {
      contents: `export { Drops } from './src/sim/drops.ts'; export { GameRoom } from './src/sim/game-room.ts'; export { DropRenderer } from './src/render/drops.ts';`,
      resolveDir: root,
      loader: 'ts',
    },
    outfile,
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node24',
    plugins: [
      {
        name: 'historical-drop-sources',
        setup(plugin) {
          plugin.onLoad({ filter: /\.ts$/ }, (args) => {
            const contents = baselineSources.get(args.path);
            return contents === undefined ? undefined : { contents, loader: 'ts' };
          });
        },
      },
    ],
  });
  const versions: Record<string, Version> = {
    before: await import(pathToFileURL(outfile).href),
    current: { Drops, GameRoom, DropRenderer },
  };
  // Warm the actual hot functions at a substantial population before timing the
  // small cases; per-case warm-up alone can leave those dominated by JIT tiering.
  for (const version of Object.values(versions)) {
    for (let run = 0; run < 4; run++) {
      serverRun(version, 1000, 'dense-full');
      serverRun(version, 1000, 'dense-mergeable');
    }
    const setup = renderSetup(version, 1000);
    try {
      for (let frame = 0; frame < 180; frame++) setup.update();
    } finally {
      setup.close();
    }
  }
  for (const count of counts)
    for (const scenario of ['dense-full', 'spread-full', 'dense-mergeable', 'near-player']) {
      const samples: Record<string, any[]> = { before: [], current: [] };
      for (let round = -3; round < repetitions; round++) {
        const order = round % 2 ? ['before', 'current'] : ['current', 'before'];
        for (const name of order) {
          const sample = serverRun(versions[name], count, scenario);
          if (round >= 0) samples[name].push(sample);
        }
      }
      const row: any = { stage: 'server', count, scenario };
      for (const name of ['before', 'current']) {
        const instrument = serverRun(versions[name], count, scenario, true);
        const measured = samples[name];
        row[name] = {
          wallMsPerTick: summary(measured.map((s) => s.wallMsPerTick)),
          cpuMsPerTick: summary(measured.map((s) => s.cpuMsPerTick)),
          remaining: instrument.remaining,
          itemsCollected: instrument.held,
          serializedBytes: instrument.bytes,
          messages: instrument.messages,
          callsPerTick: instrument.callsPerTick,
        };
      }
      row.ratio = row.current.wallMsPerTick.median / row.before.wallMsPerTick.median;
      results.push(row);
      console.log(
        `server ${scenario} ${count}: ${row.before.wallMsPerTick.median.toFixed(4)} -> ${row.current.wallMsPerTick.median.toFixed(4)} ms/tick; remaining ${row.before.remaining} -> ${row.current.remaining}`,
      );
    }
  for (const count of counts) {
    const setups = Object.fromEntries(
      Object.entries(versions).map(([name, version]) => [name, renderSetup(version, count)]),
    );
    const samples: Record<string, number[]> = { before: [], current: [] };
    try {
      for (const setup of Object.values(setups))
        for (let frame = 0; frame < 120; frame++) setup.update();
      for (let round = 0; round < repetitions; round++)
        for (const name of round % 2 ? ['before', 'current'] : ['current', 'before']) {
          const start = performance.now();
          for (let frame = 0; frame < renderFrames; frame++) setups[name].update();
          samples[name].push((performance.now() - start) / renderFrames);
        }
      const row: any = { stage: 'client-update', scenario: 'fixed-visible-count', count };
      for (const name of ['before', 'current']) {
        const counters: Record<string, number> = {};
        setups[name].update(port([], counters));
        row[name] = {
          wallMsPerFrame: summary(samples[name]),
          itemBatches: setups[name].scene.children.length,
          callsPerFrame: counters,
        };
      }
      row.ratio = row.current.wallMsPerFrame.median / row.before.wallMsPerFrame.median;
      results.push(row);
      console.log(
        `client ${count}: ${row.before.wallMsPerFrame.median.toFixed(4)} -> ${row.current.wallMsPerFrame.median.toFixed(4)} ms/frame`,
      );
    } finally {
      for (const setup of Object.values(setups)) setup.close();
    }
  }
  const report = {
    capturedAt: new Date().toISOString(),
    baselineRef: execFileSync('git', ['rev-parse', baselineRef], {
      cwd: repo,
      encoding: 'utf8',
    }).trim(),
    currentHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    currentDropSourceHashes: Object.fromEntries(
      [...paths, 'src/shared/drop-physics.ts'].map((path) => [
        path,
        hash(readFileSync(join(root, path))),
      ]),
    ),
    node: process.version,
    arch: process.arch,
    cpu: cpus()[0]?.model,
    engineHash: hash(wasm),
    contentHash: content.hash,
    scope:
      'Synthetic compute comparison against the pre-chat rewrite, not legacy noa or the intermediate halo/separation implementation. Historical drop/gameplay/room source; identical current native engine, content, inventory implementation and item geometry/materials. No servers, GPU rendering or actual network traffic.',
    methodology: {
      repetitions,
      serverSteps,
      renderFrames,
      globalWarmup: 'four 1000-drop fixed/mergeable server runs plus 180 client frames per version',
      serverWarmupRuns: 3,
      clientWarmupFrames: 120,
      order: 'alternating before/current',
      server:
        '2 simulated seconds per fresh population: native gravity at 30 Hz, actual collection and drop-replication methods at 10 Hz, one viewer, JSON serialization included; setup excluded.',
      client:
        'CPU work of DropRenderer.update at fixed visible counts, prebuilt geometry/materials; no WebGL draw or FPS measurement.',
      scenarios: {
        'dense-full': 'overlapping full mixed stacks; cannot merge, distant viewer',
        'spread-full': 'full mixed stacks on a grid; cannot merge, distant viewer',
        'dense-mergeable': 'overlapping one-item mixed stacks; can merge, distant viewer',
        'near-player':
          'one-item mixed stacks 2.5 blocks from viewer; baseline cannot collect at this distance, current magnetism can',
      },
      statistics:
        'Wall and process CPU median/p95 are normalized batch averages, not individual tick/frame spike percentiles. Live-drop counts intentionally diverge in merging/collection scenarios. Serialized bytes are synthetic JSON payload sizes, excluding transport framing.',
    },
    results,
  };
  mkdirSync(join(root, 'test-results'), { recursive: true });
  writeFileSync(
    join(root, 'test-results/drop-comparison.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  const lines = [
    '# Drop performance comparison',
    '',
    `Baseline: ${baselineRef} (before this chat’s drop work). Current: working-tree drop changes on ${report.currentHead.slice(0, 7)}.`,
    '',
    `Host: ${report.cpu}; ${report.arch}; ${report.node}. ${repetitions} measured rounds after warm-up, alternating order.`,
    '',
    'All times are milliseconds. Server numbers include gravity, collection, replication and JSON serialization for one synthetic viewer; client numbers measure CPU updates only. No server or GPU was started.',
    '',
    '| Scenario | Drops | Before ms/tick | Current ms/tick | Ratio | Remaining before → current |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const row of results.filter((r) => r.stage === 'server'))
    lines.push(
      `| ${row.scenario} | ${row.count} | ${row.before.wallMsPerTick.median.toFixed(4)} | ${row.current.wallMsPerTick.median.toFixed(4)} | ${row.ratio.toFixed(2)}× | ${row.before.remaining} → ${row.current.remaining} |`,
    );
  lines.push(
    '',
    '| Visible drops | Before client ms/frame | Current client ms/frame | Ratio | Item batches before → current |',
    '|---:|---:|---:|---:|---:|',
  );
  for (const row of results.filter((r) => r.stage === 'client-update'))
    lines.push(
      `| ${row.count} | ${row.before.wallMsPerFrame.median.toFixed(4)} | ${row.current.wallMsPerFrame.median.toFixed(4)} | ${row.ratio.toFixed(2)}× | ${row.before.itemBatches} → ${row.current.itemBatches} |`,
    );
  lines.push(
    '',
    'The fixed-count rows isolate additional per-drop work. Merge/attraction rows compare resulting workload and gameplay, rather than identical remaining populations. Both versions use the same artwork and Wasm. Timing excludes material creation and terrain generation; it includes temporary allocations within each timed operation. This predicts neither full-game FPS nor browser/GPU timing. See JSON for p95, process CPU timing, source hashes, operation counts and synthetic payload sizes.',
    '',
  );
  writeFileSync(join(root, 'test-results/drop-comparison.md'), lines.join('\n'));
  assert.equal(results.length, 20);
} finally {
  world.free();
  generator.free();
  rmSync(temporary, { recursive: true, force: true });
}
