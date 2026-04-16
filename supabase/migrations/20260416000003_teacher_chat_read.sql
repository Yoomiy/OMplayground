-- Teachers can read persisted in-game chat for moderation (per product docs).

CREATE POLICY "chat_messages_select_teacher"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = auth.uid()
        AND kp.role = 'teacher'
    )
  );
