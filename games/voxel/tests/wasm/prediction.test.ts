import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prediction } from '../../src/client/prediction.ts';
import { stepBoundedMovement } from '../../src/shared/movement.ts';
import { flatWorld } from './fixture.ts';
import { InputQueue } from '../../src/sim/input-queue.ts';
import { NEUTRAL } from '../../src/shared/input.ts';
import type { InputFrame } from '../../src/shared/input.ts';
test('variable frame durations and ordered packet jitter reconcile without recurring corrections or resyncs', () => {
  for (const stall of [false, true]) {
    const server = flatWorld(),
      client = flatWorld();
    const ss = server.player_add(0.5, 1.005, 0.5),
      cs = client.player_add(0.5, 1.005, 0.5);
    const prediction = new Prediction(client, cs),
      queue = new InputQueue(1);
    prediction.baseline(1, 0, Array.from(server.player_state(ss)));
    const packets: { at: number; frames: InputFrame[] }[] = [];
    const snapshots: { at: number; ack: number; state: number[] }[] = [];
    let delivery = 0,
      worst = 0,
      reconciliations = 0;
    try {
      for (let tick = 0; tick < 360; tick++) {
        const count = [1, 2, 4][Math.floor(tick / 30) % 3],
          frames: InputFrame[] = [];
        for (let n = 0; n < count; n++)
          frames.push(
            prediction.sample(
              {
                ...NEUTRAL,
                x: Math.floor(tick / 25) % 2 ? -0.8 : 0.8,
                yaw: Math.sin(tick / 30),
                jump: tick === 95 && n === 0,
              },
              1 / (30 * count),
            )!,
          );
        assert(frames.every(Boolean));
        delivery = Math.max(
          delivery,
          tick + (tick % 15 < 3 ? 3 : 1),
          stall && tick >= 120 && tick < 135 ? 135 : 0,
        );
        packets.push({ at: delivery, frames });
        while (packets[0]?.at <= tick)
          for (const input of packets.shift()!.frames)
            assert.equal(queue.receive(input, (tick * 1000) / 30), 'accepted');
        queue.advance(1 / 30, (input) => stepBoundedMovement(server, ss, input));
        snapshots.push({
          at: tick + 1,
          ack: queue.ack,
          state: Array.from(server.player_state(ss), (v, i) =>
            i < 6 ? Math.round(v * 10000) / 10000 : v,
          ),
        });
        while (snapshots[0]?.at <= tick) {
          const snapshot = snapshots.shift()!;
          prediction.reconcile(1, snapshot.ack, snapshot.state);
          worst = Math.max(worst, prediction.correction);
          reconciliations++;
          assert(
            prediction.correction < 0.001,
            `stall=${stall} tick=${tick} correction=${prediction.correction}`,
          );
        }
      }
      assert(reconciliations > 300);
      assert(worst < 0.001);
      assert(queue.size < 12);
    } finally {
      server.free();
      client.free();
    }
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
    queue.advance(1 / 30, () => {});
    prediction.baseline(1, queue.ack, state);
    assert.equal(prediction.inputLag, 0);
    const changed = prediction.sample({ ...NEUTRAL, x: -1 })!;
    assert.equal(changed.sequence, 9);
    assert.equal(queue.receive(changed, 1), 'accepted');
    let latest = 0;
    for (let i = 0; i < 6; i++)
      queue.advance(1 / 30, (frame) => {
        latest = frame.x;
      });
    assert.equal(latest, -1);
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
