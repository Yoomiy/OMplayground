import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isClassroomDrawingSession } from "@/lib/drawingSessionScope";

export interface MyPausedGameRow {
  id: string;
  status: "paused" | "playing";
  host_name: string;
  game_id: string;
  last_activity: string | null;
  connected_player_ids: string[];
  connected_player_names: string[];
  invitation_code: string;
  games: { name_he: string } | null;
}

/**
 * Active sessions this kid is still listed on but is not currently connected to.
 * A session can be playing while other roster members have yet to rejoin.
 */
export function useMyPausedGames(userId: string | undefined, gender: "boy" | "girl" | undefined) {
  const [rows, setRows] = useState<MyPausedGameRow[]>([]);
  const [loading, setLoading] = useState(false);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const rowsRef = useRef<MyPausedGameRow[]>([]);
  rowsRef.current = rows;
  const userIdRef = useRef<string | undefined>(userId);
  userIdRef.current = userId;

  const refetch = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("game_sessions")
      .select(
        "id, status, host_name, game_id, last_activity, invitation_code, connected_player_ids, connected_player_names, games ( name_he )"
      )
      .in("status", ["paused", "playing"])
      .contains("player_ids", [userId])
      .not("invitation_code", "like", "class-draw-%")
      .order("last_activity", { ascending: false })
      .limit(20);
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows(
        ((data ?? []) as unknown as MyPausedGameRow[]).filter(
          (row) =>
            !isClassroomDrawingSession(row.invitation_code) &&
            !row.connected_player_ids.includes(userId)
        )
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId || !gender) {
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

    const isRejoinableSession = (row: any, currentUserId: string) =>
      (row.status === "paused" || row.status === "playing") &&
      Array.isArray(row.player_ids) &&
      row.player_ids.includes(currentUserId) &&
      !isClassroomDrawingSession(row.invitation_code) &&
      !row.connected_player_ids?.includes(currentUserId);

    const handleRealtime = (payload: any) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;

      if (payload.eventType === "INSERT") {
        const newRow = payload.new;
        if (isRejoinableSession(newRow, currentUserId)) {
          void refetch();
        }
      } else if (payload.eventType === "DELETE") {
        const deletedId = payload.old.id;
        setRows(prev => prev.filter(r => r.id !== deletedId));
      } else if (payload.eventType === "UPDATE") {
        const newRow = payload.new;
        const exists = rowsRef.current.some(r => r.id === newRow.id);

        if (exists) {
          if (!isRejoinableSession(newRow, currentUserId)) {
            setRows(prev => prev.filter(r => r.id !== newRow.id));
          } else {
            void refetch();
          }
        } else {
          if (isRejoinableSession(newRow, currentUserId)) {
            void refetch();
          }
        }
      }
    };

    const channel = supabase
      .channel(`paused-games:${userId}`)
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
      .subscribe((connectionStatus) => {
        // Fetch after the subscription is active so an update cannot slip
        // between the initial query and the Realtime listener.
        if (connectionStatus === "SUBSCRIBED") void refetch();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, gender, refetch]);

  return { rows, loading, refetch };
}
