-- Extend the existing Hebrew grade values without changing stored profiles.
-- Apply before deploying the UI and import function that offer these grades.
BEGIN;

ALTER TABLE public.kid_profiles DROP CONSTRAINT kid_profiles_grade_check;
ALTER TABLE public.kid_profiles ADD CONSTRAINT kid_profiles_grade_check
  CHECK (grade IN ('גן', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'));

ALTER TABLE public.game_sessions DROP CONSTRAINT game_sessions_host_grade_check;
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_host_grade_check
  CHECK (host_grade IS NULL OR host_grade IN ('גן', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'));

ALTER TABLE public.class_recess_schedule_settings
  DROP CONSTRAINT class_recess_schedule_settings_grade_check;
ALTER TABLE public.class_recess_schedule_settings
  ADD CONSTRAINT class_recess_schedule_settings_grade_check
  CHECK (grade IN ('גן', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'));

-- Keep profile editing consistent with profile creation and CSV imports.
CREATE OR REPLACE FUNCTION public.admin_update_kid_profile(
  p_kid_id uuid,
  p_updates jsonb
)
RETURNS public.kid_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'username',
    'full_name',
    'gender',
    'grade',
    'role',
    'is_active',
    'avatar_color',
    'avatar_preset_id',
    'avatar_url',
    'best_scores',
    'unread_message_count'
  ];
  v_key text;
  v_profile public.kid_profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(COALESCE(p_updates, '{}'::jsonb))
  LOOP
    IF NOT v_key = ANY (v_allowed) THEN
      RAISE EXCEPTION 'FIELD_NOT_ALLOWED: %', v_key;
    END IF;
  END LOOP;

  IF p_updates ? 'full_name' AND length(trim(COALESCE(p_updates->>'full_name', ''))) = 0 THEN
    RAISE EXCEPTION 'FULL_NAME_REQUIRED';
  END IF;

  IF p_updates ? 'username' AND length(trim(COALESCE(p_updates->>'username', ''))) = 0 THEN
    RAISE EXCEPTION 'USERNAME_REQUIRED';
  END IF;

  IF p_updates ? 'grade' AND (p_updates->>'grade' IS NULL OR NOT (p_updates->>'grade' IN ('גן', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'))) THEN
    RAISE EXCEPTION 'GRADE_OUT_OF_RANGE';
  END IF;

  UPDATE public.kid_profiles kp
  SET
    username = CASE
      WHEN p_updates ? 'username' THEN lower(trim(p_updates->>'username'))
      ELSE kp.username
    END,
    full_name = CASE
      WHEN p_updates ? 'full_name' THEN trim(p_updates->>'full_name')
      ELSE kp.full_name
    END,
    gender = CASE
      WHEN p_updates ? 'gender' THEN (p_updates->>'gender')::public.gender_type
      ELSE kp.gender
    END,
    grade = CASE
      WHEN p_updates ? 'grade' THEN p_updates->>'grade'
      ELSE kp.grade
    END,
    role = CASE
      WHEN p_updates ? 'role' THEN (p_updates->>'role')::public.user_role
      ELSE kp.role
    END,
    is_active = CASE
      WHEN p_updates ? 'is_active' THEN (p_updates->>'is_active')::boolean
      ELSE kp.is_active
    END,
    avatar_color = CASE
      WHEN p_updates ? 'avatar_color' THEN COALESCE(NULLIF(p_updates->>'avatar_color', ''), kp.avatar_color)
      ELSE kp.avatar_color
    END,
    avatar_preset_id = CASE
      WHEN p_updates ? 'avatar_preset_id' THEN NULLIF(p_updates->>'avatar_preset_id', '')
      ELSE kp.avatar_preset_id
    END,
    avatar_url = CASE
      WHEN p_updates ? 'avatar_url' THEN NULLIF(p_updates->>'avatar_url', '')
      ELSE kp.avatar_url
    END,
    best_scores = CASE
      WHEN p_updates ? 'best_scores' THEN COALESCE(p_updates->'best_scores', '{}'::jsonb)
      ELSE kp.best_scores
    END,
    unread_message_count = CASE
      WHEN p_updates ? 'unread_message_count' THEN GREATEST(0, (p_updates->>'unread_message_count')::integer)
      ELSE kp.unread_message_count
    END
  WHERE kp.id = p_kid_id
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  PERFORM public.append_audit_log(
    auth.uid(),
    'admin',
    'update_kid_profile',
    'kid_profile',
    p_kid_id,
    p_updates
  );

  RETURN v_profile;
END;
$$;

-- Host transfers must read the text grade without an integer conversion.
CREATE OR REPLACE FUNCTION public.leave_paused_game_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.game_sessions%ROWTYPE;
  min_players int;
  i int;
  new_ids uuid[] := ARRAY[]::uuid[];
  new_names text[] := ARRAY[]::text[];
  new_connected_ids uuid[] := ARRAY[]::uuid[];
  new_connected_names text[] := ARRAY[]::text[];
  new_host uuid;
  new_host_name text;
  g public.kid_profiles.grade%TYPE;
BEGIN
  PERFORM set_config('playground.allow_game_session_authority_write', 'true', true);

  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO r FROM public.game_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found';
  END IF;
  IF r.status IS DISTINCT FROM 'paused' THEN
    RAISE EXCEPTION 'session is not paused';
  END IF;
  IF NOT (uid = ANY (r.player_ids)) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  SELECT coalesce(g.min_players, 1) INTO min_players
  FROM public.games g
  WHERE g.id = r.game_id;

  FOR i IN 1 .. coalesce(array_length(r.player_ids, 1), 0) LOOP
    IF r.player_ids[i] IS DISTINCT FROM uid THEN
      new_ids := array_append(new_ids, r.player_ids[i]);
      new_names := array_append(new_names, r.player_names[i]);
    END IF;
  END LOOP;

  FOR i IN 1 .. coalesce(array_length(r.connected_player_ids, 1), 0) LOOP
    IF r.connected_player_ids[i] IS DISTINCT FROM uid THEN
      new_connected_ids := array_append(new_connected_ids, r.connected_player_ids[i]);
      new_connected_names := array_append(new_connected_names, r.connected_player_names[i]);
    END IF;
  END LOOP;

  IF coalesce(array_length(new_ids, 1), 0) < min_players THEN
    UPDATE public.game_sessions
    SET
      player_ids = new_ids,
      player_names = new_names,
      connected_player_ids = ARRAY[]::uuid[],
      connected_player_names = ARRAY[]::text[],
      status = 'completed',
      ended_at = now(),
      is_open = false,
      last_activity = now()
    WHERE id = p_session_id;
    RETURN;
  END IF;

  IF r.host_id IS NOT DISTINCT FROM uid THEN
    new_host := new_ids[1];
    new_host_name := new_names[1];
    SELECT kp.grade INTO g FROM public.kid_profiles kp WHERE kp.id = new_host;
    UPDATE public.game_sessions
    SET
      player_ids = new_ids,
      player_names = new_names,
      connected_player_ids = new_connected_ids,
      connected_player_names = new_connected_names,
      host_id = new_host,
      host_name = new_host_name,
      host_grade = g,
      last_activity = now()
    WHERE id = p_session_id;
    RETURN;
  END IF;

  UPDATE public.game_sessions
  SET
    player_ids = new_ids,
    player_names = new_names,
    connected_player_ids = new_connected_ids,
    connected_player_names = new_connected_names,
    last_activity = now()
  WHERE id = p_session_id;
END;
$$;

COMMIT;
