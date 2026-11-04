import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import {
  initSync,
  set_content,
  TerrainGen,
  VoxelWorld,
  ChunkMesher,
} from '../engine/pkg/voxel_engine.js';
const bytes = readFileSync(new URL('../engine/pkg/voxel_engine_bg.wasm', import.meta.url));
const { memory } = initSync({ module: new WebAssembly.Module(bytes) });
const content = JSON.parse(
  readFileSync(new URL('../artifacts/content.json', import.meta.url), 'utf8'),
);
set_content(JSON.stringify(content));
const generator = new TerrainGen(4242),
  world = new VoxelWorld(),
  mesher = new ChunkMesher();
const summary = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    p99: sorted[Math.ceil(sorted.length * 0.99) - 1],
    max: sorted.at(-1),
  };
};
const timing = <T>(samples: number[], operation: () => T): T => {
  const start = performance.now();
  const value = operation();
  samples.push(performance.now() - start);
  return value;
};
const generation: number[] = [],
  insertion: number[] = [],
  extraction: number[] = [],
  meshing: number[] = [],
  columns: number[] = [],
  regions: number[] = [],
  meshes: number[] = [];
let loadedMemory = 0,
  finalColumns = 0;
try {
  for (let n = 0; n < 5; n++) generator.generate(n, 0);
  for (let z = -4; z <= 4; z++)
    for (let x = -4; x <= 4; x++) {
      const data = timing(generation, () => generator.generate(x, z));
      columns.push(data.byteLength);
      timing(insertion, () => world.insert_column(x, z, data));
    }
  for (let z = -3; z <= 3; z++)
    for (let x = -3; x <= 3; x++) {
      const data = timing(extraction, () => world.extract_region(x, z));
      regions.push(data.byteLength);
      const mesh = timing(meshing, () => mesher.mesh(data));
      meshes.push(mesh.byteLength);
    }
  loadedMemory = memory.buffer.byteLength;
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) world.remove_column(x, z);
  finalColumns = world.column_count();
} finally {
  generator.free();
  world.free();
  mesher.free();
}
const report = {
  scope:
    'Compute-only foundation preset, 81 generated columns and 49 complete mesh neighborhoods; no hardware frame-rate or capacity claim. Content differs from upstream research, so this is not an isolated format-width comparison.',
  node: process.version,
  arch: process.arch,
  cpu: cpus()[0]?.model,
  availableCpus: cpus().length,
  engineHash: createHash('sha256').update(bytes).digest('hex'),
  contentHash: content.hash,
  stateCount: content.blocks.length,
  wasmBytes: bytes.byteLength,
  generationMs: summary(generation),
  insertionMs: summary(insertion),
  extractionMs: summary(extraction),
  lightingAndMeshingMs: summary(meshing),
  columnBytes: summary(columns),
  regionBytes: summary(regions),
  meshBytes: summary(meshes),
  loadedWasmHighWaterBytes: loadedMemory,
  afterFreeWasmHighWaterBytes: memory.buffer.byteLength,
  finalLoadedColumns: finalColumns,
};
mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../test-results/engine-benchmark.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
