import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getPlaygroundAccessForUser,
  RECESS_RECHECK_MS,
  type PlaygroundAccessResult
} from "@/lib/recessAccess";

export function usePlaygroundAccess(user: User | null) {
  const [result, setResult] = useState<PlaygroundAccessResult | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const next = await getPlaygroundAccessForUser(user.id);
    setResult(next);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void getPlaygroundAccessForUser(user.id).then((next) => {
      if (cancelled) return;
      setResult(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || result?.role !== "kid") return;
    const interval = window.setInterval(() => void refresh(), RECESS_RECHECK_MS);
    return () => window.clearInterval(interval);
  }, [refresh, result?.role, user]);

  return { result, loading, refresh };
}
