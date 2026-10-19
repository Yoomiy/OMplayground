export type LabRecoveryReason = 'cpu_budget' | 'input_backlog' | 'server_stale'
  | 'controls_released' | 'mode_change' | 'error';

export interface LabDistribution {
  count: number;
  mean: number;
  /** Upper bound from fixed histogram buckets, rather than an exact percentile. */
  p95Upper: number;
  max: number;
}

export type LabPresentationReason = 'active' | 'mode' | 'worker_unready' | 'phase'
  | 'server_stale' | 'result_stale' | 'sample_stale';
export interface LabStallSample {
  timeMs: number; tick: number; sent: number; acknowledged: number; pending: number;
  completed: number; inputSendAgeMs: number; ackAdvanceAgeMs: number;
  snapshotAgeMs: number; workerBusyMs: number; resultAgeMs: number; sampleAgeMs: number;
  frameGapMs: number; reason: LabPresentationReason;
  serverCallbackGapMs: number; serverWorkMs: number; serverDroppedMs: number;
}
export interface LabStallIncident {
  event: 'input_backlog' | 'server_stale' | 'error' | 'fallback' | 'prediction_resumed';
  /** Distance between presentation targets, NOT an equal-tick physics error. */
  targetGapMeters: number;
  samples: LabStallSample[];
}

export type LabClientTimingName = 'renderSubmitMs' | 'sceneEffectsMs' | 'presentationMs' | 'hudAudioMs' | 'workerRoundTripMs' | 'poseAgeMs';
export interface LabClientTimings extends Record<LabClientTimingName, LabDistribution> { drawCallsMax: number }

export interface LabTelemetryContext {
  mode: 'original' | 'shorter' | 'predicted';
  phase: string;
  players: number;
  source: 'browser' | 'node';
  visibility: 'visible' | 'hidden' | 'none';
  focused: boolean;
  width: number;
  height: number;
  dpr: number;
  cores: number;
  graphicsQuality?: 'standard' | 'low';
  renderScale?: number;
  shadows?: boolean;
  ceilingEffect?: 'simple' | 'glass';
  carRendering?: 'batched' | 'original';
  uiLanguage?: 'he' | 'en';
  playerLabels?: boolean;
  timingProfile?: 'baseline' | 'buffer' | 'clock' | 'combined';
  inputClock?: 'render' | 'worker';
  poseBufferMs?: 0 | 50;
}

export interface LabTelemetryWindow extends LabTelemetryContext {
  version: 2;
  clientTimings?: LabClientTimings;
  stallIncidents?: LabStallIncident[];
  release: string;
  runId: string;
  windowSequence: number;
  windowMs: number;
  endedAtUtc: string;
  endReason: 'periodic' | 'context_change' | 'leave' | 'export';
  fps: number;
  rttMs: number;
  pending: number;
  ackLag: number;
  recoveries: number;
  frames: number;
  frameMs: LabDistribution;
  framesOver33ms: number;
  framesOver50ms: number;
  eligibleMs: number;
  predictionActiveMs: number;
  predictionActivePercent: number;
  recoveryCounts: Record<LabRecoveryReason, number>;
  replayMs: LabDistribution;
  localPhysicsMs: LabDistribution;
  rtt: LabDistribution;
  snapshotGapMs: LabDistribution;
  pendingMax: number;
  ackLagMax: number;
  snapshotAgeMaxMs: number;
  carCorrectionMeters: LabDistribution;
  ballCorrectionMeters: LabDistribution;
  rotationCorrectionDegrees: LabDistribution;
  carCorrectionsOver10cm: number;
  carCorrectionsOver50cm: number;
  hardSnaps: number;
  correctionsNearBall: number;
  correctionsNearCar: number;
  rebases: number;
  predictionChecks: number;
  confirmedSnapshots: number;
  skippedReplaySteps: number;
  replayedSteps: number;
  historyMisses: number;
  historyMismatches: number;
  catchupYields: number;
  unalignedCorrections: number;
  predictionLagMax: number;
  predictionResultAgeMaxMs: number;
  predictionSampleAgeMaxMs: number;
}
