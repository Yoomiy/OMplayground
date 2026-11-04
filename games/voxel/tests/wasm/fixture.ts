import { readFileSync } from 'node:fs';
import { initSync } from '../../engine/pkg/voxel_engine.js';
import * as engine from '../../engine/pkg/voxel_engine.js';
import { source } from '../../content/index.ts';
import { compileContent } from '../../tools/compile-content.ts';
const stone = source.blocks.find((b) => b.family === 'stone')!;
const slab = source.blocks.find((b) => b.family === 'stone_slab')!;
const glow = source.blocks.find((b) => b.family === 'glowstone')!;
export const content = compileContent({
  ...source,
  blocks: [
    ...source.blocks,
    ...Array.from({ length: 300 }, (_, n) => ({
      ...stone,
      family: `test_${String(n).padStart(3, '0')}`,
      drops: [],
    })),
    { ...slab, family: 'z_slab', drops: [] },
    { ...glow, family: 'z_glow', drops: [] },
  ],
});
export const wasmBytes = readFileSync(
  new URL('../../engine/pkg/voxel_engine_bg.wasm', import.meta.url),
);
export const wasmModule = new WebAssembly.Module(wasmBytes);
export const output = initSync({ module: wasmModule });
engine.set_content(JSON.stringify(content.manifest));
export { engine };
export function flatWorld() {
  const generator = new engine.TerrainGen(4242),
    world = new engine.VoxelWorld();
  generator.set_void();
  generator.set_void_ground(0, content.defaults.stone, content.defaults.stone, 1);
  for (let z = -1; z <= 1; z++)
    for (let x = -1; x <= 1; x++) world.insert_column(x, z, generator.generate(x, z));
  generator.free();
  return world;
}
