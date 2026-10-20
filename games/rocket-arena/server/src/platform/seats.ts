import type { MatchPhase } from '@rocket-arena/shared';
import { AdmissionError } from './admission.js';

export interface HumanSeat {
  userId: string;
  name: string;
  connectionId: string | null;
  reservedUntil: number | null;
}
export interface Seat { actorId: string; index: number; human: HumanSeat | null; bot: boolean }

/** Eight permanent bodies. Transport connections and human owners can change. */
export class PlatformSeats {
  readonly seats: Seat[] = Array.from({ length: 8 }, (_, index) => ({ actorId: `rocket-${index}`, index, human: null, bot: false }));
  readonly pending = new Map<string, HumanSeat>();
  readonly pendingTargets = new Map<string, string>();
  readonly banned = new Set<string>();
  hostUserId: string | null;
  private hostGraceUntil = 0;
  revision = 0;
  constructor(hostUserId: string) { this.hostUserId = hostUserId; }

  join(userId: string, name: string, connectionId: string, phase: MatchPhase, now: number): void {
    this.expire(now);
    if (this.banned.has(userId)) throw new AdmissionError('REMOVED_FROM_ROOM');
    const old = this.seats.find(seat => seat.human?.userId === userId)?.human ?? this.pending.get(userId);
    if (old?.connectionId) throw new AdmissionError('ALREADY_CONNECTED', 409);
    if (old) {
      old.connectionId = connectionId; old.reservedUntil = null; old.name = name;
    } else {
      if (this.humans().length >= 8) throw new AdmissionError('ROOM_FULL', 409);
      const human: HumanSeat = { userId, name, connectionId, reservedUntil: null };
      const free = this.freeSeat();
      if ((phase === 'waiting' || phase === 'countdown') && free) { free.human = human; free.bot = false; }
      else this.pending.set(userId, human);
    }
    this.chooseHost(now); this.revision++;
  }

  leave(connectionId: string, consented: boolean, now: number, retain = false): void {
    const pending = [...this.pending.values()].find(human => human.connectionId === connectionId);
    if (pending) {
      if (retain) { pending.connectionId = null; pending.reservedUntil = null; }
      else { this.pending.delete(pending.userId); this.pendingTargets.delete(pending.userId); }
    }
    const seat = this.seats.find(seat => seat.human?.connectionId === connectionId);
    if (seat?.human) {
      if (retain) { seat.human.connectionId = null; seat.human.reservedUntil = null; }
      else if (consented) seat.human = null;
      else { seat.human.connectionId = null; seat.human.reservedUntil = now + 30_000; }
    }
    this.chooseHost(now); this.revision++;
  }

  remove(userId: string, ban = true): void {
    if (ban) this.banned.add(userId);
    this.pending.delete(userId);
    this.pendingTargets.delete(userId);
    for (const seat of this.seats) if (seat.human?.userId === userId) seat.human = null;
    this.chooseHost(); this.revision++;
  }

  expire(now: number): void {
    let changed = false;
    for (const seat of this.seats) if (seat.human?.reservedUntil !== null && seat.human?.reservedUntil !== undefined
      && seat.human.reservedUntil <= now) { seat.human = null; changed = true; }
    if (this.hostGraceUntil > 0 && now >= this.hostGraceUntil) changed = true;
    if (changed) { this.chooseHost(now); this.revision++; }
  }

  /** Give the saved lobby host time to reload alongside the other participants. */
  retainHostUntil(deadline: number): void {
    if (this.humans().some(human => human.userId === this.hostUserId)) this.hostGraceUntil = deadline;
  }

  kickoff(): void {
    for (const [userId, human] of this.pending) {
      if (!human.connectionId) continue;
      const target = this.pendingTargets.get(userId);
      const planned = new Set(this.pendingTargets.values());
      const free = target ? this.seats.find(seat => seat.actorId === target && !seat.human)
        : this.freeSeat(false, planned);
      if (!free) continue;
      free.human = human; free.bot = false; this.pending.delete(userId); this.revision++;
      this.pendingTargets.delete(userId);
    }
  }

  planPending(userId: unknown, actorId: unknown): void {
    if (typeof userId === 'string' && this.pending.has(userId) && actorId === null) {
      this.pendingTargets.delete(userId); this.revision++; return;
    }
    const target = this.seats.find(seat => seat.actorId === actorId && !seat.human);
    if (typeof userId !== 'string' || !this.pending.has(userId) || !target
      || [...this.pendingTargets].some(([other, actor]) => other !== userId && actor === actorId)) {
      throw new AdmissionError('BAD_PENDING_SLOT', 409);
    }
    this.pendingTargets.set(userId, target.actorId); this.revision++;
  }

  /** Disconnect transport reservations without forgetting the saved roster. */
  retainRoster(): void {
    for (const human of this.humans()) human.reservedUntil = null;
  }

  actorForConnection(connectionId: string): string | null {
    return this.seats.find(seat => seat.human?.connectionId === connectionId)?.actorId ?? null;
  }
  humans(): HumanSeat[] {
    return [...this.seats.flatMap(seat => seat.human ? [seat.human] : []), ...this.pending.values()];
  }
  botCount(): number { return this.seats.filter(seat => seat.bot && !seat.human).length; }
  setBots(count: unknown): void {
    if (!Number.isInteger(count) || (count as number) < 0 || (count as number) > 8 - this.humans().length) throw new AdmissionError('BAD_BOT_COUNT', 400);
    while (this.botCount() > (count as number)) [...this.seats].reverse().find(seat => seat.bot)!.bot = false;
    while (this.botCount() < (count as number)) this.freeSeat(true)!.bot = true;
    this.revision++;
  }
  assignTeam(actorId: unknown, team: unknown): void {
    const seat = this.seats.find(seat => seat.actorId === actorId);
    if (!seat || (!seat.human && !seat.bot) || !['blue', 'orange'].includes(String(team))) throw new AdmissionError('BAD_TEAM', 400);
    const parity = team === 'blue' ? 0 : 1;
    if (seat.index % 2 === parity) return;
    const candidates = this.seats.filter(other => other.index % 2 === parity);
    const target = candidates.find(other => !other.human && !other.bot) ?? candidates.find(other => other.bot) ?? candidates[0]!;
    // A full team swaps occupants, so the host can also rearrange an 8-car room.
    [seat.human, target.human] = [target.human, seat.human];
    [seat.bot, target.bot] = [target.bot, seat.bot];
    this.revision++;
  }
  private freeSeat(emptyOnly = false, excluded = new Set<string>()): Seat | undefined {
    const active = this.seats.filter(seat => seat.human || seat.bot);
    const blue = active.filter(seat => seat.index % 2 === 0).length;
    const preferred = blue <= active.length - blue ? 0 : 1;
    return this.seats.filter(seat => !seat.human && !excluded.has(seat.actorId) && (!emptyOnly || !seat.bot))
      .sort((a, b) => Number(a.bot) - Number(b.bot) || Number(b.index % 2 === preferred) - Number(a.index % 2 === preferred) || a.index - b.index)[0];
  }
  private chooseHost(now = Date.now()): void {
    const humans = this.humans();
    const host = humans.find(human => human.userId === this.hostUserId);
    if (host?.connectionId) { this.hostGraceUntil = 0; return; }
    if (host && now < this.hostGraceUntil) return;
    this.hostGraceUntil = 0;
    this.hostUserId = humans.find(human => human.connectionId)?.userId ?? this.hostUserId;
  }
}
