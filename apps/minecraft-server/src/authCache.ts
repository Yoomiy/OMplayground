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

  // 1. Check kid_profiles table
  const { data: profile } = await supabaseAdmin
    .from("kid_profiles")
    .select("id, role, gender, full_name, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profile && profile.is_active) {
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

  // 2. Check admin_profiles table (Admins are stored in admin_profiles!)
  const { data: adminProfile } = await supabaseAdmin
    .from("admin_profiles")
    .select("id, full_name")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (adminProfile) {
    const result: CachedAuthResult = {
      userId: adminProfile.id as string,
      role: "admin",
      gender: "boy",
      full_name: (adminProfile.full_name as string) || "מנהל מערכת (אדמין)",
      is_active: true
    };
    authCache.set(token, { result, expiresAt: now + AUTH_TTL_MS });
    return result;
  }

  throw new Error("FORBIDDEN");
}
