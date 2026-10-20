import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClientTelemetryWindow } from '@rocket-arena/shared';
import { createClientMetricsHandler, createClientStallHandler, normalizeClientTelemetry, normalizeStallIncident } from './diagnostics.js';
import { CLIENT_STALL_SAMPLE_FIELDS, packClientStallIncident, type ClientStallIncident } from '@rocket-arena/shared';

function report(): ClientTelemetryWindow {
  const empty = { count: 0, mean: 0, p95Upper: 0, max: 0 };
  return { version: 2, release: 'test-release', runId: 'test-run', windowSequence: 1,
    windowMs: 20, endedAtUtc: '2026-10-12T18:00:00.000Z', endReason: 'periodic',
    mode: 'predicted', phase: 'goal-reset', players: 2, source: 'browser',
    visibility: 'visible', focused: true, width: 1280, height: 720, dpr: 1, cores: 8,
    fps: 50, rttMs: 0, pending: 0, ackLag: 0, recoveries: 1, frames: 1,
    frameMs: { count: 1, mean: 20, p95Upper: 20, max: 20 }, framesOver33ms: 0, framesOver50ms: 0,
    eligibleMs: 0, predictionActiveMs: 0, predictionActivePercent: 0,
    recoveryCounts: { cpu_budget: 0, input_backlog: 0, server_stale: 0, controls_released: 0, mode_change: 1, error: 0 },
    replayMs: empty, localPhysicsMs: empty, rtt: empty, snapshotGapMs: empty,
    pendingMax: 0, ackLagMax: 0, snapshotAgeMaxMs: 0, carCorrectionMeters: empty,
    ballCorrectionMeters: empty, rotationCorrectionDegrees: empty, carCorrectionsOver10cm: 0,
    carCorrectionsOver50cm: 0, hardSnaps: 0, correctionsNearBall: 0, correctionsNearCar: 0, rebases: 0,
    predictionChecks: 0, confirmedSnapshots: 0, skippedReplaySteps: 0, replayedSteps: 0, historyMisses: 0, historyMismatches: 0, catchupYields: 0, unalignedCorrections: 0, predictionLagMax: 0, predictionResultAgeMaxMs: 0, predictionSampleAgeMaxMs: 0 };
}

test('compact trace packets validate, decode and rate-limit independently of metric windows', () => {
  const sample = { ...Object.fromEntries(CLIENT_STALL_SAMPLE_FIELDS.map(key => [key,15])),reason:'result_stale' };
  const incident = {event:'fallback',targetGapMeters:.25,samples:[sample]} as ClientStallIncident;
  const wire = packClientStallIncident(incident);
  assert.deepEqual(normalizeStallIncident(wire),incident);
  assert.equal(normalizeStallIncident({...wire,samples:[[1,2]]}),null);
  const messages:Record<string, unknown>[]=[];
  const handler=createClientStallHandler('room', fields => messages.push(fields)),client={sessionId:'driver'};
  const packet={version:1,release:'test',runId:'run',windowSequence:1,incidentIndex:0,incident:wire};
  for(let i=0;i<20;i++)handler(client,packet);
  assert.equal(messages.length,4);
  assert.deepEqual(messages[0].incident,incident);
});

test('bounded diagnostic incident samples survive normalization while oversized and arbitrary payloads do not', () => {
  const sample = { timeMs: 100, tick: 5, sent: 8, acknowledged: 3, pending: 5, completed: 6,
    inputSendAgeMs: 10, ackAdvanceAgeMs: 50, snapshotAgeMs: 1, workerBusyMs: 2,
    resultAgeMs: 3, sampleAgeMs: 4, frameGapMs: 16, reason: 'active',serverCallbackGapMs:17,serverWorkMs:2,serverDroppedMs:0 };
  const incident = { event: 'input_backlog', targetGapMeters: .1, samples: [sample] };
  const input = { ...report(), carRendering:'batched', stallIncidents:[incident] };
  assert.deepEqual(normalizeClientTelemetry(input), input);
  assert.equal(normalizeClientTelemetry({ ...input, stallIncidents:Array(5).fill(incident) }), null);
  assert.equal(normalizeClientTelemetry({ ...input, stallIncidents:[{ ...incident, samples:Array(22).fill(sample) }] }), null);
  assert.equal(normalizeClientTelemetry({ ...input, stallIncidents:[{ ...incident, samples:[{ ...sample, workerBusyMs:Infinity }] }] }), null);
  assert.deepEqual(normalizeClientTelemetry({ ...input, stallIncidents:[{ ...incident, samples:[{ ...sample, secret:'discard' }] }] }), input);
});

test('structured telemetry accepts the window schema, rejects malformed fields, and strips unrecognized data', () => {
  const input = report();
  assert.deepEqual(normalizeClientTelemetry({ ...input, arbitrary: 'discard' }), input);
  assert.equal(normalizeClientTelemetry({ ...input, frameMs: { ...input.frameMs, max: NaN } }), null);
  assert.equal(normalizeClientTelemetry({ ...input, recoveryCounts: {} }), null);
  assert.equal(normalizeClientTelemetry({ ...input, predictionActivePercent: 101 }), null);
  assert.equal(normalizeClientTelemetry({ ...input, runId: 'x'.repeat(10_000) }), null);
  assert.equal(normalizeClientTelemetry({ ...input, confirmedSnapshots: NaN }), null);
  const legacy: Partial<ClientTelemetryWindow> = { ...input };
  for (const key of ['predictionChecks', 'confirmedSnapshots', 'skippedReplaySteps',
    'replayedSteps', 'historyMisses', 'historyMismatches', 'catchupYields', 'unalignedCorrections', 'predictionLagMax', 'predictionResultAgeMaxMs', 'predictionSampleAgeMaxMs'] as const) delete legacy[key];
  assert.equal(normalizeClientTelemetry(legacy), null);
});

test('diagnostics include authoritative occupancy and throttle context-change floods', () => {
  const messages: Record<string, any>[] = [];
  const handler = createClientMetricsHandler('room', () => 3, fields => messages.push(fields));
  const client = { sessionId: 'driver' };
  for (let i = 0; i < 100; i++) handler(client, report());
  assert.equal(messages.length, 10);
  const sample = messages[0];
  assert.equal(sample.serverPlayers, 3);
  assert.equal(sample.roomId, 'room');
  assert.equal(sample.release, 'test-release');
  assert.equal(sample.recoveryCounts.mode_change, 1);
});

test('client timings and graphics metadata are validated',()=>{
 const distribution={count:2,mean:4,p95Upper:6,max:6};
 const input={...report(),graphicsQuality:'low',renderScale:.7,ceilingEffect:'simple',clientTimings:{drawCallsMax:80,
  renderSubmitMs:distribution,sceneEffectsMs:distribution,presentationMs:distribution,
  hudAudioMs:distribution,workerRoundTripMs:distribution,poseAgeMs:distribution}};
 assert.deepEqual(normalizeClientTelemetry(input),input);
 assert.equal(normalizeClientTelemetry({...input,renderScale:0}),null);
 assert.equal(normalizeClientTelemetry({...input,ceilingEffect:'unknown'}),null);
 assert.equal(normalizeClientTelemetry({...input,graphicsQuality:'unknown'}),null);
 assert.equal(normalizeClientTelemetry({...input,clientTimings:{...input.clientTimings,poseAgeMs:{...distribution,max:Infinity}}}),null);
 assert.deepEqual(normalizeClientTelemetry({...report()}),report());
});

test('presentation metadata survives normalization and rejects invalid values', () => {
 const input={...report(),timingProfile:'buffer',inputClock:'render',poseBufferMs:50};
 assert.deepEqual(normalizeClientTelemetry(input),input);
 assert.equal(normalizeClientTelemetry({...input,timingProfile:'invalid'}),null);
 assert.equal(normalizeClientTelemetry({...input,inputClock:'invalid'}),null);
 assert.equal(normalizeClientTelemetry({...input,poseBufferMs:200}),null);
});

test('language and player-label metadata is bounded', () => {
 const input={...report(),uiLanguage:'he',playerLabels:true};
 assert.deepEqual(normalizeClientTelemetry(input),input);
 assert.equal(normalizeClientTelemetry({...input,uiLanguage:'other'}),null);
 assert.equal(normalizeClientTelemetry({...input,playerLabels:1}),null);
});
