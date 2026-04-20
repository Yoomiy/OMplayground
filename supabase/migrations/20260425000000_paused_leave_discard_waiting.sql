-- Allow kids to remove themselves from paused sessions (RLS would block a plain
-- UPDATE once they are no longer in player_ids / host).
-- On logout, discard waiting lobbies where the host is still the only player.

CREATE OR REPLACE FUNCTION public.leave_paused_game_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.game_sessions%ROWTYPE;
  i int;
  new_ids uuid[] := ARRAY[]::uuid[];
  new_names text[] := ARRAY[]::text[];
  new_host uuid;
  new_host_name text;
  g int;
BEGIN
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

  FOR i IN 1 .. coalesce(array_length(r.player_ids, 1), 0) LOOP
    IF r.player_ids[i] IS DISTINCT FROM uid THEN
      new_ids := array_append(new_ids, r.player_ids[i]);
      new_names := array_append(new_names, r.player_names[i]);
    END IF;
  END LOOP;

  IF coalesce(array_length(new_ids, 1), 0) = 0 THEN
    UPDATE public.game_sessions
    SET
      player_ids = ARRAY[]::uuid[],
      player_names = ARRAY[]::text[],
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

REVOKE ALL ON FUNCTION public.leave_paused_game_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_paused_game_session(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.discard_my_solo_waiting_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discard_my_solo_waiting_sessions() TO authenticated;
