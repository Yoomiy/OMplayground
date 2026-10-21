import type { Room } from 'colyseus.js';
import { ClientPrediction } from './prediction.js';
import type { ClientTelemetryOperation } from './telemetry.js';
import type { WorkerRequest, WorkerResponse } from './worker-protocol.js';

// No rendering, DOM or WebSocket ownership here. Only one bounded physics slice
// runs at once; MessageChannel gives new controls/snapshots a turn between slices.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};
const prediction = new ClientPrediction();
let generation = 0, revision = 0;
let room: Room | null = null;
let pong: ((value: number) => void) | null = null;
let operations: ClientTelemetryOperation[] = [];
prediction.observePhysics(operation => operations.push(operation));
const channel = new MessageChannel();
let scheduled = false;
function publish(requestId?: number): void {
  if (!room) { operations = []; return; }
  scope.postMessage({ kind: 'state', generation, revision, requestId,
    debug: prediction.getDebugState(), presentation: prediction.presentationState,
    completedAtAbsoluteMs: performance.timeOrigin + prediction.presentationState.completedAtMs,
    operations });
  operations = [];
}
function schedule(): void {
  if (room && prediction.needsContinuation && !scheduled) {
    scheduled = true;
    channel.port2.postMessage(null);
  }
}
channel.port1.onmessage = () => {
  scheduled = false;
  if (!room) return;
  prediction.continuePrediction(performance.now());
  publish();
  schedule();
};
scope.onmessage = ({ data }) => {
  if (data.kind === 'attach') {
    generation = data.generation; revision = data.revision;
    const transport = { sessionId: data.sessionId,
      onMessage(type: string, handler: (value: number) => void) { if (type === 'latency-pong') pong = handler; },
      onLeave() {}, send(message: string, value: unknown) {
        if (message !== 'client-metrics') scope.postMessage({ kind: 'send', generation, message, value });
      } } as unknown as Room;
    room = transport;
    prediction.attach(room);
    prediction.seedSequence(data.sequence);
    prediction.setMode(data.mode);
    publish();
  } else if (data.kind === 'detach') {
    generation = data.generation; room = null; pong = null;
    prediction.detach(); operations = [];
  } else if (data.generation === generation && room) {
    if (data.kind === 'mode' || data.kind === 'neutral') {
      revision = data.revision;
      if (data.kind === 'mode') prediction.setMode(data.mode);
      else prediction.neutralize(data.command);
      publish();
    } else if (data.kind === 'pong') {
      pong?.(data.value); publish();
    } else if (data.kind === 'drive') {
      if (data.revision === revision) {
        if (data.frame) prediction.receiveFrame(data.frame, data.frameAtAbsoluteMs - performance.timeOrigin);
        prediction.update(room, data.deltaSeconds, data.command, data.nowAbsoluteMs - performance.timeOrigin);
      }
      // Even superseded work must release the parent's single-slot mailbox.
      publish(data.requestId);
    }
  }
  schedule();
};
