import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MatchFlowState } from '../systems/match-flow.js';
import type { PlatformSeats } from './seats.js';

export const PAUSED_RETENTION_MS = 24 * 60 * 60_000;
export type SavedProgress = Pick<MatchFlowState, 'blueScore' | 'orangeScore' | 'regulationStepsRemaining' | 'regulationCutoffResolved'>;
export interface SavedRoom {
  version: 1;
  sessionId: string;
  expiresAt: number;
  waiting: boolean;
  hostUserId: string | null;
  progress: SavedProgress;
  seats: { actorId: string; bot: boolean; human: { userId: string; name: string } | null }[];
  pending: { userId: string; name: string; actorId: string | null }[];
  banned: string[];
}

function canonicalJson(value: unknown): string {
  const ordered = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(ordered);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, ordered(child)]));
    return item;
  };
  return JSON.stringify(ordered(value));
}

/** The app can write game_state; only server-signed checkpoints may resume it. */
export class RoomCheckpoints {
  constructor(private readonly secret: string) {}
  sign(payload: SavedRoom): { payload: SavedRoom; signature: string } {
    return { payload, signature: this.mac(payload).toString('hex') };
  }
  read(value: unknown, sessionId: string, now = Date.now()): SavedRoom | null {
    try {
      const signed = value as { payload: SavedRoom; signature: string };
      if (!signed || typeof signed.signature !== 'string' || !/^[0-9a-f]{64}$/.test(signed.signature)) return null;
      const expected = this.mac(signed.payload);
      if (!timingSafeEqual(expected, Buffer.from(signed.signature, 'hex'))) return null;
      const payload = signed.payload;
      if (payload.version !== 1 || payload.sessionId !== sessionId || !Number.isFinite(payload.expiresAt)
        || payload.expiresAt <= now || payload.seats.length !== 8 || payload.pending.length > 8) return null;
      return payload;
    } catch { return null; }
  }
  private mac(payload: SavedRoom): Buffer {
    // Postgres jsonb changes object-key order; signatures must survive that round trip.
    return createHmac('sha256', this.secret).update('rocket-checkpoint-v1\0').update(canonicalJson(payload)).digest();
  }
}

export function captureSeats(seats: PlatformSeats): Pick<SavedRoom, 'hostUserId' | 'seats' | 'pending' | 'banned'> {
  return {
    hostUserId: seats.hostUserId,
    seats: seats.seats.map(seat => ({ actorId: seat.actorId, bot: seat.bot,
      human: seat.human ? { userId: seat.human.userId, name: seat.human.name } : null })),
    pending: [...seats.pending.values()].map(human => ({ userId: human.userId, name: human.name,
      actorId: seats.pendingTargets.get(human.userId) ?? null })),
    banned: [...seats.banned],
  };
}

export function restoreSeats(seats: PlatformSeats, saved: SavedRoom, roster: string[]): void {
  for (const old of saved.seats) {
    const seat = seats.seats.find(value => value.actorId === old.actorId)!;
    seat.bot = old.bot;
    seat.human = old.human && roster.includes(old.human.userId)
      ? { ...old.human, connectionId: null, reservedUntil: null } : null;
  }
  for (const human of saved.pending) if (roster.includes(human.userId)) {
    seats.pending.set(human.userId, { userId: human.userId, name: human.name, connectionId: null, reservedUntil: null });
    if (human.actorId) seats.pendingTargets.set(human.userId, human.actorId);
  }
  seats.hostUserId = saved.hostUserId;
  for (const userId of saved.banned) seats.banned.add(userId);
}
