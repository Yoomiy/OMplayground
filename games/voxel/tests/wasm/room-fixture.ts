import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { engine, content } from './fixture.ts';
import { WorldStore } from '../../src/sim/world-store.ts';
import { GameRoom } from '../../src/sim/game-room.ts';
import type { RoomPorts } from '../../src/sim/game-room.ts';
import { NEUTRAL } from '../../src/shared/input.ts';
import type { Controls } from '../../src/shared/input.ts';
import { around } from '../../src/shared/protocol.ts';
import type { ClientMessage, ServerMessage, Cell } from '../../src/shared/protocol.ts';
import type { ChunkFrame } from '../../src/shared/chunk-wire.ts';
export function roomFixture(
  mode: 'creative' | 'survival' = 'survival',
  initialTick = 0,
  natural = false,
  onStep?: RoomPorts['onStep'],
  Room = GameRoom,
  reserveChunk?: RoomPorts['reserveChunk'],
) {
  const generator = new engine.TerrainGen(4242);
  if (!natural) {
    generator.set_void();
    generator.set_void_ground(63, content.defaults.grass_block, content.defaults.dirt, 4);
  }
  const store = new WorldStore(new engine.VoxelWorld(), generator),
    events = new Map<string, (ServerMessage | ChunkFrame)[]>();
  let now = 0;
  const inputs = new Map<string, number>(),
    actions = new Map<string, number>(),
    controls = new Map<string, Controls>();
  const room = new Room(
    store,
    content.manifest,
    JSON.parse(readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8')),
    {
      onStep,
      reserveChunk,
      send(id, message) {
        const list = events.get(id) ?? [];
        list.push(message);
        events.set(id, list);
      },
      close() {},
    },
    'survival-test',
    4242,
    now,
    initialTick,
    mode,
  );
  const baseline = (id: string) => {
    const event = events
      .get(id)
      ?.findLast(
        (e): e is Extract<ServerMessage, { type: 'baseline' }> =>
          'type' in e && e.type === 'baseline',
      );
    assert.ok(event);
    return event;
  };
  const result = (id: string) => {
    const event = events
      .get(id)
      ?.findLast(
        (e): e is Extract<ServerMessage, { type: 'result' }> => 'type' in e && e.type === 'result',
      );
    assert.ok(event);
    return event;
  };
  const player = (id = 'a') => {
    const actor = room.actors.get(id);
    assert.ok(actor);
    return actor;
  };
  const state = (id = 'a') => store.world.player_state(player(id).slot);
  const ready = (id = 'a') => {
    const initial = baseline(id),
      p = state(id);
    room.receive(
      id,
      {
        type: 'ready',
        epoch: initial.epoch,
        columns: around(Math.floor(p[0] / 16), Math.floor(p[2] / 16), 1).map((c) => ({
          ...c,
          revision: store.revision(c.x, c.z),
        })),
      },
      now,
    );
    room.receive(id, { type: 'focus', epoch: baseline(id).epoch, active: true }, now);
  };
  const join = (id = 'a', role: 'participant' | 'observer' = 'participant') => {
    room.join(
      {
        id,
        role,
        capabilities: {
          build: role === 'participant',
          fly: true,
          observe: role === 'observer',
          combat: role === 'participant',
          explosives: role === 'participant',
        },
      },
      id,
      now,
    );
    while (store.generateOne()) {}
    room.advance(now);
    ready(id);
    inputs.set(id, 0);
    actions.set(id, 0);
    controls.set(id, { ...NEUTRAL });
  };
  const tick = (count = 1) => {
    for (let n = 0; n < count; n++) {
      now += 1000 / 30;
      for (const [id, c] of controls)
        if (player(id).connection && player(id).focused) {
          const sequence = inputs.get(id)!;
          room.receive(
            id,
            {
              type: 'input',
              frames: [1, 2].map((i) => ({
                ...c,
                epoch: player(id).epoch,
                sequence: sequence + i,
              })),
            },
            now,
          );
          inputs.set(id, sequence + 2);
        }
      room.advance(now);
      while (store.generateOne()) {}
    }
  };
  const aim = (cell: Cell, id = 'a') => {
    const p = state(id),
      dx = cell[0] + 0.5 - p[0],
      dy = cell[1] + 0.5 - p[1] - 1.62,
      dz = cell[2] + 0.5 - p[2];
    controls.set(id, {
      ...NEUTRAL,
      yaw: Math.atan2(dx, -dz),
      pitch: Math.atan2(dy, Math.hypot(dx, dz)),
    });
    tick();
  };
  const send = (message: ClientMessage, id = 'a') => {
    room.receive(id, message, now);
    return result(id);
  };
  const next = (id = 'a') => {
    const sequence = (actions.get(id) ?? 0) + 1;
    actions.set(id, sequence);
    return sequence;
  };
  const start = (target: Cell, id = 'a') =>
    send(
      {
        type: 'mining',
        epoch: player(id).epoch,
        sequence: next(id),
        inputSequence: inputs.get(id)!,
        target,
        revision: store.revision(target[0] >> 4, target[2] >> 4),
        inventoryRevision: room.inventories.held(id).revision,
      },
      id,
    );
  const target = (family = 'oak_log'): Cell => {
    const p = state();
    const cell: Cell = [Math.floor(p[0]), 65, Math.floor(p[2]) - 3];
    store.set(...cell, content.defaults[family]);
    return cell;
  };
  join();
  return {
    room,
    store,
    events,
    state,
    player,
    baseline,
    result,
    join,
    ready,
    tick,
    aim,
    send,
    next,
    start,
    target,
    inputs,
    controls,
    get now() {
      return now;
    },
    elapse(ms: number) {
      now += ms;
      return room.advance(now);
    },
  };
}
