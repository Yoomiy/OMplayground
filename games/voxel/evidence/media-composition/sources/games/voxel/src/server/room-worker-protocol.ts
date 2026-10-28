import type { StaffCommand, StaffResult } from '../shared/staff.ts';
import type { BuildIdentity, ClientMessage } from '../shared/protocol.ts';
import type { ContentManifest } from '../shared/content.ts';
import type { GameMode } from '../shared/gameplay.ts';
import type { AdmittedActor } from '../sim/game-room.ts';
import type { RoomCheckpoint } from '../sim/room-checkpoint.ts';
import type { OwnerAuthorizations } from './owner-authorization.ts';
import type { WorldState } from '../shared/lifecycle.ts';

/** Private supervisor messages. None of these are browser commands. */
export type RoomWorkerData = {
  module: WebAssembly.Module;
  build: BuildIdentity;
  content: ContentManifest;
  /** Process-monotonic deadline; checked inside the worker even if its supervisor stalls. */
  ownershipDeadline?: number;
  refreshOwners?: boolean;
  enforceLifecycle?: boolean;
  projectSession?: boolean;
  start:
    | {
        type: 'fresh';
        worldId: string;
        seed: number;
        initialTick: number;
        mode: GameMode;
      }
    | {
        type: 'restore';
        checkpoint: unknown;
        owners: readonly (readonly [string, AdmittedActor | null])[];
      };
};
export type ToRoom =
  | {
      type: 'staff';
      requestId: string;
      revision: number;
      actorId: string;
      command: StaffCommand;
      deadline: number;
    }
  | { type: 'join'; actor: AdmittedActor; connection: string; authorizationUntil: number }
  | { type: 'authorization'; connection: string; deadline: number }
  | {
      type: 'owner-authorization';
      requestId: number;
      owners: OwnerAuthorizations;
      deadline: number;
    }
  | { type: 'owner-authorization-unavailable'; requestId: number }
  | { type: 'room-policy'; requestId: number; state: WorldState; deadline: number }
  | { type: 'room-policy-unavailable'; requestId: number }
  | { type: 'leave'; connection: string }
  | { type: 'message'; connection: string; message: ClientMessage }
  | { type: 'checkpoint'; requestId: number; pause: boolean }
  | { type: 'end' }
  | { type: 'resume' }
  | { type: 'pause' }
  | { type: 'ownership'; deadline: number }
  | { type: 'stop' };
export type FromRoom =
  | { type: 'staff-result'; requestId: string; revision: number; result: StaffResult }
  | { type: 'ready' }
  | { type: 'session-projection'; state: WorldState; participants: readonly string[] }
  | { type: 'room-policy-needed'; requestId: number; deadline: number }
  | { type: 'session-ended' }
  | {
      type: 'owner-authorization-needed';
      requestId: number;
      owners: readonly string[];
      deadline: number;
    }
  | {
      type: 'send';
      connection: string;
      kind: 'reliable' | 'snapshot';
      payload: string | Uint8Array;
    }
  | {
      type: 'close';
      connection: string;
      reason: 'REPLACED' | 'RECOVERING' | 'UNAUTHORIZED' | 'SESSION_ENDED';
    }
  | { type: 'checkpoint'; requestId: number; checkpoint: RoomCheckpoint }
  | { type: 'checkpoint-failed'; requestId: number }
  | { type: 'metrics'; ticks: number; columns: number; overrunMs: number }
  | { type: 'fault' };
