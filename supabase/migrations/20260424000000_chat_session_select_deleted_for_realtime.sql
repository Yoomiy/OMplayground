-- Session participants may SELECT soft-deleted rows so Realtime can authorize
-- UPDATE events after teacher_soft_delete_chat_message; the web app still filters
-- with is_deleted = false. See chat_messages_select_teacher for teacher-facing filter.

DROP POLICY IF EXISTS "chat_messages_select_session" ON public.chat_messages;
CREATE POLICY "chat_messages_select_session"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_sessions gs
      WHERE gs.id = public.chat_messages.session_id
        AND auth.uid() = ANY (gs.player_ids)
    )
  );
