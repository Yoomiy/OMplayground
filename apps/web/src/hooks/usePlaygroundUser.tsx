import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export interface KidProfileRow {
  id: string;
  username: string;
  full_name: string;
  gender: "boy" | "girl";
  grade: number;
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

const PlaygroundUserContext = createContext<PlaygroundUserContextValue | null>(
  null
);

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
    const { data, error: qErr } = await supabase
      .from("kid_profiles")
      .select(PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle();
    if (activeUserIdRef.current !== userId) return;
    if (qErr) {
      setProfileError(qErr.message);
      setProfile(null);
    } else {
      setProfile(data as KidProfileRow | null);
    }
    setProfileLoading(false);
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
    setProfileLoading(true);
    setAdminLoading(true);
    setProfileError(null);

    void (async () => {
      const [profileRes, adminRes] = await Promise.all([
        supabase
          .from("kid_profiles")
          .select(PROFILE_SELECT)
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("admin_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle()
      ]);

      if (cancelled || activeUserIdRef.current !== user.id) return;

      if (profileRes.error) {
        setProfileError(profileRes.error.message);
        setProfile(null);
      } else {
        setProfile(profileRes.data as KidProfileRow | null);
      }
      setIsAdmin(!!adminRes.data);
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
      adminLoading
    }),
    [profile, profileLoading, profileError, refetchProfile, isAdmin, adminLoading]
  );

  return (
    <PlaygroundUserContext.Provider value={value}>
      {children}
    </PlaygroundUserContext.Provider>
  );
}

function usePlaygroundUserContext(): PlaygroundUserContextValue {
  const ctx = useContext(PlaygroundUserContext);
  if (!ctx) {
    throw new Error(
      "useProfile/useIsAdmin must be used within PlaygroundUserProvider"
    );
  }
  return ctx;
}

export function useProfile() {
  const { profile, profileLoading, profileError, refetchProfile } =
    usePlaygroundUserContext();
  return {
    profile,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile
  };
}

export function useIsAdmin() {
  const { isAdmin, adminLoading } = usePlaygroundUserContext();
  return { isAdmin, loading: adminLoading };
}
