import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PrivateMessageRow {
  id: string;
  from_kid_id: string | null;
  is_from_admin: boolean;
  from_display_name: string;
  to_kid_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export function useInbox(userId: string | undefined) {
  const [messages, setMessages] = useState<PrivateMessageRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from("private_messages")
        .select(
          "id, from_kid_id, is_from_admin, from_display_name, to_kid_id, content, is_read, created_at"
        )
        .or(`to_kid_id.eq.${userId},from_kid_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(80);
      if (!cancelled) {
        setMessages((data ?? []) as PrivateMessageRow[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `to_kid_id=eq.${userId}`
        },
        (payload) => {
          const row = payload.new as PrivateMessageRow;
          setMessages((prev) => [row, ...prev]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { messages, loading };
}
