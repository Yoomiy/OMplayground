-- New-stack sessions only, identified by voxel_worlds. No existing session reset.
-- Intent is independent of projected public status: an empty/temporarily
-- recovering room may display paused without turning that into a manual pause.
ALTER TABLE public.game_sessions ADD COLUMN voxel_presence_expires_at TIMESTAMPTZ;
COMMENT ON COLUMN public.game_sessions.voxel_presence_expires_at IS
  'New voxel presence is valid only before this service/owner deadline; expired arrays are not connected users.';
CREATE TABLE public.voxel_session_controls (
  session_id UUID PRIMARY KEY REFERENCES public.voxel_worlds(session_id) ON DELETE CASCADE,
  desired_state TEXT NOT NULL CHECK (desired_state IN ('playing','paused','ended')),
  projection_epoch BIGINT NOT NULL DEFAULT 0,
  projection_sequence BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.voxel_session_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voxel_session_controls FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.voxel_session_controls TO service_role;

-- This also covers old SECURITY DEFINER browser RPCs: SET ROLE and the request
-- claims retain the original caller inside a definer function. Direct trusted
-- maintenance remains possible. Other games and pre-allocation creation retain
-- their existing policies; no global session permissions are replaced.
CREATE FUNCTION public.voxel_guard_session_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller TEXT := current_setting('role',true);
  claims JSONB := coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
BEGIN
  IF (caller IN ('anon','authenticated') OR claims->>'role' IN ('anon','authenticated'))
    AND EXISTS(SELECT FROM public.voxel_worlds WHERE session_id = OLD.id) THEN
    RAISE EXCEPTION 'voxel session changes require the authoritative service' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER voxel_session_authoritative_write BEFORE UPDATE OR DELETE
  ON public.game_sessions FOR EACH ROW EXECUTE FUNCTION public.voxel_guard_session_write();
REVOKE ALL ON FUNCTION public.voxel_guard_session_write() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.voxel_initialize_session(p_session UUID, p_world UUID, p_owner UUID, p_epoch BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session AND world_id=p_world FOR UPDATE;
  IF NOT FOUND OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;
  SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active)
    OR s.status='completed' THEN RETURN false; END IF;
  PERFORM 1 FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
  IF w.lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;
  INSERT INTO public.voxel_session_controls(session_id,desired_state)
    VALUES(p_session,CASE WHEN s.status='paused' THEN 'paused' ELSE 'playing' END)
    ON CONFLICT(session_id) DO NOTHING;
  RETURN true;
END $$;

-- Called after fresh admission, before attaching a socket to the worker. Names
-- come from active platform profiles; observers never enter student rosters.
CREATE FUNCTION public.voxel_accept_member(p_session UUID, p_world UUID, p_owner UUID, p_epoch BIGINT, p_actor UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE; k public.kid_profiles%ROWTYPE;
  desired TEXT;
BEGIN
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session AND world_id=p_world FOR UPDATE;
  IF NOT FOUND OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;
  SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
  SELECT desired_state INTO desired FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
  IF NOT FOUND OR desired='ended' OR s.status='completed' THEN RETURN false; END IF;
  SELECT * INTO k FROM public.kid_profiles WHERE id=p_actor AND is_active;
  IF NOT FOUND OR k.gender IS DISTINCT FROM s.gender THEN RETURN false; END IF;
  IF w.lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;
  IF NOT (p_actor = ANY(s.player_ids)) THEN
    -- Paused admission was already checked by SchoolAccess. Repeat its roster
    -- boundary after IO/locking; a concurrent pause cannot admit a newcomer.
    IF desired='paused' AND p_actor IS DISTINCT FROM s.host_id THEN RETURN false; END IF;
    UPDATE public.game_sessions SET player_ids=array_append(player_ids,p_actor),
      player_names=array_append(player_names,k.full_name),last_activity=clock_timestamp()
      WHERE id=p_session;
  END IF;
  RETURN true;
END $$;

CREATE FUNCTION public.voxel_project_session(p_session UUID, p_world UUID, p_owner UUID, p_epoch BIGINT,
  p_sequence BIGINT, p_state TEXT, p_participants UUID[])
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE; c public.voxel_session_controls%ROWTYPE;
  ids UUID[]; names TEXT[]; new_host UUID; host_label TEXT; host_class TEXT;
BEGIN
  IF p_sequence IS NULL OR p_sequence NOT BETWEEN 1 AND 9007199254740991
    OR p_state IS NULL OR p_state NOT IN ('playing','paused','ended') OR p_participants IS NULL
    OR array_position(p_participants,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid voxel projection' USING ERRCODE='22023';
  END IF;
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session AND world_id=p_world FOR UPDATE;
  IF NOT FOUND OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;
  SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
  SELECT * INTO c FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
  IF NOT FOUND OR c.projection_epoch > p_epoch
    OR (c.projection_epoch = p_epoch AND c.projection_sequence >= p_sequence) THEN RETURN false; END IF;
  -- Only active, rostered participants enter public presence, in stable roster
  -- order. A hidden teacher/admin camera is deliberately absent from this list.
  SELECT coalesce(array_agg(k.id ORDER BY r.ord),ARRAY[]::uuid[]),
    coalesce(array_agg(k.full_name ORDER BY r.ord),ARRAY[]::text[])
    INTO ids,names FROM unnest(s.player_ids) WITH ORDINALITY AS r(id,ord)
    JOIN public.kid_profiles k ON k.id=r.id AND k.is_active AND k.gender=s.gender
    WHERE r.id=ANY(p_participants);
  -- Recheck after session/control locks, not only after the world-owner lock.
  IF w.lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;
  IF c.desired_state='ended' OR s.status='completed' OR p_state='ended' THEN
    UPDATE public.voxel_session_controls SET desired_state='ended' WHERE session_id=p_session;
    UPDATE public.game_sessions SET status='completed',ended_at=coalesce(ended_at,clock_timestamp()),
      is_open=false,connected_player_ids=ARRAY[]::uuid[],connected_player_names=ARRAY[]::text[],
      voxel_presence_expires_at=NULL,
      last_activity=clock_timestamp() WHERE id=p_session;
  ELSE
    new_host := s.host_id; host_label := s.host_name; host_class := s.host_grade;
    IF cardinality(ids)>0 AND NOT coalesce(s.host_id=ANY(ids),false) THEN
      new_host:=ids[1];host_label:=names[1];
      SELECT grade INTO host_class FROM public.kid_profiles WHERE id=new_host;
    END IF;
    UPDATE public.game_sessions SET
      status=CASE WHEN p_state='playing' AND c.desired_state='playing' AND cardinality(ids)>0
        THEN 'playing'::public.game_session_status ELSE 'paused'::public.game_session_status END,
      connected_player_ids=ids,connected_player_names=names,
      voxel_presence_expires_at=CASE WHEN cardinality(ids)>0 THEN
        least(w.lease_expires_at,clock_timestamp()+interval '15 seconds') ELSE NULL END,
      host_id=new_host,host_name=host_label,host_grade=host_class,
      started_at=coalesce(started_at,CASE WHEN cardinality(ids)>0 THEN clock_timestamp() END),
      last_activity=clock_timestamp() WHERE id=p_session;
  END IF;
  UPDATE public.voxel_session_controls SET projection_epoch=p_epoch,projection_sequence=p_sequence,
    updated_at=clock_timestamp() WHERE session_id=p_session;
  RETURN true;
END $$;

CREATE FUNCTION public.voxel_session_policy(p_session UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.game_sessions%ROWTYPE; desired TEXT;
BEGIN
  SELECT * INTO s FROM public.game_sessions WHERE id=p_session;
  IF NOT FOUND OR s.status='completed' OR NOT EXISTS(
    SELECT FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active) THEN
    RETURN jsonb_build_object('state','ended');
  END IF;
  SELECT desired_state INTO desired FROM public.voxel_session_controls WHERE session_id=p_session;
  RETURN jsonb_build_object('state',coalesce(desired,CASE WHEN s.status='paused' THEN 'paused' ELSE 'playing' END));
END $$;

REVOKE ALL ON FUNCTION public.voxel_initialize_session(UUID,UUID,UUID,BIGINT),
  public.voxel_accept_member(UUID,UUID,UUID,BIGINT,UUID),
  public.voxel_project_session(UUID,UUID,UUID,BIGINT,BIGINT,TEXT,UUID[]),
  public.voxel_session_policy(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_initialize_session(UUID,UUID,UUID,BIGINT),
  public.voxel_accept_member(UUID,UUID,UUID,BIGINT,UUID),
  public.voxel_project_session(UUID,UUID,UUID,BIGINT,BIGINT,TEXT,UUID[]),
  public.voxel_session_policy(UUID) TO service_role;

CREATE FUNCTION public.voxel_session_projection_status()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('schema',1,'authoritativeWrites',EXISTS(
    SELECT FROM pg_catalog.pg_trigger WHERE tgrelid='public.game_sessions'::regclass
      AND tgname='voxel_session_authoritative_write' AND tgenabled='O'))
$$;
REVOKE ALL ON FUNCTION public.voxel_session_projection_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_session_projection_status() TO service_role;
