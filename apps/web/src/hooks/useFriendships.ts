import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
}

export function useFriendships(userId: string | undefined) {
  const [rows, setRows] = useState<FriendshipRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      if (!cancelled) {
        setRows((data ?? []) as FriendshipRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { rows, loading };
}
