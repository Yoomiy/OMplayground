import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GameRoom } from '../../src/sim/game-room.ts';
import { roomFixture } from './room-fixture.ts';
const baseline = new URL(
  '../../evidence/drop-encoding/sources/games/voxel/src/sim/game-room.ts',
  import.meta.url,
);
assert.equal(
  createHash('sha256').update(readFileSync(baseline)).digest('hex'),
  '47410a364fc73bfd204cc3d3faf56fa7fb5ed5ad931acc834d8c895f8ff91d8d',
);
// Compare reconstructed public state and reliable events: publication now runs at
// 30 Hz, so identical 15 Hz wire histories are intentionally no longer expected.
function wireHistory(events: Map<string, any[]>) {
  return [...events].map(([id, rows]) => {
    const actors = new Map<string, any>();
    let self: any;
    for (const e of rows) {
      if (e.type === 'actor_joined') actors.set(e.actor.id, e.actor);
      if (e.type === 'actor_removed') actors.delete(e.id);
      if (e.type === 'snapshot') {
        if (e.self) self = e.self;
        for (const delta of e.actors) actors.set(delta.id, { ...actors.get(delta.id), ...delta });
      }
    }
    return [
      id,
      rows
        .filter((e) => e.type !== 'snapshot')
        .sort((a, b) => (a.type ?? a.kind).localeCompare(b.type ?? b.kind)),
      self,
      [...actors].sort(([a], [b]) => a.localeCompare(b)),
    ];
  });
}
const { GameRoom: Before } = (await import(baseline.href)) as { GameRoom: typeof GameRoom };
function journey(Room: typeof GameRoom) {
  const f = roomFixture('creative', 0, false, undefined, Room);
  try {
    f.join('b');
    f.join('teacher', 'observer');
    f.join('c');
    f.join('d');
    for (const id of ['a', 'b', 'teacher', 'c', 'd'])
      f.room.receive(id, { type: 'focus', epoch: f.player(id).epoch, active: false }, f.now);
    const pose = (id: string, x: number, z: number) => {
      const p = f.state(id);
      p[0] = x;
      p[2] = z;
      f.store.world.player_restore(f.player(id).slot, p);
    };
    pose('a', 0, 0);
    pose('teacher', 0, 0);
    pose('c', 2, 0);
    pose('d', 3, 0);
    f.room.join(
      { id: 'late', role: 'participant', capabilities: f.player().capabilities },
      'late',
      f.now,
    );
    const history: unknown[] = [];
    const points = [
      [0, 0],
      [23, 23],
      [47, 0],
      [47.000001, 0],
      [48, 0],
      [48.000049, 0],
      [48.000051, 0],
      [-48, 0],
      [28.8, 38.4],
      [28.8001, 38.4],
      [28.7999, 38.4],
      [-28.8, -38.4],
      [34, 34],
      [48.001, 0],
      [0, 48],
      [0, -48.0001],
    ];
    for (const [x, z] of points) {
      pose('b', x, z);
      f.tick(2);
      const a = f.state('a'),
        b = f.state('b'),
        qx = Math.round(b[0] * 10000) / 10000,
        qz = Math.round(b[2] * 10000) / 10000;
      assert.equal(f.player('a').visible.has('b'), Math.hypot(qx - a[0], qz - a[2]) <= 48);
      assert.equal(f.player('a').visible.has('teacher'), false);
      assert.equal(f.player('a').visible.has('late'), false);
      assert.equal(f.player('teacher').visible.has('a'), true);
      history.push(wireHistory(f.events));
    }
    const retainedEvents = [...f.events].map(([id, events]) => [id, events.slice()]);
    const retained = JSON.stringify(retainedEvents);
    f.room.setPaused(true, f.now);
    pose('b', 1, 1);
    f.tick(2);
    assert.equal(f.player('a').visible.has('b'), true);
    assert.equal(JSON.stringify(retainedEvents), retained);
    history.push(wireHistory(f.events));
    // b has left and re-entered before this simultaneous removal. Its insertion
    // order must not move behind c/d in removals or a trusted teleport reset.
    pose('a', -200, -200);
    f.tick(2);
    history.push(wireHistory(f.events));
    assert.equal(f.room.staff('teacher', { kind: 'teleport', target: 'b' }, f.now).ok, true);
    history.push(wireHistory(f.events));
    return history;
  } finally {
    f.room.dispose();
  }
}
test('snapshot pose reuse preserves reconstructed per-viewer state, circle boundaries, quantization and hidden staff', () => {
  const after = journey(GameRoom),
    before = journey(Before);
  function compare(a: any, b: any, path: string): void {
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path + ' keys');
      for (const key of Object.keys(a)) compare(a[key], b[key], `${path}.${key}`);
    } else assert.equal(a, b, path);
  }
  compare(after, before, 'history');
});
