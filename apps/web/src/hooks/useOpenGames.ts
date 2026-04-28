import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface OpenGameRow {
  id: string;
  game_id: string;
  host_id: string;
  host_name: string;
  player_ids: string[];
  player_names: string[];
  connected_player_names: string[];
  status: "waiting" | "playing" | "paused" | "completed";
  is_open: boolean;
  gender: "boy" | "girl";
  invitation_code: string;
  host_grade: number | null;
  created_at: string;
  games: { name_he: string } | null;
}

/**
 * Open sessions in the same-gender partition the current kid can join.
 * RLS already restricts rows to same-gender via kid_profiles.gender match
 * through the existing `game_sessions_select_participant_or_gender` policy.
 */
export function useOpenGames(userId: string | undefined) {
  const [rows, setRows] = useState<OpenGameRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const refetch = async () => {
      const { data } = await supabase
        .from("game_sessions")
        .select(
          "id, game_id, host_id, host_name, player_ids, player_names, connected_player_names, status, is_open, gender, invitation_code, host_grade, created_at, games ( name_he )"
        )
        .eq("is_open", true)
        .in("status", ["waiting", "playing"])
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      const filtered = ((data ?? []) as unknown as OpenGameRow[]).filter(
        (r) => !r.player_ids.includes(userId)
      );
      setRows(filtered);
      setLoading(false);
    };

    void refetch();

    const channel = supabase
      .channel(`open-games:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_sessions" },
        () => {
          void refetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions" },
        () => {
          void refetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "game_sessions" },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { rows, loading };
}
