-- Teacher moderation, admin RLS, audit log, operational RPCs (plan: teacher_and_admin_features)

-- --- Chat soft-delete ---
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "chat_messages_select_session" ON public.chat_messages;
CREATE POLICY "chat_messages_select_session"
  ON public.chat_messages FOR SELECT
  USING (
    NOT public.chat_messages.is_deleted
    AND EXISTS (
      SELECT 1 FROM public.game_sessions gs
      WHERE gs.id = public.chat_messages.session_id
        AND auth.uid() = ANY (gs.player_ids)
    )
  );

DROP POLICY IF EXISTS "chat_messages_select_teacher" ON public.chat_messages;
CREATE POLICY "chat_messages_select_teacher"
  ON public.chat_messages FOR SELECT
  USING (
    NOT public.chat_messages.is_deleted
    AND EXISTS (
      SELECT 1
      FROM public.game_sessions gs
      INNER JOIN public.kid_profiles kp ON kp.id = auth.uid()
      WHERE gs.id = public.chat_messages.session_id
        AND kp.role = 'teacher'
        AND kp.gender = gs.gender
    )
  );

DROP POLICY IF EXISTS "game_sessions_select_teacher" ON public.game_sessions;
CREATE POLICY "game_sessions_select_teacher"
  ON public.game_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = auth.uid()
        AND kp.role = 'teacher'
        AND kp.gender = public.game_sessions.gender
    )
  );

-- --- Audit log (read: admins only; writes: SECURITY DEFINER RPCs) ---
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('admin', 'teacher')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles ap
      WHERE ap.id = auth.uid()
    )
  );

-- --- Helper: admin check (INVOKER — user can only see own admin_profiles row) ---
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid()
  );
$$;

-- --- Admin RLS: catalog, users, ops ---
CREATE POLICY "games_select_admin"
  ON public.games FOR SELECT
  USING (public.is_admin());

CREATE POLICY "games_insert_admin"
  ON public.games FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "games_update_admin"
  ON public.games FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "games_delete_admin"
  ON public.games FOR DELETE
  USING (public.is_admin());

CREATE POLICY "recess_schedules_all_admin"
  ON public.recess_schedules FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "avatar_presets_select_admin"
  ON public.avatar_presets FOR SELECT
  USING (public.is_admin());

CREATE POLICY "avatar_presets_insert_admin"
  ON public.avatar_presets FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "avatar_presets_update_admin"
  ON public.avatar_presets FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "avatar_presets_delete_admin"
  ON public.avatar_presets FOR DELETE
  USING (public.is_admin());

CREATE POLICY "kid_profiles_select_admin"
  ON public.kid_profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "kid_profiles_update_admin"
  ON public.kid_profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "moderation_reports_select_admin"
  ON public.moderation_reports FOR SELECT
  USING (public.is_admin());

CREATE POLICY "moderation_reports_update_admin"
  ON public.moderation_reports FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "private_messages_insert_admin"
  ON public.private_messages FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND is_from_admin = true
    AND from_kid_id IS NULL
  );

CREATE POLICY "game_sessions_select_admin"
  ON public.game_sessions FOR SELECT
  USING (public.is_admin());

CREATE POLICY "game_sessions_update_admin"
  ON public.game_sessions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "game_sessions_delete_admin"
  ON public.game_sessions FOR DELETE
  USING (public.is_admin());

-- --- Internal: append audit row (service role / definer only) ---
CREATE OR REPLACE FUNCTION public.append_audit_log(
  p_actor_id uuid,
  p_actor_kind text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, actor_kind, action, entity_type, entity_id, metadata)
  VALUES (p_actor_id, p_actor_kind, p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.append_audit_log(uuid, text, text, text, uuid, jsonb) FROM PUBLIC;

-- --- Teacher chat moderation ---
CREATE OR REPLACE FUNCTION public.teacher_soft_delete_chat_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_teacher_gender public.gender_type;
  v_session_gender public.gender_type;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kid_profiles kp
    WHERE kp.id = auth.uid() AND kp.role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'not a teacher';
  END IF;

  SELECT kp.gender INTO v_teacher_gender
  FROM public.kid_profiles kp
  WHERE kp.id = auth.uid();

  SELECT cm.session_id INTO v_session_id
  FROM public.chat_messages cm
  WHERE cm.id = p_message_id;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'message not found';
  END IF;

  SELECT gs.gender INTO v_session_gender
  FROM public.game_sessions gs
  WHERE gs.id = v_session_id;

  IF v_session_gender IS NULL OR v_session_gender <> v_teacher_gender THEN
    RAISE EXCEPTION 'gender mismatch';
  END IF;

  UPDATE public.chat_messages
  SET is_deleted = true
  WHERE id = p_message_id;

  PERFORM public.append_audit_log(
    auth.uid(),
    'teacher',
    'chat_soft_delete',
    'chat_message',
    p_message_id,
    jsonb_build_object('session_id', v_session_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_clear_session_chat(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_gender public.gender_type;
  v_session_gender public.gender_type;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kid_profiles kp
    WHERE kp.id = auth.uid() AND kp.role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'not a teacher';
  END IF;

  SELECT kp.gender INTO v_teacher_gender
  FROM public.kid_profiles kp
  WHERE kp.id = auth.uid();

  SELECT gs.gender INTO v_session_gender
  FROM public.game_sessions gs
  WHERE gs.id = p_session_id;

  IF v_session_gender IS NULL OR v_session_gender <> v_teacher_gender THEN
    RAISE EXCEPTION 'gender mismatch';
  END IF;

  UPDATE public.chat_messages
  SET is_deleted = true
  WHERE session_id = p_session_id;

  INSERT INTO public.chat_messages (
    session_id,
    sender_id,
    is_system,
    sender_name,
    message,
    is_deleted
  ) VALUES (
    p_session_id,
    NULL,
    true,
    'מערכת',
    'הצ''אט נוקה על ידי מורה',
    false
  );

  PERFORM public.append_audit_log(
    auth.uid(),
    'teacher',
    'chat_clear_session',
    'game_session',
    p_session_id,
    '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.teacher_soft_delete_chat_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_clear_session_chat(uuid) TO authenticated;

-- --- Admin: cascade delete kid (auth.users + dependents) ---
CREATE OR REPLACE FUNCTION public.admin_delete_kid_cascade(p_kid_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_kid_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot delete self';
  END IF;

  DELETE FROM public.moderation_reports
  WHERE reporter_kid_id = p_kid_id OR reported_kid_id = p_kid_id;

  DELETE FROM public.private_messages
  WHERE from_kid_id = p_kid_id OR to_kid_id = p_kid_id;

  DELETE FROM public.friendships
  WHERE requester_id = p_kid_id OR addressee_id = p_kid_id;

  DELETE FROM public.kid_blocks
  WHERE blocker_id = p_kid_id OR blocked_id = p_kid_id;

  DELETE FROM public.game_sessions
  WHERE host_id = p_kid_id OR p_kid_id = ANY (player_ids);

  DELETE FROM public.chat_messages
  WHERE sender_id = p_kid_id;

  DELETE FROM auth.users WHERE id = p_kid_id;

  PERFORM public.append_audit_log(
    auth.uid(),
    'admin',
    'delete_kid_cascade',
    'kid_profile',
    p_kid_id,
    '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_kid_cascade(uuid) TO authenticated;

-- --- Admin: evict stale players from sessions (last_seen older than threshold) ---
CREATE OR REPLACE FUNCTION public.admin_evict_stale_players(p_idle_minutes integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_ids uuid[];
  v_names text[];
  v_new_ids uuid[];
  v_new_names text[];
  v_i int;
  v_pid uuid;
  v_cutoff timestamptz;
  v_evicted int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_cutoff := now() - (p_idle_minutes || ' minutes')::interval;

  FOR r IN
    SELECT id, player_ids, player_names, host_id, host_name, status
    FROM public.game_sessions
    WHERE status IN ('waiting', 'playing', 'paused')
  LOOP
    v_ids := r.player_ids;
    v_names := r.player_names;
    v_new_ids := ARRAY[]::uuid[];
    v_new_names := ARRAY[]::text[];

    FOR v_i IN 1 .. COALESCE(array_length(v_ids, 1), 0)
    LOOP
      v_pid := v_ids[v_i];
      IF EXISTS (
        SELECT 1 FROM public.kid_profiles kp
        WHERE kp.id = v_pid
          AND (kp.last_seen IS NULL OR kp.last_seen < v_cutoff)
      ) THEN
        v_evicted := v_evicted + 1;
        CONTINUE;
      END IF;

      v_new_ids := array_append(v_new_ids, v_pid);
      v_new_names := array_append(v_new_names, v_names[v_i]);
    END LOOP;

    IF v_new_ids IS NOT DISTINCT FROM v_ids THEN
      CONTINUE;
    END IF;

    IF array_length(v_new_ids, 1) IS NULL OR array_length(v_new_ids, 1) = 0 THEN
      UPDATE public.game_sessions
      SET
        player_ids = ARRAY[]::uuid[],
        player_names = ARRAY[]::text[],
        status = 'paused',
        last_activity = now()
      WHERE id = r.id;
      CONTINUE;
    END IF;

    IF NOT (r.host_id = ANY (v_new_ids)) THEN
      UPDATE public.game_sessions
      SET
        player_ids = v_new_ids,
        player_names = v_new_names,
        host_id = v_new_ids[1],
        host_name = (SELECT full_name FROM public.kid_profiles WHERE id = v_new_ids[1]),
        last_activity = now()
      WHERE id = r.id;
    ELSE
      UPDATE public.game_sessions
      SET
        player_ids = v_new_ids,
        player_names = v_new_names,
        last_activity = now()
      WHERE id = r.id;
    END IF;
  END LOOP;

  PERFORM public.append_audit_log(
    auth.uid(),
    'admin',
    'evict_stale_players',
    'system',
    NULL,
    jsonb_build_object('idle_minutes', p_idle_minutes, 'evicted_slots', v_evicted)
  );

  RETURN jsonb_build_object('evicted_slots', v_evicted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_evict_stale_players(integer) TO authenticated;

-- --- Admin: mark very old active sessions completed ---
CREATE OR REPLACE FUNCTION public.admin_expire_old_sessions(p_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH u AS (
    UPDATE public.game_sessions gs
    SET status = 'completed', last_activity = now()
    WHERE gs.status IN ('waiting', 'playing', 'paused')
      AND gs.last_activity < now() - (p_hours || ' hours')::interval
    RETURNING gs.id
  )
  SELECT count(*)::int INTO v_count FROM u;

  PERFORM public.append_audit_log(
    auth.uid(),
    'admin',
    'expire_old_sessions',
    'system',
    NULL,
    jsonb_build_object('hours', p_hours, 'updated', v_count)
  );

  RETURN jsonb_build_object('completed_sessions', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_expire_old_sessions(integer) TO authenticated;

-- --- Admin: complete all non-completed sessions (operational) ---
CREATE OR REPLACE FUNCTION public.admin_complete_all_open_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH u AS (
    UPDATE public.game_sessions
    SET status = 'completed', last_activity = now()
    WHERE status IN ('waiting', 'playing', 'paused')
    RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM u;

  PERFORM public.append_audit_log(
    auth.uid(),
    'admin',
    'complete_all_open_sessions',
    'system',
    NULL,
    jsonb_build_object('completed_sessions', v_count)
  );

  RETURN jsonb_build_object('completed_sessions', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_complete_all_open_sessions() TO authenticated;

-- Teacher dashboard: live session list already on publication; chat moderation UI needs row events.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
