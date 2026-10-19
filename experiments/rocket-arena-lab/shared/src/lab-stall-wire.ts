import type { LabStallIncident } from './types/lab-telemetry.js';

export const LAB_STALL_SAMPLE_FIELDS = ['timeMs', 'tick', 'sent', 'acknowledged', 'pending', 'completed',
  'inputSendAgeMs', 'ackAdvanceAgeMs', 'snapshotAgeMs', 'workerBusyMs', 'resultAgeMs', 'sampleAgeMs',
  'frameGapMs', 'serverCallbackGapMs', 'serverWorkMs', 'serverDroppedMs'] as const;

/** One incident per packet, integer millisecond tuples: safely below the native
 * 4 KB transport limit. Downloads retain the descriptive object representation. */
export function packLabStallIncident(incident: LabStallIncident) {
  return { event: incident.event, targetGapMeters: incident.targetGapMeters,
    samples: incident.samples.map(sample => [...LAB_STALL_SAMPLE_FIELDS.map(key => Math.round(sample[key])), sample.reason]) };
}
