import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { content, engine } from './fixture.ts';
import { Prediction } from '../../src/client/prediction.ts';
import { around } from '../../src/shared/protocol.ts';
import type { ClientMessage } from '../../src/shared/protocol.ts';
type Fixture = ReturnType<typeof roomFixture>;
function pair(mode: 'creative' | 'survival' = 'survival') {
  const f = roomFixture(mode);
  f.join('b');
  f.tick(3);
  const a = f.state(),
    b = f.state('b');
  b[0] = a[0];
  b[1] = a[1];
  b[2] = a[2] - 2;
  b[3] = b[4] = b[5] = 0;
  f.store.world.player_restore(f.player('b').slot, b);
  f.room.receive('b', { type: 'focus', epoch: f.player('b').epoch, active: false }, f.now);
  f.tick();
  return f;
}
function request(f: Fixture, id = 'a'): Extract<ClientMessage, { type: 'attack' }> {
  return {
    type: 'attack',
    epoch: f.player(id).epoch,
    sequence: f.next(id),
    inputSequence: f.inputs.get(id)!,
    inventoryRevision: f.room.inventories.held(id).revision,
  };
}
function equip(f: Fixture, id: string, itemType: string, slot: number, durability: number) {
  f.room.inventories.receive(id, { itemType, count: 1, instance: { durability } });
  const view = f.room.inventories.view(id),
    index = view.bag.findIndex((stack) => stack?.itemType === itemType);
  assert.equal(
    f.room.inventories.transact(
      id,
      {
        kind: 'move',
        from: { area: 'bag', slot: index },
        to: { area: 'equipment', slot },
        count: 1,
        revision: view.revision,
        containerId: null,
        containerRevision: null,
      },
      false,
    ).ok,
    true,
  );
}
test('real Wasm combat uses owned weapons/armor once, fixed cooldowns and an independent replay boundary after eviction', () => {
  const f = pair();
  try {
    f.room.inventories.receive('a', {
      itemType: 'wooden_axe',
      count: 1,
      instance: { durability: 1 },
    });
    equip(f, 'b', 'heavy_shield', 4, 1);
    f.tick();
    assert.equal(f.player('b').movement.speed, 0.8);
    const first = request(f),
      oldEpoch = f.player('b').epoch;
    assert.equal(f.send(first).outcome?.reason, 'hit');
    assert.equal(f.player('b').vitals.view().health, 18);
    assert.equal(f.room.inventories.held('a').stack, null);
    assert.equal(f.room.inventories.view('b').equipment[4], null);
    assert.equal(f.player('b').movement.speed, 1);
    assert.ok(f.player('b').epoch > oldEpoch);
    assert.equal(f.send(first).status, 'cached');
    for (let n = 0; n < 1030; n++) assert.equal(f.send(request(f)).outcome?.reason, 'cooldown');
    assert.equal(f.send(first).status, 'retired');
    assert.equal(f.events.get('a')!.filter((e) => 'type' in e && e.type === 'hit').length, 1);
    assert.equal(f.player('b').vitals.view().health, 18);
    f.tick(17);
    assert.equal(f.send(request(f)).outcome?.reason, 'cooldown');
    f.tick();
    assert.equal(f.send(request(f)).outcome?.reason, 'hit');
    assert.equal(f.player('b').vitals.view().health, 16);
    const cooldown = f.player().vitals.view().attackCooldown;
    f.room.setPaused(true, f.now);
    assert.equal(f.elapse(10000).steps, 0);
    assert.equal(f.player().vitals.view().attackCooldown, cooldown);
    f.room.setPaused(false, f.now);
    f.room.disconnect('a', f.now);
    f.join();
    f.tick();
    assert.equal(f.send(request(f)).outcome?.reason, 'cooldown');
  } finally {
    f.room.dispose();
  }
});
test('solid occlusion, partial slab geometry, reach, mode and independent source/target combat permission control damage', () => {
  const f = pair();
  try {
    const p = f.state(),
      x = Math.floor(p[0]),
      y = Math.floor(p[1]),
      z = Math.floor(p[2]) - 1;
    f.store.set(x, y + 1, z, content.defaults.glass);
    assert.equal(f.send(request(f)).outcome?.reason, 'occluded');
    assert.equal(f.player('b').vitals.view().health, 20);
    f.store.set(x, y + 1, z, content.defaults.stone_slab);
    f.tick(15);
    assert.equal(
      f.send(request(f)).outcome?.reason,
      'hit',
      'horizontal eye ray clears a bottom slab',
    );
    f.store.set(x, y + 1, z, content.states['stone_slab[half=top]']);
    f.tick(15);
    assert.equal(f.send(request(f)).outcome?.reason, 'occluded');
    f.store.set(x, y + 1, z, 0);
    f.tick(15);
    f.player().capabilities.combat = false;
    assert.equal(f.send(request(f)).outcome?.reason, 'forbidden');
    f.player().capabilities.combat = true;
    f.player('b').capabilities.combat = false;
    assert.equal(f.send(request(f)).outcome?.reason, 'miss');
    f.player('b').capabilities.combat = true;
    f.tick(15);
    const b = f.state('b');
    b[2] -= 3;
    f.store.world.player_restore(f.player('b').slot, b);
    assert.equal(f.send(request(f)).outcome?.reason, 'miss');
    assert.equal(f.player('b').vitals.view().health, 18);
  } finally {
    f.room.dispose();
  }
  const creative = pair('creative');
  try {
    assert.equal(creative.send(request(creative)).outcome?.reason, 'forbidden');
  } finally {
    creative.room.dispose();
  }
});
test('attack waits for consumed aim, rejects stale input and cannot turn a future aim packet into immediate damage', () => {
  const f = pair();
  try {
    f.controls.set('a', { ...f.controls.get('a')!, yaw: Math.PI });
    f.tick();
    const sequence = f.inputs.get('a')! + 1;
    const frame = { ...f.controls.get('a')!, yaw: 0, epoch: f.player().epoch, sequence };
    f.room.receive('a', { type: 'input', frames: [frame] }, f.now);
    assert.equal(
      f.send(request(f)).outcome?.reason,
      'miss',
      'fresh receipt does not replace consumed aim',
    );
    f.controls.set('a', { ...f.controls.get('a')!, yaw: 0 });
    f.tick(15);
    const next = f.inputs.get('a')! + 1;
    f.room.receive('a', { type: 'input', frames: [{ ...frame, sequence: next }] }, f.now);
    const pending = { ...request(f), inputSequence: next };
    f.room.receive('a', pending, f.now);
    assert.equal(f.player().pending.size, 1);
    assert.equal(f.player('b').vitals.view().health, 20);
    f.tick();
    assert.equal(f.result('a').outcome?.reason, 'hit');
    assert.equal(f.player('b').vitals.view().health, 18);
    f.tick(15);
    f.elapse(201);
    assert.equal(f.send(request(f)).outcome?.reason, 'input_stale');
  } finally {
    f.room.dispose();
  }
});
test('melee death drops personal state once and the same connection respawns only after collision readiness with protection', () => {
  const f = pair();
  try {
    f.room.inventories.receive('b', { itemType: 'stick', count: 3 });
    f.room.inventories.transact(
      'b',
      {
        kind: 'move',
        from: { area: 'bag', slot: 0 },
        to: { area: 'craft2', slot: 0 },
        count: 1,
        revision: f.room.inventories.view('b').revision,
        containerId: null,
        containerRevision: null,
      },
      false,
    );
    for (let n = 0; n < 10; n++) {
      assert.equal(f.send(request(f)).outcome?.reason, 'hit');
      if (n !== 9) f.tick(15);
    }
    assert.equal(f.player('b').phase, 'dead');
    assert.equal(f.room.drops.size, 2);
    f.tick(60);
    const respawn = { type: 'respawn' as const, epoch: f.player('b').epoch, sequence: f.next('b') };
    assert.equal(f.send(respawn, 'b').outcome?.ok, true);
    assert.equal(f.player('b').phase, 'preparing');
    assert.equal(f.state('b')[12], 1);
    assert.equal(f.send(respawn, 'b').status, 'stale_epoch');
    f.tick();
    assert.equal(f.player('b').resolved, true);
    f.ready('b');
    f.tick();
    assert.equal(f.player('b').phase, 'playing');
    assert.equal(f.state('b')[12], 0);
    assert.ok(f.player('b').vitals.view().protection > 0);
    assert.equal(f.player('b').vitals.view().health, 20);
    assert.ok(f.room.inventories.view('b').bag.every((stack) => !stack));
    assert.equal(f.room.drops.size, 2);
    assert.ok(
      f.events
        .get('a')!
        .every((e) => !('type' in e) || e.type !== 'vitals' || e.view.health === 20),
    );
  } finally {
    f.room.dispose();
  }
});
test('nonfatal knockback changes velocity without minting motion time and reconciles through a fresh damage epoch', () => {
  const f = pair();
  try {
    f.room.receive('b', { type: 'focus', epoch: f.player('b').epoch, active: true }, f.now);
    f.tick();
    const before = f.state('b'),
      epoch = f.player('b').epoch;
    assert.equal(f.send(request(f)).outcome?.reason, 'hit');
    const hit = f.state('b');
    assert.deepEqual(hit.subarray(0, 3), before.subarray(0, 3));
    assert.ok(hit[5] < -1);
    assert.ok(hit[4] > 0);
    assert.ok(f.player('b').epoch > epoch);
    assert.equal(f.baseline('b').reason, 'damage');
    const client = new engine.VoxelWorld();
    try {
      for (const column of around(Math.floor(hit[0] / 16), Math.floor(hit[2] / 16), 1))
        client.insert_column(column.x, column.z, f.store.generator.generate(column.x, column.z));
      const slot = client.player_add(hit[0], hit[1], hit[2]),
        prediction = new Prediction(client, slot),
        currentEpoch = f.player('b').epoch;
      prediction.baseline(currentEpoch, 0, f.baseline('b').state, f.player('b').movement);
      f.inputs.set('b', 0);
      const snapshots: { at: number; ack: number; state: number[] }[] = [];
      for (let step = 1; step <= 30; step++) {
        prediction.sample(f.controls.get('b')!);
        prediction.sample(f.controls.get('b')!);
        f.tick();
        if (step % 2 === 0)
          snapshots.push({
            at: step + 3,
            ack: f.player('b').queue.ack,
            state: Array.from(f.state('b'), (v, i) => (i < 6 ? Math.round(v * 10000) / 10000 : v)),
          });
        while (snapshots[0]?.at <= step) {
          const snapshot = snapshots.shift()!;
          prediction.reconcile(currentEpoch, snapshot.ack, snapshot.state);
        }
        const predicted = client.player_state(slot),
          authoritative = f.state('b');
        assert.ok(
          Math.hypot(
            predicted[0] - authoritative[0],
            predicted[1] - authoritative[1],
            predicted[2] - authoritative[2],
          ) < 0.01,
          `impulse replay diverged at tick ${step}`,
        );
      }
    } finally {
      client.free();
    }
    assert.ok(f.state('b')[2] < before[2] - 0.05);
    assert.ok(Array.from(f.state('b')).every(Number.isFinite));
  } finally {
    f.room.dispose();
  }
});

test('respawn searches past a flooded or lava-filled spawn cell before offering collision readiness', () => {
  const f = roomFixture();
  try {
    f.tick(3);
    const original = f.state();
    f.player().vitals.damage(20);
    f.tick();
    f.store.set(
      Math.floor(original[0]),
      Math.floor(original[1]),
      Math.floor(original[2]),
      content.defaults.lava,
    );
    f.tick(60);
    assert.equal(
      f.send({ type: 'respawn', epoch: f.player().epoch, sequence: f.next() }).outcome?.ok,
      true,
    );
    for (let attempt = 0; attempt < 10 && f.player().phase === 'preparing'; attempt++) {
      f.tick();
      f.ready();
    }
    f.tick(30);
    const body = f.state();
    assert.equal(f.player().phase, 'playing');
    assert.equal(f.player().vitals.view().health, 20);
    assert.ok(Math.hypot(body[0] - original[0], body[2] - original[2]) >= 1);
    assert.ok(
      !['water', 'lava'].includes(
        content.manifest.blocks[
          f.store.world.get_block(
            Math.floor(body[0]),
            Math.floor(body[1] + 0.1),
            Math.floor(body[2]),
          )
        ].name,
      ),
    );
  } finally {
    f.room.dispose();
  }
});
