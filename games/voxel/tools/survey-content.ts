import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initSync, set_content, TerrainGen } from '../engine/pkg/voxel_engine.js';
import type { ContentManifest } from '../src/shared/content.ts';
import { BOUNDS } from '../src/shared/protocol.ts';
const root = new URL('../', import.meta.url),
  read = (path: string) => readFileSync(new URL(path, root));
const content = JSON.parse(read('artifacts/content.json').toString()) as ContentManifest,
  build = JSON.parse(read('artifacts/build.json').toString()),
  bytes = read('engine/pkg/voxel_engine_bg.wasm');
assert.equal(createHash('sha256').update(bytes).digest('hex'), build.engineHash);
assert.equal(content.hash, build.contentHash);
initSync({ module: bytes });
set_content(JSON.stringify(content));
const required = [
  'oak_log',
  'birch_log',
  'spruce_log',
  'oak_leaves',
  'birch_leaves',
  'spruce_leaves',
  'stone',
  'sand',
  'water',
  'short_grass',
  'coal_ore',
  'iron_ore',
  'gold_ore',
  'diamond_ore',
  'lapis_ore',
];
const reports = [];
for (const seed of [4242, 42, 20261024]) {
  const generator = new TerrainGen(seed),
    start = performance.now();
  try {
    const spawn = Array.from(generator.find_spawn()),
      cx = Math.floor(Math.max(BOUNDS.minX + 32, Math.min(BOUNDS.maxX - 32, spawn[0])) / 16),
      cz = Math.floor(Math.max(BOUNDS.minZ + 32, Math.min(BOUNDS.maxZ - 32, spawn[2])) / 16),
      columns = new Map<string, readonly [number, number]>(),
      counts = new Map<string, number>();
    const add = (x: number, z: number) => {
      if (
        x >= BOUNDS.minX / 16 &&
        x < BOUNDS.maxX / 16 &&
        z >= BOUNDS.minZ / 16 &&
        z < BOUNDS.maxZ / 16
      )
        columns.set(`${x},${z}`, [x, z]);
    };
    const step = Math.max(1, Math.floor((BOUNDS.maxX - BOUNDS.minX) / 16 / 8));
    for (let x = BOUNDS.minX / 16; x < BOUNDS.maxX / 16; x += step)
      for (let z = BOUNDS.minZ / 16; z < BOUNDS.maxZ / 16; z += step) add(x, z);
    for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 3; z <= cz + 3; z++) add(x, z);
    for (const [x, z] of columns.values()) {
      const data = generator.generate(x, z),
        view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      assert.equal(new TextDecoder().decode(data.subarray(0, 4)), 'VXC2');
      for (let offset = 1032; offset < data.length; offset += 2) {
        const id = view.getUint16(offset, true),
          name = content.blocks[id]?.name;
        assert.ok(
          name && id !== 65535,
          'all generated states must belong to the compiled registry',
        );
        if (id) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const missing = required.filter((kind) => !counts.get(kind));
    if (!['oak', 'birch', 'spruce'].some((wood) => counts.get(`${wood}_log`)))
      missing.push('any_wood');
    if (!['oak', 'birch', 'spruce'].some((wood) => counts.get(`${wood}_leaves`)))
      missing.push('any_leaves');
    reports.push({
      seed,
      spawn,
      columns: [...columns.values()],
      counts: Object.fromEntries([...counts].sort()),
      missing,
      durationMs: performance.now() - start,
    });
    console.log(
      `Seed ${seed}: ${columns.size} bounded columns, ${counts.size} families, missing ${missing.join(',') || 'none'}`,
    );
  } finally {
    generator.free();
  }
}
const report = {
  result: reports.some((report) => report.missing.length) ? 'FAIL' : 'PASS',
  checkedAt: new Date().toISOString(),
  buildId: build.buildId,
  contentHash: content.hash,
  bounds: BOUNDS,
  reports,
  limits:
    'Three deterministic seeds and a sampled column grid, including a 7x7 spawn neighborhood. Presence does not establish reachable cave entrances, survival travel, sufficient quantities, every seed, resource distribution balance or hardware performance.',
};
mkdirSync(new URL('test-results/', root), { recursive: true });
writeFileSync(
  new URL('test-results/content-survey.json', root),
  JSON.stringify(report, null, 2) + '\n',
);
assert.equal(
  report.result,
  'PASS',
  'sampled bounded seeds must contain essential progression resources',
);
