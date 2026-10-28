-- Match SchoolAccess: an existing school profile always takes precedence,
-- including inactive profiles. A second admin record cannot undo a revocation.
CREATE FUNCTION public.voxel_actor_kind(p_actor UUID) RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE kind TEXT; active BOOLEAN;
BEGIN
  SELECT role::text,is_active INTO kind,active FROM public.kid_profiles WHERE id=p_actor;
  IF FOUND THEN RETURN CASE WHEN active THEN kind ELSE NULL END; END IF;
  IF EXISTS(SELECT FROM public.admin_profiles WHERE id=p_actor) THEN RETURN 'admin'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.voxel_actor_kind(UUID) FROM PUBLIC,anon,authenticated,service_role;

-- Mode/teleport commands are volatile worker actions. They acknowledge application,
-- never a checkpoint save. A dispatched action cannot replay into a new epoch.
ALTER TABLE public.voxel_session_controls ADD COLUMN staff_revision BIGINT NOT NULL DEFAULT 0
  CHECK(staff_revision BETWEEN 0 AND 9007199254740991);
CREATE TABLE public.voxel_staff_commands (
  session_id UUID NOT NULL REFERENCES public.voxel_session_controls(session_id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  command JSONB NOT NULL,
  revision BIGINT NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
  owner_epoch BIGINT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  result JSONB,
  audit_id UUID REFERENCES public.audit_log(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY(session_id,request_id)
);
ALTER TABLE public.voxel_staff_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voxel_staff_commands FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.voxel_staff_receipt(p_session UUID,p_request UUID,p_actor UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('command',r.command,'revision',r.revision,'ownerEpoch',r.owner_epoch,
    'completed',r.completed,'result',r.result,'current',r.revision=c.staff_revision
      AND r.owner_epoch=w.owner_epoch AND w.lease_expires_at>clock_timestamp() AND s.status<>'completed' AND c.desired_state<>'ended')
  FROM public.voxel_staff_commands r JOIN public.voxel_session_controls c USING(session_id)
    JOIN public.voxel_worlds w USING(session_id) JOIN public.game_sessions s ON s.id=r.session_id
  WHERE r.session_id=p_session AND r.request_id=p_request AND r.actor_id=p_actor
$$;

CREATE FUNCTION public.voxel_begin_staff(p_session UUID,p_world UUID,p_owner UUID,p_epoch BIGINT,
  p_actor UUID,p_request UUID,p_command JSONB,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE;
  c public.voxel_session_controls%ROWTYPE; r public.voxel_staff_commands%ROWTYPE;
  kind TEXT; audit UUID; ts TIMESTAMPTZ;
BEGIN
  IF p_actor IS NULL OR p_request IS NULL OR NOT coalesce(jsonb_typeof(p_command)='object' AND (
    (p_command->>'kind'='mode' AND p_command ?& ARRAY['kind','mode'] AND p_command-ARRAY['kind','mode']='{}'::jsonb
      AND p_command->>'mode' IN ('creative','survival')) OR
    (p_command->>'kind'='teleport' AND p_command ?& ARRAY['kind','target'] AND p_command-ARRAY['kind','target']='{}'::jsonb
      AND (p_command->>'target'='spawn' OR p_command->>'target' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))),false)
    THEN RAISE EXCEPTION 'invalid staff command' USING ERRCODE='22023'; END IF;
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session AND world_id=p_world FOR UPDATE;
  SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
  SELECT * INTO c FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
  ts:=clock_timestamp();
  IF w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at<=ts OR c.session_id IS NULL
    THEN RAISE EXCEPTION 'staff owner unavailable' USING ERRCODE='55000'; END IF;
  IF p_authorized_until IS NULL OR p_authorized_until<=ts OR p_authorized_until>ts+interval '5 seconds'
    THEN RAISE EXCEPTION 'staff authorization expired' USING ERRCODE='42501'; END IF;
  kind:=public.voxel_actor_kind(p_actor);
  IF kind IS NULL OR kind NOT IN ('teacher','admin') OR NOT EXISTS(
    SELECT FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active)
    THEN RAISE EXCEPTION 'staff command forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.voxel_staff_commands WHERE session_id=p_session AND request_id=p_request;
  IF FOUND THEN
    IF r.actor_id IS DISTINCT FROM p_actor OR r.command IS DISTINCT FROM p_command
      THEN RAISE EXCEPTION 'staff command conflict' USING ERRCODE='22023'; END IF;
    RETURN public.voxel_staff_receipt(p_session,p_request,p_actor)||jsonb_build_object('dispatch',
      NOT r.completed AND r.owner_epoch=p_epoch AND r.revision=c.staff_revision AND s.status<>'completed' AND c.desired_state<>'ended');
  END IF;
  IF s.status='completed' OR c.desired_state='ended' THEN RAISE EXCEPTION 'staff session ended' USING ERRCODE='55000'; END IF;
  IF c.staff_revision=9007199254740991 THEN RAISE EXCEPTION 'staff revision exhausted' USING ERRCODE='54000'; END IF;
  ts:=clock_timestamp();
  IF w.lease_expires_at<=ts OR p_authorized_until<=ts THEN RAISE EXCEPTION 'staff authorization expired' USING ERRCODE='42501'; END IF;
  INSERT INTO public.audit_log(actor_id,actor_kind,action,entity_type,entity_id,metadata)
    VALUES(p_actor,kind,'VOXEL_STAFF_'||upper(p_command->>'kind'),'game_session',p_session,
      jsonb_build_object('correlation_id',p_request::text,'request_id',p_request::text,'owner_epoch',p_epoch,
        'revision',c.staff_revision+1,'command',p_command,'status','dispatched')) RETURNING id INTO audit;
  IF w.lease_expires_at<=clock_timestamp() OR p_authorized_until<=clock_timestamp()
    THEN RAISE EXCEPTION 'staff authorization expired' USING ERRCODE='42501'; END IF;
  UPDATE public.voxel_session_controls SET staff_revision=staff_revision+1 WHERE session_id=p_session;
  INSERT INTO public.voxel_staff_commands(session_id,request_id,actor_id,command,revision,owner_epoch,audit_id)
    VALUES(p_session,p_request,p_actor,p_command,c.staff_revision+1,p_epoch,audit);
  RETURN public.voxel_staff_receipt(p_session,p_request,p_actor)||jsonb_build_object('dispatch',true);
END $$;

CREATE FUNCTION public.voxel_finish_staff(p_session UUID,p_world UUID,p_owner UUID,p_epoch BIGINT,
  p_actor UUID,p_request UUID,p_result JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; r public.voxel_staff_commands%ROWTYPE;
BEGIN
  IF NOT coalesce(jsonb_typeof(p_result)='object' AND p_result ?& ARRAY['ok','reason']
    AND p_result-ARRAY['ok','reason']='{}'::jsonb AND jsonb_typeof(p_result->'ok')='boolean'
    AND ((p_result->>'ok'='true' AND p_result->>'reason' IN ('mode','teleport','unchanged'))
      OR (p_result->>'ok'='false' AND p_result->>'reason' IN ('not_present','not_ready','ended','invalid','expired','retired'))),false)
    THEN RAISE EXCEPTION 'invalid staff result' USING ERRCODE='22023'; END IF;
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session AND world_id=p_world FOR UPDATE;
  SELECT * INTO r FROM public.voxel_staff_commands WHERE session_id=p_session AND request_id=p_request FOR UPDATE;
  IF r.actor_id IS DISTINCT FROM p_actor OR r.owner_epoch IS DISTINCT FROM p_epoch
    OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at<=clock_timestamp()
    THEN RAISE EXCEPTION 'staff owner unavailable' USING ERRCODE='55000'; END IF;
  IF p_result->>'ok'='true' AND NOT (p_result->>'reason'=r.command->>'kind'
    OR (r.command->>'kind'='mode' AND p_result->>'reason'='unchanged'))
    THEN RAISE EXCEPTION 'staff result conflict' USING ERRCODE='22023'; END IF;
  IF r.completed THEN
    IF r.result IS DISTINCT FROM p_result THEN RAISE EXCEPTION 'staff result conflict' USING ERRCODE='22023'; END IF;
    RETURN public.voxel_staff_receipt(p_session,p_request,p_actor);
  END IF;
  UPDATE public.audit_log SET metadata=metadata||jsonb_build_object('status',
    CASE WHEN p_result->>'ok'='true' THEN 'applied' ELSE 'rejected' END,'result',p_result) WHERE id=r.audit_id;
  IF w.lease_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'staff owner unavailable' USING ERRCODE='55000'; END IF;
  UPDATE public.voxel_staff_commands SET completed=true,result=p_result,completed_at=clock_timestamp()
    WHERE session_id=p_session AND request_id=p_request;
  RETURN public.voxel_staff_receipt(p_session,p_request,p_actor);
END $$;
CREATE FUNCTION public.voxel_staff_status() RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('schema',1,'epochFencing',true) $$;
REVOKE ALL ON FUNCTION public.voxel_staff_receipt(UUID,UUID,UUID),
  public.voxel_begin_staff(UUID,UUID,UUID,BIGINT,UUID,UUID,JSONB,TIMESTAMPTZ),
  public.voxel_finish_staff(UUID,UUID,UUID,BIGINT,UUID,UUID,JSONB),public.voxel_staff_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_staff_receipt(UUID,UUID,UUID),
  public.voxel_begin_staff(UUID,UUID,UUID,BIGINT,UUID,UUID,JSONB,TIMESTAMPTZ),
  public.voxel_finish_staff(UUID,UUID,UUID,BIGINT,UUID,UUID,JSONB),public.voxel_staff_status() TO service_role;

-- Tighten lifecycle authorization without rewriting the already applied migration.
CREATE OR REPLACE FUNCTION public.voxel_begin_control(p_session UUID,p_world UUID,p_owner UUID,p_epoch BIGINT,
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
  kind:=public.voxel_actor_kind(p_actor);
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

