import { supabase } from "@/lib/supabase";
import {
  isWithinEffectiveRecess,
  type ClassRecessException,
  type ClassRecessSchedule,
  type RecessWindow
} from "@playground/game-logic";

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

export const RECESS_ACCESS_CACHE_MS = 30_000;
export const RECESS_RECHECK_MS = 30_000;

const RECESS_DENIED_MESSAGE =
  "לא ניתן להתחבר מחוץ לשעות ההפסקה";

let defaultScheduleCache: { rows: RecessWindow[]; expiresAt: number } | null = null;
const classScheduleCache = new Map<string, { schedule: ClassRecessSchedule | null; expiresAt: number }>();

async function loadActiveDefaultRecessSchedules(): Promise<RecessWindow[]> {
  const now = Date.now();
  if (defaultScheduleCache && defaultScheduleCache.expiresAt > now) {
    return defaultScheduleCache.rows;
  }

  const { data, error } = await supabase
    .from("recess_schedules")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as RecessWindow[];
  defaultScheduleCache = { rows, expiresAt: now + RECESS_ACCESS_CACHE_MS };
  return rows;
}

export function isKidAllowedByRecess(
  schedules: RecessWindow[],
  now = new Date()
): boolean {
  return isWithinEffectiveRecess(now, { defaultWindows: schedules });
}

async function loadClassRecessSchedule(grade: string, gender: "boy" | "girl"): Promise<ClassRecessSchedule | null> {
  const cacheKey = `${grade}:${gender}`;
  const now = Date.now();
  const cached = classScheduleCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.schedule;

  const { data: setting, error: settingError } = await supabase
    .from("class_recess_schedule_settings")
    .select("override_enabled")
    .eq("grade", grade)
    .eq("gender", gender)
    .maybeSingle();
  if (settingError) throw new Error(settingError.message);

  if (!setting) {
    classScheduleCache.set(cacheKey, { schedule: null, expiresAt: now + RECESS_ACCESS_CACHE_MS });
    return null;
  }

  const { data: exceptions, error: exceptionsError } = await supabase
    .from("class_recess_schedule_exceptions")
    .select("day_of_week, start_time, end_time, mode, is_active")
    .eq("grade", grade)
    .eq("gender", gender);
  if (exceptionsError) throw new Error(exceptionsError.message);

  const schedule: ClassRecessSchedule = {
    overrideEnabled: Boolean(setting.override_enabled),
    exceptions: (exceptions ?? []) as ClassRecessException[]
  };
  classScheduleCache.set(cacheKey, { schedule, expiresAt: now + RECESS_ACCESS_CACHE_MS });
  return schedule;
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
    .select("role, is_active, grade, gender")
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
    const profileData = profile as { grade?: string; gender?: "boy" | "girl" };
    if (!profileData.grade || (profileData.gender !== "boy" && profileData.gender !== "girl")) {
      throw new Error("missing_class_profile");
    }
    const [schedules, classSchedule] = await Promise.all([
      loadActiveDefaultRecessSchedules(),
      loadClassRecessSchedule(profileData.grade, profileData.gender)
    ]);
    if (isWithinEffectiveRecess(now, { defaultWindows: schedules, classSchedule })) {
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
  defaultScheduleCache = null;
  classScheduleCache.clear();
}
