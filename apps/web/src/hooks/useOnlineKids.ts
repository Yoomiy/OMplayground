import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useOnlinePresence } from "@/hooks/usePresence";

export interface PublicKidProfile {
  id: string;
  username: string;
  full_name: string;
  gender: "boy" | "girl";
  grade: number;
  avatar_color: string;
  avatar_preset_id: string | null;
  avatar_url: string | null;
  role: "kid" | "teacher";
}

/** Simple module-scope cache so navigation doesn't re-fetch every profile. */
const cache = new Map<string, PublicKidProfile>();

/**
 * Returns the subset of `onlineUserIds` that correspond to visible
 * same-gender kid profiles (RLS enforces same-gender).
 */
export function useOnlineKids(excludeSelf = true) {
  const { user } = useAuth();
  const { onlineUserIds } = useOnlinePresence();
  const [kids, setKids] = useState<PublicKidProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const wantedIds = useMemo(() => {
    const ids = Array.from(onlineUserIds);
    return excludeSelf && user ? ids.filter((i) => i !== user.id) : ids;
  }, [onlineUserIds, user, excludeSelf]);

  useEffect(() => {
    let cancelled = false;
    if (wantedIds.length === 0) {
      setKids([]);
      return;
    }
    const missing = wantedIds.filter((id) => !cache.has(id));
    if (missing.length === 0) {
      setKids(
        wantedIds
          .map((id) => cache.get(id))
          .filter((p): p is PublicKidProfile => Boolean(p))
      );
      return;
    }
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from("public_kid_profiles")
        .select(
          "id, username, full_name, gender, grade, avatar_color, avatar_preset_id, avatar_url, role"
        )
        .in("id", missing)
        .eq("role", "kid");
      if (cancelled) return;
      if (!error && data) {
        for (const row of data as PublicKidProfile[]) {
          cache.set(row.id, row);
        }
      }
      setKids(
        wantedIds
          .map((id) => cache.get(id))
          .filter((p): p is PublicKidProfile => Boolean(p))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [wantedIds.join("|")]);

  return { kids, loading };
}
