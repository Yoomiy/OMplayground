import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
  pending_challenge: unknown;
  unread_message_count: number;
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<KidProfileRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const { data, error: qErr } = await supabase
        .from("kid_profiles")
        .select(
          "id, username, full_name, gender, grade, role, is_active, avatar_color, avatar_preset_id, avatar_url, pending_challenge, unread_message_count"
        )
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setProfile(null);
      } else {
        setProfile(data as KidProfileRow | null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { profile, loading, error };
}
