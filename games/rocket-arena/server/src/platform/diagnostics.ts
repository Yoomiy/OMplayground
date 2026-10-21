import { readFileSync } from 'node:fs';
import { MATCH_PHASES, CLIENT_STALL_SAMPLE_FIELDS, type ClientTelemetryWindow, type ClientStallIncident } from '@rocket-arena/shared';

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
try { serverRelease = JSON.parse(readFileSync(new URL('./build.json', import.meta.url), 'utf8')).release; }
catch { /* Development tree has no release manifest. */ }

export function normalizeStallIncident(value: unknown): ClientStallIncident | null {
  if (!record(value) || !['input_backlog', 'server_stale', 'error', 'fallback', 'prediction_resumed'].includes(String(value.event))
    || !numeric(value.targetGapMeters) || !Array.isArray(value.samples)
    || value.samples.length < 1 || value.samples.length > 21) return null;
  const samples = [];
  for (const entry of value.samples) {
    if (Array.isArray(entry) && entry.length !== CLIENT_STALL_SAMPLE_FIELDS.length + 1) return null;
    const sample = Array.isArray(entry) ? { ...Object.fromEntries(CLIENT_STALL_SAMPLE_FIELDS.map((key,i) => [key,entry[i]])),
      reason:entry[CLIENT_STALL_SAMPLE_FIELDS.length] } : entry;
    if (!record(sample) || !CLIENT_STALL_SAMPLE_FIELDS.every(key => numeric(sample[key]))
      || !['active', 'mode', 'worker_unready', 'phase', 'server_stale', 'result_stale', 'sample_stale'].includes(String(sample.reason))) return null;
    samples.push({ ...Object.fromEntries(CLIENT_STALL_SAMPLE_FIELDS.map(key => [key,sample[key]])), reason:sample.reason });
  }
  return { event:value.event, targetGapMeters:value.targetGapMeters, samples } as ClientStallIncident;
}

/** Separate bounded packets preserve the native 4 KB WebSocket limit. */
export function createClientStallHandler(roomId: string, write: (fields: Record<string, unknown>) => void) {
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
    write(fields);
  };
}

/** Select validated fields only, so arbitrary client objects never enter logs. */
export function normalizeClientTelemetry(data: Record<string, unknown>): ClientTelemetryWindow | null {
  if (data.version !== 2 || !['server', 'predicted'].includes(String(data.mode))
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
    if (!numeric(data[key])) return null;
    result[key] = data[key];
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
  return result as unknown as ClientTelemetryWindow;
}

/** Validated, bounded production diagnostics; the caller owns severity/output. */
export function createClientMetricsHandler(roomId: string, getPlayers: () => number, write: (fields: Record<string, unknown>) => void) {
  const limits = new WeakMap<object, { tokens: number; at: number }>();
  return (client: { sessionId: string }, value: unknown): void => {
    if (!record(value)) return;
    const now = Date.now();
    const budget = limits.get(client) ?? { tokens: 10, at: now };
    budget.tokens = Math.min(10, budget.tokens + (now - budget.at) / 2_000);
    budget.at = now;
    limits.set(client, budget);
    if (budget.tokens < 1) return;
    const metrics = normalizeClientTelemetry(value);
    if (!metrics) return;
    budget.tokens--;
    write({ ...metrics, roomId, sessionId: client.sessionId,
      serverRelease, serverPlayers: getPlayers(), receivedAtUtc: new Date().toISOString() });
  };
}
