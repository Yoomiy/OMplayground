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
      setState((previous) => ({
        userId,
        result: accessAfterCheck(
          previous?.userId === userId ? previous.result : null,
          next,
        ),
      }));
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
  useEffect(() => {
    if (!userId || !result?.allowed || result.expiresAt === undefined) return;
    const timer = window.setTimeout(
      () => {
        setState((previous) =>
          previous?.userId === userId
            ? {
                userId,
                result: accessAfterCheck(previous.result, previous.result),
              }
            : previous,
        );
      },
      Math.max(0, result.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [userId, result]);
  return { result, loading, refresh };
}
