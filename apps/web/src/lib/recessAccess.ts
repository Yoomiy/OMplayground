import { supabase } from "@/lib/supabase";
import { isWithinRecess, type RecessWindowRow } from "@/lib/recess";

export type PlaygroundRole = "kid" | "teacher" | "admin";

export type PlaygroundAccessResult =
  | { allowed: true; role: PlaygroundRole }
  | {
      allowed: false;
      role?: PlaygroundRole;
      reason:
        | "inactive_profile"
        | "missing_profile"
        | "outside_recess"
        | "profile_error"
        | "schedule_error"
        | "unknown_role";
      message: string;
    };

export const RECESS_ACCESS_CACHE_MS = 60_000;
export const RECESS_RECHECK_MS = 30_000;

const RECESS_DENIED_MESSAGE =
  "כרגע אין הפסקה פעילה — לא ניתן להתחבר (מורים יכולים להתחבר בכל עת).";

let scheduleCache:
  | { rows: RecessWindowRow[]; expiresAt: number }
  | null = null;

async function loadActiveRecessSchedules(): Promise<RecessWindowRow[]> {
  const now = Date.now();
  if (scheduleCache && scheduleCache.expiresAt > now) {
    return scheduleCache.rows;
  }

  const { data, error } = await supabase
    .from("recess_schedules")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as RecessWindowRow[];
  scheduleCache = { rows, expiresAt: now + RECESS_ACCESS_CACHE_MS };
  return rows;
}

export function isKidAllowedByRecess(
  schedules: RecessWindowRow[],
  now = new Date()
): boolean {
  return schedules.length > 0 && isWithinRecess(now, schedules);
}

export async function getPlaygroundAccessForUser(
  userId: string,
  now = new Date()
): Promise<PlaygroundAccessResult> {
  const { data: adminRow, error: adminError } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (adminError) {
    return {
      allowed: false,
      reason: "profile_error",
      message: "לא ניתן לבדוק הרשאות משתמש כרגע."
    };
  }

  if (adminRow) {
    return { allowed: true, role: "admin" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("kid_profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return {
      allowed: false,
      reason: "profile_error",
      message: "לא ניתן לבדוק הרשאות משתמש כרגע."
    };
  }

  if (!profile) {
    return {
      allowed: false,
      reason: "missing_profile",
      message: "לא נמצא פרופיל פעיל למשתמש."
    };
  }

  const role = (profile as { role?: string }).role;
  const isActive = (profile as { is_active?: boolean }).is_active;

  if (!isActive) {
    return {
      allowed: false,
      reason: "inactive_profile",
      message: "הפרופיל אינו פעיל כרגע."
    };
  }

  if (role === "teacher") {
    return { allowed: true, role: "teacher" };
  }

  if (role !== "kid") {
    return {
      allowed: false,
      reason: "unknown_role",
      message: "תפקיד המשתמש אינו מוכר."
    };
  }

  try {
    const schedules = await loadActiveRecessSchedules();
    if (isKidAllowedByRecess(schedules, now)) {
      return { allowed: true, role: "kid" };
    }
  } catch {
    return {
      allowed: false,
      role: "kid",
      reason: "schedule_error",
      message: "לא ניתן לבדוק את זמני ההפסקה כרגע."
    };
  }

  return {
    allowed: false,
    role: "kid",
    reason: "outside_recess",
    message: RECESS_DENIED_MESSAGE
  };
}

export function clearRecessScheduleCacheForTests(): void {
  scheduleCache = null;
}
