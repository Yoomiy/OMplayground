import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from './room-fixture.ts';
import { emptyAppearance } from '../../src/shared/appearance.ts';
import { selectAvatar } from '../../src/shared/avatars.ts';
import type { ActorState, ServerMessage } from '../../src/shared/protocol.ts';
import type { ChunkFrame } from '../../src/shared/chunk-wire.ts';

/** Reconstruct only what a peer receives, without reading the server's replica cache. */
function publicActors(events: readonly (ServerMessage | ChunkFrame)[]) {
  const actors = new Map<string, ActorState>();
  for (const event of events) {
    if (!('type' in event)) continue;
    if (event.type === 'actor_joined') actors.set(event.actor.id, event.actor);
    if (event.type === 'actor_removed') actors.delete(event.id);
    if (event.type === 'snapshot')
      for (const delta of event.actors) {
        const previous = actors.get(delta.id);
        assert(previous, 'an actor must be introduced before receiving deltas');
        actors.set(delta.id, { ...previous, ...delta });
      }
  }
  return actors;
}

test('snapshots reconstruct public poses and avatars at circle boundaries, hide unready/staff actors and retain removal order', () => {
  const f = roomFixture('creative');
  const avatars = new Map([
    ['a', selectAvatar('a')],
    ['b', 9],
    ['teacher', 6],
    ['c', 1],
    ['d', 11],
  ]);
  try {
    f.join('b', 'participant', avatars.get('b'));
    f.join('teacher', 'observer', avatars.get('teacher'));
    f.join('c', 'participant', avatars.get('c'));
    f.join('d', 'participant', avatars.get('d'));
    for (const id of avatars.keys())
      f.room.receive(id, { type: 'focus', epoch: f.player(id).epoch, active: false }, f.now);
    const pose = (id: string, x: number, z: number) => {
      const p = f.state(id);
      p[10] = 1;
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
    const quantized = (id: string) =>
      Array.from(f.state(id), (value, axis) =>
        axis < 6 ? Math.round(value * 10000) / 10000 : value,
      );
    const checkViewers = () => {
      for (const viewer of avatars.keys()) {
        const own = quantized(viewer);
        // Interest uses the viewer's precise body and the published target pose.
        // A viewer just outside the circle can round onto its wire boundary.
        const origin = f.state(viewer);
        const expected = [...avatars.keys()].filter((id) => {
          if (id === viewer || (id === 'teacher' && viewer !== 'teacher')) return false;
          const other = quantized(id);
          return Math.hypot(other[0] - origin[0], other[2] - origin[2]) <= 48;
        });
        const replicas = publicActors(f.events.get(viewer)!);
        assert.deepEqual([...replicas.keys()].sort(), [...expected].sort(), viewer);
        assert.deepEqual([...f.player(viewer).visible.keys()], expected, 'canonical actor order');
        for (const id of expected)
          assert.deepEqual(
            replicas.get(id),
            {
              id,
              avatar: avatars.get(id),
              state: quantized(id),
              yaw: 0,
              pitch: 0,
              appearance: emptyAppearance(),
            },
            `${viewer} receives the complete public state for ${id}`,
          );
        const snapshot = f.events
          .get(viewer)!
          .findLast(
            (e): e is Extract<ServerMessage, { type: 'snapshot' }> =>
              'type' in e && e.type === 'snapshot',
          );
        assert(snapshot?.self);
        assert.deepEqual(snapshot.self.state, own, 'private self retains the acknowledged pose');
        assert.equal(snapshot.self.ack, f.player(viewer).queue.ack);
      }
    };
    for (const [x, z] of [
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
    ]) {
      pose('b', x, z);
      f.tick(2);
      checkViewers();
    }
    const retainedEvents = [...f.events].map(([id, events]) => [id, events.slice()]);
    const retained = JSON.stringify(retainedEvents);
    f.room.setPaused(true, f.now);
    pose('b', 1, 1);
    f.tick(2);
    checkViewers();
    assert.equal(
      JSON.stringify(retainedEvents),
      retained,
      'later publications never mutate retained events',
    );
    // Re-entered b must precede c/d when all leave visibility together.
    const beforeRemoval = f.events.get('a')!.length;
    pose('a', -200, -200);
    f.tick(2);
    checkViewers();
    const removed = (events: readonly (ServerMessage | ChunkFrame)[]) =>
      events.flatMap((event) =>
        'type' in event && event.type === 'actor_removed' ? [event.id] : [],
      );
    assert.deepEqual(removed(f.events.get('a')!.slice(beforeRemoval)), ['b', 'c', 'd']);
    const beforeTeleport = f.events.get('teacher')!.length;
    assert.equal(f.room.staff('teacher', { kind: 'teleport', target: 'b' }, f.now).ok, true);
    assert.deepEqual(removed(f.events.get('teacher')!.slice(beforeTeleport)), ['b', 'c', 'd']);
  } finally {
    f.room.dispose();
  }
});
