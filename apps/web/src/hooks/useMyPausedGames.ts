import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface MyPausedGameRow {
  id: string;
  host_name: string;
  game_id: string;
  last_activity: string | null;
  connected_player_ids: string[];
  connected_player_names: string[];
  games: { name_he: string } | null;
}

/**
 * Paused sessions this kid is still listed on (`player_ids`), same gender via RLS.
 */
export function useMyPausedGames(userId: string | undefined) {
  const [rows, setRows] = useState<MyPausedGameRow[]>([]);
  const [loading, setLoading] = useState(false);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const refetch = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("game_sessions")
      .select(
        "id, host_name, game_id, last_activity, connected_player_ids, connected_player_names, games ( name_he )"
      )
      .eq("status", "paused")
      .contains("player_ids", [userId])
      .order("last_activity", { ascending: false })
      .limit(20);
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as MyPausedGameRow[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      prevUserIdRef.current = undefined;
      return;
    }

    const userChanged = prevUserIdRef.current !== userId;
    prevUserIdRef.current = userId;
    if (userChanged) {
      setLoading(true);
    }

    void refetch();

    const channel = supabase
      .channel(`paused-games:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_sessions" },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  return { rows, loading, refetch };
}
