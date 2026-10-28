"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classroomParticipantKeyFromMetadata = classroomParticipantKeyFromMetadata;
exports.isClassroomParticipantBlocked = isClassroomParticipantBlocked;
exports.blockClassroomParticipant = blockClassroomParticipant;
const PARTICIPANT_KEY_PATTERN = /^(?:user|delegate|guest):[^\s]{1,240}$/;
function classroomParticipantKeyFromMetadata(metadata, identity) {
    const key = metadata.attendanceKey;
    if (typeof key === "string" && PARTICIPANT_KEY_PATTERN.test(key))
        return key;
    // Authenticated classroom identities are UUIDs. Older active participants
    // may predate attendanceKey metadata, but still have a stable admission key.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity)) {
        return `user:${identity.toLowerCase()}`;
    }
    return null;
}
async function isClassroomParticipantBlocked(supabaseAdmin, classroomId, participantKey) {
    const { data, error } = await supabaseAdmin
        .from("classroom_participant_blocks")
        .select("id")
        .eq("classroom_id", classroomId)
        .eq("participant_key", participantKey)
        .maybeSingle();
    if (error)
        throw error;
    return Boolean(data);
}
async function blockClassroomParticipant(supabaseAdmin, classroomId, target) {
    const { error } = await supabaseAdmin
        .from("classroom_participant_blocks")
        .upsert({
        classroom_id: classroomId,
        participant_key: target.participantKey,
        participant_identity: target.identity,
        display_name: target.displayName,
    }, { onConflict: "classroom_id,participant_key" });
    if (error)
        throw error;
}
//# sourceMappingURL=classroomParticipantBlocks.js.map