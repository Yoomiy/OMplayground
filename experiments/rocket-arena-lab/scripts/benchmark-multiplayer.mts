import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createWriteStream, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Client, type Room } from 'colyseus.js';
import { PHYSICS, type InputCommandV2, type LabTelemetryWindow } from '@rocket-arena/shared';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import { WorkerDrivingLab } from '../client/src/lab/worker-driving-lab.js';
import { nodeLabWorker } from './node-lab-worker.mts';

// Real Colyseus sockets, published backend, production prediction worker. Other
// clients send active controls without duplicating their physics on this VPS.
// A callback cadence is not render FPS; this harness has no WebGL or camera.
const releaseRoot = process.env.SCALING_RELEASE_ROOT ?? realpathSync('/srv/playground-labs/rocket/current');
const manifest = JSON.parse(readFileSync(`${releaseRoot}/release.json`, 'utf8'));
const port = Number(process.env.SCALING_PORT ?? 19004);
const seconds = Number(process.env.SCALING_SECONDS ?? 90);
const warmupSeconds = Number(process.env.SCALING_WARMUP_SECONDS ?? 15);
const prefix = process.argv[2] ?? '.run/multiplayer-scaling';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const distribution = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, mean: sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1),
    p50: sorted[Math.floor(sorted.length * .5)] ?? 0,
    p95: sorted[Math.floor(sorted.length * .95)] ?? 0, max: sorted.at(-1) ?? 0 };
};
const log = createWriteStream(`${prefix}-server.log`);
const server = fork(new URL('./scaling-server.mjs', import.meta.url), [], {
  execArgv: [], env: { ...process.env, SCALING_RELEASE_ROOT: releaseRoot, SCALING_PORT: String(port),
    NODE_ENV: 'production', ROCKET_ARENA_DEV_CONTROLS: 'false' }, silent: true,
});
server.stdout!.pipe(log, { end: false }); server.stderr!.pipe(log, { end: false });
const pending = new Map<number, (value: any) => void>(); let messageId = 0;
server.on('message', (message: any) => { if (message.id !== undefined) { pending.get(message.id)?.(message.value); pending.delete(message.id); } });
const ready = new Promise<void>((resolve, reject) => {
  server.on('message', (message: any) => { if (message.kind === 'ready') resolve(); });
  server.once('error', reject); server.once('exit', code => reject(new Error(`Benchmark server exited ${code}`)));
});
async function request(kind: string) {
  const id = ++messageId;
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Server ${kind} timed out`)); }, 5000);
    pending.set(id, value => { clearTimeout(timeout); resolve(value); }); server.send({ kind, id });
  });
}
const neutral: InputCommandV2 = { protocolVersion: 2, throttle: 0, steer: 0, pitch: 0, roll: 0, yaw: 0,
  jumpHeld: false, jumpSequence: 0, boostHeld: false, powerslideHeld: false, cameraToggleSequence: 0 };
type Bot = { room: Room; index: number; sequence: number; jumpSequence: number; jumping: boolean };
function drive(bot: Bot, frame: PredictionFrame | null, time: number): InputCommandV2 {
  const car = frame?.cars.find(car => car.sessionId === bot.room.sessionId);
  if (!car || !frame) return neutral;
  const q = car.rotation, fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  // Offset approaches slightly; every player pursues the same live ball.
  const dx = frame.ball.position.x + Math.sin(bot.index * 2.4) * .7 - car.position.x;
  const dz = frame.ball.position.z - car.position.z;
  const angle = Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz);
  const jumping = (time + bot.index * 1.3) % 11 > 10.85;
  if (jumping && !bot.jumping) bot.jumpSequence++;
  bot.jumping = jumping;
  const speed = Math.hypot(car.velocity.x, car.velocity.z);
  const reverse = speed < 2 && (time + bot.index) % 9 > 7.8;
  return { ...neutral, throttle: reverse ? -1 : 1,
    steer: Math.max(-1, Math.min(1, angle * 2)) * (reverse ? -1 : 1),
    jumpHeld: jumping, jumpSequence: bot.jumpSequence,
    boostHeld: !reverse && Math.abs(angle) < .35 && speed < 30,
    powerslideHeld: Math.abs(angle) > 1.1 };
}
class OrderedDelay {
  private due = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  constructor(private readonly latencyMs: number) {}
  send(fn: () => void, now: number) {
    if (!this.latencyMs) { fn(); return; }
    // Deterministic varying delay while retaining TCP delivery order.
    const jitter = Math.sin(now / 701) * 10;
    this.due = Math.max(this.due, now + this.latencyMs + jitter);
    const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, Math.max(0, this.due - performance.now()));
    this.timers.add(timer);
  }
  dispose() { for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); }
}

const cases = (process.env.SCALING_CASES ?? '2:60:0,8:60:0,8:60:0,2:60:0,2:30:50,8:30:50').split(',')
  .map(value => { const [players, cadence, oneWayMs] = value.split(':').map(Number); return { players, cadence, oneWayMs }; });
const output: any = { release: manifest.release, sourceSha256: manifest.sourceSha256,
  environment: { platform: process.platform, architecture: process.arch, logicalCpus: cpus().length },
  conditions: 'Isolated loopback published Colyseus backend; one production prediction worker reference client plus active non-predicting socket opponents; ball chasing, boost, powerslide and periodic jumps. Contact samples are actual Rapier manifolds, sampled every fourth server callback. No WebGL, camera, device FPS or remote-network proof. Client and backend share this VPS; other services may contend.',
  results: [] };
try {
  await Promise.race([ready, delay(15_000).then(() => { throw new Error('Server startup timed out'); })]);
  for (const scenario of cases) {
    assert.ok([2, 8].includes(scenario.players));
    const rooms: Room[] = [], queues: OrderedDelay[] = [];
    let lab: WorkerDrivingLab | null = null, thread: ReturnType<typeof nodeLabWorker>['thread'] | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      const client = new Client(`ws://127.0.0.1:${port}`);
      const host = await client.create('custom', { name: 'Reference' }); rooms.push(host);
      host.onMessage('*', () => {});
      let frame: PredictionFrame | null = null, previousFrame: PredictionFrame | null = null;
      let fullRoster = false;
      let measuring = false, ballSamples = 0, payloadBytes = 0, snapshots = 0, epochs = new Set<number>();
      const distance = new Map<string, number>(), ackStart = new Map<string, number>();
      host.onMessage('prediction-state', (next: PredictionFrame) => {
        if (!fullRoster) return;
        if (next.cars.length !== scenario.players) {
          assert.equal(measuring, false, 'roster must stay full throughout measurement');
          return;
        }
        if (measuring) {
          snapshots++; epochs.add(next.kickoffEpoch); payloadBytes += Buffer.byteLength(JSON.stringify(next));
          if (next.phase === 'playing' || next.phase === 'overtime') ballSamples++;
          if (previousFrame?.kickoffEpoch === next.kickoffEpoch) for (const car of next.cars) {
            const prior = previousFrame.cars.find(old => old.sessionId === car.sessionId);
            if (prior) distance.set(car.sessionId, (distance.get(car.sessionId) ?? 0)
              + Math.hypot(car.position.x - prior.position.x, car.position.y - prior.position.y, car.position.z - prior.position.z));
          }
        }
        previousFrame = next; frame = next;
      });
      // Let the roster reach its full size before accepting prediction frames.
      const bots: Bot[] = [{ room: host, index: 0, sequence: 0, jumpSequence: 0, jumping: false }];
      for (let index = 1; index < scenario.players; index++) {
        const room = await client.joinById(host.id, { name: `Opponent ${index}` }); rooms.push(room);
        room.onMessage('*', () => {}); bots.push({ room, index, sequence: 0, jumpSequence: 0, jumping: false });
      }
      fullRoster = true;
      const inbound = new OrderedDelay(scenario.oneWayMs), outbound = new OrderedDelay(scenario.oneWayMs);
      queues.push(inbound, outbound);
      const transport = {
        sessionId: host.sessionId,
        onMessage(type: string, fn: (value: any) => void) {
          return host.onMessage(type, value => inbound.send(() => fn(value), performance.now()));
        }, onLeave(fn: () => void) { return host.onLeave(fn); },
        send(type: string, value: any) { outbound.send(() => { if (host.connection.isOpen) host.send(type, value); }, performance.now()); },
      } as unknown as Room;
      lab = new WorkerDrivingLab(() => { const adapter = nodeLabWorker(); thread = adapter.thread; return adapter.port; });
      lab.setMode('predicted'); lab.attach(transport);
      host.send('start-match');
      const begin = performance.now(); let previous = begin, accumulator = 0;
      const frameIntervals: number[] = []; let eligibleMs = 0, activeMs = 0, pendingMax = 0, lagMax = 0;
      const age: number[] = [];
      timer = setInterval(() => {
        const now = performance.now(), dt = Math.max(0, now - previous); previous = now;
        const time = (now - begin) / 1000;
        lab!.update(transport, dt / 1000, drive(bots[0], frame, time), now);
        accumulator += Math.min(dt / 1000, PHYSICS.TIMESTEP * 3);
        for (let steps = 0; accumulator >= PHYSICS.TIMESTEP && steps < 3; steps++) {
          accumulator -= PHYSICS.TIMESTEP;
          for (const bot of bots.slice(1)) bot.room.send('lab-input', { sequence: ++bot.sequence, command: drive(bot, frame, time) });
        }
        accumulator %= PHYSICS.TIMESTEP;
        const debug = lab!.getDebugState();
        if (measuring && (frame?.phase === 'playing' || frame?.phase === 'overtime')) {
          eligibleMs += dt; if (debug.predictionActive) activeMs += dt;
          frameIntervals.push(dt); pendingMax = Math.max(pendingMax, debug.pending);
          lagMax = Math.max(lagMax, debug.predictionLagInputs);
          age.push(debug.predictionResultAgeMs);
        }
        assert.equal(debug.error, null); assert.ok(debug.pending <= 24);
      }, 1000 / scenario.cadence);
      await delay((warmupSeconds + 3.5) * 1000);
      assert.ok(frame, 'server snapshots arrived');
      assert.ok(lab.getDebugState().predictedCar, 'reference worker initialized');
      for (const car of (frame as unknown as PredictionFrame).cars) ackStart.set(car.sessionId, car.acknowledgedSequence);
      lab.exportTelemetry();
      await request('measure'); const measureStart = performance.now(); measuring = true;
      const startUtc = new Date().toISOString();
      console.log(JSON.stringify({ event: 'measuring', scenario, startUtc, seconds }));
      // Short waits allow progress reporting without interrupting the actual load.
      for (let elapsed = 0; elapsed < seconds;) {
        const chunk = Math.min(15, seconds - elapsed);
        await delay(chunk * 1000); elapsed += chunk;
        console.log(JSON.stringify({ event: 'progress', players: scenario.players,
          cadence: scenario.cadence, oneWayMs: scenario.oneWayMs, elapsedSeconds: elapsed,
          activePercent: eligibleMs ? 100 * activeMs / eligibleMs : 0, pendingMax }));
      }
      measuring = false; const duration = (performance.now() - measureStart) / 1000;
      const serverMetrics = await request('metrics');
      const telemetry = lab.exportTelemetry().filter(row => Date.parse(row.endedAtUtc) > Date.parse(startUtc));
      const physicsWindows = telemetry.filter(row => row.phase === 'playing' || row.phase === 'overtime');
      const sum = (key: keyof LabTelemetryWindow) => physicsWindows.reduce((n, row) => n + Number(row[key] ?? 0), 0);
      const dist = (key: 'replayMs' | 'localPhysicsMs' | 'carCorrectionMeters' | 'rotationCorrectionDegrees') => {
        const count = physicsWindows.reduce((n, row) => n + row[key].count, 0);
        return { count, mean: physicsWindows.reduce((n, row) => n + row[key].count * row[key].mean, 0) / (count || 1),
          max: Math.max(0, ...physicsWindows.map(row => row[key].max)) };
      };
      const recoveries = Object.fromEntries(['cpu_budget','input_backlog','server_stale','controls_released','mode_change','error']
        .map(key => [key, physicsWindows.reduce((n, row) => n + row.recoveryCounts[key as keyof typeof row.recoveryCounts], 0)]));
      const latest = frame as unknown as PredictionFrame;
      const activity = latest.cars.map(car => ({ index: bots.findIndex(bot => bot.room.sessionId === car.sessionId),
        distanceMeters: distance.get(car.sessionId) ?? 0, acknowledgedInputs: car.acknowledgedSequence - (ackStart.get(car.sessionId) ?? 0) }));
      assert.ok(activity.every(bot => bot.acknowledgedInputs > seconds * 20), 'all players delivered sustained controls');
      assert.ok(activity.every(bot => bot.distanceMeters > 10), 'all players actually moved');
      assert.ok(serverMetrics.carBallContactSamples > 0, 'workload includes real ball contact');
      const result = { ...scenario, durationSeconds: duration, startUtc, server: serverMetrics,
        reference: { eligibleSeconds: eligibleMs / 1000, predictionActivePercent: 100 * activeMs / eligibleMs,
          updateIntervalMs: distribution(frameIntervals), pendingMax, predictionLagMax: lagMax,
          resultAgeMs: distribution(age), recoveries, replayMs: dist('replayMs'), localPhysicsMs: dist('localPhysicsMs'),
          carCorrectionMeters: dist('carCorrectionMeters'), rotationCorrectionDegrees: dist('rotationCorrectionDegrees'),
          correctionsOver10cm: sum('carCorrectionsOver10cm'), correctionsOver50cm: sum('carCorrectionsOver50cm'),
          hardSnaps: sum('hardSnaps'), unalignedCorrections: sum('unalignedCorrections'),
          predictionChecks: sum('predictionChecks'), confirmedSnapshots: sum('confirmedSnapshots'),
          replayedSteps: sum('replayedSteps') },
        traffic: { snapshots, activePlaySnapshots: ballSamples, meanPredictionFrameJsonBytes: payloadBytes / snapshots,
          estimatedPredictionJsonBytesPerSecondPerClient: payloadBytes / duration, kickoffEpochs: epochs.size }, activity };
      output.results.push(result); writeFileSync(`${prefix}.json`, JSON.stringify(output, null, 2) + '\n');
      writeFileSync(`${prefix}-${output.results.length}-windows.json`, JSON.stringify(telemetry, null, 2) + '\n');
      console.log(JSON.stringify({ event: 'result', players: scenario.players, cadence: scenario.cadence, oneWayMs: scenario.oneWayMs,
        active: result.reference.predictionActivePercent, serverCoreMeanMs: serverMetrics.coreMs.mean,
        serverCpu: serverMetrics.cpuPercentOfOneCore, recoveries, carBallContacts: serverMetrics.carBallContactSamples,
        carCarContacts: serverMetrics.carCarContactSamples }));
    } finally {
      if (timer) clearInterval(timer); lab?.dispose(); for (const queue of queues) queue.dispose();
      for (const room of rooms.reverse()) await room.leave().catch(() => {});
      if (thread) await (thread as ReturnType<typeof nodeLabWorker>['thread']).terminate();
      await delay(500);
    }
  }
} finally {
  if (server.connected) server.disconnect();
  await new Promise<void>(resolve => { if (server.exitCode !== null || server.signalCode !== null) resolve(); else server.once('exit', () => resolve()); });
  log.end();
}
