import type RAPIER from '@dimforge/rapier3d-compat';
import type { Room } from 'colyseus.js';
import { ARENA_COLLISION_GEOMETRY, PHYSICS, type InputCommandV2 } from '@rocket-arena/shared';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import { AuthoritativeRoomCore } from '../../server/src/rooms/authoritative-room-core.js';
import { initializeAuthoritativeRapierWorld, type AuthoritativeRapierCar } from '../../server/src/rooms/rapier-room-world.js';
import { initPhysics } from '@rocket-arena/simulation/world';
import { DrivingLab } from '../src/lab/prediction.js';

export const historyCommand: InputCommandV2 = { protocolVersion: 2, throttle: 1, steer: 0, pitch: 0,
  roll: 0, yaw: 0, jumpHeld: false, jumpSequence: 0, boostHeld: false,
  powerslideHeld: false, cameraToggleSequence: 0 };
const command = historyCommand;
const fixedMs = PHYSICS.TIMESTEP * 1_000;

export async function historyFixture(reuse = true, players = 1, delayTicks = 6, outboundTicks = 0, freezeBudgetClock = false) {
  const core = new AuthoritativeRoomCore<RAPIER.World, AuthoritativeRapierCar, RAPIER.RigidBody>({
    roomId: 'history', mode: 'custom', logger: { info() {}, error() {} },
    initializeWorld: context => initializeAuthoritativeRapierWorld(context, {
      resolvedGeometry: ARENA_COLLISION_GEOMETRY,
      initialCarPosition: () => ({ x: 0, y: .6, z: -25 }),
    }),
  });
  await core.initialize();
  const join = core.queueMutation({ kind: 'join', sessionId: 'driver', name: 'Driver' });
  core.advanceSimulation(fixedMs); await join;
  for (let i = 1; i < players; i++) {
    const guest = core.queueMutation({ kind: 'join', sessionId: `remote-${i}`, name: 'Remote' });
    core.advanceSimulation(fixedMs); await guest;
  }
  const start = core.queueMutation({ kind: 'start', sessionId: 'driver' });
  core.advanceSimulation(fixedMs); await start;
  for (let i = 0; i < 190; i++) core.advanceSimulation(fixedMs);
  let receiver: (frame: PredictionFrame) => void = () => {};
  const inputs: unknown[] = [];
  const room = { sessionId: 'driver', onMessage(type: string, fn: any) { if (type === 'prediction-state') receiver = fn; },
    onLeave() {}, send(type: string, value: unknown) { if (type === 'lab-input') inputs.push(value); } } as unknown as Room;
  const lab = new DrivingLab(reuse);
  await initPhysics(); await new Promise(resolve => setTimeout(resolve, 0));
  lab.attach(room);
  receiver(core.buildPredictionFrame()!);
  lab.update(room, 0, command, performance.now());
  const delayed: PredictionFrame[] = [];
  const outgoing: { value: unknown; due: number }[] = [];
  let ticks = 0;
  const receive = (frame: PredictionFrame) => receiver(frame);
  const tick = (input = command, inputBatch = 1, render = true, deltaTicks = 1) => {
    ticks++;
    const startedAt = performance.now();
    const cpuStart = process.hrtime.bigint();
    const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    // Benchmark only: keep both algorithms active instead of timing CPU fallback.
    // Physical state does not use this clock. Actual timing uses hrtime below.
    if (freezeBudgetClock) Object.defineProperty(performance, 'now', { value: () => startedAt, configurable: true });
    try { if (render) lab.update(room, PHYSICS.TIMESTEP * deltaTicks, input, startedAt); }
    finally {
      if (freezeBudgetClock) {
        if (descriptor) Object.defineProperty(performance, 'now', descriptor);
        else delete (performance as unknown as { now?: unknown }).now;
      }
    }
    const updateMs = Number(process.hrtime.bigint() - cpuStart) / 1_000_000;
    while (inputs.length) outgoing.push({ value: inputs.shift(), due: ticks + outboundTicks });
    while (outgoing.filter(item => item.due <= ticks).length >= inputBatch) {
      for (let i = 0; i < inputBatch; i++) core.submitPredictionInput('driver', outgoing.shift()!.value);
    }
    core.advanceSimulation(fixedMs);
    delayed.push(structuredClone(core.buildPredictionFrame()!));
    if (delayed.length > delayTicks) receiver(delayed.shift()!);
    return updateMs;
  };
  const prime = () => {
    core.advanceSimulation(fixedMs);
    receiver(core.buildPredictionFrame()!);
    lab.update(room, 0, command, performance.now());
  };
  return { lab, core, room, tick, receive, prime, headSnapshot: () => structuredClone(delayed[0] ?? core.buildPredictionFrame()!), dispose() { lab.detach(); core.dispose(); } };
}
