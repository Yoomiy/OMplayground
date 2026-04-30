import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PublicKidProfile } from "@/hooks/useOnlineKids";

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
}

export interface FriendWithProfile {
  friendship: FriendshipRow;
  partner: PublicKidProfile;
}

export interface BlockedRow {
  blocked_id: string;
  profile: PublicKidProfile | null;
}

interface Split {
  friends: FriendWithProfile[];
  incomingRequests: FriendWithProfile[];
  outgoingRequests: FriendWithProfile[];
  blocked: BlockedRow[];
}

const EMPTY: Split = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  blocked: []
};

async function hydrate(userId: string): Promise<Split> {
  const [{ data: rows }, { data: blocks }] = await Promise.all([
    supabase
      .from("friendships")
      .select(
        "id, requester_id, addressee_id, status, created_at, updated_at"
      )
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .neq("status", "declined"),
    supabase
      .from("kid_blocks")
      .select("blocked_id")
      .eq("blocker_id", userId)
  ]);

  const friendshipRows = (rows ?? []) as FriendshipRow[];
  const blockRows = (blocks ?? []) as { blocked_id: string }[];

  const partnerIds = new Set<string>();
  for (const r of friendshipRows) {
    partnerIds.add(r.requester_id === userId ? r.addressee_id : r.requester_id);
  }
  for (const b of blockRows) partnerIds.add(b.blocked_id);

  let profileMap = new Map<string, PublicKidProfile>();
  if (partnerIds.size > 0) {
    const { data: profiles } = await supabase
      .from("public_kid_profiles")
      .select(
        "id, username, full_name, gender, grade, avatar_color, avatar_preset_id, avatar_url, role"
      )
      .in("id", Array.from(partnerIds));
    profileMap = new Map(
      ((profiles ?? []) as PublicKidProfile[]).map((p) => [p.id, p])
    );
  }

  const friends: FriendWithProfile[] = [];
  const incomingRequests: FriendWithProfile[] = [];
  const outgoingRequests: FriendWithProfile[] = [];
  for (const f of friendshipRows) {
    const partnerId =
      f.requester_id === userId ? f.addressee_id : f.requester_id;
    const partner = profileMap.get(partnerId);
    if (!partner) continue;
    const item: FriendWithProfile = { friendship: f, partner };
    if (f.status === "accepted") friends.push(item);
    else if (f.status === "pending") {
      if (f.addressee_id === userId) incomingRequests.push(item);
      else outgoingRequests.push(item);
    }
  }

  const blocked: BlockedRow[] = blockRows.map((b) => ({
    blocked_id: b.blocked_id,
    profile: profileMap.get(b.blocked_id) ?? null
  }));

  return { friends, incomingRequests, outgoingRequests, blocked };
}

export function useFriendships(userId: string | undefined) {
  const [state, setState] = useState<Split>(EMPTY);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!userId) {
      setState(EMPTY);
      return;
    }
    setLoading(true);
    const next = await hydrate(userId);
    setState(next);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await hydrate(userId);
      if (!cancelled) {
        setState(next);
        setLoading(false);
      }
    })();
    setLoading(true);

    const channel = supabase
      .channel(`friends:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          void refetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kid_blocks" },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  return { ...state, loading, refetch };
}
