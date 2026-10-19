import { PHYSICS, type InputCommandV2, type LabRecoveryReason, type LabTelemetryWindow } from '@rocket-arena/shared';
import type { Room } from 'colyseus.js';
import * as THREE from 'three';
import { initPhysics } from '@rocket-arena/simulation/world';
import { PredictionWorld } from '@rocket-arena/simulation/prediction-world';
import type { PredictionFrame, SequencedInput, BodyState } from '@rocket-arena/simulation/protocol';
import { LabTelemetry, type LabTelemetryOperation } from './telemetry.js';
import { PredictionHistory } from './prediction-history.js';

export type DrivingMode = 'original' | 'shorter' | 'predicted';
const STORAGE_KEY = 'rocket-arena-lab-mode-v1';
const MAX_PENDING_INPUTS = 24;
const MAX_WORK_SLICE_MS = 8;
const SNAPSHOT_TIMEOUT_MS = 500;

interface TimedInput extends SequencedInput { sampledAtMs: number }

interface ReplayJob {
  frame: PredictionFrame;
  rebase: boolean;
  restoring: boolean;
  inputs: TimedInput[];
  cursor: number;
  before: BodyState | null;
  beforeBall: BodyState;
  beforeTick: number;
  sampledAtMs: number;
  comparableCar: BodyState | null;
  comparableBall: BodyState | null;
  wasActive: boolean;
}

export class DrivingLab {
  mode: DrivingMode = 'predicted';
  private room: Room | null = null;
  private localId = '';
  private physics: PredictionWorld | null = null;
  private physicsReady = false;
  private lastFrame: PredictionFrame | null = null;
  private pending: TimedInput[] = [];
  private sequence = 0;
  private accumulator = 0;
  private pingSentAt = 0;
  private telemetry = new LabTelemetry(globalThis.crypto?.randomUUID?.()
    ?? `run-${Date.now()}-${Math.random().toString(36).slice(2)}`, import.meta.env?.VITE_LAB_RELEASE ?? 'development');
  private lastReceivedAt = 0;
  private correctionOffset = new THREE.Vector3();
  private rotationOffset = new THREE.Quaternion();
  private previousCar: BodyState | null = null;
  rttMs = 0;
  correctionMeters = 0;
  fps = 0;
  snapshots = 0;
  lastError: string | null = null;
  private lastTick = -1;
  private queuedFrame: { frame: PredictionFrame; rebase: boolean } | null = null;
  private acknowledgedSequence = 0;
  private recoverySequence = 0;
  private recoveryReason: string | null = null;
  private predictionActive = false;
  private reconciliations = 0;
  private replaySteps = 0;
  private replayMs = 0;
  private recoveries = 0;
  private history = new PredictionHistory();
  private confirmedSnapshots = 0;
  private skippedReplaySteps = 0;
  private totalReplaySteps = 0;
  private replayJob: ReplayJob | null = null;
  private simulatedSequence = 0;
  private completedSequence = 0;
  private completedAtMs = 0;
  private completedTick = 0;
  private sampledAtMs = 0;
  private completedPhase: PredictionFrame['phase'] | null = null;
  private completedEpoch = 0;
  private completedPreviousCar: BodyState | null = null;
  private completedCar: BodyState | null = null;
  private completedBall: BodyState | null = null;
  private catchupYields = 0;

  // The harness can disable reuse to compare the same physics against full replay.
  constructor(private readonly reuseConfirmedHistory = true) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'original' || stored === 'shorter' || stored === 'predicted') this.mode = stored;
    } catch { /* Defaults work without storage. */ }
    void initPhysics().then(() => { this.physicsReady = true; })
      .catch((error) => { this.lastError = `Prediction unavailable: ${String(error)}`; this.mode = 'shorter'; });
  }

  setMode(mode: DrivingMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.emitTelemetry(this.telemetry.flush(performance.now(), 'context_change'));
    this.recover('Synchronizing driving mode', 'mode_change');
    this.refreshTelemetryContext();
    this.physics?.dispose();
    this.physics = null;
    if (this.lastFrame) this.queuedFrame = { frame: this.lastFrame, rebase: true };
    this.correctionOffset.set(0, 0, 0);
    this.rotationOffset.identity();
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* Optional. */ }
  }

  attach(room: Room): void {
    if (this.room === room) return;
    this.detach();
    this.room = room;
    this.localId = room.sessionId;
    this.sequence = 0;
    this.lastTick = -1;
    room.onMessage('prediction-state', (frame: PredictionFrame) => {
      if (this.room !== room) return;
      this.acceptFrame(frame, performance.now());
    });
    room.onMessage('lab-pong', (sentAt: number) => {
      if (this.room === room && Number.isFinite(sentAt)) this.rttMs = performance.now() - sentAt;
      if (this.room === room && Number.isFinite(sentAt)) this.telemetry.ping(this.rttMs);
    });
    room.onLeave(() => { if (this.room === room) this.detach(); });
  }

  receiveFrame(frame: PredictionFrame, nowMs = performance.now()): void { this.acceptFrame(frame, nowMs); }

  seedSequence(sequence: number): void { this.sequence = sequence; this.recoverySequence = sequence; }

  observePhysics(sink: (operation: LabTelemetryOperation) => void): void { this.telemetry.observe(sink); }

  private acceptFrame(frame: PredictionFrame, nowMs: number): void {
    if (frame?.version !== 1 || !Number.isSafeInteger(frame.tick) || frame.tick <= this.lastTick
      || !Array.isArray(frame.cars) || frame.cars.length > 8) return;
    const local = frame.cars.find((car) => car.sessionId === this.localId);
    if (!local || !Number.isSafeInteger(local.acknowledgedSequence)
      || local.acknowledgedSequence < this.acknowledgedSequence
      || local.acknowledgedSequence > this.sequence) return;
    const rebase = !this.lastFrame || frame.kickoffEpoch !== this.lastFrame.kickoffEpoch
      || frame.phase !== this.lastFrame.phase || nowMs - this.lastReceivedAt > 500;
    this.refreshTelemetryContext(nowMs, frame);
    if (this.lastReceivedAt) this.telemetry.snapshot(nowMs - this.lastReceivedAt);
    this.lastTick = frame.tick;
    this.lastReceivedAt = nowMs;
    this.lastFrame = frame;
    this.snapshots++;
    this.acknowledgedSequence = local.acknowledgedSequence;
    this.pending = this.pending.filter((input) => input.sequence > local.acknowledgedSequence);
    // Coalesce network batches. Replaying inside each message handler can starve
    // requestAnimationFrame precisely when a slow browser needs to catch up.
    this.queuedFrame = { frame, rebase: rebase || (this.queuedFrame?.rebase ?? false) };
  }

  private recover(reason: string, code: LabRecoveryReason = 'controls_released'): void {
    this.history.clear();
    this.replayJob = null;
    this.telemetry.recovery(code);
    this.recoverySequence = this.sequence;
    this.pending = [];
    this.predictionActive = false;
    this.recoveryReason = reason;
    this.recoveries++;
    this.previousCar = null;
    this.correctionOffset.set(0, 0, 0);
    this.rotationOffset.identity();
  }

  /** Continue a fixed replay target; arriving controls never extend unfinished work. */
  continuePrediction(nowMs: number): void {
    this.replaySteps = 0;
    this.replayMs = 0;
    if (!this.physicsReady || this.mode !== 'predicted' || !this.lastFrame
      || this.acknowledgedSequence < this.recoverySequence
      || nowMs - this.lastReceivedAt > SNAPSHOT_TIMEOUT_MS) return;
    // Match transitions invalidate an unfinished world immediately.
    if (this.replayJob && this.queuedFrame?.rebase) {
      this.replayJob = null;
      this.predictionActive = false;
      this.history.clear();
    }
    const startedAt = performance.now();
    try {
      if (!this.replayJob && this.queuedFrame) {
        const { frame, rebase } = this.queuedFrame;
        this.queuedFrame = null;
        this.physics ??= new PredictionWorld();
        this.reconciliations++;
        const alreadySimulated = this.pending.filter(input => input.sequence <= this.simulatedSequence).length;
        const check = this.reuseConfirmedHistory && this.predictionActive && !rebase
          ? this.history.check(frame, this.physics.capture(), this.localId) : null;
        if (check) this.telemetry.predictionCheck(check, alreadySimulated);
        if (check === 'match') {
          this.confirmedSnapshots++;
          this.skippedReplaySteps += alreadySimulated;
        } else {
          const before = this.completedCar;
          const beforeBall = this.completedBall ?? this.physics.getBall();
          const beforeTick = this.completedTick;
          if (rebase) this.predictionActive = false;
          this.physics.restore(frame);
          this.simulatedSequence = frame.cars.find(car => car.sessionId === this.localId)!.acknowledgedSequence;
          this.history.clear();
          if (this.reuseConfirmedHistory) this.history.record(this.physics.capture());
          if (rebase) this.telemetry.rebase();
          this.replayJob = { frame, rebase, restoring: true, inputs: [...this.pending], cursor: 0,
            before, beforeBall, beforeTick, sampledAtMs: this.pending.at(-1)?.sampledAtMs ?? this.lastReceivedAt, wasActive: this.predictionActive,
            comparableCar: beforeTick === this.physics.tick ? this.physics.getCar(this.localId) : null,
            comparableBall: beforeTick === this.physics.tick ? this.physics.getBall() : null };
        }
      }
      if (!this.replayJob && this.predictionActive && this.physics) {
        const inputs = this.pending.filter(input => input.sequence > this.simulatedSequence);
        if (inputs.length) this.replayJob = { frame: this.lastFrame, rebase: false, restoring: false,
          inputs, cursor: 0, before: null, beforeBall: this.physics.getBall(), beforeTick: this.completedTick, sampledAtMs: inputs.at(-1)!.sampledAtMs,
          comparableCar: null, comparableBall: null, wasActive: this.predictionActive };
      }
      if (this.replayJob) this.runReplayChunk(nowMs, startedAt);
    } catch (error) {
      this.telemetry.recovery('error');
      this.emitTelemetry(this.telemetry.flush(nowMs, 'context_change'));
      this.lastError = `Prediction stopped: ${String(error)}`;
      this.mode = 'shorter';
      this.replayJob = null;
      this.physics?.dispose();
      this.physics = null;
      this.predictionActive = false;
    }
  }

  private runReplayChunk(nowMs: number, startedAt: number): void {
    const job = this.replayJob!, physics = this.physics!;
    const replayStartedAt = performance.now();
    while (job.cursor < job.inputs.length) {
      const input = job.inputs[job.cursor++];
      this.previousCar = physics.getCar(this.localId);
      const stepStartedAt = performance.now();
      physics.step(this.localId, input.command, input.sequence);
      this.simulatedSequence = input.sequence;
      if (this.reuseConfirmedHistory) this.history.record(physics.capture());
      if (job.restoring) {
        this.replaySteps++;
        this.totalReplaySteps++;
        this.telemetry.replayedStep();
        if (physics.tick === job.beforeTick) {
          job.comparableCar = physics.getCar(this.localId);
          job.comparableBall = physics.getBall();
        }
      } else this.telemetry.localPhysicsSample(performance.now() - stepStartedAt);
      this.replayMs = performance.now() - replayStartedAt;
      if (job.cursor < job.inputs.length && performance.now() - startedAt >= MAX_WORK_SLICE_MS) {
        if (job.restoring) this.telemetry.replaySample(this.replayMs);
        this.catchupYields++;
        this.telemetry.catchupYield();
        return; // Retain cursor/world/history; no one-second restart penalty.
      }
    }
    if (job.restoring) this.telemetry.replaySample(this.replayMs);
    if (job.restoring && job.wasActive && !job.rebase && job.before && job.comparableCar && job.comparableBall) {
      const before = job.before, after = job.comparableCar;
      const difference = new THREE.Vector3(before.position.x - after.position.x,
        before.position.y - after.position.y, before.position.z - after.position.z);
      this.correctionMeters = difference.length();
      const beforeQ = new THREE.Quaternion(before.rotation.x, before.rotation.y, before.rotation.z, before.rotation.w);
      const afterQ = new THREE.Quaternion(after.rotation.x, after.rotation.y, after.rotation.z, after.rotation.w);
      const local = job.frame.cars.find(car => car.sessionId === this.localId)!;
      const distance = (a: BodyState['position'], b: BodyState['position']) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
      this.telemetry.correction(this.correctionMeters, distance(job.beforeBall.position, job.comparableBall.position),
        beforeQ.angleTo(afterQ)*180/Math.PI, distance(local.position, job.frame.ball.position)<4,
        job.frame.cars.some(car=>car.sessionId!==this.localId && distance(local.position,car.position)<4));
      if (difference.length() < 3) {
        this.correctionOffset.add(difference).clampLength(0,3);
        this.rotationOffset.multiply(beforeQ.multiply(afterQ.invert())).normalize();
      } else { this.correctionOffset.set(0,0,0); this.rotationOffset.identity(); }
    } else if (job.rebase) { this.correctionOffset.set(0,0,0); this.rotationOffset.identity(); }
    else if (job.restoring && job.wasActive) this.telemetry.unalignedCorrection();
    this.completedPreviousCar = job.rebase || !job.inputs.length ? physics.getCar(this.localId) : this.previousCar;
    this.completedCar = physics.getCar(this.localId);
    this.completedBall = physics.getBall();
    this.completedSequence = this.simulatedSequence;
    this.completedAtMs = nowMs;
    this.completedTick = physics.tick;
    this.sampledAtMs = job.sampledAtMs;
    this.completedPhase = physics.phase;
    this.completedEpoch = job.frame.kickoffEpoch;
    this.predictionActive = true;
    this.recoveryReason = null;
    this.replayJob = null;
  }

  get needsContinuation(): boolean {
    return this.mode === 'predicted' && this.physicsReady && !!this.lastFrame
      && performance.now() - this.lastReceivedAt <= SNAPSHOT_TIMEOUT_MS
      && this.acknowledgedSequence >= this.recoverySequence
      && (!!this.replayJob || !!this.queuedFrame
        || (this.predictionActive && this.pending.some(input => input.sequence > this.simulatedSequence)));
  }

  get presentationState() {
    return { car: this.completedCar, ball: this.completedBall, previousCar: this.completedPreviousCar,
      correctionOffset: this.correctionOffset.toArray(), rotationOffset: this.rotationOffset.toArray(),
      completedSequence: this.completedSequence, completedAtMs: this.completedAtMs, sampledAtMs: this.sampledAtMs,
      phase: this.completedPhase, kickoffEpoch: this.completedEpoch };
  }

  update(room: Room | null, deltaSeconds: number, command: Readonly<InputCommandV2>, nowMs: number): void {
    if (!room) { if (this.room) this.detach(); return; }
    if (room !== this.room) this.attach(room);
    this.refreshTelemetryContext(nowMs);
    this.telemetry.frameSample(deltaSeconds * 1_000, this.predictionActive && nowMs - this.lastReceivedAt <= SNAPSHOT_TIMEOUT_MS);
    const dt = Math.max(0, Math.min(deltaSeconds, PHYSICS.TIMESTEP * 3));
    if (deltaSeconds > 0) this.fps += (1 / deltaSeconds - this.fps) * Math.min(1, dt * 3);
    if (nowMs - this.pingSentAt > 1000) {
      room.send('lab-ping', nowMs);
      this.pingSentAt = nowMs;
    }
    if (!this.lastFrame) return;
    const stale = nowMs - this.lastReceivedAt > SNAPSHOT_TIMEOUT_MS;
    if (stale && this.predictionActive) this.recover('Waiting for fresh server state', 'server_stale');
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= PHYSICS.TIMESTEP && steps++ < 3) {
      this.accumulator -= PHYSICS.TIMESTEP;
      const input = { sequence: ++this.sequence, command };
      room.send('lab-input', input);
      if (this.mode === 'predicted' && !stale && this.physicsReady) {
        if (this.pending.length >= MAX_PENDING_INPUTS) {
          this.telemetry.gauge(this.rttMs, this.pending.length, this.sequence - this.acknowledgedSequence,
            this.recoveries, Math.max(0, nowMs - this.lastReceivedAt));
          this.recover('Acknowledgements delayed; using server movement', 'input_backlog');
        }
        // Once old history is discarded, wait for its acknowledgement. Replaying
        // a partial history would predict the wrong timeline and repeat the stall.
        if (this.acknowledgedSequence >= this.recoverySequence) {
          this.pending.push({ ...input, sampledAtMs: nowMs-this.accumulator*1_000 });
        }

      }
    }
    this.continuePrediction(nowMs);
    // Discard elapsed time after a render stall instead of sending catch-up floods.
    this.accumulator %= PHYSICS.TIMESTEP;
    this.telemetry.gauge(this.rttMs, this.pending.length, this.sequence - this.acknowledgedSequence,
      this.recoveries, Math.max(0, nowMs - this.lastReceivedAt));
    if (this.telemetry.due(nowMs)) this.emitTelemetry(this.telemetry.flush(nowMs, 'periodic'));
    this.correctionOffset.multiplyScalar(Math.exp(-dt * 18));
    this.rotationOffset.slerp(new THREE.Quaternion(), 1 - Math.exp(-dt * 18));
  }

  neutralize(command: Readonly<InputCommandV2>): void {
    if (!this.room || !this.lastFrame) return;
    const input = { sequence: ++this.sequence, command: { ...command,
      throttle: 0, steer: 0, pitch: 0, roll: 0, yaw: 0,
      jumpHeld: false, boostHeld: false, powerslideHeld: false } };
    this.recover('Controls released; synchronizing');
    this.room.send('lab-neutral', input);
  }

  get kickoffEpoch(): number | null { return this.lastFrame?.kickoffEpoch ?? null; }

  refreshTelemetryContext(nowMs = performance.now(), frame = this.lastFrame): void {
    if (!this.room) return;
    const browser = typeof document !== 'undefined';
    this.emitTelemetry(this.telemetry.configure({ mode: this.mode, phase: frame?.phase ?? 'waiting',
      players: frame?.cars.length ?? 0, source: browser ? 'browser' : 'node',
      visibility: browser ? (document.hidden ? 'hidden' : 'visible') : 'none',
      focused: browser && document.hasFocus(), width: browser ? window.innerWidth : 0,
      height: browser ? window.innerHeight : 0, dpr: browser ? window.devicePixelRatio : 0,
      cores: browser ? navigator.hardwareConcurrency ?? 0 : 0 }, nowMs));
  }

  private emitTelemetry(report: LabTelemetryWindow | null): void {
    if (!report || !this.room || this.room.connection?.isOpen === false) return;
    try { this.room.send('lab-stats', report); } catch { /* Export retains unsent windows after disconnect. */ }
  }

  get latestTelemetry(): LabTelemetryWindow | null { return this.telemetry.latest; }
  exportTelemetry(): readonly LabTelemetryWindow[] {
    this.emitTelemetry(this.telemetry.flush(performance.now(), 'export'));
    return this.telemetry.export();
  }

  present(car: THREE.Group | null, ball: THREE.Group | null, nowMs: number): void {
    if (this.mode !== 'predicted' || !this.predictionActive || !this.physics || !car
      || nowMs - this.lastReceivedAt > SNAPSHOT_TIMEOUT_MS) return;
    const state = this.completedCar;
    if (!state) return;
    // Render between physics ticks with at most one tick of presentation latency.
    const alpha = Math.min(1, this.accumulator / PHYSICS.TIMESTEP);
    const previous = this.completedPreviousCar ?? state;
    car.position.set(previous.position.x, previous.position.y, previous.position.z)
      .lerp(new THREE.Vector3(state.position.x, state.position.y, state.position.z), alpha)
      .add(this.correctionOffset);
    car.quaternion.set(previous.rotation.x, previous.rotation.y, previous.rotation.z, previous.rotation.w)
      .slerp(new THREE.Quaternion(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w), alpha)
      .premultiply(this.rotationOffset);
    // The ball uses predicted physics for immediate hit feedback; scores stay server-owned.
    if (ball) {
      const predictedBall = this.completedBall!;
      ball.position.set(predictedBall.position.x, predictedBall.position.y, predictedBall.position.z);
      ball.quaternion.set(predictedBall.rotation.x, predictedBall.rotation.y, predictedBall.rotation.z, predictedBall.rotation.w);
    }
  }

  get status(): string {
    if (this.lastError) return this.lastError;
    if (!this.room) return 'Create a Custom Room to test. You can start alone.';
    if (!this.physicsReady) return 'Loading prediction physics…';
    if (performance.now() - this.lastReceivedAt > 500) return 'Waiting for game server…';
    const metrics = `${Math.round(this.rttMs)} ms ping · ${Math.round(this.fps)} fps · ${this.pending.length} pending inputs`;
    return this.mode === 'predicted' && this.recoveryReason ? `${metrics} · ${this.recoveryReason}` : metrics;
  }

  getDebugState() {
    return { mode: this.mode, rttMs: this.rttMs, fps: this.fps,
      pending: this.pending.length, sequence: this.sequence, tick: this.lastTick,
      correctionMeters: this.correctionMeters, snapshots: this.snapshots, error: this.lastError,
      acknowledgedSequence: this.acknowledgedSequence, predictionActive: this.predictionActive,
      recoveryReason: this.recoveryReason, recoveries: this.recoveries,
      reconciliations: this.reconciliations, replaySteps: this.replaySteps, replayMs: this.replayMs,
      confirmedSnapshots: this.confirmedSnapshots, skippedReplaySteps: this.skippedReplaySteps,
      totalReplaySteps: this.totalReplaySteps, historySize: this.history.size,
      catchingUp: !!this.replayJob, catchupYields: this.catchupYields,
      completedSequence: this.completedSequence,
      predictionLagInputs: Math.max(0, this.sequence - this.completedSequence),
      predictedCar: this.completedCar };
  }

  detach(): void {
    this.history.clear();
    this.replayJob = null;
    this.completedCar = null;
    this.completedPreviousCar = null;
    this.completedBall = null;
    this.completedPhase = null;
    this.simulatedSequence = 0;
    this.completedSequence = 0;
    this.emitTelemetry(this.telemetry.leave(performance.now()));
    this.physics?.dispose();
    this.physics = null;
    this.room = null;
    this.lastFrame = null;
    this.queuedFrame = null;
    this.acknowledgedSequence = 0;
    this.recoverySequence = 0;
    this.recoveryReason = null;
    this.predictionActive = false;
    this.pending = [];
    this.accumulator = 0;
    this.previousCar = null;
    this.correctionOffset.set(0, 0, 0);
    this.rotationOffset.identity();
    this.lastReceivedAt = 0;
  }
}
