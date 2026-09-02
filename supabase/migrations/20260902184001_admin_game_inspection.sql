-- A game inspector is either a same-gender teacher or a platform admin.
-- Staff need deleted rows too so Realtime can deliver moderation updates;
-- the client already filters them before rendering.
DROP POLICY IF EXISTS "chat_messages_select_teacher" ON public.chat_messages;
CREATE POLICY "chat_messages_select_staff"
  ON public.chat_messages FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.game_sessions gs
      INNER JOIN public.kid_profiles kp ON kp.id = auth.uid()
      WHERE gs.id = public.chat_messages.session_id
        AND kp.role = 'teacher'
        AND kp.gender = gs.gender
    )
  );

CREATE OR REPLACE FUNCTION public.moderator_soft_delete_chat_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_actor_kind text;
BEGIN
  IF public.is_admin() THEN
    v_actor_kind := 'admin';
  ELSIF EXISTS (
    SELECT 1 FROM public.kid_profiles kp
    WHERE kp.id = auth.uid() AND kp.role = 'teacher'
  ) THEN
    v_actor_kind := 'teacher';
  ELSE
    RAISE EXCEPTION 'not a moderator';
  END IF;

  SELECT cm.session_id INTO v_session_id
  FROM public.chat_messages cm
  WHERE cm.id = p_message_id;
  IF v_session_id IS NULL THEN RAISE EXCEPTION 'message not found'; END IF;

  IF v_actor_kind = 'teacher' AND NOT EXISTS (
    SELECT 1 FROM public.game_sessions gs
    INNER JOIN public.kid_profiles kp ON kp.id = auth.uid()
    WHERE gs.id = v_session_id AND kp.gender = gs.gender
  ) THEN
    RAISE EXCEPTION 'gender mismatch';
  END IF;

  UPDATE public.chat_messages SET is_deleted = true WHERE id = p_message_id;
  PERFORM public.append_audit_log(auth.uid(), v_actor_kind, 'chat_soft_delete', 'chat_message', p_message_id, jsonb_build_object('session_id', v_session_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.moderator_clear_session_chat(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_kind text;
BEGIN
  IF public.is_admin() THEN
    v_actor_kind := 'admin';
  ELSIF EXISTS (
    SELECT 1 FROM public.kid_profiles kp
    WHERE kp.id = auth.uid() AND kp.role = 'teacher'
  ) THEN
    v_actor_kind := 'teacher';
  ELSE
    RAISE EXCEPTION 'not a moderator';
  END IF;

  IF v_actor_kind = 'teacher' AND NOT EXISTS (
    SELECT 1 FROM public.game_sessions gs
    INNER JOIN public.kid_profiles kp ON kp.id = auth.uid()
    WHERE gs.id = p_session_id AND kp.gender = gs.gender
  ) THEN
    RAISE EXCEPTION 'gender mismatch';
  END IF;

  UPDATE public.chat_messages SET is_deleted = true WHERE session_id = p_session_id;
  INSERT INTO public.chat_messages (session_id, sender_id, is_system, sender_name, message, is_deleted)
  VALUES (p_session_id, NULL, true, 'מערכת', CASE WHEN v_actor_kind = 'admin' THEN 'הצ׳אט נוקה על ידי מנהל' ELSE 'הצ׳אט נוקה על ידי מורה' END, false);
  PERFORM public.append_audit_log(auth.uid(), v_actor_kind, 'chat_clear_session', 'game_session', p_session_id, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderator_soft_delete_chat_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderator_clear_session_chat(uuid) TO authenticated;
DROP FUNCTION IF EXISTS public.teacher_soft_delete_chat_message(uuid);
DROP FUNCTION IF EXISTS public.teacher_clear_session_chat(uuid);
