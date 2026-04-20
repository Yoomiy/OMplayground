import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { respondToFriendRequest } from "@/lib/friendsApi";
import type { FriendshipRow } from "@/hooks/useFriendships";

/**
 * Tracks the most recent incoming pending friend request for the current user.
 */
export function usePendingFriendRequest(userId: string | undefined) {
  const [request, setRequest] = useState<FriendshipRow | null>(null);

  useEffect(() => {
    if (!userId) {
      setRequest(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at, updated_at")
        .eq("addressee_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = (data?.[0] as FriendshipRow | undefined) ?? null;
      setRequest(row);
    })();

    const channel = supabase
      .channel(`friend-requests:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${userId}`
        },
        (payload) => {
          const row = payload.new as FriendshipRow;
          if (row.status === "pending") {
            setRequest(row);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${userId}`
        },
        (payload) => {
          const row = payload.new as FriendshipRow;
          setRequest((prev) => {
            if (!prev || prev.id !== row.id) return prev;
            if (row.status !== "pending") return null;
            return row;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const accept = useCallback(async () => {
    if (!request) return;
    await respondToFriendRequest(request.id, true);
    setRequest(null);
  }, [request]);

  const decline = useCallback(async () => {
    if (!request) return;
    await respondToFriendRequest(request.id, false);
    setRequest(null);
  }, [request]);

  return { request, accept, decline };
}
