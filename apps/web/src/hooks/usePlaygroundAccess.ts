import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  accessAfterCheck,
  getPlaygroundAccessForUser,
  RECESS_RECHECK_MS,
  type PlaygroundAccessResult,
} from "@/lib/recessAccess";

export function usePlaygroundAccess(user: User | null) {
  const userId = user?.id ?? null;
  const [state, setState] = useState<{
    userId: string;
    result: PlaygroundAccessResult;
    reopenedAt: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const scope = useRef(userId);
  scope.current = userId;
  const sequence = useRef(0);
  const pending = useRef<{ userId: string; promise: Promise<void> } | null>(
    null,
  );
  const result = state?.userId === userId ? state.result : null;
  const refresh = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    if (pending.current?.userId === userId) return pending.current.promise;
    const request = ++sequence.current;
    setLoading(true);
    const promise = (async () => {
      let next: PlaygroundAccessResult;
      try {
        next = await getPlaygroundAccessForUser(userId);
      } catch {
        next = {
          allowed: false,
          reason: "profile_error",
          message: "לא ניתן לבדוק כרגע את החיבור. ננסה שוב בקרוב.",
        };
      }
      if (scope.current !== userId || sequence.current !== request) return;
      const checkedAt = Date.now();
      setState((previous) => {
        const current = previous?.userId === userId ? previous : null;
        const result = accessAfterCheck(current?.result ?? null, next);
        const wasOutsideRecess = current?.result.allowed === false
          && current.result.reason === "outside_recess";
        let reopenedAt = null;
        if (result.allowed && result.role === "kid") {
          reopenedAt = wasOutsideRecess ? checkedAt : current?.reopenedAt ?? null;
        }
        return { userId, result, reopenedAt };
      });
      setLoading(false);
    })().finally(() => {
      if (pending.current?.promise === promise) pending.current = null;
    });
    pending.current = { userId, promise };
    return promise;
  }, [userId]);

  useEffect(() => {
    setState((previous) => (previous?.userId === userId ? previous : null));
    if (!userId) setLoading(false);
    void refresh();
    // A known recess cutoff is also enforced when the network is unavailable.
    const online = () => void refresh();
    window.addEventListener("online", online);
    const timer = userId ? window.setInterval(online, RECESS_RECHECK_MS) : null;
    return () => {
      sequence.current++;
      pending.current = null;
      if (timer !== null) window.clearInterval(timer);
      window.removeEventListener("online", online);
    };
  }, [refresh, userId]);
  const expiresAt = result?.allowed ? result.expiresAt : undefined;
  useEffect(() => {
    if (!userId || expiresAt === undefined) return;
    const timer = window.setTimeout(
      () => {
        setState((previous) =>
          previous?.userId === userId
            ? {
                userId,
                result: accessAfterCheck(previous.result, previous.result),
                reopenedAt: null,
              }
            : previous,
        );
      },
      Math.max(0, expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [userId, expiresAt]);
  const reopenedAt = state?.userId === userId ? state.reopenedAt : null;
  return { result, loading, refresh, reopenedAt };
}
