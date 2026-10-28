import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdtempSync,
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { restoreRelease } from '../tools/release-snapshot.mjs';
import { execFileSync } from 'node:child_process';
const game = new URL('../', import.meta.url);
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'voxel-published-release-')),
    root = pathToFileURL(dir + '/'),
    manifest = JSON.parse(readFileSync(new URL('release/manifest.json', game), 'utf8'));
  for (const row of manifest.inputs) {
    mkdirSync(dirname(join(dir, row.path)), { recursive: true });
    cpSync(new URL(row.path, game), join(dir, row.path));
  }
  cpSync(new URL('release/', game), new URL('release/', root), { recursive: true });
  return { dir, root, manifest };
}
test('a clean source checkout restores matching browser/server/Wasm artifacts without Rust or npm dependencies', () => {
  const f = fixture();
  try {
    assert(!existsSync(new URL('engine/pkg/', f.root)));
    assert(!existsSync(new URL('artifacts/', f.root)));
    assert(!existsSync(new URL('node_modules/', f.root)));
    const result = restoreRelease(f.root);
    assert.equal(result.buildId, f.manifest.buildId);
    assert.deepEqual(
      readFileSync(new URL('engine/pkg/voxel_engine_bg.wasm', f.root)),
      readFileSync(new URL('engine/pkg/voxel_engine_bg.wasm', game)),
    );
    const proof = JSON.parse(
      readFileSync(new URL('test-results/release-verification.json', f.root), 'utf8'),
    );
    assert.equal(proof.result, 'PASS');
    assert.equal(proof.matchedReleaseFiles, 12);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
test('source, payload corruption and destination traversal fail before overwriting generated output', () => {
  for (const kind of ['source', 'payload', 'destination']) {
    const f = fixture();
    try {
      mkdirSync(new URL('artifacts/', f.root));
      const marker = new URL('artifacts/owned-marker', f.root);
      writeFileSync(marker, 'preserve existing build');
      if (kind === 'source') writeFileSync(new URL('engine/src/lib.rs', f.root), 'changed source');
      else if (kind === 'payload') {
        const hash = f.manifest.files.find((row) => row.path.endsWith('.wasm')).hash;
        writeFileSync(new URL(`release/payload/${hash}`, f.root), 'corrupt');
      } else {
        f.manifest.files[0].path = '../../outside';
        writeFileSync(new URL('release/manifest.json', f.root), JSON.stringify(f.manifest));
      }
      assert.throws(
        () => restoreRelease(f.root),
        /source differs|checksum mismatch|Invalid release destination/,
      );
      assert.equal(readFileSync(marker, 'utf8'), 'preserve existing build');
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  }
});

test('a Node process without native TypeScript restores a clean checkout through the project tsx loader', () => {
  const f = fixture();
  try {
    const module = new URL('../tools/release-snapshot.mjs', import.meta.url).href;
    const script = `import { restoreRelease } from ${JSON.stringify(module)};
      if (process.features.typescript !== false) throw Error('TypeScript must be disabled in this regression');
      restoreRelease(new URL(${JSON.stringify(f.root.href)}));`;
    execFileSync(process.execPath, ['--no-strip-types', '--input-type=module', '--eval', script], {
      env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --no-strip-types` },
      stdio: 'pipe',
      encoding: 'utf8',
    });
    assert(!existsSync(new URL('node_modules/', f.root)));
    const proof = JSON.parse(
      readFileSync(new URL('test-results/release-verification.json', f.root), 'utf8'),
    );
    assert.equal(proof.result, 'PASS');
    assert.equal(proof.matchedReleaseFiles, 12);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
