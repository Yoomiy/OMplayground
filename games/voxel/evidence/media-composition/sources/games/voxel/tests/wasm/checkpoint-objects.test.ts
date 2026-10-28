import assert from 'node:assert/strict';
import { test } from 'node:test';
import { content, flatWorld } from './fixture.ts';
import { Drops } from '../../src/sim/drops.ts';
import { Explosives } from '../../src/sim/explosives.ts';
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

test('drop checkpoint reconstruction matches uninterrupted native sweeps, partial pickup, owner delays and expiry', () => {
  const a = flatWorld(),
    b = flatWorld(),
    original = new Drops(content.manifest);
  try {
    original.add({ itemType: 'stone', count: 14 }, [-0.5, 4, 0.5], 7, 'owner', [2, 2, 1]);
    for (let tick = 8; tick <= 17; tick++) original.step(a, tick);
    const restored = Drops.fromCheckpoint(content.manifest, json(original.checkpoint(17)));
    for (let tick = 18; tick < 260; tick++) {
      original.step(a, tick);
      restored.step(b, tick);
      if (tick === 40) {
        original.take('drop-1', 2);
        restored.take('drop-1', 2);
      }
      for (const id of ['owner', 'other'])
        assert.equal(restored.eligible('drop-1', id, tick), original.eligible('drop-1', id, tick));
      assert.deepEqual(restored.checkpoint(tick), original.checkpoint(tick));
    }
    original.step(a, 9007);
    restored.step(b, 9007);
    assert.equal(original.size, 0);
    assert.equal(restored.size, 0);
  } finally {
    a.free();
    b.free();
  }
});

test('TNT reconstruction continues the same native moving-body trace and due-work order for normal and chain fuses', () => {
  const a = flatWorld(),
    b = flatWorld(),
    original = new Explosives(),
    state = content.defaults.tnt,
    rule = content.manifest.behavior.find((block) => block.family === 'tnt')!.explosive!;
  try {
    for (let i = 0; i < 12; i++)
      original.add('owner', state, [i - 5.5, 4, 0.5], rule, i % 2 ? 30 : rule.fuse);
    for (let tick = 0; tick < 17; tick++) original.step(a);
    const restored = Explosives.fromCheckpoint(
      content.manifest,
      json(original.checkpoint(content.manifest)),
    );
    for (let tick = 17; tick < 135; tick++) {
      original.step(a);
      restored.step(b);
      assert.deepEqual(
        restored.checkpoint(content.manifest),
        original.checkpoint(content.manifest),
      );
      assert.deepEqual(restored.due(), original.due());
      for (const explosives of [original, restored])
        for (const body of explosives.due().slice(0, 2)) explosives.remove(body.id);
    }
    assert.equal(original.size, 0);
    assert.equal(restored.size, 0);
  } finally {
    a.free();
    b.free();
  }
});
