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
 * Global Realtime presence — one channel keyed on the kid's gender so
 * same-gender kids see each other. Mounted once above the router so it
 * survives navigation (no remount / no blank-flash).
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
  const { profile } = useProfile(user);
  const { isAdmin } = useIsAdmin(user);
  const userId = user?.id;
  const gender = profile?.gender;
  /** Only same-gender kids count as "online" for the playground presence channel. */
  const shouldTrackPresence =
    Boolean(userId && gender) &&
    profile?.role === "kid" &&
    !isAdmin;

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    () => new Set<string>()
  );

  useEffect(() => {
    if (!shouldTrackPresence || !userId || !gender) {
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
      setOnlineUserIds(next);
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, gender, shouldTrackPresence]);

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
