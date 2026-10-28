import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flatWorld, content } from './fixture.ts';
import { roomFixture } from './room-fixture.ts';
import type { Cell, ClientMessage } from '../../src/shared/protocol.ts';

test('native liquid ray selects the mean rendered surface, passes above it and preserves solid/model occlusion', () => {
  const world = flatWorld();
  try {
    world.set_block(2, 2, 2, content.defaults.water);
    let hit = world.raycast_liquids(2.5, 4, 2.5, 0, -1, 0, 6);
    assert.deepEqual(Array.from(hit.slice(1, 8)), [2, 2, 2, 0, 1, 0, content.defaults.water]);
    assert.equal(hit[8], 1.125);
    assert.equal(world.raycast(2.5, 4, 2.5, 0, -1, 0, 6)[2], 0);
    assert.deepEqual(Array.from(world.target_boxes(2, 2, 2)), [0, 0, 0, 16, 14, 16]);
    world.set_block(4, 2, 2, content.defaults.stone);
    assert.equal(world.raycast_liquids(0.5, 2.94, 2.5, 1, 0, 0, 6)[1], 4);
    assert.equal(world.raycast_liquids(0.5, 2.5, 2.5, 1, 0, 0, 6)[1], 2);
    world.set_block(1, 2, 2, content.defaults.stone_slab);
    assert.equal(world.raycast_liquids(0.5, 2.25, 2.5, 1, 0, 0, 6)[1], 1);
    assert.equal(world.raycast_liquids(0.5, 2.75, 2.5, 1, 0, 0, 6)[1], 2);
    world.set_block(2, 3, 2, content.defaults.water);
    assert.deepEqual(Array.from(world.target_boxes(2, 2, 2)), [0, 0, 0, 16, 16, 16]);
    hit = world.raycast_liquids(2.5, 5, 2.5, 0, -1, 0, 6);
    assert.equal(hit[2], 3);
    assert.equal(hit[8], 1.125);
  } finally {
    world.free();
  }
});

test('real room buckets conserve one source and one container across collect/place, conflict and replay eviction', () => {
  const f = roomFixture();
  try {
    f.room.inventories.receive('a', { itemType: 'bucket', count: 1 });
    const source = f.target('water');
    f.aim(source);
    const intent = (
      kind: 'collect' | 'place',
      target: Cell,
    ): Extract<ClientMessage, { type: 'action' }> => ({
      type: 'action',
      kind,
      epoch: f.player().epoch,
      sequence: f.next(),
      inputSequence: f.inputs.get('a')!,
      target,
      state: kind === 'collect' ? 0 : content.defaults.water,
      inventoryRevision: f.room.inventories.held('a').revision,
      revisions: [
        {
          x: target[0] >> 4,
          z: target[2] >> 4,
          revision: f.store.revision(target[0] >> 4, target[2] >> 4),
        },
      ],
    });
    const stale = intent('collect', source);
    stale.inventoryRevision--;
    assert.equal(f.send(stale).outcome?.reason, 'conflict');
    assert.equal(f.store.world.get_block(...source), content.defaults.water);
    const collect = intent('collect', source),
      before = f.store.revision(source[0] >> 4, source[2] >> 4);
    assert.equal(f.send(collect).outcome?.ok, true);
    assert.equal(f.store.world.get_block(...source), 0);
    assert.equal(f.store.revision(source[0] >> 4, source[2] >> 4), before + 1);
    assert.equal(f.room.inventories.held('a').stack?.itemType, 'water_bucket');
    assert.equal(f.send(collect).status, 'cached');
    // Aim at the ground below the removed source and place through the ordinary building path.
    const ground: Cell = [source[0], 63, source[2]];
    f.aim(ground);
    const p = f.state(),
      c = f.player().controls,
      cos = Math.cos(c.pitch),
      hit = f.store.world.raycast(
        p[0],
        p[1] + 1.62,
        p[2],
        Math.sin(c.yaw) * cos,
        Math.sin(c.pitch),
        -Math.cos(c.yaw) * cos,
        6,
      );
    assert.equal(hit[0], 1);
    const placed: Cell = [hit[1] + hit[4], hit[2] + hit[5], hit[3] + hit[6]],
      place = intent('place', [hit[1], hit[2], hit[3]]),
      result = f.send(place);
    assert.equal(result.outcome?.ok, true, JSON.stringify(result));
    assert.equal(f.store.world.get_block(...placed), content.defaults.water);
    assert.deepEqual(f.room.inventories.held('a').stack, { itemType: 'bucket', count: 1 });
    assert.equal(f.send(place).status, 'cached');
    for (let n = 0; n < 140; n++)
      f.send({ type: 'flight', epoch: f.player().epoch, sequence: f.next(), on: true });
    assert.equal(f.send(collect).status, 'retired');
    assert.equal(f.send(place).status, 'retired');
    assert.deepEqual(f.room.inventories.held('a').stack, { itemType: 'bucket', count: 1 });
    const lava = f.target('lava');
    f.aim(lava);
    assert.equal(f.send(intent('collect', lava)).outcome?.ok, false);
    assert.equal(f.store.world.get_block(...lava), content.defaults.lava);
    f.store.set(...lava, content.defaults.water);
    f.player().capabilities.build = false;
    assert.equal(f.send(intent('collect', lava)).outcome?.reason, 'forbidden');
    assert.deepEqual(f.room.inventories.held('a').stack, { itemType: 'bucket', count: 1 });
  } finally {
    f.room.dispose();
  }
});

test('two owned buckets racing for one source yield exactly one filled container and no wall penetration', () => {
  const f = roomFixture();
  try {
    f.join('b');
    const source = f.target('water');
    for (const id of ['a', 'b']) {
      f.room.inventories.receive(id, { itemType: 'bucket', count: 1 });
      f.aim(source, id);
    }
    const commands = ['a', 'b'].map<Extract<ClientMessage, { type: 'action' }>>((id) => ({
      type: 'action',
      kind: 'collect',
      epoch: f.player(id).epoch,
      sequence: f.next(id),
      inputSequence: f.inputs.get(id)!,
      target: source,
      state: 0,
      inventoryRevision: f.room.inventories.held(id).revision,
      revisions: [
        {
          x: source[0] >> 4,
          z: source[2] >> 4,
          revision: f.store.revision(source[0] >> 4, source[2] >> 4),
        },
      ],
    }));
    assert.equal(f.send(commands[0], 'a').outcome?.ok, true);
    assert.equal(f.send(commands[1], 'b').outcome?.ok, false);
    assert.deepEqual(
      ['a', 'b'].map((id) => f.room.inventories.held(id).stack?.itemType),
      ['water_bucket', 'bucket'],
    );
    f.store.set(...source, content.defaults.water);
    f.store.set(source[0], source[1], source[2] + 1, content.defaults.stone);
    f.aim(source, 'b');
    const blocked = {
      ...commands[1],
      sequence: f.next('b'),
      inputSequence: f.inputs.get('b')!,
      revisions: [
        {
          x: source[0] >> 4,
          z: source[2] >> 4,
          revision: f.store.revision(source[0] >> 4, source[2] >> 4),
        },
      ],
    };
    assert.equal(f.send(blocked, 'b').outcome?.reason, 'out_of_reach');
    assert.equal(f.room.inventories.held('b').stack?.itemType, 'bucket');
  } finally {
    f.room.dispose();
  }
});
