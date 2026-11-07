import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { reportCaughtError } from "@/utils/telemetry";

export interface KidProfileRow {
  id: string;
  username: string;
  full_name: string;
  gender: "boy" | "girl";
  grade: string;
  role: "kid" | "teacher";
  is_active: boolean;
  avatar_color: string;
  avatar_preset_id: string | null;
  avatar_url: string | null;
  unread_message_count: number;
  best_scores: Record<string, number>;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

const PROFILE_SELECT =
  "id, username, full_name, gender, grade, role, is_active, avatar_color, avatar_preset_id, avatar_url, unread_message_count, best_scores, last_seen, created_at, updated_at";

type PlaygroundUserContextValue = {
  profile: KidProfileRow | null;
  profileLoading: boolean;
  profileError: string | null;
  refetchProfile: () => Promise<void>;
  isAdmin: boolean;
  adminLoading: boolean;
};

const PlaygroundUserContext = createContext<PlaygroundUserContextValue | null>(null);

export function PlaygroundUserProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<KidProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const activeUserIdRef = useRef<string | null>(null);

  const refetchProfile = useCallback(async () => {
    const userId = activeUserIdRef.current;
    if (!userId) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from("kid_profiles")
        .select(PROFILE_SELECT)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (activeUserIdRef.current !== userId) return;
      setProfile(data as KidProfileRow | null);
    } catch (error) {
      if (activeUserIdRef.current !== userId) return;
      // Keep the last successful profile so a background failure cannot discard forms or a game.
      setProfileError("לא ניתן לעדכן את הפרופיל כרגע. אפשר לנסות שוב");
      reportCaughtError("Profile query failed", error, { appArea: "profile", operation: "load" });
    } finally {
      if (activeUserIdRef.current === userId) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    let cancelled = false;
    setProfile(null);
    setIsAdmin(false);
    setProfileLoading(true);
    setAdminLoading(true);
    setProfileError(null);

    void (async () => {
      const [profileResult, adminResult] = await Promise.allSettled([
        supabase.from("kid_profiles").select(PROFILE_SELECT).eq("id", user.id).maybeSingle(),
        supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
      ]);

      if (cancelled || activeUserIdRef.current !== user.id) return;

      if (profileResult.status === "rejected" || profileResult.value.error) {
        setProfileError("לא ניתן לטעון את הפרופיל כרגע. אפשר לנסות שוב");
        reportCaughtError(
          "Profile query failed",
          profileResult.status === "rejected" ? profileResult.reason : profileResult.value.error,
          { appArea: "profile", operation: "load" },
        );
      } else {
        setProfile(profileResult.value.data as KidProfileRow | null);
      }
      setIsAdmin(
        adminResult.status === "fulfilled" && !adminResult.value.error && !!adminResult.value.data,
      );
      setProfileLoading(false);
      setAdminLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const value = useMemo<PlaygroundUserContextValue>(
    () => ({
      profile,
      profileLoading,
      profileError,
      refetchProfile,
      isAdmin,
      adminLoading,
    }),
    [profile, profileLoading, profileError, refetchProfile, isAdmin, adminLoading],
  );

  return <PlaygroundUserContext.Provider value={value}>{children}</PlaygroundUserContext.Provider>;
}

function usePlaygroundUserContext(): PlaygroundUserContextValue {
  const ctx = useContext(PlaygroundUserContext);
  if (!ctx) {
    throw new Error("useProfile/useIsAdmin must be used within PlaygroundUserProvider");
  }
  return ctx;
}

export function useProfile() {
  const { profile, profileLoading, profileError, refetchProfile } = usePlaygroundUserContext();
  return {
    profile,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  };
}

export function useIsAdmin() {
  const { isAdmin, adminLoading } = usePlaygroundUserContext();
  return { isAdmin, loading: adminLoading };
}
