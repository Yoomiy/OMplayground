-- Pragmatic security: block privilege escalation and audit forgery.
-- best_scores client writes remain allowed (low-stakes kid cheating).

-- 1) Lock down append_audit_log 7-arg overload (June 2026 correlation_id variant).
REVOKE ALL ON FUNCTION public.append_audit_log(uuid, text, text, text, uuid, jsonb, text) FROM PUBLIC;

-- 2) kid_profiles: block client changes to privilege / identity columns.
CREATE OR REPLACE FUNCTION public.guard_kid_profiles_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.gender IS DISTINCT FROM OLD.gender
    OR NEW.grade IS DISTINCT FROM OLD.grade
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.username IS DISTINCT FROM OLD.username
  THEN
    RAISE EXCEPTION 'kid_profiles_immutable_field';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kid_profiles_guard_immutable ON public.kid_profiles;
CREATE TRIGGER kid_profiles_guard_immutable
  BEFORE UPDATE ON public.kid_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_kid_profiles_immutable_columns();

-- 3) game_sessions: block direct client writes to authoritative columns.
-- Host may still toggle is_open (and invitation_code) from the web app.
CREATE OR REPLACE FUNCTION public.guard_game_sessions_authoritative_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF current_setting('playground.allow_game_session_authority_write', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.game_state IS DISTINCT FROM OLD.game_state
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.player_ids IS DISTINCT FROM OLD.player_ids
    OR NEW.player_names IS DISTINCT FROM OLD.player_names
    OR NEW.host_id IS DISTINCT FROM OLD.host_id
    OR NEW.gender IS DISTINCT FROM OLD.gender
    OR NEW.connected_player_ids IS DISTINCT FROM OLD.connected_player_ids
    OR NEW.connected_player_names IS DISTINCT FROM OLD.connected_player_names
    OR NEW.host_name IS DISTINCT FROM OLD.host_name
    OR NEW.host_grade IS DISTINCT FROM OLD.host_grade
    OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
    OR NEW.game_id IS DISTINCT FROM OLD.game_id
  THEN
    RAISE EXCEPTION 'game_sessions_authoritative_field';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_sessions_guard_authoritative ON public.game_sessions;
CREATE TRIGGER game_sessions_guard_authoritative
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_game_sessions_authoritative_columns();

-- 4) Trusted RPCs that legitimately mutate authoritative session fields.
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
  g int;
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

CREATE OR REPLACE FUNCTION public.discard_my_solo_waiting_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  n int;
BEGIN
  PERFORM set_config('playground.allow_game_session_authority_write', 'true', true);

  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.game_sessions
  SET
    status = 'completed',
    ended_at = now(),
    is_open = false,
    last_activity = now()
  WHERE host_id = uid
    AND status = 'waiting'
    AND coalesce(array_length(player_ids, 1), 0) = 1
    AND player_ids[1] = uid;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
