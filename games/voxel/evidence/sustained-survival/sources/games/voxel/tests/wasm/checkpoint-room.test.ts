import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { engine, content } from './fixture.ts';
import { roomFixture } from './room-fixture.ts';
import { GameRoom } from '../../src/sim/game-room.ts';
import type { AdmittedActor } from '../../src/sim/game-room.ts';
import type { RoomCheckpoint } from '../../src/sim/room-checkpoint.ts';
import { around } from '../../src/shared/protocol.ts';
import type { ServerMessage, ClientMessage, Cell } from '../../src/shared/protocol.ts';
import type { ChunkFrame } from '../../src/shared/chunk-wire.ts';
import type { InventoryArea } from '../../src/shared/inventory.ts';
const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
);
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const actor = (id = 'a', build = true): AdmittedActor => ({
  id,
  role: 'participant',
  capabilities: { build, fly: true, observe: false, combat: build, explosives: build },
});
function restore(
  snapshot: unknown,
  owners: ReadonlyMap<string, AdmittedActor | null> = new Map(),
  started = 1_000_000,
) {
  const world = new engine.VoxelWorld(),
    generator = new engine.TerrainGen((snapshot as RoomCheckpoint).seed),
    events = new Map<string, (ServerMessage | ChunkFrame)[]>();
  let room: GameRoom;
  try {
    room = GameRoom.fromCheckpoint(
      world,
      generator,
      content.manifest,
      build,
      {
        send(id, event) {
          const list = events.get(id) ?? [];
          list.push(event);
          events.set(id, list);
        },
        close() {},
      },
      snapshot,
      started,
      owners,
    );
  } catch (error) {
    world.free();
    generator.free();
    throw error;
  }
  let now = started;
  const baseline = (id = 'a') =>
    events
      .get(id)
      ?.findLast(
        (event): event is Extract<ServerMessage, { type: 'baseline' }> =>
          'type' in event && event.type === 'baseline',
      );
  const pump = () => {
    while (room.store.generateOne()) {}
  };
  const join = (admitted = actor()) => {
    room.join(admitted, admitted.id, now);
    pump();
    room.advance(now);
    const current = room.actors.get(admitted.id)!;
    if (current.phase !== 'dead') {
      const b = baseline(admitted.id);
      assert.ok(b);
      const p = room.store.world.player_state(current.slot);
      room.receive(
        admitted.id,
        {
          type: 'ready',
          epoch: b.epoch,
          columns: around(Math.floor(p[0] / 16), Math.floor(p[2] / 16), 1).map((c) => ({
            ...c,
            revision: room.store.revision(c.x, c.z),
          })),
        },
        now,
      );
      room.receive(admitted.id, { type: 'focus', epoch: current.epoch, active: true }, now);
    }
    return current;
  };
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      now += 1000 / 30;
      room.advance(now);
      pump();
    }
  };
  const elapse = (ms: number) => {
    now += ms;
    return room.advance(now);
  };
  return {
    room,
    events,
    baseline,
    join,
    tick,
    elapse,
    pump,
    get now() {
      return now;
    },
  };
}

test('one room checkpoint retains clock, ownership, containers, terrain and timed bodies while fresh admission/readiness creates new input epochs', () => {
  const f = roomFixture('survival', 0, true);
  let resumed: ReturnType<typeof restore> | undefined;
  try {
    f.join('b');
    f.tick(12);
    const inv = f.room.inventories;
    inv.receive('a', { itemType: 'stone', count: 40 });
    inv.receive('a', { itemType: 'iron_pickaxe', count: 1, instance: { durability: 103 } });
    inv.receive('a', { itemType: 'spruce_planks', count: 8 });
    inv.receive('a', { itemType: 'iron_vest', count: 1, instance: { durability: 138 } });
    const p = f.state(),
      x = Math.floor(p[0]),
      y = Math.floor(p[1]),
      z = Math.floor(p[2]),
      chest: Cell = [x + 1, y, z],
      table: Cell = [x - 1, y, z];
    for (const cell of [chest, table]) f.store.set(cell[0], cell[1] + 1, cell[2], 0);
    f.store.set(...chest, content.defaults.chest);
    f.store.set(...table, content.defaults.crafting_table);
    f.store.set(x, y + 3, z + 2, content.defaults.test_299);
    const run = (operation: Parameters<typeof inv.transact>[1], id = 'a') =>
      assert.equal(inv.transact(id, operation, false).ok, true, JSON.stringify(operation));
    const move = (
      from: InventoryArea,
      slot: number,
      to: InventoryArea,
      target: number,
      count: number,
    ) => {
      const v = inv.view('a');
      run({
        kind: 'move',
        from: { area: from, slot },
        to: { area: to, slot: target },
        count,
        revision: v.revision,
        containerId: v.container?.id ?? null,
        containerRevision: v.container?.revision ?? null,
      });
    };
    move('bag', 3, 'equipment', 1, 1);
    move('bag', 2, 'craft2', 3, 2);
    run({ kind: 'open', target: table });
    move('bag', 0, 'craft3', 8, 3);
    run({ kind: 'open', target: chest });
    move('bag', 0, 'container', 0, 4);
    run({ kind: 'open', target: chest }, 'b');
    f.player().vitals.damage(3);
    f.player().vitals.effort(4.75);
    f.room.drops.add(
      { itemType: 'stone', count: 3 },
      [x + 5.5, y + 0.2, z + 0.5],
      f.room.checkpoint(f.now).tick,
      'a',
    );
    const rule = content.manifest.behavior.find((block) => block.family === 'tnt')!.explosive!;
    f.room.explosives.add('a', content.defaults.tnt, [x + 5.5, y + 0.05, z + 5.5], rule);
    f.tick(2);
    const oldEpoch = f.player().epoch;
    const queued: ClientMessage = {
      type: 'input',
      frames: [
        {
          epoch: oldEpoch,
          sequence: f.inputs.get('a')! + 100,
          x: 1,
          z: 0,
          yaw: 0,
          pitch: 0,
          jump: false,
          sneak: false,
          sprint: false,
        },
      ],
    };
    f.room.receive('a', queued, f.now);
    const snapshot = f.room.checkpoint(f.now),
      bytes = JSON.stringify(snapshot);
    assert.equal(Object.hasOwn(snapshot.players[0], 'capabilities'), false);
    resumed = restore(json(snapshot), new Map([['a', actor()]]));
    assert.equal(resumed.room.actors.size, 0);
    assert.equal(resumed.events.size, 0);
    assert.equal(resumed.room.store.world.column_count(), 0);
    const cold = resumed.room.checkpoint(resumed.now);
    for (const key of [
      'world',
      'inventories',
      'drops',
      'explosives',
      'spawn',
      'tick',
      'seed',
      'worldId',
      'mode',
    ] as const)
      assert.deepEqual(cold[key], snapshot[key], key);
    for (const player of cold.players)
      assert.deepEqual(player.vitals, snapshot.players.find((p) => p.id === player.id)!.vitals);
    const a = resumed.join();
    assert.ok(a.epoch > snapshot.epoch);
    assert.equal(a.queue.ack, 0);
    assert.equal(a.queue.size, 0);
    assert.equal(a.pending.size, 0);
    assert.equal(a.focused, true);
    assert.equal(a.mining, null);
    assert.equal(resumed.room.inventories.view('a').station, 'personal');
    assert.deepEqual(resumed.room.inventories.viewers('chest-1'), []);
    const old: ClientMessage = {
      type: 'inventory',
      epoch: oldEpoch,
      sequence: 900,
      operation: { kind: 'drop', slot: 0, count: 1, revision: inv.view('a').revision },
    };
    const before = resumed.room.inventories.checkpoint();
    resumed.room.receive('a', old, resumed.now);
    assert.deepEqual(resumed.room.inventories.checkpoint(), before);
    const result = resumed.events
      .get('a')!
      .findLast(
        (event): event is Extract<ServerMessage, { type: 'result' }> =>
          'type' in event && event.type === 'result',
      );
    assert.equal(result?.status, 'stale_epoch');
    resumed.room.receive(
      'a',
      {
        type: 'inventory',
        epoch: a.epoch,
        sequence: 1,
        operation: { kind: 'open', target: chest },
      },
      resumed.now,
    );
    assert.equal(resumed.room.inventories.view('a').container?.slots[0]?.count, 4);
    const input = json(snapshot);
    input.players[0].state[0] += 3;
    assert.equal(
      JSON.stringify(snapshot),
      bytes,
      'capture remains immutable through reconstruction and gameplay',
    );
  } finally {
    f.room.dispose();
    resumed?.room.dispose();
  }
});

test('saved pause freezes all timers and reservation clocks; a restored partial fall continues with the same earned damage', () => {
  const f = roomFixture('survival', 0, true);
  let resumed: ReturnType<typeof restore> | undefined;
  try {
    f.tick(6);
    const state = f.state();
    state[1] += 10;
    state[4] = 0;
    state[6] = 0;
    f.store.world.player_restore(f.player().slot, state);
    f.tick(6);
    f.room.setPaused(true, f.now);
    const snapshot = f.room.checkpoint(f.now);
    resumed = restore(json(snapshot));
    assert.equal(resumed.elapse(3_600_000).steps, 0);
    f.elapse(3_600_000);
    assert.deepEqual(
      resumed.room.checkpoint(resumed.now).players[0].vitals,
      snapshot.players[0].vitals,
    );
    assert.equal(resumed.room.checkpoint(resumed.now).tick, snapshot.tick);
    resumed.room.setPaused(false, resumed.now);
    resumed.join();
    f.room.setPaused(false, f.now);
    f.room.receive('a', { type: 'focus', epoch: f.player().epoch, active: true }, f.now);
    for (let i = 0; i < 60; i++) {
      f.tick();
      resumed.tick();
    }
    assert.equal(f.player().vitals.view().health, 13);
    assert.deepEqual(
      resumed.room.actors.get('a')!.vitals.checkpoint(),
      f.player().vitals.checkpoint(),
    );
    assert.deepEqual(
      Array.from(resumed.room.store.world.player_state(resumed.room.actors.get('a')!.slot)),
      Array.from(f.state()),
    );
  } finally {
    f.room.dispose();
    resumed?.room.dispose();
  }
});

test('durable poses remain after connection reservation expiry while a fresh safe spawn starts a new fall segment', () => {
  const f = roomFixture('survival', 0, true);
  let resumed: ReturnType<typeof restore> | undefined;
  try {
    f.tick(6);
    const state = f.state();
    state[1] += 35;
    state[4] = 0;
    state[6] = 0;
    f.store.world.player_restore(f.player().slot, state);
    f.tick();
    f.room.disconnect('a', f.now);
    f.elapse(31000);
    assert.equal(f.room.actors.size, 0);
    const snapshot = f.room.checkpoint(f.now);
    assert.equal(snapshot.players[0].reservationMs, 0);
    assert.ok(snapshot.players[0].state[1] > 90);
    resumed = restore(json(snapshot));
    const a = resumed.join();
    resumed.tick(30);
    assert.equal(a.vitals.view().health, 20);
    assert.equal(a.phase, 'playing');
    assert.equal(resumed.room.inventories.view('a').bag.length, 36);
  } finally {
    f.room.dispose();
    resumed?.room.dispose();
  }
});

test('restored TNT requires fresh explicit owner resolution and a denied owner fizzles without terrain damage', () => {
  const f = roomFixture('survival', 0, true);
  let resumed: ReturnType<typeof restore> | undefined;
  try {
    f.tick(6);
    const p = f.state(),
      rule = content.manifest.behavior.find((block) => block.family === 'tnt')!.explosive!;
    f.room.explosives.add('a', content.defaults.tnt, [p[0] + 2, p[1] + 0.05, p[2]], rule, 30);
    const snapshot = f.room.checkpoint(f.now);
    assert.throws(() => restore(json(snapshot)), /owner policy missing/);
    assert.throws(
      () => restore(json(snapshot), new Map([['a', undefined as any]])),
      /owner policy/,
    );
    resumed = restore(json(snapshot), new Map([['a', null]]));
    resumed.pump();
    resumed.tick(31);
    assert.equal(resumed.room.explosives.size, 0);
    assert.deepEqual(resumed.room.store.checkpoint(content.manifest), snapshot.world);
    assert.equal(snapshot.explosives.entries[0].remaining, 30);
  } finally {
    f.room.dispose();
    resumed?.room.dispose();
  }
});

test('fractional monotonic reservation durations survive a paused restore without losing the grace interval', () => {
  const f = roomFixture('survival', 0, true);
  let resumed: ReturnType<typeof restore> | undefined;
  try {
    f.room.disconnect('a', f.now + 0.25);
    f.room.setPaused(true, f.now + 0.75);
    const snapshot = f.room.checkpoint(f.now + 1.25);
    assert.equal(snapshot.players[0].reservationMs, 29999.5);
    resumed = restore(json(snapshot));
    resumed.elapse(3600000);
    assert.equal(resumed.room.checkpoint(resumed.now).players[0].reservationMs, 29999.5);
    resumed.room.setPaused(false, resumed.now);
    const player = resumed.join();
    assert.equal(player.spawnNew, false);
  } finally {
    f.room.dispose();
    resumed?.room.dispose();
  }
});

test('corrupt room metadata and cross-component mismatches fail before publication or native terrain installation', () => {
  const f = roomFixture('survival', 0, true);
  try {
    f.tick(6);
    f.room.inventories.receive('a', { itemType: 'stone', count: 1 });
    const snapshot = f.room.checkpoint(f.now),
      mutations: ((v: any) => void)[] = [
        (v) => (v.schema = 2),
        (v) => (v.contentHash = 'wrong'),
        (v) => (v.generatorVersion = 1),
        (v) => (v.engineHash = 'wrong'),
        (v) => (v.bounds.height = 128),
        (v) => v.players.push(v.players[0]),
        (v) => (v.players[0].state[3] = Infinity),
        (v) => (v.players[0].state[13] = 1),
        (v) => (v.players[0].yaw = 4),
        (v) => (v.players[0].reservationMs = 30001),
        (v) => (v.players[0].state = Array(17)),
        (v) => (v.inventories.players = []),
        (v) => v.drops.tick++,
        (v) => (v.players[0].vitals.health = 0),
      ];
    for (const mutate of mutations) {
      const value = json(snapshot);
      mutate(value);
      const world = new engine.VoxelWorld(),
        gen = new engine.TerrainGen(4242);
      let sent = 0;
      try {
        assert.throws(
          () =>
            GameRoom.fromCheckpoint(
              world,
              gen,
              content.manifest,
              build,
              {
                send() {
                  sent++;
                },
                close() {},
              },
              value,
              1000,
            ),
          /checkpoint/,
        );
        assert.equal(sent, 0);
        assert.equal(world.column_count(), 0);
      } finally {
        world.free();
        gen.free();
      }
    }
  } finally {
    f.room.dispose();
  }
});
