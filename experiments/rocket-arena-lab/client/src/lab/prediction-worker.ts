import type { Room } from 'colyseus.js';
import { DrivingLab } from './prediction.js';
import type { LabTelemetryOperation } from './telemetry.js';
import type { WorkerRequest, WorkerResponse } from './worker-protocol.js';

// No rendering, DOM or WebSocket ownership here. Only one bounded physics slice
// runs at once; MessageChannel gives new controls/snapshots a turn between slices.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};
const lab = new DrivingLab();
let generation = 0, revision = 0;
let room: Room | null = null;
let pong: ((value: number) => void) | null = null;
let operations: LabTelemetryOperation[] = [];
lab.observePhysics(operation => operations.push(operation));
const channel = new MessageChannel();
let scheduled = false;
function publish(requestId?: number): void {
  if (!room) { operations = []; return; }
  scope.postMessage({ kind: 'state', generation, revision, requestId,
    debug: lab.getDebugState(), presentation: lab.presentationState,
    completedAtAbsoluteMs: performance.timeOrigin + lab.presentationState.completedAtMs,
    operations });
  operations = [];
}
function schedule(): void {
  if (room && lab.needsContinuation && !scheduled) {
    scheduled = true;
    channel.port2.postMessage(null);
  }
}
channel.port1.onmessage = () => {
  scheduled = false;
  if (!room) return;
  lab.continuePrediction(performance.now());
  publish();
  schedule();
};
let autonomous = false;
let currentCommand: Extract<WorkerRequest,{kind:'drive'}>['command'] | null = null;
let controlsAt = 0;
let leaseNeutralized = false;
let lastClockAt = 0;
let clock: ReturnType<typeof setInterval> | null = null;
function stopClock(): void { if (clock !== null) clearInterval(clock); clock = null; }
function startClock(): void {
  if (!autonomous || !room || !currentCommand || clock !== null) return;
  if (performance.timeOrigin+performance.now()-controlsAt>200) {
    if (!leaseNeutralized) lab.neutralize(currentCommand);
    leaseNeutralized=true;publish();return;
  }
  lastClockAt = performance.now();
  clock = setInterval(() => {
    const now = performance.now();
    if (!room || !currentCommand) { stopClock(); return; }
    // A stalled/hidden parent cannot keep old controls alive indefinitely.
    if (performance.timeOrigin+now-controlsAt > 200) {
      if(!leaseNeutralized)lab.neutralize(currentCommand);leaseNeutralized=true;publish();stopClock();return;
    }
    const phase=lab.presentationState.phase;
    if(phase !== 'playing' && phase !== 'overtime'){lastClockAt=now;return;}
    const dt = Math.max(0,(now-lastClockAt)/1_000);lastClockAt = now;
    lab.update(room,dt,currentCommand,now);publish();schedule();
  },1_000/60);
}
function neutralCommand(command: NonNullable<typeof currentCommand>) {
  return { ...command,throttle:0,steer:0,pitch:0,roll:0,yaw:0,jumpHeld:false,boostHeld:false,powerslideHeld:false };
}
scope.onmessage = ({ data }) => {
  if (data.kind === 'clock') {
    autonomous = data.enabled; if (!autonomous) stopClock(); else startClock();
  } else if (data.kind === 'attach') {
    stopClock();currentCommand=null;leaseNeutralized=false;
    generation = data.generation; revision = data.revision;
    const transport = { sessionId: data.sessionId,
      onMessage(type: string, handler: (value: number) => void) { if (type === 'lab-pong') pong = handler; },
      onLeave() {}, send(message: string, value: unknown) {
        if (message !== 'lab-stats') scope.postMessage({ kind: 'send', generation, message, value });
      } } as unknown as Room;
    room = transport;
    lab.attach(room);
    lab.seedSequence(data.sequence);
    lab.setMode(data.mode);
    publish();
  } else if (data.kind === 'detach') {
    stopClock();currentCommand=null;leaseNeutralized=false;generation = data.generation; room = null; pong = null;
    lab.detach(); operations = [];
  } else if (data.generation === generation && room) {
    if (data.kind === 'mode' || data.kind === 'neutral') {
      revision = data.revision;
      if (data.kind === 'mode') lab.setMode(data.mode);
      else { leaseNeutralized=true;currentCommand=neutralCommand(data.command);controlsAt=performance.timeOrigin+performance.now();lab.neutralize(data.command); }
      publish();
    } else if (data.kind === 'pong') {
      pong?.(data.value); publish();
    } else if (data.kind === 'drive') {
      if (data.revision === revision) {
        if (data.frame) lab.receiveFrame(data.frame, data.frameAtAbsoluteMs - performance.timeOrigin);
        controlsAt=data.controlsAtAbsoluteMs ?? data.nowAbsoluteMs;
        const expired=autonomous && performance.timeOrigin+performance.now()-controlsAt>200;
        currentCommand = expired ? neutralCommand(data.command) : data.command;
        if(expired && !leaseNeutralized){lab.neutralize(currentCommand);leaseNeutralized=true;}
        if(!expired)leaseNeutralized=false;
        lab.update(room, autonomous ? 0 : data.deltaSeconds, currentCommand, data.nowAbsoluteMs - performance.timeOrigin);
        startClock();
      }
      // Even superseded work must release the parent's single-slot mailbox.
      publish(data.requestId);
    }
  }
  schedule();
};
