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

  if (token.startsWith("guest:")) {
    const parts = token.split(":");
    const userId = parts[1] || `guest-${Math.random().toString(36).substring(2, 9)}`;
    const displayName = parts[2] ? decodeURIComponent(parts[2]) : "משתתף";
    const result: CachedAuthResult = {
      userId,
      role: "student",
      gender: "boy",
      full_name: displayName,
      is_active: true
    };
    authCache.set(token, { result, expiresAt: now + AUTH_TTL_MS });
    return result;
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

  if (profile && !error && profile.is_active) {
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

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, full_name")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (adminError || !admin) throw new Error("FORBIDDEN");

  const result: CachedAuthResult = {
    userId: admin.id as string,
    role: "admin",
    gender: "boy",
    full_name: admin.full_name as string,
    is_active: true
  };

  authCache.set(token, { result, expiresAt: now + AUTH_TTL_MS });
  return result;
}
