-- Trusted self-departure and revision-fenced membership. No existing world reset.
ALTER TABLE public.game_sessions ADD COLUMN voxel_roster_revision BIGINT NOT NULL DEFAULT 0
  CHECK (voxel_roster_revision BETWEEN 0 AND 9007199254740991);
CREATE TABLE public.voxel_roster_departures (
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  revision BIGINT NOT NULL,
  ended BOOLEAN NOT NULL,
  PRIMARY KEY(session_id,request_id)
);
ALTER TABLE public.voxel_roster_departures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voxel_roster_departures FROM PUBLIC,anon,authenticated,service_role;

-- The former signature cannot accept a ticket created before a departure.
REVOKE ALL ON FUNCTION public.voxel_accept_member(UUID,UUID,UUID,BIGINT,UUID)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.voxel_accept_member_revision(p_session UUID,p_world UUID,p_owner UUID,
  p_epoch BIGINT,p_actor UUID,p_revision BIGINT,p_authorized_until TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE;
  k public.kid_profiles%ROWTYPE; desired TEXT; ts TIMESTAMPTZ;
BEGIN
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session AND world_id=p_world FOR UPDATE;
  IF NOT FOUND OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at<=clock_timestamp() THEN RETURN false; END IF;
  SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
  SELECT desired_state INTO desired FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
  IF NOT FOUND OR desired='ended' OR s.status='completed' OR p_revision IS DISTINCT FROM s.voxel_roster_revision
    OR NOT EXISTS(SELECT FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active)
    THEN RETURN false; END IF;
  SELECT * INTO k FROM public.kid_profiles WHERE id=p_actor AND is_active;
  IF NOT FOUND OR k.gender IS DISTINCT FROM s.gender THEN RETURN false; END IF;
  ts:=clock_timestamp();
  IF w.lease_expires_at<=ts OR p_authorized_until IS NULL OR p_authorized_until<=ts
    OR p_authorized_until>ts+interval '5 seconds' THEN RETURN false; END IF;
  IF NOT (p_actor=ANY(s.player_ids)) THEN
    IF desired='paused' AND p_actor IS DISTINCT FROM s.host_id THEN RETURN false; END IF;
    UPDATE public.game_sessions SET player_ids=array_append(player_ids,p_actor),
      player_names=array_append(player_names,k.full_name),last_activity=ts WHERE id=p_session;
  END IF;
  RETURN true;
END $$;

CREATE FUNCTION public.voxel_leave_roster(p_session UUID,p_actor UUID,p_request UUID,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE;
  k public.kid_profiles%ROWTYPE; receipt public.voxel_roster_departures%ROWTYPE;
  ids UUID[]; names TEXT[]; connected UUID[]; connected_names TEXT[];
  next_host UUID; next_name TEXT; next_grade public.game_sessions.host_grade%TYPE; revision BIGINT; ended BOOLEAN; ts TIMESTAMPTZ;
  new_world UUID:=gen_random_uuid();
BEGIN
  IF p_actor IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'invalid departure' USING ERRCODE='22023'; END IF;
  -- Claim metadata without starting a worker, including never-opened sessions.
  -- This also activates the browser-write guard before changing the revision.
  IF NOT EXISTS(SELECT FROM public.voxel_worlds WHERE session_id=p_session) THEN
    INSERT INTO public.voxel_worlds(session_id,world_id,namespace)
      VALUES(p_session,new_world,encode(sha256(convert_to(new_world::text,'UTF8')),'hex'))
      ON CONFLICT(session_id) DO NOTHING;
  END IF;
  -- Same world -> session -> controls lock order as admission/projection.
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session FOR UPDATE;
  SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active)
    THEN RAISE EXCEPTION 'departure denied' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
  SELECT * INTO k FROM public.kid_profiles WHERE id=p_actor AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'departure denied' USING ERRCODE='42501'; END IF;
  ts:=clock_timestamp();
  IF p_authorized_until IS NULL OR p_authorized_until<=ts OR p_authorized_until>ts+interval '5 seconds'
    THEN RAISE EXCEPTION 'departure authorization expired' USING ERRCODE='42501'; END IF;
  SELECT * INTO receipt FROM public.voxel_roster_departures WHERE session_id=p_session AND request_id=p_request;
  IF FOUND THEN
    IF receipt.actor_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'departure conflict' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('requestId',p_request,'left',true,'ended',receipt.ended,'revision',receipt.revision);
  END IF;
  IF s.status NOT IN ('playing','paused') OR NOT(p_actor=ANY(s.player_ids))
    THEN RAISE EXCEPTION 'departure denied' USING ERRCODE='42501'; END IF;
  -- Do not dismiss a player who is still connected elsewhere. Expired presence
  -- is not live; actor renewal separately requires current accepted membership.
  IF s.voxel_presence_expires_at>ts AND p_actor=ANY(s.connected_player_ids)
    THEN RAISE EXCEPTION 'participant connected' USING ERRCODE='55000'; END IF;
  SELECT coalesce(array_agg(r.id ORDER BY r.ord),ARRAY[]::uuid[]),
    coalesce(array_agg(coalesce(kp.full_name,s.player_names[r.ord]) ORDER BY r.ord),ARRAY[]::text[])
    INTO ids,names FROM unnest(s.player_ids) WITH ORDINALITY AS r(id,ord)
    LEFT JOIN public.kid_profiles kp ON kp.id=r.id WHERE r.id<>p_actor;
  ended:=cardinality(ids)=0;
  -- A normal last leave saves and releases its owner first. Never overtake that
  -- save, or treat an owner that may still publish as a retired room. After a
  -- crash, only the previously committed checkpoint is durable; no saved claim
  -- is returned by this roster operation.
  IF ended AND w.lease_expires_at>clock_timestamp()
    THEN RAISE EXCEPTION 'room retirement pending' USING ERRCODE='55000'; END IF;
  IF s.voxel_roster_revision=9007199254740991
    THEN RAISE EXCEPTION 'roster revision exhausted' USING ERRCODE='54000'; END IF;
  revision:=s.voxel_roster_revision+1;
  next_host:=s.host_id;next_name:=s.host_name;next_grade:=s.host_grade;
  IF NOT ended AND s.host_id=p_actor THEN
    next_host:=ids[1];next_name:=names[1];
    SELECT grade INTO next_grade FROM public.kid_profiles WHERE id=next_host;
  END IF;
  SELECT coalesce(array_agg(r.id ORDER BY r.ord),ARRAY[]::uuid[]),
    coalesce(array_agg(kp.full_name ORDER BY r.ord),ARRAY[]::text[])
    INTO connected,connected_names FROM unnest(s.connected_player_ids) WITH ORDINALITY AS r(id,ord)
    JOIN public.kid_profiles kp ON kp.id=r.id AND kp.is_active AND kp.gender=s.gender
    WHERE r.id=ANY(ids) AND s.voxel_presence_expires_at>clock_timestamp();
  -- Profiles/locks may have taken time. The proof is checked immediately before
  -- the write as well, and an exhausted/expired operation rolls back entirely.
  ts:=clock_timestamp();
  IF p_authorized_until<=ts THEN RAISE EXCEPTION 'departure authorization expired' USING ERRCODE='42501'; END IF;
  UPDATE public.game_sessions SET player_ids=ids,player_names=names,
    connected_player_ids=connected,connected_player_names=connected_names,
    voxel_roster_revision=revision,host_id=next_host,host_name=next_name,host_grade=next_grade,
    status=CASE WHEN ended THEN 'completed'::public.game_session_status ELSE status END,
    is_open=CASE WHEN ended THEN false ELSE is_open END,
    ended_at=CASE WHEN ended THEN coalesce(ended_at,ts) ELSE ended_at END,last_activity=ts,
    voxel_presence_expires_at=CASE WHEN ended OR cardinality(connected)=0 THEN NULL ELSE voxel_presence_expires_at END
    WHERE id=p_session;
  IF ended THEN UPDATE public.voxel_session_controls SET desired_state='ended',updated_at=ts WHERE session_id=p_session; END IF;
  INSERT INTO public.voxel_roster_departures VALUES(p_session,p_request,p_actor,revision,ended);
  RETURN jsonb_build_object('requestId',p_request,'left',true,'ended',ended,'revision',revision);
END $$;
CREATE FUNCTION public.voxel_roster_status() RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('schema',1,'revisionFencing',true) $$;
REVOKE ALL ON FUNCTION public.voxel_accept_member_revision(UUID,UUID,UUID,BIGINT,UUID,BIGINT,TIMESTAMPTZ),
  public.voxel_leave_roster(UUID,UUID,UUID,TIMESTAMPTZ),public.voxel_roster_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_accept_member_revision(UUID,UUID,UUID,BIGINT,UUID,BIGINT,TIMESTAMPTZ),
  public.voxel_leave_roster(UUID,UUID,UUID,TIMESTAMPTZ),public.voxel_roster_status() TO service_role;
