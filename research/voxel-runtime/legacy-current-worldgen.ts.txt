// Current scalar generator cost. Terrain differs from Blockyard: do not infer a language speedup.
import { MultiBiomeGenerator } from '../../packages/voxel-content/src/worldgen';
import { writeFileSync } from 'node:fs';
const stats = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / s.length, p50: s[Math.floor(s.length * .5)], p95: s[Math.floor(s.length * .95)], max: s.at(-1) };
};
const generator = new MultiBiomeGenerator(4242);
const cube: number[] = [], columns: number[] = [];
let checksum = 0;
for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) {
  const startColumn = performance.now();
  // Match the current client's 16-cube traversal, output allocation, and scalar calls.
  for (let cy = 0; cy < 16; cy++) {
    const voxels = new Uint16Array(4096); let n = 0;
    const start = performance.now();
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) voxels[n++] = generator.blockAt(cx * 16 + x, cy * 16 + y, cz * 16 + z);
    cube.push(performance.now() - start); checksum += voxels[2048];
  }
  columns.push(performance.now() - startColumn);
}
const result = { seed: 4242, cubeGenerationMs: stats(cube), full256HighColumnMs: stats(columns), checksum, fullColumnVoxelBytes: 16 * 16 * 256 * 2, excludes: ['NOA ndarray population', 'meshing', 'rendering', 'worker transfer'] };
writeFileSync(process.env.PROBE_OUTPUT ?? '/tmp/voxel-runtime-current-results.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
