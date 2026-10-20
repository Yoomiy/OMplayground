import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClientTelemetryContext } from '@rocket-arena/shared';
import { ClientTelemetry } from '../src/prediction/telemetry.js';

const context: ClientTelemetryContext = { mode: 'predicted', phase: 'playing', players: 2,
  source: 'browser', visibility: 'visible', focused: true, width: 1280, height: 720, dpr: 1, cores: 8 };

test('time-weighted active percentage and real frame intervals survive ten-second aggregation', () => {
  const metrics = new ClientTelemetry('test-run', 'test-release');
  metrics.configure(context, 0);
  metrics.frameSample(500, true); // Cross-boundary frame excluded.
  metrics.frameSample(10, true);
  metrics.frameSample(30, false);
  metrics.frameSample(60, false);
  metrics.recovery('cpu_budget');
  metrics.recovery('controls_released');
  metrics.replaySample(9.4);
  metrics.localPhysicsSample(2.2);
  const window = metrics.flush(10_000, 'periodic')!;
  assert.equal(window.frames, 3);
  assert.equal(window.fps, 30);
  assert.equal(window.predictionActivePercent, 10);
  assert.equal(window.eligibleMs, 100);
  assert.equal(window.framesOver50ms, 1);
  assert.equal(window.frameMs.p95Upper, 60);
  assert.equal(window.recoveryCounts.cpu_budget, 1);
  assert.equal(window.recoveryCounts.controls_released, 1);
  assert.equal(window.replayMs.p95Upper, 10);
  metrics.frameSample(20, true);
  const next = metrics.flush(20_000, 'periodic')!;
  assert.equal(next.recoveryCounts.cpu_budget, 0);
  assert.equal(next.replayMs.count, 0);
});

test('mode, focus, visibility, phase and player-count changes separate measurement windows', () => {
  const metrics = new ClientTelemetry('test-run', 'test-release');
  metrics.configure(context, 0);
  metrics.frameSample(10, true);
  metrics.frameSample(10, true);
  const foreground = metrics.configure({ ...context, focused: false }, 20)!;
  assert.equal(foreground.focused, true);
  metrics.frameSample(5_000, true);
  metrics.frameSample(100, true);
  const unfocused = metrics.configure({ ...context, visibility: 'hidden', focused: false }, 5_120)!;
  assert.equal(unfocused.eligibleMs, 0);
  assert.equal(unfocused.frameMs.max, 100);
  metrics.frameSample(100, true);
  metrics.frameSample(100, true);
  const hidden = metrics.configure({ ...context, mode: 'server', phase: 'countdown', players: 1 }, 5_320)!;
  assert.equal(hidden.visibility, 'hidden');
  assert.equal(hidden.predictionActivePercent, 0);
  metrics.frameSample(100, false);
  metrics.frameSample(100, false);
  const countdown = metrics.flush(5_520, 'export')!;
  assert.equal(countdown.mode, 'server');
  assert.equal(countdown.phase, 'countdown');
  assert.equal(countdown.players, 1);
  assert.equal(countdown.eligibleMs, 0);
});

test('correction distributions retain large events and contextual counts even if the last event is tiny', () => {
  const metrics = new ClientTelemetry('test-run', 'test-release');
  metrics.configure(context, 0);
  metrics.correction(.2, .3, 5, true, false);
  metrics.correction(4, 5, 45, false, true);
  metrics.correction(.01, 0, 0, false, false);
  metrics.rebase();
  const report = metrics.flush(100, 'periodic')!;
  assert.equal(report.carCorrectionMeters.count, 3);
  assert.equal(report.carCorrectionMeters.max, 4);
  assert.equal(report.ballCorrectionMeters.max, 5);
  assert.equal(report.carCorrectionsOver10cm, 2);
  assert.equal(report.carCorrectionsOver50cm, 1);
  assert.equal(report.hardSnaps, 1);
  assert.equal(report.correctionsNearBall, 1);
  assert.equal(report.correctionsNearCar, 1);
  assert.equal(report.rebases, 1);
});

test('node automation is labelled and has no foreground active percentage; history is bounded and export is detached', () => {
  const metrics = new ClientTelemetry('test-run', 'test-release');
  metrics.configure({ ...context, source: 'node', focused: false, visibility: 'none' }, 0);
  metrics.frameSample(10, true);
  for (let i = 1; i <= 150; i++) {
    metrics.frameSample(10, true);
    metrics.flush(i * 10, 'periodic');
  }
  const exported = metrics.export();
  assert.equal(exported.length, 120);
  assert.equal(exported[0].eligibleMs, 0);
  assert.equal(exported[0].predictionActivePercent, 0);
  exported[119].frameMs.max = 999;
  assert.equal(metrics.latest!.frameMs.max, 10);
});

test('worker cost events preserve render samples and expose yields, lag, age and unaligned corrections', () => {
  const metrics=new ClientTelemetry('worker-run','worker-release');
  metrics.configure(context,0);
  metrics.frameSample(33,true);metrics.frameSample(33,true);metrics.frameSample(33,false);
  metrics.replaySample(10);metrics.localPhysicsSample(5);metrics.catchupYield();metrics.unalignedCorrection();
  metrics.workerGauge(4,80);metrics.workerGauge(2,30);
  const first=metrics.flush(100,'periodic')!;
  assert.equal(first.frames,2);
  assert.equal(first.replayMs.mean,10);
  assert.equal(first.catchupYields,1);assert.equal(first.unalignedCorrections,1);
  assert.equal(first.predictionLagMax,4);assert.equal(first.predictionResultAgeMaxMs,80);
  assert.equal(first.predictionActivePercent,50);assert.equal(first.recoveryCounts.cpu_budget,0);
  metrics.frameSample(33,true);
  const second=metrics.flush(133,'periodic')!;
  assert.equal(second.catchupYields,0);assert.equal(second.predictionLagMax,0);
});

test('graphics changes separate timing windows and client timings reset cleanly',()=>{
 const m=new ClientTelemetry('timing-run','timing-build');
 m.configure({...context,graphicsQuality:'standard',renderScale:1},0);
 m.frameSample(10,true);m.frameSample(20,true);
 m.clientSample('renderSubmitMs',6);m.clientSample('renderSubmitMs',10);
 m.clientSample('workerRoundTripMs',15);m.drawCalls(220);
 const standard=m.configure({...context,graphicsQuality:'low',renderScale:.7},30)!;
 assert.equal(standard.graphicsQuality,'standard');assert.equal(standard.clientTimings!.renderSubmitMs.mean,8);
 assert.equal(standard.clientTimings!.drawCallsMax,220);
 m.frameSample(20,true);m.frameSample(20,true);m.clientSample('renderSubmitMs',4);m.drawCalls(80);
 const low=m.flush(70,'export')!;
 assert.equal(low.graphicsQuality,'low');assert.equal(low.renderScale,.7);
 assert.equal(low.clientTimings!.renderSubmitMs.mean,4);assert.equal(low.clientTimings!.workerRoundTripMs.count,0);
 assert.equal(low.clientTimings!.drawCallsMax,80);
});
