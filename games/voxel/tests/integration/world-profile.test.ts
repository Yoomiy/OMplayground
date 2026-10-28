import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test(
  'shared build profiles control real native boundaries, wire, persisted worlds and gateway recovery',
  { timeout: 90000 },
  () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const stage = mkdtempSync(path.join(tmpdir(), 'voxel-world-profile-'));
    const reports: { size: number; buildId: string }[] = [];
    const execute = (args: string[], expected = 0) => {
      const result = spawnSync(process.execPath, args, {
        cwd: stage,
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 2 * 1024 * 1024,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, expected, result.stdout + result.stderr);
      return result.stdout;
    };
    try {
      for (const directory of ['src', 'config', 'tools'])
        cpSync(path.join(root, directory), path.join(stage, directory), { recursive: true });
      cpSync(path.join(root, 'package.json'), path.join(stage, 'package.json'));
      cpSync(path.join(root, 'tsconfig.json'), path.join(stage, 'tsconfig.json'));
      mkdirSync(path.join(stage, 'engine'));
      symlinkSync(path.join(root, 'engine/pkg'), path.join(stage, 'engine/pkg'), 'dir');
      symlinkSync(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
      mkdirSync(path.join(stage, 'artifacts'));
      cpSync(path.join(root, 'artifacts/content.json'), path.join(stage, 'artifacts/content.json'));
      mkdirSync(path.join(stage, 'tests/fixtures'), { recursive: true });
      for (const file of [
        'world-profile-scenario.ts',
        'socket-probe.ts',
        'checkpoint-storage.ts',
        'default512-checkpoint.json',
      ])
        cpSync(path.join(root, 'tests/fixtures', file), path.join(stage, 'tests/fixtures', file));
      for (const size of [128, 512, 1024]) {
        writeFileSync(
          path.join(stage, 'config/world.json'),
          JSON.stringify({ size }, null, 2) + '\n',
        );
        execute(['tools/build-manifest.mjs']);
        if (process.env.VOXEL_TEST_BUNDLE) execute(['tools/build-server.mjs']);
        const output = execute(['tests/fixtures/world-profile-scenario.ts']);
        const report = JSON.parse(output.trim().split('\n').at(-1)!);
        assert.equal(
          report.result,
          'CONFIGURED_WORLD_AUTHORITY_WIRE_DROPS_CHECKPOINT_AND_GATEWAY_PASS',
        );
        assert.equal(report.size, size);
        reports.push(report);
      }
      assert.equal(new Set(reports.map((r) => r.buildId)).size, 3);
      assert.equal(
        reports.find((r) => r.size === 512)!.buildId,
        JSON.parse(readFileSync(path.join(root, 'artifacts/build.json'), 'utf8')).buildId,
      );
      for (const profile of [
        { size: 63 },
        { size: 65 },
        { size: 65568 },
        { size: '512' },
        { size: 512, extra: true },
      ]) {
        writeFileSync(path.join(stage, 'config/world.json'), JSON.stringify(profile));
        const result = spawnSync(process.execPath, ['tools/build-manifest.mjs'], {
          cwd: stage,
          encoding: 'utf8',
          timeout: 10000,
        });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /World size must be/);
      }
      mkdirSync(path.join(root, 'test-results'), { recursive: true });
      writeFileSync(
        path.join(
          root,
          'test-results',
          process.env.VOXEL_TEST_BUNDLE
            ? 'world-profiles-bundle.json'
            : 'world-profiles-source.json',
        ),
        JSON.stringify(
          {
            result: 'CONFIGURED_WORLD_PROFILES_PASS',
            packaged: !!process.env.VOXEL_TEST_BUNDLE,
            reports,
            invalidProfilesRejected: 5,
            scope:
              'Functional native/wire/checkpoint/gateway checks; not hardware or capacity qualification',
          },
          null,
          2,
        ) + '\n',
      );
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }
  },
);
