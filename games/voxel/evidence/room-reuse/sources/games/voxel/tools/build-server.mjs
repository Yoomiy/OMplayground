import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync, copyFileSync } from 'node:fs';
const root = fileURLToPath(new URL('../', import.meta.url)),
  out = new URL('../dist-server/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ['src/server/gateway.ts', 'src/server/room-worker.ts'],
  outdir: 'dist-server',
  bundle: true,
  packages: 'external',
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
});
copyFileSync(
  new URL('../engine/pkg/voxel_engine_bg.wasm', import.meta.url),
  new URL('engine.wasm', out),
);
copyFileSync(new URL('../artifacts/build.json', import.meta.url), new URL('build.json', out));
copyFileSync(new URL('../artifacts/content.json', import.meta.url), new URL('content.json', out));
console.log('Built voxel gateway and room worker');
