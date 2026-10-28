import type { IncomingMessage, ServerResponse } from 'node:http';
import type { StaffCommand, StaffResult } from '../shared/staff.ts';
import type { RoomLease, CheckpointPointer } from './checkpoint-storage.ts';

/** Private service capability. Browsers cannot supply leases or worker commands. */
export type RoomControl = Readonly<{
  lease: RoomLease;
  savePaused(): Promise<CheckpointPointer>;
  resume(): void;
  end(): void;
  staff(
    request: Readonly<{
      requestId: string;
      revision: number;
      actorId: string;
      command: StaffCommand;
      expiresAt: number;
    }>,
  ): Promise<StaffResult>;
}>;
export type ControlGrant = Readonly<{
  room: string;
  execute(control: RoomControl): Promise<unknown>;
}>;
export type ControlPolicy = (
  request: IncomingMessage,
  body: unknown,
  response: ServerResponse,
) => Promise<ControlGrant | null>;
