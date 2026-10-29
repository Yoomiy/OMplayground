import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test(
  'streamed terrain crosses the former map fence and preserves old saves through native/wire/gateway recovery',
  { timeout: 30000 },
  () => {
    const output = execFileSync(
      process.execPath,
      [fileURLToPath(new URL('../fixtures/world-profile-scenario.ts', import.meta.url))],
      { encoding: 'utf8', timeout: 25000 },
    );
    const report = JSON.parse(output.trim().split('\n').at(-1)!);
    assert.equal(report.result, 'STREAMED_WORLD_AUTHORITY_WIRE_DROPS_CHECKPOINT_AND_GATEWAY_PASS');
    assert.ok(report.size > 512);
    assert.equal(report.oldDefaultCheckpoint, 'expanded-with-seed-and-progress-preserved');
  },
);
