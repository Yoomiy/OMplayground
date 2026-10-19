import { readFileSync } from 'node:fs';
import { MATCH_PHASES, LAB_STALL_SAMPLE_FIELDS, type LabTelemetryWindow, type LabStallIncident } from '@rocket-arena/shared';

const RECOVERY_KEYS = ['cpu_budget', 'input_backlog', 'server_stale', 'controls_released', 'mode_change', 'error'];
const DISTRIBUTIONS = ['frameMs', 'replayMs', 'localPhysicsMs', 'rtt', 'snapshotGapMs',
  'carCorrectionMeters', 'ballCorrectionMeters', 'rotationCorrectionDegrees'];
const NUMBERS = ['players', 'width', 'height', 'dpr', 'cores', 'windowSequence', 'windowMs',
  'fps', 'rttMs', 'pending', 'ackLag', 'recoveries', 'frames', 'framesOver33ms', 'framesOver50ms',
  'eligibleMs', 'predictionActiveMs', 'predictionActivePercent', 'pendingMax', 'ackLagMax',
  'snapshotAgeMaxMs', 'carCorrectionsOver10cm', 'carCorrectionsOver50cm', 'hardSnaps',
  'correctionsNearBall', 'correctionsNearCar', 'rebases'];
const HISTORY_NUMBERS = ['predictionChecks', 'confirmedSnapshots', 'skippedReplaySteps', 'replayedSteps', 'historyMisses', 'historyMismatches', 'catchupYields', 'unalignedCorrections', 'predictionLagMax', 'predictionResultAgeMaxMs', 'predictionSampleAgeMaxMs'];
const numeric = (value: unknown): value is number => typeof value === 'number'
  && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
let serverRelease = 'development';
try { serverRelease = JSON.parse(readFileSync(new URL(process.env.ROCKET_MODE === 'app'
  ? '../platform/build.json' : '../../../release.json', import.meta.url), 'utf8')).release; }
catch { /* Development tree has no release manifest. */ }

export function normalizeStallIncident(value: unknown): LabStallIncident | null {
  if (!record(value) || !['input_backlog', 'server_stale', 'error', 'fallback', 'prediction_resumed'].includes(String(value.event))
    || !numeric(value.targetGapMeters) || !Array.isArray(value.samples)
    || value.samples.length < 1 || value.samples.length > 21) return null;
  const samples = [];
  for (const entry of value.samples) {
    if (Array.isArray(entry) && entry.length !== LAB_STALL_SAMPLE_FIELDS.length + 1) return null;
    const sample = Array.isArray(entry) ? { ...Object.fromEntries(LAB_STALL_SAMPLE_FIELDS.map((key,i) => [key,entry[i]])),
      reason:entry[LAB_STALL_SAMPLE_FIELDS.length] } : entry;
    if (!record(sample) || !LAB_STALL_SAMPLE_FIELDS.every(key => numeric(sample[key]))
      || !['active', 'mode', 'worker_unready', 'phase', 'server_stale', 'result_stale', 'sample_stale'].includes(String(sample.reason))) return null;
    samples.push({ ...Object.fromEntries(LAB_STALL_SAMPLE_FIELDS.map(key => [key,sample[key]])), reason:sample.reason });
  }
  return { event:value.event, targetGapMeters:value.targetGapMeters, samples } as LabStallIncident;
}

/** Separate bounded packets preserve the native 4 KB WebSocket limit. */
export function createLabStallHandler(roomId: string, write?: (fields: Record<string, unknown>) => void) {
  const limits = new WeakMap<object, { tokens:number; at:number }>();
  return (client: { sessionId:string }, value:unknown): void => {
    if (!record(value) || value.version !== 1 || typeof value.release !== 'string' || !/^[\w.-]{1,96}$/.test(value.release)
      || typeof value.runId !== 'string' || !/^[\w-]{1,96}$/.test(value.runId)
      || !Number.isSafeInteger(value.windowSequence) || !numeric(value.windowSequence)
      || !Number.isInteger(value.incidentIndex) || !numeric(value.incidentIndex) || value.incidentIndex > 3) return;
    const incident=normalizeStallIncident(value.incident);if(!incident)return;
    const now=Date.now(), budget=limits.get(client) ?? {tokens:4,at:now};
    budget.tokens=Math.min(4,budget.tokens+(now-budget.at)/2_000);budget.at=now;limits.set(client,budget);
    if(budget.tokens<1)return;budget.tokens--;
    const fields = {release:value.release,runId:value.runId,
      windowSequence:value.windowSequence,incidentIndex:value.incidentIndex,incident,
      roomId,sessionId:client.sessionId,serverRelease,receivedAtUtc:new Date().toISOString()};
    if (write) write(fields);
    else console.info('[DrivingLabStall] '+JSON.stringify(fields));
  };
}

/** Select validated fields only, so arbitrary client objects never enter logs. */
export function normalizeLabTelemetry(data: Record<string, unknown>): LabTelemetryWindow | null {
  if (data.version !== 2 || !['original', 'shorter', 'predicted'].includes(String(data.mode))
    || !['browser', 'node'].includes(String(data.source)) || !['visible', 'hidden', 'none'].includes(String(data.visibility))
    || !['periodic', 'context_change', 'leave', 'export'].includes(String(data.endReason))
    || typeof data.focused !== 'boolean' || !MATCH_PHASES.includes(data.phase as never)
    || typeof data.release !== 'string' || !/^[\w.-]{1,96}$/.test(data.release)
    || typeof data.runId !== 'string' || !/^[\w-]{1,96}$/.test(data.runId)
    || typeof data.endedAtUtc !== 'string' || data.endedAtUtc.length > 40 || !Number.isFinite(Date.parse(data.endedAtUtc))
    || !NUMBERS.every(key => numeric(data[key])) || (data.players as number) > 8
    || (data.predictionActivePercent as number) > 100 || (data.predictionActiveMs as number) > (data.eligibleMs as number)) return null;
  const result: Record<string, unknown> = { version: 2 };
  for (const key of ['mode', 'phase', 'source', 'visibility', 'endReason', 'focused', 'release', 'runId', 'endedAtUtc', ...NUMBERS]) result[key] = data[key];
  for (const key of HISTORY_NUMBERS) {
    if (!numeric(data[key] ?? 0)) return null;
    result[key] = data[key] ?? 0; // Older telemetry-v2 clients have no history counters.
  }
  for (const name of DISTRIBUTIONS) {
    const value = data[name];
    if (!record(value) || !['count', 'mean', 'p95Upper', 'max'].every(key => numeric(value[key]))) return null;
    result[name] = { count: value.count, mean: value.mean, p95Upper: value.p95Upper, max: value.max };
  }
  if (data.ceilingEffect !== undefined) {
    if (data.ceilingEffect !== 'simple' && data.ceilingEffect !== 'glass') return null;
    result.ceilingEffect = data.ceilingEffect;
  }
  if (data.carRendering !== undefined) {
    if (data.carRendering !== 'batched' && data.carRendering !== 'original') return null;
    result.carRendering = data.carRendering;
  }
  if (data.uiLanguage !== undefined) {
    if (data.uiLanguage !== 'he' && data.uiLanguage !== 'en') return null;
    result.uiLanguage = data.uiLanguage;
  }
  if (data.playerLabels !== undefined) {
    if (typeof data.playerLabels !== 'boolean') return null;
    result.playerLabels = data.playerLabels;
  }
  if (data.stallIncidents !== undefined) {
    if (!Array.isArray(data.stallIncidents) || data.stallIncidents.length > 4) return null;
    const incidents = data.stallIncidents.map(normalizeStallIncident);
    if (incidents.some(value => value === null)) return null;
    result.stallIncidents = incidents;
  }
  if (data.timingProfile !== undefined) {
    if (!['baseline','buffer','clock','combined'].includes(String(data.timingProfile))) return null;
    result.timingProfile = data.timingProfile;
  }
  if (data.inputClock !== undefined) {
    if (data.inputClock !== 'render' && data.inputClock !== 'worker') return null;
    result.inputClock = data.inputClock;
  }
  if (data.poseBufferMs !== undefined) {
    if (data.poseBufferMs !== 0 && data.poseBufferMs !== 50) return null;
    result.poseBufferMs = data.poseBufferMs;
  }
  if(data.graphicsQuality !== undefined){
    if(!['standard','low'].includes(String(data.graphicsQuality)))return null;
    result.graphicsQuality=data.graphicsQuality;
  }
  if(data.renderScale !== undefined){
    if(!numeric(data.renderScale)||data.renderScale<=0||data.renderScale>1)return null;
    result.renderScale=data.renderScale;
  }
  if(data.shadows !== undefined){
    if(typeof data.shadows!=='boolean')return null;
    result.shadows=data.shadows;
  }
  if(data.clientTimings !== undefined){
    const timings=data.clientTimings;if(!record(timings)||!numeric(timings.drawCallsMax))return null;
    const names=['renderSubmitMs','sceneEffectsMs','presentationMs','hudAudioMs','workerRoundTripMs','poseAgeMs'];
    const clean:Record<string,unknown>={drawCallsMax:timings.drawCallsMax};
    for(const name of names){
      const value=timings[name];
      if(!record(value)||!['count','mean','p95Upper','max'].every(key=>numeric(value[key])))return null;
      clean[name]={count:value.count,mean:value.mean,p95Upper:value.p95Upper,max:value.max};
    }
    result.clientTimings=clean;
  }
  const recoveries = data.recoveryCounts;
  if (!record(recoveries) || !RECOVERY_KEYS.every(key => numeric(recoveries[key]))) return null;
  result.recoveryCounts = Object.fromEntries(RECOVERY_KEYS.map(key => [key, recoveries[key]]));
  return result as unknown as LabTelemetryWindow;
}

/** Bounded playtest metrics retained in the journal; legacy clients remain readable. */
export function createLabStatsHandler(roomId: string, getPlayers = () => 0, write?: (fields: Record<string, unknown>) => void) {
  const limits = new WeakMap<object, { tokens: number; at: number }>();
  return (client: { sessionId: string }, value: unknown): void => {
    if (!record(value)) return;
    const data = value;
    const now = Date.now();
    const budget = limits.get(client) ?? { tokens: 10, at: now };
    budget.tokens = Math.min(10, budget.tokens + (now - budget.at) / 2_000);
    budget.at = now;
    limits.set(client, budget);
    if (budget.tokens < 1) return;
    if (data.version === 2) {
      const metrics = normalizeLabTelemetry(data);
      if (!metrics) return;
      budget.tokens--;
      const fields = { ...metrics, roomId, sessionId: client.sessionId,
        serverRelease, serverPlayers: getPlayers(), receivedAtUtc: new Date().toISOString() };
      if (write) write(fields);
      else console.info('[DrivingLabV2] ' + JSON.stringify(fields));
      return;
    }
    if (!['predicted', 'original', 'shorter'].includes(String(data.mode))) return;
    const keys = ['fps', 'rttMs', 'pending', 'ackLag', 'replayMs', 'recoveries'] as const;
    if (!keys.every(key => typeof data[key] === 'number' && Number.isFinite(data[key])
      && (data[key] as number) >= 0 && (data[key] as number) <= 1_000_000)) return;
    budget.tokens--;
    if (write) { write({ roomId, sessionId: client.sessionId, mode: data.mode, ...Object.fromEntries(keys.map(key => [key, data[key]])) }); return; }
    console.info(`[DrivingLab] room=${roomId} session=${client.sessionId} mode=${data.mode} `
      + keys.map(key => `${key}=${Math.round(data[key] as number)}`).join(' '));
  };
}
