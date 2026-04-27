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
