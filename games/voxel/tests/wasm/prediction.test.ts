import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prediction } from '../../src/client/prediction.ts';
import { stepBoundedMovement } from '../../src/shared/movement.ts';
import { flatWorld } from './fixture.ts';
import { InputQueue } from '../../src/sim/input-queue.ts';
import { NEUTRAL } from '../../src/shared/input.ts';
import type { InputFrame } from '../../src/shared/input.ts';
test('a recovered input link retires stale movement/jump and restores native prediction agreement without extra steps', () => {
  const server = flatWorld(),
    client = flatWorld(),
    ss = server.player_add(0.5, 1.005, 0.5),
    cs = client.player_add(0.5, 1.005, 0.5);
  const prediction = new Prediction(client, cs),
    queue = new InputQueue(1),
    held: InputFrame[] = [];
  const snapshots: { at: number; ack: number; state: number[] }[] = [];
  let steps = 0,
    resyncs = 0;
  try {
    prediction.baseline(1, 0, Array.from(server.player_state(ss)));
    for (let tick = 0; tick < 120; tick++) {
      const now = (tick * 1000) / 30,
        controls = { ...NEUTRAL, x: tick < 30 ? 1 : tick < 75 ? -1 : 0, jump: tick === 20 };
      const packet = [prediction.sample(controls)!, prediction.sample(controls)!];
      assert(packet.every(Boolean));
      if (tick < 30) held.push(...packet);
      else {
        let overflow = false;
        for (const input of [...held.splice(0), ...packet]) {
          const result = queue.receive(input, now);
          assert(
            ['accepted', 'resync'].includes(result),
            'retired prediction never reuses transmitted sequences',
          );
          if (result === 'resync') overflow = true;
        }
        if (overflow) {
          prediction.baseline(1, queue.ack, Array.from(server.player_state(ss)));
          resyncs++;
        }
      }
      for (let n = 0; n < 2; n++) {
        const input = queue.take(now);
        stepBoundedMovement(server, ss, input.controls);
        steps++;
        if (input.resync) {
          prediction.baseline(1, queue.ack, Array.from(server.player_state(ss)));
          resyncs++;
        }
      }
      if (tick % 2 === 0)
        snapshots.push({
          at: tick + 3,
          ack: queue.ack,
          state: Array.from(server.player_state(ss)),
        });
      while (snapshots[0]?.at <= tick) {
        const snapshot = snapshots.shift()!;
        prediction.reconcile(1, snapshot.ack, snapshot.state);
      }
      if (tick >= 36) {
        assert(
          queue.received - queue.ack <= 2,
          'recovered server input latency is bounded by one packet',
        );
        const a = server.player_state(ss),
          b = client.player_state(cs);
        assert(
          Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.01,
          'native/client worlds agree after resynchronization',
        );
        assert(
          a[1] < 1.02,
          'a jump buffered during the stall never becomes a late authoritative jump',
        );
        assert(prediction.inputLag <= 10, 'only the ordinary delayed snapshot window remains');
      }
    }
    assert.equal(steps, 240);
    assert(resyncs > 0);
  } finally {
    server.free();
    client.free();
  }
});
test('same-epoch resynchronization never reuses an already transmitted input identity', () => {
  const client = flatWorld(),
    slot = client.player_add(0.5, 1.005, 0.5),
    prediction = new Prediction(client, slot),
    queue = new InputQueue(1);
  try {
    const state = Array.from(client.player_state(slot));
    prediction.baseline(1, 0, state);
    for (let i = 0; i < 8; i++)
      assert.equal(queue.receive(prediction.sample({ ...NEUTRAL, x: 1 })!, 0), 'accepted');
    queue.take(0);
    queue.take(0);
    prediction.baseline(1, queue.ack, state);
    assert.equal(prediction.inputLag, 0);
    const changed = prediction.sample({ ...NEUTRAL, x: -1 })!;
    assert.equal(changed.sequence, 9);
    assert.equal(queue.receive(changed, 1), 'accepted');
    for (let i = 0; i < 6; i++) queue.take(1);
    assert.equal(queue.take(1).controls.x, -1);
    prediction.baseline(1, queue.ack, state);
    assert.equal(prediction.sample(NEUTRAL)!.sequence, 10);
    prediction.baseline(2, 0, state);
    assert.equal(prediction.sample(NEUTRAL)!.sequence, 1);
  } finally {
    client.free();
  }
});
test('prediction replays equipment and hunger profiles through epoch changes with delayed snapshots', () => {
  const server = flatWorld(),
    client = flatWorld(),
    ss = server.player_add(0.5, 1.005, 0.5),
    cs = client.player_add(0.5, 1.005, 0.5);
  const prediction = new Prediction(client, cs);
  try {
    let epoch = 0;
    for (const profile of [
      { speed: 1.1, gravity: 1, control: 1, jump: 1, sprint: true },
      { speed: 1.1, gravity: 1, control: 1, jump: 1, sprint: false },
      { speed: 1, gravity: 0.8, control: 1.2, jump: 1, sprint: true },
      { speed: 1.5, gravity: 1, control: 1, jump: 1.6, sprint: true },
    ]) {
      const previous = epoch++;
      const initial = Array.from(server.player_state(ss));
      prediction.baseline(epoch, 0, initial, profile);
      assert.equal(prediction.reconcile(previous, 200, initial), false);
      const snapshots: { at: number; ack: number; state: number[] }[] = [];
      for (let step = 1; step <= 200; step++) {
        const controls = {
          x: 0,
          z: -0.7,
          yaw: epoch + step / 100,
          pitch: 0,
          jump: step % 90 === 0,
          sneak: false,
          sprint: true,
        };
        const input = prediction.sample(controls)!;
        stepBoundedMovement(server, ss, input, profile);
        if (step % 4 === 0)
          snapshots.push({
            at: step + 6,
            ack: input.sequence,
            state: Array.from(server.player_state(ss), (v, i) =>
              i < 6 ? Math.round(v * 10000) / 10000 : v,
            ),
          });
        while (snapshots[0]?.at <= step) {
          const snapshot = snapshots.shift()!;
          prediction.reconcile(epoch, snapshot.ack, snapshot.state);
        }
        const a = server.player_state(ss),
          b = client.player_state(cs);
        assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.01);
      }
    }
  } finally {
    server.free();
    client.free();
  }
});
test('prediction replays delayed snapshots within one centimeter on an unchanged world', () => {
  const client = flatWorld(),
    server = flatWorld(),
    clientSlot = client.player_add(0.5, 1.005, 0.5),
    serverSlot = server.player_add(0.5, 1.005, 0.5),
    prediction = new Prediction(client, clientSlot);
  prediction.baseline(1, 0, Array.from(server.player_state(serverSlot)));
  const snapshots: { at: number; ack: number; state: number[] }[] = [];
  let worst = 0;
  try {
    for (let step = 1; step <= 900; step++) {
      const t = step / 60,
        controls = {
          x: Math.sin(t * 0.3) * 0.25,
          z: -0.9,
          yaw: Math.atan2(Math.sin(t * 0.6), Math.cos(t * 0.6)),
          pitch: Math.sin(t) * 0.2,
          jump: step % 120 === 0,
          sneak: false,
          sprint: false,
        };
      const frame = prediction.sample(controls)!;
      assert.ok(frame);
      stepBoundedMovement(server, serverSlot, frame);
      if (step % 4 === 0)
        snapshots.push({
          at: step + 6,
          ack: frame.sequence,
          state: Array.from(server.player_state(serverSlot), (v, i) =>
            i < 6 ? Math.round(v * 10000) / 10000 : v,
          ),
        });
      while (snapshots[0]?.at <= step) {
        const s = snapshots.shift()!;
        prediction.reconcile(1, s.ack, s.state);
      }
      const a = client.player_state(clientSlot),
        b = server.player_state(serverSlot),
        error = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      worst = Math.max(worst, error);
      assert.ok(error <= 0.01, `prediction error ${error} at ${step}`);
    }
    assert.ok(prediction.inputLag <= 12);
    assert.ok(worst < 0.01);
    const state = Array.from(server.player_state(serverSlot));
    state[0] += 4;
    prediction.baseline(2, 0, state);
    const restored = client.player_state(clientSlot);
    assert.equal(prediction.inputLag, 0);
    assert.equal(prediction.reconcile(1, 900, state), false);
    assert.deepEqual(client.player_state(clientSlot), restored);
    assert.equal(
      prediction.sample({ x: 0, z: 0, yaw: 0, pitch: 0, jump: false, sneak: false, sprint: false })!
        .sequence,
      1,
    );
  } finally {
    client.free();
    server.free();
  }
});
