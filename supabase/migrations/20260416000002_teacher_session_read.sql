-- Teachers can list active game session metadata for observation (per ARCHITECTURE.md).

CREATE POLICY "game_sessions_select_teacher"
  ON public.game_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = auth.uid()
        AND kp.role = 'teacher'
    )
  );
