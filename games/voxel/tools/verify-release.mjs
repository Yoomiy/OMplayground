import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { source } from '../content/index.ts';
import { compileContent } from './compile-content.ts';
import { PROTOCOL } from '../src/shared/protocol.ts';
import { ENVIRONMENT_VERSION } from '../src/shared/environment.ts';

const root = new URL('../', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path) => readFileSync(new URL(path, root));
const json = (path) => JSON.parse(read(path).toString());
function files(dir, prefix = '') {
  return readdirSync(new URL(dir, root), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(`${dir}${entry.name}/`, `${prefix}${entry.name}/`)
        : [{ path: `${prefix}${entry.name}`, bytes: read(`${dir}${entry.name}`) }],
    );
}
const build = json('artifacts/build.json'),
  release = json('artifacts/release.json'),
  content = json('artifacts/content.json');
assert.deepEqual(content, compileContent(source).manifest, 'authored content differs from build');
const identity = {
  runtimeHash: hash(
    Buffer.concat([
      Buffer.from('config/world.json'),
      read('config/world.json'),
      ...files('src/').flatMap((entry) => [Buffer.from(`src/${entry.path}`), entry.bytes]),
    ]),
  ),
  engineHash: hash(read('engine/pkg/voxel_engine_bg.wasm')),
  bindingsHash: hash(read('engine/pkg/voxel_engine.js')),
  contentHash: content.hash,
  protocol: PROTOCOL,
  environmentVersion: ENVIRONMENT_VERSION,
  columnFormat: 2,
  regionFormat: 2,
  editFormat: 2,
  height: 256,
};
for (const [field, value] of Object.entries(identity))
  assert.equal(build[field], value, `current ${field} differs from build`);
assert.equal(build.buildId, hash(JSON.stringify(identity)), 'build identity hash mismatch');
assert.equal(hash(read(`artifacts/${build.engineArtifact}`)), identity.engineHash);
assert.equal(hash(read(`artifacts/${build.bindingsArtifact}`)), identity.bindingsHash);
for (const field of ['buildId', 'engineHash', 'contentHash'])
  assert.equal(release[field], build[field], `release ${field} mismatch`);
let matchedReleaseFiles = 0;
for (const target of ['client', 'server']) {
  const inventory = files(`dist-${target}/`).map(({ path, bytes }) => ({
    path,
    hash: hash(bytes),
  }));
  assert.deepEqual(inventory, release[target], `${target} release inventory mismatch`);
  assert.equal(hash(JSON.stringify(inventory)), release[`${target}Hash`]);
  assert.ok(inventory.some((entry) => entry.hash === identity.engineHash));
  matchedReleaseFiles += inventory.length;
}
const result = {
  result: 'PASS',
  capturedAt: new Date().toISOString(),
  buildId: build.buildId,
  ...identity,
  matchedReleaseFiles,
};
mkdirSync(new URL('test-results/', root), { recursive: true });
writeFileSync(
  new URL('test-results/release-verification.json', root),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  `Verified current source/content and ${matchedReleaseFiles} release files: ${build.buildId.slice(0, 12)}`,
);
