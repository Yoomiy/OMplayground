import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useChatOutbox, type OutgoingChatMessage } from "./useChatOutbox";

export interface ChatLineRow {
  id: string;
  sender_name: string;
  message: string;
  timestamp: string;
  is_system: boolean;
  is_deleted?: boolean;
  outgoing?: OutgoingChatMessage;
}

/**
 * Single source of truth for in-session chat UI: Postgres + Realtime (teacher moderation + kid view stay in sync).
 */
export function usePersistedSessionChat(sessionId: string | undefined) {
  const [lines, setLines] = useState<ChatLineRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const outbox = useChatOutbox(sessionId);
  const { acknowledged, reconcile } = outbox;
  const scope = useRef({ sessionId, active: false, request: 0 });

  const reload = useCallback(async () => {
    if (
      !sessionId ||
      !scope.current.active ||
      scope.current.sessionId !== sessionId
    )
      return;
    const readScope = scope.current;
    const request = ++readScope.request;
    const acknowledgedBeforeRead = acknowledged();
    const { data, error: qErr } = await supabase
      .from("chat_messages")
      .select("id, sender_name, message, timestamp, is_system, is_deleted")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: false })
      .limit(200);
    if (
      !readScope.active ||
      scope.current !== readScope ||
      request !== readScope.request
    )
      return;
    if (qErr) {
      setError(qErr.message);
      return;
    }
    const rows = (data ?? []) as ChatLineRow[];
    setLines(rows.filter((line) => !line.is_deleted).reverse());
    reconcile(new Set(rows.map((line) => line.id)), acknowledgedBeforeRead);
    setError(null);
  }, [sessionId, acknowledged, reconcile]);

  useEffect(() => {
    const currentScope = { sessionId, active: true, request: 0 };
    scope.current = currentScope;
    setLines([]);
    setError(null);
    if (!sessionId)
      return () => {
        currentScope.active = false;
      };
    void reload();
    const ch = supabase
      .channel(`session-chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void reload();
        },
      )
      .subscribe();
    return () => {
      currentScope.active = false;
      void supabase.removeChannel(ch);
    };
  }, [sessionId, reload]);

  const received = new Set(lines.map((line) => line.id));
  const visible: ChatLineRow[] = [
    ...lines,
    ...outbox.messages
      .filter((line) => !received.has(line.id))
      .map((line) => ({
        id: line.id,
        sender_name: "אני",
        message: line.message,
        timestamp: line.at,
        is_system: false,
        outgoing: line,
      })),
  ];
  return { lines: visible, error, reload, outbox };
}
