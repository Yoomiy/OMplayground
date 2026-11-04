import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('..', import.meta.url));
if (process.versions.node !== '24.21.0') throw new Error('Node 24.21.0 required');
const version = execFileSync('rustc', ['--version'], {
  cwd: fileURLToPath(new URL('../engine/', import.meta.url)),
  encoding: 'utf8',
}).trim();
if (!version.startsWith('rustc 1.99.1 ')) throw new Error(`Rust 1.99.1 required; got ${version}`);
const wasmPack =
  process.env.WASM_PACK ||
  fileURLToPath(new URL('../node_modules/.bin/wasm-pack', import.meta.url));
const packVersion = execFileSync(wasmPack, ['--version'], { encoding: 'utf8' }).trim();
if (packVersion !== 'wasm-pack 0.15.0')
  throw new Error(`wasm-pack 0.15.0 required; got ${packVersion}`);
execFileSync(
  wasmPack,
  [
    'build',
    'engine',
    '--target',
    'web',
    '--release',
    '--out-dir',
    'pkg',
    '--out-name',
    'voxel_engine',
    '--locked',
  ],
  { cwd: dir, stdio: 'inherit' },
);
