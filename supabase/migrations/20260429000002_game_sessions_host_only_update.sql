-- Restrict game session updates (including visibility toggles) to the host.
DROP POLICY IF EXISTS "game_sessions_update_participant" ON public.game_sessions;

CREATE POLICY "game_sessions_update_host_only"
  ON public.game_sessions FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);
