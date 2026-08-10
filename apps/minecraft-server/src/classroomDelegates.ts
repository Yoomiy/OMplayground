import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CLASSROOM_DELEGATE_SCOPES = [
  "manage_settings",
  "remove_participants",
  "manage_whiteboard",
  "control_presentation",
  "manage_delegates"
] as const;

export type ClassroomDelegateScope = (typeof CLASSROOM_DELEGATE_SCOPES)[number];

export interface ClassroomDelegateAuthority {
  delegateId: string;
  classroomId: string;
  displayName: string;
  scopes: ClassroomDelegateScope[];
}

interface DelegateRow {
  id: string;
  classroom_id: string;
  display_name: string;
  scopes: string[] | null;
  is_active: boolean;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const index = part.indexOf("=");
      if (index < 1) return [];
      return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
    })
  );
}

export function delegateCookieName(delegateId: string): string {
  return `classroom_delegate_${delegateId}`;
}

export function newOpaqueSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function secretHash(secret: string): string {
  return sha256(secret);
}

export async function findClassroomDelegateAuthority(
  supabase: SupabaseClient,
  req: Request,
  classroomId: string,
  requiredScope?: ClassroomDelegateScope
): Promise<ClassroomDelegateAuthority | null> {
  const cookies = parseCookies(req.headers.cookie);
  const candidates = Object.entries(cookies)
    .filter(([name]) => /^classroom_delegate_[0-9a-f-]{36}$/i.test(name))
    .slice(0, 20);

  for (const [name, value] of candidates) {
    const delegateId = name.slice("classroom_delegate_".length);
    const [sessionId, secret] = value.split(".", 2);
    if (!sessionId || !secret) continue;

    const { data: session } = await supabase
      .from("classroom_delegate_sessions")
      .select("id, delegate_id, expires_at, revoked_at")
      .eq("id", sessionId)
      .eq("delegate_id", delegateId)
      .eq("token_hash", secretHash(secret))
      .maybeSingle();
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) continue;

    const { data: delegate } = await supabase
      .from("classroom_host_delegates")
      .select("id, classroom_id, display_name, scopes, is_active")
      .eq("id", delegateId)
      .eq("classroom_id", classroomId)
      .maybeSingle<DelegateRow>();
    if (!delegate?.is_active) continue;

    const scopes = (delegate.scopes ?? []).filter((scope): scope is ClassroomDelegateScope =>
      (CLASSROOM_DELEGATE_SCOPES as readonly string[]).includes(scope)
    );
    if (requiredScope && !scopes.includes(requiredScope)) continue;

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
      scopes
    };
  }
  return null;
}

export interface ClassroomDelegateGameTokenPayload {
  delegateId: string;
  classroomId: string;
  roomCode: string;
  identity: string;
  exp: number;
}

function gameTokenSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`classroom-delegate.${payload}`).digest("base64url");
}

export function createClassroomDelegateGameToken(
  payload: Omit<ClassroomDelegateGameTokenPayload, "exp">,
  secret: string
): string {
  const encoded = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 5 * 60 })
  ).toString("base64url");
  return `${encoded}.${gameTokenSignature(encoded, secret)}`;
}

export function verifyClassroomDelegateGameToken(
  token: string,
  secret: string
): ClassroomDelegateGameTokenPayload | null {
  const [encoded, signature] = token.split(".", 2);
  if (!encoded || !signature) return null;
  const expected = gameTokenSignature(encoded, secret);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof payload.delegateId !== "string" ||
      typeof payload.classroomId !== "string" ||
      typeof payload.roomCode !== "string" ||
      typeof payload.identity !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as ClassroomDelegateGameTokenPayload;
  } catch {
    return null;
  }
}
