import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  usePersistedSessionChat,
  type ChatLineRow
} from "@/hooks/usePersistedSessionChat";

export type { ChatLineRow };

/**
 * Teacher observe UI: persisted chat + moderation RPCs (same feed as kids; TODO #11).
 */
export function useTeacherSessionChat(sessionId: string | undefined) {
  const { lines, error, reload } = usePersistedSessionChat(sessionId);

  const softDelete = useCallback(
    async (messageId: string) => {
      const { error: rpcErr } = await supabase.rpc(
        "teacher_soft_delete_chat_message",
        { p_message_id: messageId }
      );
      if (rpcErr) throw rpcErr;
      void reload();
    },
    [reload]
  );

  const clearSession = useCallback(async () => {
    if (!sessionId) return;
    const { error: rpcErr } = await supabase.rpc("teacher_clear_session_chat", {
      p_session_id: sessionId
    });
    if (rpcErr) throw rpcErr;
    void reload();
  }, [sessionId, reload]);

  return { lines, error, reload, softDelete, clearSession };
}
