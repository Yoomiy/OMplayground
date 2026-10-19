import assert from 'node:assert/strict';
import test from 'node:test';
import { historyFixture, historyCommand as command } from './lab-history-fixture.js';

test('aligned delayed authoritative snapshots confirm history without replaying steady driving', async () => {
  const f = await historyFixture();
  try {
    for (let i = 0; i < 90; i++) f.tick();
    const stats = f.lab.getDebugState();
    assert.equal(stats.error, null);
    assert.ok(stats.confirmedSnapshots > 30, JSON.stringify(stats));
    assert.ok(stats.skippedReplaySteps > 100);
    assert.ok(stats.historySize <= 64);
    const reports = f.lab.exportTelemetry();
    assert.ok(reports.some(r => r.confirmedSnapshots > 0 && r.skippedReplaySteps > 0));
  } finally { f.dispose(); }
});

test('an authoritative collision/teleport mismatch restores instead of trusting the confirmed path', async () => {
  const f = await historyFixture();
  try {
    for (let i = 0; i < 30; i++) f.tick();
    const frame = f.headSnapshot();
    frame.cars[0].position.x += 2;
    frame.ball.velocity.x += 5;
    const before = f.lab.getDebugState();
    f.receive(frame);
    f.lab.update(f.room, 0, command, performance.now());
    const after = f.lab.getDebugState();
    assert.equal(after.confirmedSnapshots, before.confirmedSnapshots);
    assert.ok(after.totalReplaySteps > before.totalReplaySteps);
    assert.equal(after.error, null);
  } finally { f.dispose(); }
});

test('held and batched inputs cannot confuse acknowledgement IDs with physics ticks', async () => {
  const f = await historyFixture();
  try {
    for (let i = 0; i < 90; i++) f.tick(command, 4);
    const reports = f.lab.exportTelemetry();
    assert.ok(reports.some(r => r.historyMismatches > 0));
    assert.equal(f.lab.getDebugState().error, null);
    assert.ok(f.lab.getDebugState().pending <= 24);
  } finally { f.dispose(); }
});
