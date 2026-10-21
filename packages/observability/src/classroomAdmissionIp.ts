import type { readSecurityClientIp } from "./clientIp";

type IpEvidence = ReturnType<typeof readSecurityClientIp>;
type Entry = {
  roomCode: string;
  participantIdentity: string;
  ip: IpEvidence;
  expiresAt: number;
};

/** Server-only association. Never put IP evidence in LiveKit token metadata. */
export class ClassroomAdmissionIpCache {
  private entries = new Map<string, Entry>();

  constructor(private readonly maxEntries = 10_000, private readonly ttlMs = 5 * 60 * 60_000,
    private readonly now: () => number = Date.now) {}

  remember(roomCode: string, admissionId: string, participantIdentity: string, ip: IpEvidence): void {
    this.entries.delete(admissionId);
    this.entries.set(admissionId, { roomCode, participantIdentity, ip, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }

  lookup(roomCode: string, admissionId?: string, participantIdentity?: string) {
    const entry = admissionId ? this.entries.get(admissionId) : undefined;
    if (!entry || entry.roomCode !== roomCode || entry.participantIdentity !== participantIdentity || entry.expiresAt <= this.now()) {
      if (entry && entry.expiresAt <= this.now()) this.entries.delete(admissionId!);
      return {
        ipStatus: "unavailable" as const, ipSource: "unavailable" as const,
        ipObservation: "admission" as const, ipUnavailableReason: "admission_not_cached" as const
      };
    }
    // Active classroom snapshots refresh the bounded association for long lessons.
    entry.expiresAt = this.now() + this.ttlMs;
    this.entries.delete(admissionId!);
    this.entries.set(admissionId!, entry);
    return { ...entry.ip, ipObservation: "admission" as const };
  }
}

export const classroomAdmissionIps = new ClassroomAdmissionIpCache();
