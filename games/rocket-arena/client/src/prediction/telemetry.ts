import type { ClientTimingName, ClientTimings, TelemetryDistribution, RecoveryReason, ClientTelemetryContext, ClientTelemetryWindow, ClientStallIncident } from '@rocket-arena/shared';

export type ClientTelemetryOperation =
  | { method: 'recovery'; args: [RecoveryReason] }
  | { method: 'replaySample' | 'localPhysicsSample' | 'ping'; args: [number] }
  | { method: 'rebase' | 'replayedStep' | 'catchupYield' | 'unalignedCorrection'; args: [] }
  | { method: 'predictionCheck'; args: ['match' | 'missing' | 'different', number] }
  | { method: 'correction'; args: [number, number, number, boolean, boolean] };

const MS_BUCKETS = [...Array.from({ length: 201 }, (_, i) => i), 250, 500, 1_000, 5_000, 60_000];
const METER_BUCKETS = [...Array.from({ length: 101 }, (_, i) => i / 100), 1.5, 2, 3, 5, 10, 100];
const DEGREE_BUCKETS = Array.from({ length: 181 }, (_, i) => i);

/** Fixed memory and no per-frame sample arrays or sorting. */
class Distribution {
  private bins: Uint32Array;
  count = 0;
  sum = 0;
  max = 0;
  constructor(private limits: readonly number[]) { this.bins = new Uint32Array(limits.length); }
  add(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    let index = 0;
    while (index < this.limits.length - 1 && value > this.limits[index]) index++;
    this.bins[index]++;
    this.count++;
    this.sum += value;
    this.max = Math.max(this.max, value);
  }
  read(): TelemetryDistribution {
    let seen = 0, p95Upper = 0;
    for (let i = 0; i < this.bins.length && this.count; i++) {
      seen += this.bins[i];
      if (seen >= Math.ceil(this.count * .95)) {
        p95Upper = i === this.bins.length - 1 ? this.max : this.limits[i];
        break;
      }
    }
    return { count: this.count, mean: this.count ? this.sum / this.count : 0, p95Upper, max: this.max };
  }
}

const reasons = (): Record<RecoveryReason, number> => ({ cpu_budget: 0, input_backlog: 0,
  server_stale: 0, controls_released: 0, mode_change: 0, error: 0 });

export class ClientTelemetry {
  private incidents: ClientStallIncident[] = [];
  stallIncident(incident: ClientStallIncident): void {
    if (this.incidents.length < 4) this.incidents.push(incident);
  }
  private context: ClientTelemetryContext | null = null;
  private startedAt = 0;
  private skipFrame = true;
  private clientTimings = new Map<ClientTimingName,Distribution>();
  private drawCallsMax = 0;
  clientSample(name: ClientTimingName, ms: number): void {
    let distribution=this.clientTimings.get(name);
    if(!distribution){distribution=new Distribution(MS_BUCKETS);this.clientTimings.set(name,distribution);}
    distribution.add(ms);
  }
  drawCalls(calls: number): void { this.drawCallsMax=Math.max(this.drawCallsMax,calls); }
  private readClientTimings(): ClientTimings {
    const keys:ClientTimingName[]=['renderSubmitMs','sceneEffectsMs','presentationMs','hudAudioMs','workerRoundTripMs','poseAgeMs'];
    return { ...Object.fromEntries(keys.map(key=>[key,this.clientTimings.get(key)?.read() ?? {count:0,mean:0,p95Upper:0,max:0}])), drawCallsMax:this.drawCallsMax } as ClientTimings;
  }
  private windowSequence = 0;
  private frame = new Distribution(MS_BUCKETS);
  private replay = new Distribution(MS_BUCKETS);
  private localPhysics = new Distribution(MS_BUCKETS);
  private rtt = new Distribution(MS_BUCKETS);
  private snapshotGap = new Distribution(MS_BUCKETS);
  private carCorrection = new Distribution(METER_BUCKETS);
  private ballCorrection = new Distribution(METER_BUCKETS);
  private rotationCorrection = new Distribution(DEGREE_BUCKETS);
  private over33 = 0;
  private over50 = 0;
  private eligibleMs = 0;
  private activeMs = 0;
  private recoveries = reasons();
  private pendingMax = 0;
  private ackLagMax = 0;
  private snapshotAgeMaxMs = 0;
  private over10cm = 0;
  private over50cm = 0;
  private snaps = 0;
  private nearBall = 0;
  private nearCar = 0;
  private rebases = 0;
  private predictionChecks = 0;
  private confirmedSnapshots = 0;
  private skippedReplaySteps = 0;
  private replayedSteps = 0;
  private historyMisses = 0;
  private historyMismatches = 0;
  private history: ClientTelemetryWindow[] = [];
  private catchupYields = 0;
  private unalignedCorrections = 0;
  private predictionLagMax = 0;
  private predictionResultAgeMaxMs = 0;
  private predictionSampleAgeMaxMs = 0;
  private sink?: (operation: ClientTelemetryOperation) => void;
  private gauges = { rttMs: 0, pending: 0, ackLag: 0, recoveries: 0 };

  constructor(readonly runId: string, readonly release: string) {}

  observe(sink: (operation: ClientTelemetryOperation) => void): void { this.sink = sink; }

  configure(context: ClientTelemetryContext, nowMs: number): ClientTelemetryWindow | null {
    if (this.context && (Object.keys(context) as (keyof ClientTelemetryContext)[])
      .every(key => context[key] === this.context![key])) return null;
    const previous = this.flush(nowMs, 'context_change');
    this.context = { ...context };
    this.startedAt = nowMs;
    this.skipFrame = true; // Interval crossed a room/mode/focus/phase boundary.
    return previous;
  }

  frameSample(ms: number, active: boolean): void {
    if (this.skipFrame) { this.skipFrame = false; return; }
    if (!this.context || !Number.isFinite(ms) || ms <= 0) return;
    this.frame.add(ms);
    if (ms > 33.333) this.over33++;
    if (ms > 50) this.over50++;
    const eligible = this.context.source === 'browser' && this.context.visibility === 'visible'
      && this.context.focused && ['playing', 'overtime'].includes(this.context.phase);
    if (eligible) {
      this.eligibleMs += ms;
      if (this.context.mode === 'predicted' && active) this.activeMs += ms;
    }
  }
  recovery(reason: RecoveryReason): void { this.sink?.({ method: 'recovery', args: [reason] }); this.recoveries[reason]++; }
  replaySample(ms: number): void { this.sink?.({ method: 'replaySample', args: [ms] }); this.replay.add(ms); }
  localPhysicsSample(ms: number): void { this.sink?.({ method: 'localPhysicsSample', args: [ms] }); this.localPhysics.add(ms); }
  ping(ms: number): void { this.sink?.({ method: 'ping', args: [ms] }); this.rtt.add(ms); }
  snapshot(ms: number): void { this.snapshotGap.add(ms); }
  rebase(): void { this.sink?.({ method: 'rebase', args: [] }); this.rebases++; }
  predictionCheck(result: 'match' | 'missing' | 'different', pending: number): void {
    this.sink?.({ method: 'predictionCheck', args: [result, pending] });
    this.predictionChecks++;
    if (result === 'match') { this.confirmedSnapshots++; this.skippedReplaySteps += pending; }
    else if (result === 'missing') this.historyMisses++;
    else this.historyMismatches++;
  }
  replayedStep(): void { this.sink?.({ method: 'replayedStep', args: [] }); this.replayedSteps++; }
  catchupYield(): void { this.sink?.({ method: 'catchupYield', args: [] }); this.catchupYields++; }
  unalignedCorrection(): void { this.sink?.({ method: 'unalignedCorrection', args: [] }); this.unalignedCorrections++; }
  workerGauge(lag: number, ageMs: number, sampleAgeMs = ageMs): void {
    this.predictionLagMax = Math.max(this.predictionLagMax, lag);
    this.predictionResultAgeMaxMs = Math.max(this.predictionResultAgeMaxMs, ageMs);
    this.predictionSampleAgeMaxMs = Math.max(this.predictionSampleAgeMaxMs,sampleAgeMs);
  }
  correction(carMeters: number, ballMeters: number, degrees: number, nearBall: boolean, nearCar: boolean): void {
    this.sink?.({ method: 'correction', args: [carMeters, ballMeters, degrees, nearBall, nearCar] });
    this.carCorrection.add(carMeters);
    this.ballCorrection.add(ballMeters);
    this.rotationCorrection.add(degrees);
    if (carMeters > .1) this.over10cm++;
    if (carMeters > .5) this.over50cm++;
    if (carMeters >= 3) this.snaps++;
    if (carMeters > .1 && nearBall) this.nearBall++;
    if (carMeters > .1 && nearCar) this.nearCar++;
  }
  gauge(rttMs: number, pending: number, ackLag: number, recoveries: number, ageMs: number): void {
    this.gauges = { rttMs, pending, ackLag, recoveries };
    this.pendingMax = Math.max(this.pendingMax, pending);
    this.ackLagMax = Math.max(this.ackLagMax, ackLag);
    this.snapshotAgeMaxMs = Math.max(this.snapshotAgeMaxMs, ageMs);
  }
  due(nowMs: number): boolean { return this.context !== null && nowMs - this.startedAt >= 10_000; }

  flush(nowMs: number, endReason: ClientTelemetryWindow['endReason']): ClientTelemetryWindow | null {
    if (!this.context) return null;
    const hasData = this.incidents.length || this.frame.count || Object.values(this.recoveries).some(Boolean) || this.carCorrection.count
      || this.unalignedCorrections || this.catchupYields || this.predictionChecks || this.replay.count || this.localPhysics.count;
    if (!hasData) { this.startedAt = nowMs; return null; }
    const report: ClientTelemetryWindow = { ...this.context, ...this.gauges, version: 2,
      clientTimings:this.readClientTimings(), stallIncidents: this.incidents, release: this.release, runId: this.runId, windowSequence: ++this.windowSequence,
      windowMs: Math.max(0, nowMs - this.startedAt), endedAtUtc: new Date().toISOString(), endReason,
      fps: this.frame.sum ? this.frame.count / this.frame.sum * 1_000 : 0,
      frames: this.frame.count, frameMs: this.frame.read(), framesOver33ms: this.over33,
      framesOver50ms: this.over50, eligibleMs: this.eligibleMs, predictionActiveMs: this.activeMs,
      predictionActivePercent: this.eligibleMs ? this.activeMs / this.eligibleMs * 100 : 0,
      recoveryCounts: { ...this.recoveries }, replayMs: this.replay.read(), localPhysicsMs: this.localPhysics.read(),
      rtt: this.rtt.read(), snapshotGapMs: this.snapshotGap.read(), pendingMax: this.pendingMax,
      ackLagMax: this.ackLagMax, snapshotAgeMaxMs: this.snapshotAgeMaxMs,
      carCorrectionMeters: this.carCorrection.read(), ballCorrectionMeters: this.ballCorrection.read(),
      rotationCorrectionDegrees: this.rotationCorrection.read(), carCorrectionsOver10cm: this.over10cm,
      carCorrectionsOver50cm: this.over50cm, hardSnaps: this.snaps,
      correctionsNearBall: this.nearBall, correctionsNearCar: this.nearCar, rebases: this.rebases,
      predictionChecks: this.predictionChecks, confirmedSnapshots: this.confirmedSnapshots,
      skippedReplaySteps: this.skippedReplaySteps, replayedSteps: this.replayedSteps,
      historyMisses: this.historyMisses, historyMismatches: this.historyMismatches,
      catchupYields: this.catchupYields, unalignedCorrections: this.unalignedCorrections, predictionLagMax: this.predictionLagMax,
      predictionResultAgeMaxMs: this.predictionResultAgeMaxMs, predictionSampleAgeMaxMs: this.predictionSampleAgeMaxMs };
    this.history.push(report);
    if (this.history.length > 120) this.history.shift();
    this.resetWindow(nowMs);
    return report;
  }

  private resetWindow(nowMs: number): void {
    this.startedAt = nowMs;
    this.incidents = [];
    this.clientTimings.clear();this.drawCallsMax=0;
    this.frame = new Distribution(MS_BUCKETS);
    this.replay = new Distribution(MS_BUCKETS);
    this.localPhysics = new Distribution(MS_BUCKETS);
    this.rtt = new Distribution(MS_BUCKETS);
    this.snapshotGap = new Distribution(MS_BUCKETS);
    this.carCorrection = new Distribution(METER_BUCKETS);
    this.ballCorrection = new Distribution(METER_BUCKETS);
    this.rotationCorrection = new Distribution(DEGREE_BUCKETS);
    this.recoveries = reasons();
    this.over33 = this.over50 = this.eligibleMs = this.activeMs = 0;
    this.pendingMax = this.ackLagMax = this.snapshotAgeMaxMs = 0;
    this.over10cm = this.over50cm = this.snaps = this.nearBall = this.nearCar = this.rebases = 0;
    this.predictionChecks = this.confirmedSnapshots = this.skippedReplaySteps = this.replayedSteps = 0;
    this.historyMisses = this.historyMismatches = 0;
    this.catchupYields = this.unalignedCorrections = this.predictionLagMax = this.predictionResultAgeMaxMs = this.predictionSampleAgeMaxMs = 0;
  }
  leave(nowMs: number): ClientTelemetryWindow | null {
    const report = this.flush(nowMs, 'leave');
    this.context = null;
    this.skipFrame = true;
    this.gauges = { rttMs: 0, pending: 0, ackLag: 0, recoveries: 0 };
    return report;
  }
  get latest(): ClientTelemetryWindow | null { return this.history.at(-1) ?? null; }
  export(): readonly ClientTelemetryWindow[] { return this.history.map(row => structuredClone(row)); }
}
