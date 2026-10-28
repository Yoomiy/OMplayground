import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const game = new URL('../', import.meta.url);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (root, path) => readFileSync(new URL(path, root));
const json = (root, path) => JSON.parse(read(root, path).toString());
function files(root, dir) {
  return readdirSync(new URL(dir, root), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) => {
      assert(!entry.isSymbolicLink(), 'Release inputs must not be symlinks');
      const path = dir + entry.name;
      return entry.isDirectory() ? files(root, path + '/') : [path];
    });
}
export function sourceInventory(root = game) {
  const paths = [
    ...['src/', 'content/', 'config/', 'engine/src/'].flatMap((dir) => files(root, dir)),
    'package.json',
    'package-lock.json',
    'engine/Cargo.toml',
    'engine/Cargo.lock',
    'engine/rust-toolchain.toml',
    'engine/LICENSE',
    'LICENSE',
    'UPSTREAM.md',
    'tools/build-engine.mjs',
    'tools/build-manifest.mjs',
    'tools/release-manifest.mjs',
    'tools/compile-content.ts',
    'tools/verify-release.mjs',
  ];
  return paths.sort().map((path) => ({ path, hash: digest(read(root, path)) }));
}
function verifyCurrent(root) {
  // Native TypeScript may be unavailable or disabled. The normal Node path stays
  // dependency-free; local installs can use the existing root tsx dependency.
  const loader = process.features.typescript ? [] : ['--import', import.meta.resolve('tsx')];
  execFileSync(
    process.execPath,
    [...loader, fileURLToPath(new URL('tools/verify-release.mjs', root))],
    { stdio: 'pipe', encoding: 'utf8' },
  );
}
/** Explicit release-maintainer command, after a full matched build/check. */
export function freezeRelease(root = game) {
  verifyCurrent(root);
  const build = json(root, 'artifacts/build.json');
  const paths = [
    ...files(root, 'engine/pkg/'),
    ...files(root, 'dist-client/'),
    ...files(root, 'dist-server/'),
    'artifacts/build.json',
    'artifacts/content.json',
    'artifacts/content-bindings.ts',
    'artifacts/release.json',
    'artifacts/' + build.engineArtifact,
    'artifacts/' + build.bindingsArtifact,
  ].sort();
  const manifest = {
    schema: 1,
    buildId: build.buildId,
    inputs: sourceInventory(root),
    files: paths.map((path) => ({ path, hash: digest(read(root, path)) })),
  };
  const staging = new URL(`.release-${process.pid}/`, root);
  mkdirSync(new URL('payload/', staging), { recursive: true });
  try {
    for (const row of manifest.files)
      writeFileSync(new URL(`payload/${row.hash}`, staging), read(root, row.path));
    writeFileSync(new URL('manifest.json', staging), JSON.stringify(manifest, null, 2) + '\n');
    rmSync(new URL('release/', root), { recursive: true, force: true });
    renameSync(staging, new URL('release/', root));
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  return manifest;
}
/** Hydrates a checked-in release; never downloads engine code or runs Rust. */
export function restoreRelease(root = game) {
  assert(Number(process.versions.node.split('.')[0]) >= 24, 'Node 24 or newer is required');
  const manifest = json(root, 'release/manifest.json');
  assert.equal(manifest.schema, 1);
  assert.match(manifest.buildId, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    sourceInventory(root),
    manifest.inputs,
    'Game source differs from the published release. Run build:voxel/check:voxel, then freeze:release.',
  );
  const paths = new Set(),
    data = [];
  for (const row of manifest.files) {
    assert(
      typeof row.path === 'string' &&
        /^(?:engine\/pkg|artifacts|dist-client|dist-server)\/[a-zA-Z0-9_./-]+$/.test(row.path) &&
        !row.path.split('/').some((p) => p === '..' || p === '.' || p === ''),
      'Invalid release destination',
    );
    assert(!paths.has(row.path), 'Duplicate release destination');
    paths.add(row.path);
    assert.match(row.hash, /^[a-f0-9]{64}$/);
    const bytes = read(root, `release/payload/${row.hash}`);
    assert.equal(digest(bytes), row.hash, 'Release payload checksum mismatch');
    data.push({ path: row.path, bytes });
  }
  const buildFile = data.find((row) => row.path === 'artifacts/build.json');
  assert(buildFile && JSON.parse(buildFile.bytes.toString()).buildId === manifest.buildId);
  // Verify all source and payload bytes before changing generated directories.
  for (const dir of ['engine/pkg/', 'artifacts/', 'dist-client/', 'dist-server/'])
    rmSync(new URL(dir, root), { recursive: true, force: true });
  for (const row of data) {
    mkdirSync(new URL('./', new URL(row.path, root)), { recursive: true });
    writeFileSync(new URL(row.path, root), row.bytes);
  }
  verifyCurrent(root);
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const action = process.argv[2];
  assert(['freeze', 'restore'].includes(action), 'Use freeze or restore');
  const manifest = action === 'freeze' ? freezeRelease() : restoreRelease();
  console.log(
    `${action === 'freeze' ? 'Published' : 'Restored'} matched release ${manifest.buildId.slice(0, 12)} (${manifest.files.length} files)`,
  );
}
