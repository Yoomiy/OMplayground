"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLASSROOM_DELEGATE_SCOPES = void 0;
exports.findActiveClassroomDelegateByParticipantKey = findActiveClassroomDelegateByParticipantKey;
exports.ensureActiveClassroomDelegate = ensureActiveClassroomDelegate;
exports.delegateCookieName = delegateCookieName;
exports.hasClassroomDelegateCookie = hasClassroomDelegateCookie;
exports.newOpaqueSecret = newOpaqueSecret;
exports.secretHash = secretHash;
exports.findClassroomDelegateAuthority = findClassroomDelegateAuthority;
exports.createClassroomDelegateGameToken = createClassroomDelegateGameToken;
exports.verifyClassroomDelegateGameToken = verifyClassroomDelegateGameToken;
const crypto_1 = require("crypto");
exports.CLASSROOM_DELEGATE_SCOPES = [
    "manage_settings",
    "remove_participants",
    "manage_whiteboard",
    "control_presentation",
    "manage_delegates",
];
async function findActiveClassroomDelegateByParticipantKey(supabase, classroomId, participantKey) {
    const { data, error } = await supabase
        .from("classroom_host_delegates")
        .select("id")
        .eq("classroom_id", classroomId)
        .eq("participant_key", participantKey)
        .eq("is_active", true)
        .maybeSingle();
    if (error)
        throw error;
    return data;
}
async function ensureActiveClassroomDelegate(supabase, input) {
    const existing = await findActiveClassroomDelegateByParticipantKey(supabase, input.classroomId, input.participantKey);
    if (existing)
        return { id: existing.id, created: false };
    const { data: inserted, error: insertError } = await supabase
        .from("classroom_host_delegates")
        .insert({
        classroom_id: input.classroomId,
        display_name: input.displayName,
        participant_key: input.participantKey,
        scopes: [...input.scopes],
        created_by: input.createdBy,
    })
        .select("id")
        .single();
    if (!insertError && inserted)
        return { id: inserted.id, created: true };
    if (insertError?.code !== "23505") {
        throw insertError ?? new Error("delegate_create_failed");
    }
    // A concurrent request may have inserted the same active participant after
    // our initial read. Resolve the winner instead of surfacing a false 500.
    const concurrent = await findActiveClassroomDelegateByParticipantKey(supabase, input.classroomId, input.participantKey);
    if (!concurrent)
        throw insertError;
    return { id: concurrent.id, created: false };
}
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function parseCookies(header) {
    if (!header)
        return {};
    return Object.fromEntries(header.split(";").flatMap((part) => {
        const index = part.indexOf("=");
        if (index < 1)
            return [];
        return [
            [
                part.slice(0, index).trim(),
                decodeURIComponent(part.slice(index + 1).trim()),
            ],
        ];
    }));
}
function delegateCookieName(delegateId) {
    return `classroom_delegate_${delegateId}`;
}
function hasClassroomDelegateCookie(req, delegateId) {
    return Boolean(parseCookies(req.headers.cookie)[delegateCookieName(delegateId)]);
}
function newOpaqueSecret() {
    return (0, crypto_1.randomBytes)(32).toString("base64url");
}
function secretHash(secret) {
    return sha256(secret);
}
async function findClassroomDelegateAuthority(supabase, req, classroomId, requiredScope) {
    const cookies = parseCookies(req.headers.cookie);
    const candidates = Object.entries(cookies)
        .filter(([name]) => /^classroom_delegate_[0-9a-f-]{36}$/i.test(name))
        .slice(0, 20);
    for (const [name, value] of candidates) {
        const delegateId = name.slice("classroom_delegate_".length);
        const [sessionId, secret] = value.split(".", 2);
        if (!sessionId || !secret)
            continue;
        const { data: session, error: sessionError } = await supabase
            .from("classroom_delegate_sessions")
            .select("id, delegate_id, expires_at, revoked_at")
            .eq("id", sessionId)
            .eq("delegate_id", delegateId)
            .eq("token_hash", secretHash(secret))
            .maybeSingle();
        if (sessionError)
            throw sessionError;
        if (!session ||
            session.revoked_at ||
            new Date(session.expires_at).getTime() <= Date.now())
            continue;
        const { data: delegate, error: delegateError } = await supabase
            .from("classroom_host_delegates")
            .select("id, classroom_id, display_name, participant_key, scopes, is_active")
            .eq("id", delegateId)
            .eq("classroom_id", classroomId)
            .maybeSingle();
        if (delegateError)
            throw delegateError;
        if (!delegate?.is_active)
            continue;
        const scopes = (delegate.scopes ?? []).filter((scope) => exports.CLASSROOM_DELEGATE_SCOPES.includes(scope));
        if (requiredScope && !scopes.includes(requiredScope))
            continue;
        void supabase
            .from("classroom_delegate_sessions")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", session.id);
        void supabase
            .from("classroom_host_delegates")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", delegate.id);
        return {
            delegateId: delegate.id,
            classroomId: delegate.classroom_id,
            displayName: delegate.display_name,
            participantKey: delegate.participant_key,
            scopes,
        };
    }
    return null;
}
function gameTokenSignature(payload, secret) {
    return (0, crypto_1.createHmac)("sha256", secret)
        .update(`classroom-delegate.${payload}`)
        .digest("base64url");
}
function createClassroomDelegateGameToken(payload, secret) {
    const encoded = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 5 * 60 })).toString("base64url");
    return `${encoded}.${gameTokenSignature(encoded, secret)}`;
}
function verifyClassroomDelegateGameToken(token, secret) {
    const [encoded, signature] = token.split(".", 2);
    if (!encoded || !signature)
        return null;
    const expected = gameTokenSignature(encoded, secret);
    if (signature.length !== expected.length)
        return null;
    if (!(0, crypto_1.timingSafeEqual)(Buffer.from(signature), Buffer.from(expected)))
        return null;
    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        if (typeof payload.delegateId !== "string" ||
            typeof payload.classroomId !== "string" ||
            typeof payload.roomCode !== "string" ||
            typeof payload.identity !== "string" ||
            typeof payload.exp !== "number" ||
            payload.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=classroomDelegates.js.map