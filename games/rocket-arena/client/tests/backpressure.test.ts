import assert from 'node:assert/strict';
import test from 'node:test';
import type { Room } from 'colyseus.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import { ARENA_COLLISION_GEOMETRY, PHYSICS, type InputCommandV2 } from '@rocket-arena/shared';
import { initPhysics } from '@rocket-arena/simulation/world';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import { PredictionWorld } from '@rocket-arena/simulation/prediction-world';
import { AuthoritativeRoomCore } from '../../server/src/rooms/authoritative-room-core.js';
import { initializeAuthoritativeRapierWorld, type AuthoritativeRapierCar } from '../../server/src/rooms/rapier-room-world.js';
import { ClientPrediction } from '../src/prediction/prediction.js';

const command: InputCommandV2 = { protocolVersion: 2, throttle: 1, steer: 0, pitch: 0,
  roll: 0, yaw: 0, jumpHeld: false, jumpSequence: 0, boostHeld: false,
  powerslideHeld: false, cameraToggleSequence: 0 };

async function fixture() {
  const core = new AuthoritativeRoomCore<RAPIER.World, AuthoritativeRapierCar, RAPIER.RigidBody>({
    roomId: 'backpressure', mode: 'custom', logger: { info() {}, error() {} },
    initializeWorld: context => initializeAuthoritativeRapierWorld(context, {
      resolvedGeometry: ARENA_COLLISION_GEOMETRY,
      initialCarPosition: () => ({ x: 0, y: 0.6, z: -25 }),
    }),
  });
  await core.initialize();
  const join = core.queueMutation({ kind: 'join', sessionId: 'driver', name: 'Driver' });
  core.advanceSimulation(PHYSICS.TIMESTEP * 1000);
  await join;
  const start = core.queueMutation({ kind: 'start', sessionId: 'driver' });
  core.advanceSimulation(PHYSICS.TIMESTEP * 1000);
  await start;
  for (let i = 0; i < 190; i++) core.advanceSimulation(PHYSICS.TIMESTEP * 1000);
  const frame = core.buildPredictionFrame()!;
  const handlers = new Map<string, (value: any) => void>();
  const sent: { type: string; value: any }[] = [];
  const room = { sessionId: 'driver', onMessage(type: string, fn: (value: any) => void) { handlers.set(type, fn); },
    onLeave() {}, send(type: string, value: any) { sent.push({ type, value }); } } as unknown as Room;
  const prediction = new ClientPrediction();
  await initPhysics();
  await new Promise(resolve => setTimeout(resolve, 0));
  prediction.attach(room);
  let tick = frame.tick;
  const receive = (ack = 0) => handlers.get('prediction-state')!({ ...frame, tick: ++tick,
    cars: frame.cars.map(car => ({ ...car, acknowledgedSequence: ack })) } satisfies PredictionFrame);
  receive();
  prediction.update(room, 0, command, performance.now());
  return { prediction, room, receive, sent, dispose() { prediction.detach(); core.dispose(); } };
}

test('missing acknowledgements cannot accumulate seconds of replay; fresh acknowledgements recover', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 180; i++) {
      f.receive(); // Server ticks arrive, but input acknowledgements are stalled.
      f.prediction.update(f.room, PHYSICS.TIMESTEP, command, performance.now());
      assert.ok(f.prediction.getDebugState().pending <= 24, 'history must stay below 400 ms');
    }
    assert.equal(f.prediction.getDebugState().predictionActive, false);
    assert.ok(f.prediction.getDebugState().recoveries > 0);
    const latest = f.prediction.getDebugState().sequence;
    f.receive(latest);
    f.prediction.update(f.room, PHYSICS.TIMESTEP, command, performance.now());
    assert.ok(f.prediction.getDebugState().pending <= 1);
    assert.equal(f.prediction.getDebugState().error, null);
    assert.equal(f.prediction.getDebugState().predictionActive, true);
  } finally { f.dispose(); }
});

test('expensive replay yields and resumes a fixed target without discarding inputs or restarting on snapshots', async () => {
  const f = await fixture();
  const original = PredictionWorld.prototype.step;
  try {
    for (let i = 0; i < 6; i++) f.prediction.update(f.room, PHYSICS.TIMESTEP, command, performance.now());
    PredictionWorld.prototype.step = function(id, input, sequence) {
      original.call(this, id, input, sequence);
      const until = performance.now() + 10;
      while (performance.now() < until) { /* Simulate a slower device's physics. */ }
    };
    f.receive();
    f.prediction.update(f.room, 0, command, performance.now());
    const recovered = f.prediction.getDebugState();
    assert.equal(recovered.catchingUp, true);
    assert.equal(recovered.replaySteps, 1);
    assert.equal(recovered.pending, 6);
    assert.ok(recovered.catchupYields > 0);
    f.receive(recovered.sequence);
    f.prediction.update(f.room, PHYSICS.TIMESTEP, command, performance.now());
    assert.equal(f.prediction.getDebugState().reconciliations, recovered.reconciliations);
    assert.ok(f.prediction.getDebugState().sequence > recovered.sequence);
    for (let i = 0; i < 20 && f.prediction.needsContinuation; i++) f.prediction.continuePrediction(performance.now());
    assert.equal(f.prediction.needsContinuation, false);
    assert.equal(f.prediction.getDebugState().catchingUp, false);
    assert.equal(f.prediction.getDebugState().predictionActive, true);
    assert.ok(f.prediction.exportTelemetry().every(window => window.recoveryCounts.cpu_budget === 0));
  } finally { PredictionWorld.prototype.step = original; f.dispose(); }
});

test('batched snapshots perform no network-callback physics and reconcile once per render frame', async () => {
  const f = await fixture();
  const original = PredictionWorld.prototype.restore;
  let restores = 0;
  PredictionWorld.prototype.restore = function(frame) { restores++; original.call(this, frame); };
  try {
    for (let i = 0; i < 8; i++) f.prediction.update(f.room, PHYSICS.TIMESTEP, command, performance.now());
    for (let i = 0; i < 30; i++) f.receive();
    assert.equal(restores, 0, 'queued network messages must not replay physics');
    f.prediction.update(f.room, 0, command, performance.now());
    assert.equal(restores, 1);
    f.prediction.setMode('server');
    for (let i = 0; i < 30; i++) f.receive();
    f.prediction.update(f.room, PHYSICS.TIMESTEP, command, performance.now());
    assert.equal(restores, 1, 'comparison modes should not spend time on prediction');
  } finally { PredictionWorld.prototype.restore = original; f.dispose(); }
});

test('a render stall does not burst six old commands and acknowledgement from another connection is rejected', async () => {
  const f = await fixture();
  try {
    f.prediction.update(f.room, 2, command, performance.now());
    assert.ok(f.sent.filter(message => message.type === 'player-input').length <= 3);
    const before = f.prediction.getDebugState();
    f.receive(before.sequence + 1_000);
    assert.equal(f.prediction.getDebugState().snapshots, before.snapshots);
  } finally { f.dispose(); }
});

test('switching back to prediction waits for controls sent in comparison mode to be acknowledged', async () => {
  const f = await fixture();
  try {
    f.prediction.setMode('server');
    for (let i = 0; i < 6; i++) f.prediction.update(f.room, PHYSICS.TIMESTEP, command, performance.now());
    assert.equal(f.prediction.getDebugState().pending, 0);
    f.prediction.setMode('predicted');
    f.receive();
    f.prediction.update(f.room, 0, command, performance.now());
    assert.equal(f.prediction.getDebugState().predictionActive, false);
    f.receive(f.prediction.getDebugState().sequence);
    f.prediction.update(f.room, 0, command, performance.now());
    assert.equal(f.prediction.getDebugState().predictionActive, true);
  } finally { f.dispose(); }
});
