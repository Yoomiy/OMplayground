import type { SupabaseClient } from "@supabase/supabase-js";

export type ClassroomParticipantBlockTarget = {
  participantKey: string;
  identity: string;
  displayName: string;
};

const PARTICIPANT_KEY_PATTERN = /^(?:user|delegate|guest):[^\s]{1,240}$/;

export function classroomParticipantKeyFromMetadata(
  metadata: Record<string, unknown>,
  identity: string
): string | null {
  const key = metadata.attendanceKey;
  if (typeof key === "string" && PARTICIPANT_KEY_PATTERN.test(key)) return key;

  // Authenticated classroom identities are UUIDs. Older active participants
  // may predate attendanceKey metadata, but still have a stable admission key.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity)) {
    return `user:${identity.toLowerCase()}`;
  }
  return null;
}

export async function isClassroomParticipantBlocked(
  supabaseAdmin: SupabaseClient,
  classroomId: string,
  participantKey: string
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
  target: ClassroomParticipantBlockTarget
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("classroom_participant_blocks")
    .upsert(
      {
        classroom_id: classroomId,
        participant_key: target.participantKey,
        participant_identity: target.identity,
        display_name: target.displayName
      },
      { onConflict: "classroom_id,participant_key" }
    );
  if (error) throw error;
}
