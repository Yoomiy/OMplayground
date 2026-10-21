import type { InputCommandV2 } from '@rocket-arena/shared';
import type { PredictionFrame } from '@rocket-arena/simulation/protocol';
import type { ClientPrediction, PredictionMode } from './prediction.js';
import type { ClientTelemetryOperation } from './telemetry.js';

export type WorkerRequest =
  | { kind: 'attach'; generation: number; revision: number; sessionId: string; sequence: number; mode: PredictionMode }
  | { kind: 'detach'; generation: number }
  | { kind: 'mode'; generation: number; revision: number; mode: PredictionMode }
  | { kind: 'neutral'; generation: number; revision: number; command: Readonly<InputCommandV2> }
  | { kind: 'pong'; generation: number; value: number }
  | { kind: 'drive'; generation: number; revision: number; requestId: number;
      frame: PredictionFrame | null; frameAtAbsoluteMs: number; deltaSeconds: number;
      nowAbsoluteMs: number; command: Readonly<InputCommandV2> };
export type PredictionDebugState = ReturnType<ClientPrediction['getDebugState']>;
export type PredictionPresentation = ClientPrediction['presentationState'];
export type WorkerResponse =
  | { kind: 'send'; generation: number; message: string; value: unknown }
  | { kind: 'state'; generation: number; revision: number; requestId?: number;
      debug: PredictionDebugState; presentation: PredictionPresentation;
      completedAtAbsoluteMs: number; operations: ClientTelemetryOperation[] };
