import assert from 'node:assert/strict';
import test from 'node:test';
import { CLIENT_STALL_SAMPLE_FIELDS, packClientStallIncident, type ClientStallSample } from '@rocket-arena/shared';
import { Room } from 'colyseus.js';
import { StallRecorder } from '../src/prediction/stall-recorder.js';
import { ClientTelemetry } from '../src/prediction/telemetry.js';

const sample = (timeMs: number): ClientStallSample => ({ timeMs, tick: 500, sent: 200,
  acknowledged: 176, pending: 24, completed: 190, inputSendAgeMs: 3, ackAdvanceAgeMs: 400,
  snapshotAgeMs: 10, workerBusyMs: 120, resultAgeMs: 200, sampleAgeMs: 250,
  frameGapMs: 16, reason: 'result_stale', serverCallbackGapMs:17,serverWorkMs:2,serverDroppedMs:0 });

test('maximum incident fits the native 4 KB transport using the actual Colyseus encoder', () => {
  const worst = { ...Object.fromEntries(CLIENT_STALL_SAMPLE_FIELDS.map(key => [key,1_000_000_000])),reason:'worker_unready' } as ClientStallSample;
  const incident = { event:'prediction_resumed' as const,targetGapMeters:1_000_000_000,samples:Array(21).fill(worst) };
  const room = new Room('test');let size=0;
  room.connection = { send(bytes:ArrayBuffer) {size=bytes.byteLength;} } as never;
  room.send('client-stall',{version:1,release:'x'.repeat(96),runId:'x'.repeat(96),windowSequence:1_000_000_000,
    incidentIndex:3,incident:packClientStallIncident(incident)});
  assert.ok(size < 4_096, `packet used ${size} bytes`);
});

test('incident traces bound sampling, history, event rate and reset between rooms', () => {
  const recorder = new StallRecorder();
  for (let ms = 0; ms <= 10_000; ms += 1) recorder.sample(sample(ms));
  const incident = recorder.capture('input_backlog', sample(10_001))!;
  assert.equal(incident.samples.length, 21);
  assert.ok(incident.samples.every(value => value.timeMs >= 8_001));
  assert.equal(incident.samples.at(-1)!.pending, 24);
  assert.equal(recorder.capture('input_backlog', sample(10_002)), null);
  assert.ok(recorder.capture('fallback', sample(10_002)), 'handoffs do not suppress backlog traces');
  assert.ok(recorder.capture('prediction_resumed', sample(12_001), .5));
  recorder.reset();
  assert.equal(recorder.capture('fallback', sample(12_002))!.samples.length, 1);
});

test('incident-only windows export and reset with a maximum of four traces', () => {
  const telemetry = new ClientTelemetry('trace-run', 'trace-release');
  telemetry.configure({ mode:'predicted',phase:'playing',players:8,source:'browser',visibility:'visible',
    focused:true,width:800,height:600,dpr:1,cores:2 }, 0);
  for (let i = 0; i < 20; i++) telemetry.stallIncident({ event:'fallback',targetGapMeters:0,samples:[sample(i)] });
  const first = telemetry.flush(1_000, 'periodic')!;
  assert.equal(first.stallIncidents!.length, 4);
  assert.equal(telemetry.flush(2_000, 'periodic'), null);
  telemetry.stallIncident({ event:'prediction_resumed',targetGapMeters:.1,samples:[sample(3_000)] });
  assert.equal(telemetry.flush(3_001, 'export')!.stallIncidents!.length, 1);
  assert.equal(telemetry.export()[0].stallIncidents!.length, 4);
});
