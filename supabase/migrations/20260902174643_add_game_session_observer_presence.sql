-- Child overflow viewers may chat without ever becoming game players.
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS connected_observer_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

COMMENT ON COLUMN public.game_sessions.connected_observer_ids IS
  'Currently connected child game observers; excluded from seats, player roster, and lifecycle.';

DROP POLICY IF EXISTS "chat_messages_select_session" ON public.chat_messages;
CREATE POLICY "chat_messages_select_session"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_sessions gs
      WHERE gs.id = public.chat_messages.session_id
        AND (
          auth.uid() = ANY (gs.player_ids)
          OR auth.uid() = ANY (gs.connected_observer_ids)
        )
    )
  );
