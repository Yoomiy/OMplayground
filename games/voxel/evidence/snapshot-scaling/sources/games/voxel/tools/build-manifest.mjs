import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { PROTOCOL } from '../src/shared/protocol.ts';
import { ENVIRONMENT_VERSION } from '../src/shared/environment.ts';
const root = new URL('../', import.meta.url),
  artifacts = new URL('artifacts/', root);
const hash = (data) => createHash('sha256').update(data).digest('hex');
const wasm = new URL('engine/pkg/voxel_engine_bg.wasm', root);
const engineHash = hash(readFileSync(wasm));
const bindings = new URL('engine/pkg/voxel_engine.js', root);
const bindingsHash = hash(readFileSync(bindings));
const content = JSON.parse(readFileSync(new URL('content.json', artifacts), 'utf8'));
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((e) =>
      e.isDirectory() ? sources(new URL(`${e.name}/`, dir)) : [new URL(e.name, dir)],
    );
}
const runtimeHash = hash(
  Buffer.concat(
    sources(new URL('src/', root)).flatMap((file) => [
      Buffer.from(file.pathname.slice(root.pathname.length)),
      readFileSync(file),
    ]),
  ),
);
const identity = {
  runtimeHash,
  engineHash,
  bindingsHash,
  contentHash: content.hash,
  protocol: PROTOCOL,
  environmentVersion: ENVIRONMENT_VERSION,
  columnFormat: 2,
  regionFormat: 2,
  editFormat: 2,
  height: 256,
};
const buildId = hash(JSON.stringify(identity));
mkdirSync(artifacts, { recursive: true });
copyFileSync(wasm, new URL(`engine-${engineHash}.wasm`, artifacts));
copyFileSync(bindings, new URL(`bindings-${bindingsHash}.js`, artifacts));
writeFileSync(
  new URL('build.json', artifacts),
  JSON.stringify(
    {
      ...identity,
      buildId,
      engineArtifact: `engine-${engineHash}.wasm`,
      bindingsArtifact: `bindings-${bindingsHash}.js`,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Voxel build ${buildId.slice(0, 12)}`);
