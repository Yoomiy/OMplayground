import type { SupabaseClient } from "@supabase/supabase-js";

export type ClassroomParticipantBlockTarget = {
  participantKey: string;
  identity: string;
  displayName: string;
  guestFingerprint?: string;
};

const FINGERPRINT_PREFIX = "guest-fingerprint:";
export function readGuestFingerprint(value: unknown): string | undefined {
  return typeof value === "string" && /^v1:[a-f0-9]{64}$/.test(value)
    ? value : undefined;
}

/** One small cached set per room; empty rooms perform no fingerprint matching.
 * Refresh across service instances within 30s; local bans invalidate immediately.
 */
export class ClassroomGuestFingerprintBans {
  private rooms = new Map<string, { expiresAt: number; value: Promise<ReadonlySet<string>> }>();
  constructor(private client: SupabaseClient) {}

  invalidate(classroomId: string) { this.rooms.delete(classroomId); }

  forRoom(classroomId: string): Promise<ReadonlySet<string>> {
    const cached = this.rooms.get(classroomId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (this.rooms.size >= 128) this.rooms.delete(this.rooms.keys().next().value!);
    const entry = { expiresAt: Date.now() + 30_000, value: Promise.resolve<ReadonlySet<string>>(new Set()) };
    entry.value = (async () => {
      const { data, error } = await this.client.from("classroom_participant_blocks")
        .select("participant_key").eq("classroom_id", classroomId)
        .like("participant_key", `${FINGERPRINT_PREFIX}%`);
      if (error) throw error;
      return new Set<string>((data ?? []).map((row) => row.participant_key.slice(FINGERPRINT_PREFIX.length)));
    })().catch((error) => {
      if (this.rooms.get(classroomId) === entry) this.rooms.delete(classroomId);
      throw error;
    });
    this.rooms.set(classroomId, entry);
    return entry.value;
  }
}

const PARTICIPANT_KEY_PATTERN = /^(?:user|delegate|guest):[^\s]{1,240}$/;

export function classroomParticipantKeyFromMetadata(
  metadata: Record<string, unknown>,
  identity: string,
): string | null {
  const key = metadata.attendanceKey;
  if (typeof key === "string" && PARTICIPANT_KEY_PATTERN.test(key)) return key;

  // Authenticated classroom identities are UUIDs. Older active participants
  // may predate attendanceKey metadata, but still have a stable admission key.
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identity,
    )
  ) {
    return `user:${identity.toLowerCase()}`;
  }
  return null;
}

export async function isClassroomParticipantBlocked(
  supabaseAdmin: SupabaseClient,
  classroomId: string,
  participantKey: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("classroom_participant_blocks")
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("participant_key", participantKey)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function blockClassroomParticipant(
  supabaseAdmin: SupabaseClient,
  classroomId: string,
  target: ClassroomParticipantBlockTarget,
): Promise<void> {
  const row = {
    classroom_id: classroomId,
    participant_key: target.participantKey,
    participant_identity: target.identity,
    display_name: target.displayName,
  };
  const fingerprint = target.participantKey.startsWith("guest:")
    ? readGuestFingerprint(target.guestFingerprint) : undefined;
  const { error } = await supabaseAdmin
    .from("classroom_participant_blocks")
    .upsert(
      fingerprint ? [row, { ...row, participant_key: FINGERPRINT_PREFIX + fingerprint }] : row,
      { onConflict: "classroom_id,participant_key" },
    );
  if (error) throw error;
}
