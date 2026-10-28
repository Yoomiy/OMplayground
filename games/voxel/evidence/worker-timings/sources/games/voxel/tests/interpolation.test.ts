import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RemoteActors } from '../src/client/interpolation.ts';
import { emptyAppearance } from '../src/shared/appearance.ts';
const body = (x: number, vx = 0, frozen = 0) => [
  x,
  68,
  0,
  vx,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  0,
  frozen,
  0,
  0,
  0,
  0,
];
test('a delayed receipt cannot leave remote movement and look stuck behind after healthy snapshots resume', () => {
  const actors = new RemoteActors();
  actors.join({ id: 'peer', state: body(0), yaw: 0, pitch: 0, appearance: emptyAppearance() }, 0);
  actors.snapshot([], 1000, 100);
  actors.snapshot([{ id: 'peer', state: body(1), yaw: 0 }], 1050, 1150);
  actors.snapshot([{ id: 'peer', state: body(10), yaw: Math.PI / 2, pitch: 0.3 }], 2050, 1151);
  const result = actors.frame(1350)[0];
  assert.equal(result.position[0], 10);
  assert.ok(Math.abs(result.yaw - Math.PI / 2) < 1e-9);
  assert.equal(result.pitch, 0.3);
});
test('extrapolation is bounded, frozen bodies do not coast, and removed actors release interpolation state', () => {
  const actors = new RemoteActors();
  actors.join(
    { id: 'peer', state: body(3, 4), yaw: 3.1, pitch: 0, appearance: emptyAppearance() },
    0,
  );
  actors.snapshot([{ id: 'peer', yaw: -3.1 }], 1000, 100);
  assert.ok(actors.frame(5000)[0].position[0] <= 3.4 + 1e-9);
  actors.snapshot([{ id: 'peer', state: body(7, 4, 1) }], 6000, 5100);
  assert.equal(actors.frame(10000)[0].position[0], 7);
  assert.equal(actors.frame(10000)[0].speed, 0);
  actors.remove('peer');
  assert.deepEqual(actors.frame(10001), []);
  actors.clear();
  assert.equal(actors.size, 0);
});
test('appearance-only deltas update discrete gear without inventing motion and removal/rejoin never retains stale equipment', () => {
  const actors = new RemoteActors(),
    appearance = emptyAppearance();
  actors.join({ id: 'peer', state: body(3), yaw: 0, pitch: 0, appearance }, 0);
  actors.snapshot(
    [
      {
        id: 'peer',
        appearance: {
          ...appearance,
          held: 'wooden_pickaxe',
          equipment: { ...appearance.equipment, feet: 'trail_boots' },
        },
      },
    ],
    1000,
    1000,
  );
  const rendered = actors.frame(1000)[0];
  assert.equal(rendered.position[0], 3);
  assert.equal(rendered.appearance.held, 'wooden_pickaxe');
  assert.equal(rendered.appearance.equipment.feet, 'trail_boots');
  actors.snapshot([{ id: 'peer', appearance }], 1100, 1100);
  assert.deepEqual(actors.frame(1100)[0].appearance, appearance);
  actors.remove('peer');
  actors.join({ id: 'peer', state: body(8), yaw: 0, pitch: 0, appearance }, 1200);
  assert.deepEqual(actors.frame(1300)[0].appearance, appearance);
  actors.clear();
  assert.deepEqual(actors.frame(1400), []);
});
