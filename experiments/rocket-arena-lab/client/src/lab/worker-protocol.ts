import type { InputCommandV2 } from '@rocket-arena/shared';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import type { DrivingLab, DrivingMode } from './prediction.js';
import type { LabTelemetryOperation } from './telemetry.js';

export type WorkerRequest =
  | { kind: 'clock'; enabled: boolean }
  | { kind: 'attach'; generation: number; revision: number; sessionId: string; sequence: number; mode: DrivingMode }
  | { kind: 'detach'; generation: number }
  | { kind: 'mode'; generation: number; revision: number; mode: DrivingMode }
  | { kind: 'neutral'; generation: number; revision: number; command: Readonly<InputCommandV2> }
  | { kind: 'pong'; generation: number; value: number }
  | { kind: 'drive'; generation: number; revision: number; requestId: number;
      frame: PredictionFrame | null; frameAtAbsoluteMs: number; deltaSeconds: number;
      nowAbsoluteMs: number; controlsAtAbsoluteMs?: number; command: Readonly<InputCommandV2> };
export type PredictionDebugState = ReturnType<DrivingLab['getDebugState']>;
export type PredictionPresentation = DrivingLab['presentationState'];
export type WorkerResponse =
  | { kind: 'send'; generation: number; message: string; value: unknown }
  | { kind: 'state'; generation: number; revision: number; requestId?: number;
      debug: PredictionDebugState; presentation: PredictionPresentation;
      completedAtAbsoluteMs: number; operations: LabTelemetryOperation[] };
