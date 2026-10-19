import { getLocalActorId } from '../networking/client.js';
import { PHYSICS, packLabStallIncident, type InputCommandV2, type LabClientTimingName, type LabTelemetryWindow, type LabStallSample, type LabStallIncident, type LabPresentationReason } from '@rocket-arena/shared';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import type { Room } from 'colyseus.js';
import * as THREE from 'three';
import { LabTelemetry } from './telemetry.js';
import { PresentationFilter } from './presentation-filter.js';
import { StallRecorder } from './stall-recorder.js';
import { useBatchedCars } from '../renderer/car.js';
import { language } from '../ui/i18n.js';
import { playerLabelsEnabled } from '../hud/player-labels.js';
import type { TimingProfileName } from './timing-profile.js';
import type { DrivingMode } from './prediction.js';
import type { WorkerRequest, WorkerResponse, PredictionDebugState, PredictionPresentation } from './worker-protocol.js';

export type LabWorker = Pick<Worker, 'postMessage' | 'onmessage' | 'onerror' | 'terminate'>;
const STORAGE_KEY = 'rocket-arena-lab-mode-v1';
const MAX_RESULT_AGE_MS = 150;
const absoluteNow = () => performance.timeOrigin + performance.now();

/** Browser transport/presentation only. Rapier and replay live in the worker. */
export class WorkerDrivingLab {
  private stalls = new StallRecorder();
  private inputSentAt = 0;
  private ackAdvancedAt = 0;
  private previousAck = 0;
  private lastFrameGapMs = 0;
  private presentedActive: boolean | null = null;
  private readonly carRendering = useBatchedCars() ? 'batched' : 'original';
  private readonly playerLabels = playerLabelsEnabled();
  private worker: LabWorker | null;
  private disposed = false;
  private autonomous = false;
  private inputTimer: ReturnType<typeof setInterval> | null = null;
  private inputSample: (() => void) | null = null;
  private room: Room | null = null;
  private roomSubscriptions: (() => void)[] = [];
  private generation = 0;
  private revision = 0;
  private requestId = 0;
  private inFlight: number | null = null;
  private sentAt = 0;
  private graphicsQuality: 'standard' | 'low' = 'standard';
  private renderScale = 1;
  private shadows = false;
  private ceilingEffect: 'simple' | 'glass' = 'simple';
  setGraphicsQuality(low: boolean, scale: number, shadows=false, refractiveCeiling=false): void {
    this.graphicsQuality=low?'low':'standard';this.renderScale=scale;this.shadows=shadows;
    this.ceilingEffect=refractiveCeiling?'glass':'simple';this.refreshTelemetryContext();
  }
  clientSample(name: LabClientTimingName, ms: number): void { this.telemetry.clientSample(name,ms); }
  drawCalls(calls: number): void { this.telemetry.drawCalls(calls); }
  private queuedDelta = 0;
  private queuedUpdate = false;
  private command: Readonly<InputCommandV2> | null = null;
  private commandAt = 0;
  private queuedFrame: PredictionFrame | null = null;
  private frameAtAbsoluteMs = 0;
  private lastFrame: PredictionFrame | null = null;
  private debug: PredictionDebugState | null = null;
  private presentation: PredictionPresentation | null = null;
  private completedAtAbsoluteMs = 0;
  private sampledAtAbsoluteMs = 0;
  private carFilter: PresentationFilter;
  private ballFilter: PresentationFilter;
  readonly poseBufferMs: 0 | 50;
  get timingProfile(): TimingProfileName {
    return this.autonomous ? (this.poseBufferMs > 0 ? 'combined' : 'clock')
      : (this.poseBufferMs > 0 ? 'buffer' : 'baseline');
  }
  private presentationContext: string | null = null;
  private lastSentSequence = 0;
  private sequences = new WeakMap<Room,number>();
  private fallbackAccumulator = 0;
  private pingSentAt = 0;
  private choice: DrivingMode = 'predicted';
  private error: string | null = null;
  private frameRate = 0;
  private fallbackRtt = 0;
  private snapshotCount = 0;
  private telemetry = new LabTelemetry(globalThis.crypto?.randomUUID?.() ?? `run-${Date.now()}-${Math.random().toString(36).slice(2)}`, import.meta.env?.VITE_LAB_RELEASE ?? 'development');

  constructor(factory: () => LabWorker = () => new Worker(new URL('./prediction-worker.ts', import.meta.url), { type: 'module' }),
    options: { poseBufferMs?: 0 | 50 } = {}) {
    this.poseBufferMs = options.poseBufferMs ?? 50;
    this.carFilter = new PresentationFilter(this.poseBufferMs);
    this.ballFilter = new PresentationFilter(this.poseBufferMs);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'original' || stored === 'shorter' || stored === 'predicted') this.choice = stored;
    } catch { /* Optional. */ }
    this.worker = null;
    try {
      this.worker = factory();
      this.worker.onmessage = event => this.receive(event.data as WorkerResponse);
      this.worker.onerror = event => { event.preventDefault(); this.workerFailed(); };
    } catch { this.workerFailed(); }
  }

  private post(message: WorkerRequest): void { this.worker?.postMessage(message); }
  private workerFailed(): void {
    if (this.disposed) return;
    this.telemetry.recovery('error');
    this.emit(this.telemetry.flush(performance.now(), 'context_change'));
    this.worker?.terminate(); this.worker = null;this.generation++;
    this.choice = 'shorter'; this.error = 'Prediction worker unavailable; using server movement';
    this.inFlight = null; this.queuedUpdate = false; this.queuedDelta = 0;
    this.presentation = null;
    this.refreshTelemetryContext();
  }

  private receive(message: WorkerResponse): void {
    if (this.disposed || !this.room || message.generation !== this.generation) return;
    if (message.kind === 'send') {
      if (message.message === 'lab-input' || message.message === 'lab-neutral') {
        const input = message.value as { sequence: number };
        this.lastSentSequence = Math.max(this.lastSentSequence, input.sequence);
        this.sequences.set(this.room,this.lastSentSequence);
      }
      if (this.room.connection?.isOpen !== false) {
        try {
          this.room.send(message.message, message.value);
          if (message.message === 'lab-input' || message.message === 'lab-neutral') this.inputSentAt = absoluteNow();
        } catch { /* Closing room. */ }
      }
      return;
    }
    // A mode/control change can supersede the reply which frees the mailbox.
    if (message.requestId !== undefined && message.requestId === this.inFlight) {
      this.telemetry.clientSample('workerRoundTripMs',Math.max(0,absoluteNow()-this.sentAt));this.inFlight=null;
    }
    if (message.revision === this.revision) {
      for (const operation of message.operations) {
        (this.telemetry[operation.method] as (...args: any[]) => void)(...operation.args);
      }
      this.debug = message.debug;
      if (message.debug.error) {
        this.error = message.debug.error; this.choice = message.debug.mode;
        this.refreshTelemetryContext();
      }
      this.presentation = message.presentation;
      this.completedAtAbsoluteMs = message.completedAtAbsoluteMs;
      this.sampledAtAbsoluteMs = message.completedAtAbsoluteMs
        + ((message.presentation.sampledAtMs ?? message.presentation.completedAtMs)-message.presentation.completedAtMs);
      for (const operation of message.operations) {
        if (operation.method === 'recovery' && ['input_backlog', 'server_stale', 'error'].includes(operation.args[0])) {
          this.recordStall(operation.args[0] as LabStallIncident['event']);
        }
      }
      if(this.poseBufferMs > 0 && this.isActive && this.lastFrame){
        const context=`${this.generation}:${this.lastFrame.phase}:${this.lastFrame.kickoffEpoch}`;
        if(context!==this.presentationContext){this.resetPresentation();this.presentationContext=context;}
        this.carFilter.push(this.presentation.car!,this.sampledAtAbsoluteMs);
        if(this.presentation.ball)this.ballFilter.push(this.presentation.ball,this.sampledAtAbsoluteMs);
      }
    }
    this.pump();
  }

  attach(room: Room): void {
    if (this.disposed) return;
    if (this.room === room) return;
    this.detach(); this.room = room; this.ackAdvancedAt = absoluteNow();
    this.lastSentSequence = this.sequences.get(room) ?? 0;
    this.debug = null;
    this.post({ kind: 'attach', generation: this.generation, revision: this.revision,
      sessionId: getLocalActorId(room), sequence: this.lastSentSequence, mode: this.choice });
    const stopPrediction = room.onMessage('prediction-state', (frame: PredictionFrame) => {
      if (this.room !== room || frame?.version !== 1 || !Number.isSafeInteger(frame.tick)
        || frame.tick <= (this.lastFrame?.tick ?? -1) || !Array.isArray(frame.cars)
        || frame.cars.length > 8 || !frame.cars.some(car => car.sessionId === getLocalActorId(room))) return;
      const received = absoluteNow();
      if (this.frameAtAbsoluteMs) this.telemetry.snapshot(received - this.frameAtAbsoluteMs);
      this.lastFrame = frame; this.queuedFrame = frame; this.frameAtAbsoluteMs = received;
      const ack = frame.cars.find(car => car.sessionId === getLocalActorId(room))!.acknowledgedSequence;
      if (ack !== this.previousAck) { this.previousAck = ack; this.ackAdvancedAt = received; }
      this.snapshotCount++;
      this.refreshTelemetryContext();
      this.pump();
    });
    const stopPong = room.onMessage('lab-pong', (value: number) => {
      if (this.room !== room) return;
      if (this.worker) this.post({ kind: 'pong', generation: this.generation, value });
      else {
        this.fallbackRtt = Math.max(0, performance.now() - value);
        this.telemetry.ping(this.fallbackRtt);
      }
    });
    const onLeave = () => { if (this.room === room) this.detach(); };
    room.onLeave(onLeave);
    this.roomSubscriptions = [stopPrediction, stopPong].filter((stop): stop is () => void => typeof stop === 'function');
    this.roomSubscriptions.push(() => room.onLeave.remove?.(onLeave));
    this.refreshTelemetryContext();
  }

  private pump(): void {
    if (!this.worker || !this.room || this.inFlight !== null || !this.command
      || (!this.queuedUpdate && !this.queuedFrame)) return;
    const requestId = ++this.requestId;
    this.inFlight = requestId;this.sentAt=absoluteNow();
    this.post({ kind: 'drive', generation: this.generation, revision: this.revision, requestId,
      frame: this.queuedFrame, frameAtAbsoluteMs: this.frameAtAbsoluteMs,
      deltaSeconds: this.queuedDelta, nowAbsoluteMs: absoluteNow(), controlsAtAbsoluteMs:this.commandAt, command: this.command });
    this.queuedFrame = null; this.queuedUpdate = false; this.queuedDelta = 0;
  }

  update(room: Room | null, deltaSeconds: number, command: Readonly<InputCommandV2>, nowMs: number): void {
    if (this.disposed) return;
    if (!room) { if (this.room) this.detach(); return; }
    if (room !== this.room) this.attach(room);
    this.lastFrameGapMs = Math.max(0, deltaSeconds * 1_000);
    this.refreshTelemetryContext(nowMs);
    this.telemetry.frameSample(deltaSeconds*1_000, this.isActive);
    if (deltaSeconds > 0) this.frameRate += (1/deltaSeconds-this.frameRate)*Math.min(1,deltaSeconds*3);
    if (!this.autonomous) this.driveControls(deltaSeconds,command,nowMs);
    if(this.presentation?.car)this.telemetry.clientSample('poseAgeMs',Math.max(0,absoluteNow()-this.sampledAtAbsoluteMs));
    const stats = this.getDebugState();
    this.telemetry.gauge(stats.rttMs, stats.pending, Math.max(0, stats.sequence-stats.acknowledgedSequence),
      stats.recoveries, this.lastFrame ? Math.max(0,absoluteNow()-this.frameAtAbsoluteMs) : 0);
    this.telemetry.workerGauge(stats.predictionLagInputs, this.presentation?.car
      ? Math.max(0,absoluteNow()-this.completedAtAbsoluteMs) : 0, this.presentation?.car
      ? Math.max(0,absoluteNow()-this.sampledAtAbsoluteMs) : 0);
    if (this.stalls.due(performance.now())) this.stalls.sample(this.stallSample());
    if (this.telemetry.due(nowMs)) this.emit(this.telemetry.flush(nowMs,'periodic'));
  }

  private driveControls(deltaSeconds: number, command: Readonly<InputCommandV2>, nowMs: number): void {
    const room = this.room; if (!room) return;
    this.command = { ...command };this.commandAt=performance.timeOrigin+nowMs;
    if (this.worker) {
      // One request in flight, one newest frame, and at most three current input
      // ticks queued. Rendering/worker stalls cannot accumulate message floods.
      this.queuedDelta = Math.min(PHYSICS.TIMESTEP*3, this.queuedDelta + Math.max(0,deltaSeconds));
      this.queuedUpdate = true;
      this.pump();
    } else if (this.lastFrame) {
      this.fallbackAccumulator += Math.min(PHYSICS.TIMESTEP*3, Math.max(0,deltaSeconds));
      let steps = 0;
      while (this.fallbackAccumulator >= PHYSICS.TIMESTEP && steps++ < 3) {
        this.fallbackAccumulator -= PHYSICS.TIMESTEP;
        room.send('lab-input', { sequence: ++this.lastSentSequence, command });
        this.inputSentAt = absoluteNow();
      }
      this.sequences.set(room,this.lastSentSequence);
      this.fallbackAccumulator %= PHYSICS.TIMESTEP;
      if (nowMs-this.pingSentAt>1_000) { room.send('lab-ping',nowMs); this.pingSentAt=nowMs; }
    }
  }

  /** Input heartbeats and worker physics continue independently of rendered frames. */
  startInputClock(readRoom: () => Room | null, readCommand: () => Readonly<InputCommandV2>, active = () => true): void {
    if (this.disposed) return;
    this.stopInputClock();this.autonomous=true;this.post({kind:'clock',enabled:true});
    let previous=performance.now();
    this.inputSample=()=>{
      const room=readRoom();const now=performance.now();const dt=Math.max(0,(now-previous)/1_000);previous=now;
      if (!room || room.connection?.isOpen === false) { if(this.room)this.detach();return; }
      if(room!==this.room)this.attach(room);
      if (!active()) return;
      this.driveControls(this.worker?0:dt,readCommand(),now);
    };
    this.inputTimer=setInterval(()=>this.inputSample?.(),1_000/30);
    this.inputSample();
    this.refreshTelemetryContext();
  }
  sampleInputs(): void { this.inputSample?.(); }
  stopInputClock(): void {
    if(this.inputTimer!==null)clearInterval(this.inputTimer);
    this.inputTimer=null;this.inputSample=null;this.autonomous=false;
    this.post({kind:'clock',enabled:false});
    this.refreshTelemetryContext();
  }

  setMode(mode: DrivingMode): void {
    if (this.disposed) return;
    if (!this.worker && mode === 'predicted') return;
    if (mode === this.choice) return;
    this.emit(this.telemetry.flush(performance.now(),'context_change'));
    this.choice = mode; this.revision++;
    this.presentation = null;
    this.post({ kind: 'mode', generation: this.generation, revision: this.revision, mode });
    try { localStorage.setItem(STORAGE_KEY,mode); } catch { /* Optional. */ }
    this.refreshTelemetryContext();
  }

  neutralize(command: Readonly<InputCommandV2>): void {
    if (!this.room) return;
    this.command={...command,throttle:0,steer:0,pitch:0,roll:0,yaw:0,jumpHeld:false,boostHeld:false,powerslideHeld:false};
    this.commandAt=absoluteNow();
    this.revision++; this.queuedUpdate = false; this.queuedDelta = 0;
    this.presentation = null;
    if (this.worker) this.post({ kind: 'neutral', generation: this.generation, revision: this.revision, command });
    else this.room.send('lab-neutral', { sequence: ++this.lastSentSequence, command: { ...command,
      throttle:0,steer:0,pitch:0,roll:0,yaw:0,jumpHeld:false,boostHeld:false,powerslideHeld:false } });
    this.sequences.set(this.room,this.lastSentSequence);
  }

  refreshTelemetryContext(nowMs = performance.now()): void {
    if (!this.room) return;
    const browser = typeof document !== 'undefined';
    this.emit(this.telemetry.configure({ mode: this.choice, phase: this.lastFrame?.phase ?? 'waiting',
      players: this.lastFrame?.cars.length ?? 0, source: browser ? 'browser' : 'node',
      visibility: browser ? (document.hidden ? 'hidden' : 'visible') : 'none', focused: browser && document.hasFocus(),
      width: browser ? window.innerWidth : 0, height: browser ? window.innerHeight : 0,
      graphicsQuality:this.graphicsQuality,renderScale:this.renderScale,shadows:this.shadows,
      ceilingEffect:this.ceilingEffect,
      carRendering:this.carRendering,
      uiLanguage:language,playerLabels:this.playerLabels,
      timingProfile:this.timingProfile,inputClock:this.autonomous?'worker':'render',poseBufferMs:this.poseBufferMs,
      dpr: browser ? window.devicePixelRatio : 0, cores: browser ? navigator.hardwareConcurrency ?? 0 : 0 },nowMs));
  }
  private emit(report: LabTelemetryWindow | null): void {
    if (!report || !this.room || this.room.connection?.isOpen === false) return;
    try {
      const { stallIncidents, ...metrics } = report;
      this.room.send('lab-stats', metrics);
      stallIncidents?.forEach((incident, incidentIndex) => this.room!.send('lab-stall', {
        version:1, release:report.release, runId:report.runId, windowSequence:report.windowSequence,
        incidentIndex, incident:packLabStallIncident(incident),
      }));
    } catch { /* Export retains the window. */ }
  }
  exportTelemetry(): readonly LabTelemetryWindow[] {
    this.emit(this.telemetry.flush(performance.now(),'export')); return this.telemetry.export();
  }
  get latestTelemetry(): LabTelemetryWindow | null { return this.telemetry.latest; }
  get mode(): DrivingMode { return this.choice; }
  get kickoffEpoch(): number | null { return this.lastFrame?.kickoffEpoch ?? null; }
  private get isActive(): boolean {
    return this.presentationReason === 'active';
  }
  private get presentationReason(): LabPresentationReason {
    if (this.choice !== 'predicted') return 'mode';
    if (!this.debug?.predictionActive || !this.presentation?.car) return 'worker_unready';
    if (this.presentation.phase !== this.lastFrame?.phase || this.presentation.kickoffEpoch !== this.lastFrame?.kickoffEpoch) return 'phase';
    const now = absoluteNow();
    if (now - this.frameAtAbsoluteMs > 500) return 'server_stale';
    if (now - this.completedAtAbsoluteMs > MAX_RESULT_AGE_MS) return 'result_stale';
    if (now - this.sampledAtAbsoluteMs > MAX_RESULT_AGE_MS) return 'sample_stale';
    return 'active';
  }
  private stallSample(): LabStallSample {
    const now = absoluteNow(), age = (at: number) => at ? Math.max(0, now - at) : 0;
    return { timeMs: performance.now(), tick: Math.max(0, this.lastFrame?.tick ?? 0),
      sent: this.lastSentSequence, acknowledged: this.previousAck, pending: this.debug?.pending ?? 0,
      completed: this.presentation?.completedSequence ?? 0, inputSendAgeMs: age(this.inputSentAt),
      ackAdvanceAgeMs: age(this.ackAdvancedAt), snapshotAgeMs: age(this.frameAtAbsoluteMs),
      workerBusyMs: this.inFlight === null ? 0 : age(this.sentAt),
      resultAgeMs: age(this.completedAtAbsoluteMs), sampleAgeMs: age(this.sampledAtAbsoluteMs),
      frameGapMs: this.lastFrameGapMs, reason: this.presentationReason,
      serverCallbackGapMs: this.lastFrame?.serverTiming?.callbackGapMs ?? 0,
      serverWorkMs: this.lastFrame?.serverTiming?.workMs ?? 0,
      serverDroppedMs: this.lastFrame?.serverTiming?.droppedMs ?? 0 };
  }
  private recordStall(event: LabStallIncident['event'], gap = 0): void {
    if (!this.lastFrame || !['playing', 'overtime'].includes(this.lastFrame.phase)) return;
    const incident = this.stalls.capture(event, this.stallSample(), gap);
    if (incident) this.telemetry.stallIncident(incident);
  }
  get status(): string {
    if (this.error) return this.error;
    if (!this.room) return 'Create a Custom Room to test. You can start alone.';
    if (!this.lastFrame || absoluteNow()-this.frameAtAbsoluteMs>500) return 'Waiting for game server…';
    const stats = this.getDebugState();
    const metrics = `${Math.round(stats.rttMs)} ms ping · ${Math.round(this.frameRate)} fps · ${stats.pending} pending inputs`;
    if (this.choice !== 'predicted') return metrics;
    if (!this.isActive) return `${metrics} · Catching up prediction…`;
    return stats.catchingUp ? `${metrics} · Updating prediction…` : metrics;
  }
  getDebugState(): PredictionDebugState & { worker: boolean; workerInFlight: number; predictionResultAgeMs: number; inputClock:boolean; poseBufferMs:number; timingProfile:TimingProfileName; graphicsQuality:'standard'|'low'; renderScale:number; ceilingEffect:'simple'|'glass' } {
    const ack = this.lastFrame?.cars.find(car=>car.sessionId===(this.room ? getLocalActorId(this.room) : ''))?.acknowledgedSequence ?? 0;
    return { mode:this.choice,rttMs:this.debug?.rttMs ?? this.fallbackRtt,fps:this.frameRate,
      pending:this.debug?.pending ?? 0, sequence:this.lastSentSequence,tick:this.lastFrame?.tick ?? -1,
      correctionMeters:this.debug?.correctionMeters ?? 0,snapshots:this.snapshotCount,error:this.error,
      acknowledgedSequence:ack,predictionActive:this.isActive,recoveryReason:this.debug?.recoveryReason ?? null,
      recoveries:this.debug?.recoveries ?? 0,reconciliations:this.debug?.reconciliations ?? 0,
      replaySteps:this.debug?.replaySteps ?? 0,replayMs:this.debug?.replayMs ?? 0,
      confirmedSnapshots:this.debug?.confirmedSnapshots ?? 0,skippedReplaySteps:this.debug?.skippedReplaySteps ?? 0,
      totalReplaySteps:this.debug?.totalReplaySteps ?? 0,historySize:this.debug?.historySize ?? 0,
      catchingUp:this.debug?.catchingUp ?? false,catchupYields:this.debug?.catchupYields ?? 0,
      completedSequence:this.presentation?.completedSequence ?? 0,
      predictionLagInputs:Math.max(0,this.lastSentSequence-(this.presentation?.completedSequence ?? 0)),
      predictedCar:this.presentation?.car ?? null,worker:!!this.worker,inputClock:this.autonomous,poseBufferMs:this.poseBufferMs,timingProfile:this.timingProfile,graphicsQuality:this.graphicsQuality,renderScale:this.renderScale,ceilingEffect:this.ceilingEffect,workerInFlight:this.inFlight===null?0:1,
      predictionResultAgeMs:this.presentation?.car ? Math.max(0,absoluteNow()-this.completedAtAbsoluteMs):0 };
  }

  present(car: THREE.Group | null, ball: THREE.Group | null, nowMs: number): void {
    if (this.choice !== 'predicted' || !car || !this.lastFrame) { this.resetPresentation(); return; }
    const context = `${this.generation}:${this.lastFrame.phase}:${this.lastFrame.kickoffEpoch}`;
    if (context !== this.presentationContext) {
      this.resetPresentation();this.presentationContext=context;
    }
    const active=this.isActive;
    if (this.presentedActive !== null && this.presentedActive !== active) {
      const target = this.presentation?.car?.position;
      const gap = target ? car.position.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) : 0;
      this.recordStall(active ? 'prediction_resumed' : 'fallback', gap);
    }
    this.presentedActive = active;
    const nowAbsoluteMs=performance.timeOrigin+nowMs;
    const local=this.lastFrame.cars.find(body=>body.sessionId===(this.room ? getLocalActorId(this.room) : ''))!;
    // The meshes already hold this frame's server interpolation. Blend from our
    // last displayed pose during temporary fallback and return to prediction.
    const fallback=(mesh:THREE.Group,body:PredictionFrame['ball'])=>({
      position:mesh.position,rotation:mesh.quaternion,velocity:body.velocity,angularVelocity:body.angularVelocity });
    const sampledAt=active?this.sampledAtAbsoluteMs:nowAbsoluteMs;
    this.carFilter.sample(active?this.presentation!.car!:fallback(car,local),sampledAt,nowAbsoluteMs,active && this.poseBufferMs > 0);
    car.position.copy(this.carFilter.position);car.quaternion.copy(this.carFilter.rotation);
    if (ball) {
      this.ballFilter.sample(active&&this.presentation!.ball?this.presentation!.ball:fallback(ball,this.lastFrame.ball),sampledAt,nowAbsoluteMs,active && this.poseBufferMs > 0);
      ball.position.copy(this.ballFilter.position);ball.quaternion.copy(this.ballFilter.rotation);
    }
  }

  private resetPresentation(): void {
    this.carFilter.reset();this.ballFilter.reset();this.presentationContext=null;
    this.presentedActive = null;
  }

  detach(): void {
    for (const stop of this.roomSubscriptions.splice(0)) stop();
    this.resetPresentation();
    this.emit(this.telemetry.leave(performance.now()));
    this.room=null; this.generation++; this.revision=0;
    this.post({ kind:'detach',generation:this.generation });
    this.inFlight=null;this.queuedUpdate=false;this.queuedDelta=0;this.queuedFrame=null;
    this.lastFrame=null;this.presentation=null;this.debug=null;this.frameAtAbsoluteMs=0;
    this.fallbackAccumulator=0;this.command=null;
    this.stalls.reset(); this.inputSentAt = this.ackAdvancedAt = this.previousAck = 0;
    this.completedAtAbsoluteMs = this.sampledAtAbsoluteMs = 0;
  }

  /** Terminal shutdown; detach remains reusable between rooms. */
  dispose(): void {
    if (this.disposed) return;
    this.stopInputClock();
    this.detach();
    this.disposed = true;
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
      this.worker = null;
    }
    this.inputSample = null;
  }
}
