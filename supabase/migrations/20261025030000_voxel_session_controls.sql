-- Trusted lifecycle commands for the rewritten voxel service only.
ALTER TABLE public.voxel_session_controls ADD COLUMN control_revision BIGINT NOT NULL DEFAULT 0
  CHECK(control_revision BETWEEN 0 AND 9007199254740991);
CREATE TABLE public.voxel_session_commands (
  session_id UUID NOT NULL REFERENCES public.voxel_session_controls(session_id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  actor_kind TEXT NOT NULL CHECK(actor_kind IN ('kid','teacher','admin')),
  action TEXT NOT NULL CHECK(action IN ('pause','resume','end')),
  revision BIGINT NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
  completed BOOLEAN NOT NULL DEFAULT false,
  saved_sequence BIGINT,
  audit_id UUID REFERENCES public.audit_log(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(session_id,request_id),
  CHECK(saved_sequence IS NULL OR saved_sequence BETWEEN 1 AND 9007199254740991)
);
ALTER TABLE public.voxel_session_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voxel_session_commands FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.voxel_session_commands TO service_role;

-- Authenticated by the trusted HTTP boundary; this function is not browser callable.
CREATE FUNCTION public.voxel_control_receipt(p_session UUID,p_request UUID,p_actor UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('action',r.action,'completed',r.completed,'savedSequence',r.saved_sequence,
    'revision',r.revision,'current',r.revision=c.control_revision)
    FROM public.voxel_session_commands r JOIN public.voxel_session_controls c USING(session_id)
    WHERE r.session_id=p_session AND r.request_id=p_request AND r.actor_id=p_actor
$$;

CREATE FUNCTION public.voxel_begin_control(p_session UUID,p_world UUID,p_owner UUID,p_epoch BIGINT,
  p_request UUID,p_actor UUID,p_action TEXT,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE; c public.voxel_session_controls%ROWTYPE;
  r public.voxel_session_commands%ROWTYPE; kind TEXT; audit UUID; ts TIMESTAMPTZ;
BEGIN
  IF p_request IS NULL OR p_actor IS NULL OR p_action IS NULL OR p_action NOT IN ('pause','resume','end') THEN
    RAISE EXCEPTION 'invalid voxel control' USING ERRCODE='22023'; END IF;
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session AND world_id=p_world FOR UPDATE;
  SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
  SELECT * INTO c FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
  ts:=clock_timestamp();
  IF w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at<=ts OR c.session_id IS NULL THEN
    RAISE EXCEPTION 'voxel owner unavailable' USING ERRCODE='55000'; END IF;
  IF p_authorized_until IS NULL OR p_authorized_until<=ts OR p_authorized_until>ts+interval '5 seconds' THEN
    RAISE EXCEPTION 'voxel authorization expired' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT FROM public.admin_profiles WHERE id=p_actor) THEN kind:='admin';
  ELSE SELECT role::text INTO kind FROM public.kid_profiles WHERE id=p_actor AND is_active; END IF;
  IF kind IS NULL OR (kind='kid' AND (s.host_id IS DISTINCT FROM p_actor OR NOT EXISTS(
    SELECT FROM public.kid_profiles WHERE id=p_actor AND gender=s.gender AND is_active))) THEN
    RAISE EXCEPTION 'voxel control forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.voxel_session_commands WHERE session_id=p_session AND request_id=p_request;
  IF FOUND THEN
    IF r.actor_id<>p_actor OR r.action<>p_action THEN RAISE EXCEPTION 'control identity conflict' USING ERRCODE='22023'; END IF;
    RETURN public.voxel_control_receipt(p_session,p_request,p_actor);
  END IF;
  IF c.desired_state='ended' OR s.status='completed' THEN RAISE EXCEPTION 'voxel session ended' USING ERRCODE='55000'; END IF;
  IF NOT EXISTS(SELECT FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active) THEN
    RAISE EXCEPTION 'voxel game unavailable' USING ERRCODE='42501'; END IF;
  IF c.control_revision=9007199254740991 THEN RAISE EXCEPTION 'control revision exhausted' USING ERRCODE='54000'; END IF;
  -- No authorization/lease may gain time while waiting for the above row locks.
  ts:=clock_timestamp();
  IF w.lease_expires_at<=ts OR p_authorized_until<=ts THEN
    RAISE EXCEPTION 'voxel authorization expired' USING ERRCODE='42501'; END IF;
  IF kind IN ('teacher','admin') THEN
    INSERT INTO public.audit_log(actor_id,actor_kind,action,entity_type,entity_id,metadata)
    VALUES(p_actor,kind,'VOXEL_SESSION_'||upper(p_action),'game_session',p_session,
      jsonb_build_object('correlation_id',p_request::text,'request_id',p_request::text,
        'owner_epoch',p_epoch,'revision',c.control_revision+1,'status','accepted')) RETURNING id INTO audit;
  END IF;
  IF w.lease_expires_at<=clock_timestamp() OR p_authorized_until<=clock_timestamp() THEN
    RAISE EXCEPTION 'voxel authorization expired' USING ERRCODE='42501'; END IF;
  UPDATE public.voxel_session_controls SET control_revision=control_revision+1,
    desired_state=CASE p_action WHEN 'pause' THEN 'paused' WHEN 'resume' THEN 'playing' ELSE 'ended' END,
    updated_at=ts WHERE session_id=p_session;
  INSERT INTO public.voxel_session_commands(session_id,request_id,actor_id,actor_kind,action,revision,audit_id)
    VALUES(p_session,p_request,p_actor,kind,p_action,c.control_revision+1,audit);
  RETURN public.voxel_control_receipt(p_session,p_request,p_actor);
END $$;

CREATE FUNCTION public.voxel_finish_control(p_session UUID,p_world UUID,p_owner UUID,p_epoch BIGINT,
  p_request UUID,p_actor UUID,p_saved BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; r public.voxel_session_commands%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session AND world_id=p_world FOR UPDATE;
  SELECT * INTO r FROM public.voxel_session_commands WHERE session_id=p_session AND request_id=p_request FOR UPDATE;
  IF r.actor_id IS DISTINCT FROM p_actor OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'voxel owner unavailable' USING ERRCODE='55000'; END IF;
  IF r.completed THEN RETURN public.voxel_control_receipt(p_session,p_request,p_actor); END IF;
  IF (r.action='resume' AND p_saved IS NOT NULL) OR (r.action<>'resume' AND (p_saved IS NULL OR NOT EXISTS(
    SELECT FROM public.voxel_checkpoints WHERE world_id=p_world AND sequence=p_saved AND owner_epoch=p_epoch))) THEN
    RAISE EXCEPTION 'control checkpoint uncommitted' USING ERRCODE='55000'; END IF;
  UPDATE public.voxel_session_commands SET completed=true,saved_sequence=p_saved,completed_at=clock_timestamp()
    WHERE session_id=p_session AND request_id=p_request;
  IF r.audit_id IS NOT NULL THEN UPDATE public.audit_log SET metadata=metadata||jsonb_build_object(
    'status','completed','saved_sequence',p_saved) WHERE id=r.audit_id; END IF;
  IF w.lease_expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'voxel owner unavailable' USING ERRCODE='55000'; END IF;
  RETURN public.voxel_control_receipt(p_session,p_request,p_actor);
END $$;

CREATE FUNCTION public.voxel_controls_status()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('schema',1) $$;
REVOKE ALL ON FUNCTION public.voxel_control_receipt(UUID,UUID,UUID),
  public.voxel_begin_control(UUID,UUID,UUID,BIGINT,UUID,UUID,TEXT,TIMESTAMPTZ),
  public.voxel_finish_control(UUID,UUID,UUID,BIGINT,UUID,UUID,BIGINT),public.voxel_controls_status()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_control_receipt(UUID,UUID,UUID),
  public.voxel_begin_control(UUID,UUID,UUID,BIGINT,UUID,UUID,TEXT,TIMESTAMPTZ),
  public.voxel_finish_control(UUID,UUID,UUID,BIGINT,UUID,UUID,BIGINT),public.voxel_controls_status()
  TO service_role;
