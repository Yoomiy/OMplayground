import type { WorldState } from '../shared/lifecycle.ts';
export const ROOM_POLICY_MS = 5000;
export type RoomPolicy = Readonly<{ state: WorldState; expiresAt: number }>;
export type RoomPolicyReader = (room: string) => Promise<RoomPolicy>;
export function readRoomPolicy(value: unknown, now: number): RoomPolicy {
  if (!Number.isFinite(now)) throw new Error('invalid room policy');
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid room policy');
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).length !== 2 ||
    !['playing', 'paused', 'ended'].includes(v.state as string) ||
    typeof v.expiresAt !== 'number' ||
    !Number.isFinite(v.expiresAt) ||
    v.expiresAt <= now ||
    v.expiresAt > now + ROOM_POLICY_MS
  )
    throw new Error('invalid room policy');
  return Object.freeze({ state: v.state as WorldState, expiresAt: v.expiresAt });
}
