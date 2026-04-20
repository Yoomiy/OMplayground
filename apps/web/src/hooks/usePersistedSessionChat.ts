import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface ChatLineRow {
  id: string;
  sender_name: string;
  message: string;
  timestamp: string;
  is_system: boolean;
}

/**
 * Single source of truth for in-session chat UI: Postgres + Realtime (teacher moderation + kid view stay in sync).
 */
export function usePersistedSessionChat(sessionId: string | undefined) {
  const [lines, setLines] = useState<ChatLineRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    const { data, error: qErr } = await supabase
      .from("chat_messages")
      .select("id, sender_name, message, timestamp, is_system")
      .eq("session_id", sessionId)
      .eq("is_deleted", false)
      .order("timestamp", { ascending: true })
      .limit(200);
    if (qErr) {
      setError(qErr.message);
      return;
    }
    setLines((data ?? []) as ChatLineRow[]);
    setError(null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    void reload();
    const ch = supabase
      .channel(`session-chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`
        },
        () => {
          void reload();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [sessionId, reload]);

  return { lines, error, reload };
}
