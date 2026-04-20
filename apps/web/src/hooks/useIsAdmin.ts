import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** True when `auth.uid()` has a row in `admin_profiles` (platform admin). */
export function useIsAdmin(user: User | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("admin_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setIsAdmin(!!data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isAdmin, loading };
}
