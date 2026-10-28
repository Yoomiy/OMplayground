import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Global Realtime presence — one channel keyed on gender. Kids publish their
 * presence; teachers only subscribe, so they can see connected kids without
 * appearing as challenge targets themselves.
 */
interface PresenceContextValue {
  onlineUserIds: Set<string>;
  isOnline: (id: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set<string>(),
  isOnline: () => false
});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useIsAdmin();
  const userId = user?.id;
  const gender = profile?.gender;
  const shouldSubscribeToPresence =
    Boolean(userId && gender) &&
    (profile?.role === "kid" || profile?.role === "teacher") &&
    !isAdmin;
  const shouldPublishPresence = profile?.role === "kid";

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    () => new Set<string>()
  );

  useEffect(() => {
    if (!shouldSubscribeToPresence || !userId || !gender) {
      setOnlineUserIds(new Set());
      return;
    }
    const channel = supabase.channel(`presence:playground:${gender}`, {
      config: { presence: { key: userId } }
    });

    const recompute = () => {
      const state = channel.presenceState() as Record<
        string,
        { userId?: string }[]
      >;
      const next = new Set<string>();
      for (const key of Object.keys(state)) {
        next.add(key);
      }
      setOnlineUserIds((prev) => {
        if (prev.size === next.size) {
          let same = true;
          for (const id of next) {
            if (!prev.has(id)) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return next;
      });
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          if (shouldPublishPresence) {
            await channel.track({
              userId,
              online_at: new Date().toISOString()
            });
          }
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, gender, shouldSubscribeToPresence, shouldPublishPresence]);

  const value = useMemo<PresenceContextValue>(
    () => ({
      onlineUserIds,
      isOnline: (id: string) => onlineUserIds.has(id)
    }),
    [onlineUserIds]
  );

  return (
    <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
  );
}

export function useOnlinePresence(): PresenceContextValue {
  return useContext(PresenceContext);
}
