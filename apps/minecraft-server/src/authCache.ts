import { SupabaseClient } from "@supabase/supabase-js";

export interface CachedAuthResult {
  userId: string;
  role: string;
  gender: "boy" | "girl";
  full_name: string;
  is_active: boolean;
}

const authCache = new Map<string, { result: CachedAuthResult; expiresAt: number }>();
const AUTH_TTL_MS = 30_000; // 30 seconds

export async function getCachedAuth(
  supabaseAdmin: SupabaseClient,
  token: string
): Promise<CachedAuthResult> {
  const now = Date.now();
  const cached = authCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const { data: profile, error } = await supabaseAdmin
    .from("kid_profiles")
    .select("id, role, gender, full_name, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !profile || !profile.is_active) {
    throw new Error("FORBIDDEN");
  }

  const result: CachedAuthResult = {
    userId: profile.id as string,
    role: profile.role as string,
    gender: profile.gender as "boy" | "girl",
    full_name: profile.full_name as string,
    is_active: profile.is_active as boolean
  };

  authCache.set(token, { result, expiresAt: now + AUTH_TTL_MS });
  return result;
}
