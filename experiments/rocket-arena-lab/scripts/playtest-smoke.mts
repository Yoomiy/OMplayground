import assert from 'node:assert/strict';
import { Client, type Room } from 'colyseus.js';
import { DrivingLab } from '../client/src/lab/prediction.js';
import { WorkerDrivingLab } from '../client/src/lab/worker-driving-lab.js';
import { nodeLabWorker } from './node-lab-worker.mts';
import type { Worker } from 'node:worker_threads';
import type { InputCommandV2 } from '@rocket-arena/shared';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';

// Real matchmaking/WebSockets/physics with controlled latency and an input stall.
// Rendering and physical-device usability still need a browser playtest.
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = process.env.LAB_TEST_ENDPOINT ?? 'ws://127.0.0.1:19001';
const command: InputCommandV2 = { protocolVersion: 2, throttle: 1, steer: 0, pitch: 0,
  roll: 0, yaw: 0, jumpHeld: false, jumpSequence: 0, boostHeld: false,
  powerslideHeld: false, cameraToggleSequence: 0 };
const client = new Client(endpoint);
const host = await client.create('custom', { name: 'Smoke Host' });
host.onMessage('*', () => {});
const workerMode=process.env.LAB_TEST_WORKER === '1';
let thread:Worker|null=null;
const lab = workerMode ? new WorkerDrivingLab(()=>{const adapter=nodeLabWorker();thread=adapter.thread;return adapter.port}) : new DrivingLab();
const timers = new Set<ReturnType<typeof setTimeout>>();
let latencyMs = 0;
let dropInputs = false;
function later(fn: () => void) {
  const timer = setTimeout(() => { timers.delete(timer); fn(); }, latencyMs);
  timers.add(timer);
}
const transport = {
  sessionId: host.sessionId,
  onMessage(type: string, fn: (value: any) => void) {
    return host.onMessage(type, value => later(() => fn(value)));
  },
  onLeave(fn: () => void) { return host.onLeave(fn); },
  send(type: string, value: any) {
    if (dropInputs && type === 'lab-input') return;
    later(() => host.send(type, value));
  },
} as unknown as Room;
lab.attach(transport);
if(workerMode && process.env.LAB_TEST_CLOCK === '1')lab.startInputClock(()=>transport,()=>command);
let guest: Room | null = null;
let previous = performance.now();
let largestPending = 0;
let frames = 0;
let predictedFrames = 0;
const replayTimes: number[] = [];
async function drive(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    await delay(16);
    const now = performance.now();
    lab.update(transport, (now - previous) / 1000, command, now);
    previous = now;
    largestPending = Math.max(largestPending, lab.getDebugState().pending);
    frames++;
    if (lab.getDebugState().predictionActive) predictedFrames++;
    if (lab.getDebugState().replaySteps > 0) replayTimes.push(lab.getDebugState().replayMs);
    assert.ok(lab.getDebugState().pending <= 24);
  }
}
try {
  guest = await client.joinById(host.id, { name: 'Smoke Guest' });
  guest.onMessage('*', () => {});
  let guestSnapshots = 0;
  guest.onMessage('prediction-state', (frame: PredictionFrame) => {
    guestSnapshots++;
    assert.ok(frame.cars.every(car => Number.isSafeInteger(car.inputAppliedTick)
      && car.inputAppliedTick! >= 0 && car.inputAppliedTick! <= frame.tick));
  });
  host.send('start-match');
  await delay(3400);
  lab.update(transport, 0, command, performance.now());
  for(let warmup=0;workerMode && !lab.getDebugState().predictedCar && warmup<200;warmup++){
    await delay(16);lab.update(transport,0,command,performance.now());
  }
  const initial = lab.getDebugState().predictedCar;
  assert.ok(initial);
  previous = performance.now();
  await drive(3000);
  const normal = lab.getDebugState();
  const normalPredictionFraction = predictedFrames / frames;
  assert.equal(normal.error, null);
  assert.ok(normal.pending < 10);
  assert.ok(normal.acknowledgedSequence > 30);
  assert.ok(Math.hypot(normal.predictedCar!.position.x - initial.position.x,
    normal.predictedCar!.position.z - initial.position.z) > 5);
  latencyMs = 180; // 360 ms added RTT.
  await drive(2200);
  const delayed = lab.getDebugState();
  dropInputs = true;
  await drive(1200);
  const stalled = lab.getDebugState();
  assert.ok(stalled.recoveries > 0);
  dropInputs = false;
  latencyMs = 0;
  await drive(3200);
  const recovered = lab.getDebugState();
  assert.equal(recovered.error, null);
  assert.ok(recovered.pending < 10);
  assert.ok(recovered.acknowledgedSequence > stalled.acknowledgedSequence + 30);
  assert.ok(guestSnapshots > 100);
  for (const mode of ['original', 'shorter', 'predicted'] as const) {
    lab.setMode(mode);
    await drive(100);
    if (mode !== 'predicted') assert.equal(lab.getDebugState().pending, 0);
    else if(workerMode){
      const readyUntil=performance.now()+3_000;
      while(!lab.getDebugState().predictionActive && performance.now()<readyUntil)await drive(50);
      assert.equal(lab.getDebugState().predictionActive,true,'worker must finish rebuilding after a mode switch');
    }
  }
  lab.neutralize(command);
  await drive(150);
  const telemetry = lab.exportTelemetry();
  if (workerMode) {
    const incidents = telemetry.flatMap(row => row.stallIncidents ?? []);
    const backlog = incidents.find(incident => incident.event === 'input_backlog');
    assert.ok(backlog, 'deliberate input loss retains a backlog timing trace');
    assert.ok(backlog.samples.length <= 21);
    assert.ok(backlog.samples.some(sample => sample.ackAdvanceAgeMs > 100 && sample.snapshotAgeMs < 100),
      'trace separates stalled acknowledgements from healthy snapshot delivery');
    assert.ok(backlog.samples.every(sample => Number.isFinite(sample.serverWorkMs)));
  }
  assert.ok(telemetry.some(row => row.mode === 'predicted' && row.frames > 0));
  for (const mode of ['original', 'shorter', 'predicted']) assert.ok(telemetry.some(row => row.mode === mode));
  assert.ok(telemetry.every(row => row.version === 2 && row.source === 'node' && row.eligibleMs === 0));
  assert.ok(telemetry.some(row => row.recoveryCounts.controls_released > 0));
  assert.ok(telemetry.every(row => Number.isFinite(row.confirmedSnapshots)
    && Number.isFinite(row.skippedReplaySteps) && Number.isFinite(row.replayedSteps)));
  assert.ok(lab.getDebugState().historySize <= 64);
  await delay(50); // Let the zero-latency test transport send its final export before cleanup.
  console.log(JSON.stringify({ result: 'PASS', endpoint, workerMode, largestPending, guestSnapshots,
    telemetryWindows: telemetry.length, telemetry,
    normalPredictionFraction, predictionFraction: predictedFrames / frames,
    replayP95Ms: replayTimes.sort((a, b) => a - b)[Math.floor(replayTimes.length * .95)] ?? 0,
    normal, delayed, stalled, recovered }, null, 2));
} finally {
  for (const timer of timers) clearTimeout(timer);
  lab.stopInputClock?.();lab.detach();
  await guest?.leave();
  await host.leave();
  if(thread)await thread.terminate();
}
