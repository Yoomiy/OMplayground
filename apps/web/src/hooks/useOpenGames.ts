import { useEffect, useRef, useState } from "react";
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

const OPEN_GAMES_REFETCH_MS = 400;

/**
 * Open sessions in the same-gender partition the current kid can join.
 * RLS already restricts rows to same-gender via kid_profiles.gender match
 * through the existing `game_sessions_select_participant_or_gender` policy.
 */
export function useOpenGames(userId: string | undefined, gender: "boy" | "girl" | undefined) {
  const [rows, setRows] = useState<OpenGameRow[]>([]);
  const [loading, setLoading] = useState(false);
  const refetchTimerRef = useRef<number | null>(null);

  const rowsRef = useRef<OpenGameRow[]>([]);
  rowsRef.current = rows;
  const userIdRef = useRef<string | undefined>(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!userId || !gender) {
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

    const scheduleRefetch = () => {
      if (refetchTimerRef.current !== null) {
        window.clearTimeout(refetchTimerRef.current);
      }
      refetchTimerRef.current = window.setTimeout(() => {
        refetchTimerRef.current = null;
        void refetch();
      }, OPEN_GAMES_REFETCH_MS);
    };

    void refetch();

    const handleRealtime = (payload: any) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;

      if (payload.eventType === "INSERT") {
        scheduleRefetch();
      } else if (payload.eventType === "DELETE") {
        setRows(prev => prev.filter(r => r.id !== payload.old.id));
      } else if (payload.eventType === "UPDATE") {
        const newRow = payload.new;
        if (
          !newRow.is_open ||
          !["waiting", "playing"].includes(newRow.status) ||
          (newRow.player_ids && newRow.player_ids.includes(currentUserId))
        ) {
          setRows(prev => prev.filter(r => r.id !== newRow.id));
          return;
        }

        const existing = rowsRef.current.find(r => r.id === newRow.id);
        if (existing) {
          const changed =
            existing.status !== newRow.status ||
            existing.is_open !== newRow.is_open ||
            JSON.stringify(existing.player_ids) !== JSON.stringify(newRow.player_ids) ||
            JSON.stringify(existing.connected_player_names) !== JSON.stringify(newRow.connected_player_names);

          if (changed) {
            setRows(prev =>
              prev.map(r => {
                if (r.id === newRow.id) {
                  return {
                    ...r,
                    status: newRow.status,
                    is_open: newRow.is_open,
                    player_ids: newRow.player_ids,
                    player_names: newRow.player_names,
                    connected_player_names: newRow.connected_player_names
                  };
                }
                return r;
              })
            );
          }
        } else {
          scheduleRefetch();
        }
      }
    };

    const channel = supabase
      .channel(`open-games:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `gender=eq.${gender}`
        },
        handleRealtime
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (refetchTimerRef.current !== null) {
        window.clearTimeout(refetchTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [userId, gender]);

  return { rows, loading };
}

