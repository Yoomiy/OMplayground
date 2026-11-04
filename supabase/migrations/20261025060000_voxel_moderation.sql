-- Durable room access policy, independent of worker ownership or world saves.
-- Removal revokes previous admissions; a fresh eligible admission is allowed.
-- A ban additionally rejects fresh admissions until a new staff unban command.
CREATE TABLE public.voxel_actor_access (
  session_id UUID NOT NULL REFERENCES public.voxel_worlds(session_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  revision BIGINT NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
  accepted_revision BIGINT NOT NULL CHECK(accepted_revision BETWEEN 0 AND 9007199254740991),
  banned BOOLEAN NOT NULL,
  PRIMARY KEY(session_id,actor_id)
);
CREATE TABLE public.voxel_moderation_commands (
  session_id UUID NOT NULL REFERENCES public.voxel_worlds(session_id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  target_id UUID NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('remove','ban','unban')),
  revision BIGINT NOT NULL CHECK(revision BETWEEN 0 AND 9007199254740991),
  banned BOOLEAN NOT NULL,
  audit_id UUID REFERENCES public.audit_log(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(session_id,request_id)
);
ALTER TABLE public.voxel_actor_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxel_moderation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voxel_actor_access,public.voxel_moderation_commands FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.voxel_actor_policy(p_session UUID,p_actor UUID) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('revision',coalesce(a.revision,0),'acceptedRevision',coalesce(a.accepted_revision,0),
   'banned',coalesce(a.banned,false)) FROM (SELECT 1) seed
 LEFT JOIN public.voxel_actor_access a ON a.session_id=p_session AND a.actor_id=p_actor
$$;
CREATE FUNCTION public.voxel_moderation_receipt(p_session UUID,p_request UUID,p_actor UUID) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('requestId',r.request_id,'action',r.action,'target',r.target_id,
   'revision',r.revision,'banned',r.banned,'current',r.revision=coalesce(a.revision,0),'applied',true)
 FROM public.voxel_moderation_commands r LEFT JOIN public.voxel_actor_access a
   ON a.session_id=r.session_id AND a.actor_id=r.target_id
 WHERE r.session_id=p_session AND r.request_id=p_request AND r.actor_id=p_actor
$$;
CREATE FUNCTION public.voxel_moderate(p_session UUID,p_request UUID,p_actor UUID,p_target UUID,
  p_action TEXT,p_authorized_until TIMESTAMPTZ) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE;
 r public.voxel_moderation_commands%ROWTYPE; kind TEXT; ts TIMESTAMPTZ; revision BIGINT;
 blocked BOOLEAN; noop BOOLEAN; previous public.voxel_actor_access%ROWTYPE; audit UUID; new_world UUID:=gen_random_uuid();
BEGIN
 IF p_actor IS NULL OR p_target IS NULL OR p_request IS NULL OR p_actor=p_target
   OR p_action IS NULL OR p_action NOT IN ('remove','ban','unban')
   THEN RAISE EXCEPTION 'invalid moderation' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT FROM public.voxel_worlds WHERE session_id=p_session) THEN
   INSERT INTO public.voxel_worlds(session_id,world_id,namespace)
     VALUES(p_session,new_world,encode(sha256(convert_to(new_world::text,'UTF8')),'hex'))
     ON CONFLICT(session_id) DO NOTHING;
 END IF;
 -- Same serialization order as admission, projection, lifecycle and departure.
 SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session FOR UPDATE;
 SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
 PERFORM 1 FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
 ts:=clock_timestamp();kind:=public.voxel_actor_kind(p_actor);
 IF kind IS NULL OR kind NOT IN ('teacher','admin') OR NOT EXISTS(
   SELECT FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active)
   THEN RAISE EXCEPTION 'moderation forbidden' USING ERRCODE='42501'; END IF;
 IF p_authorized_until IS NULL OR p_authorized_until<=ts OR p_authorized_until>ts+interval '5 seconds'
   THEN RAISE EXCEPTION 'moderation authorization expired' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.voxel_moderation_commands WHERE session_id=p_session AND request_id=p_request;
 IF FOUND THEN
   IF r.actor_id IS DISTINCT FROM p_actor OR r.target_id IS DISTINCT FROM p_target OR r.action IS DISTINCT FROM p_action
     THEN RAISE EXCEPTION 'moderation conflict' USING ERRCODE='22023'; END IF;
   RETURN public.voxel_moderation_receipt(p_session,p_request,p_actor);
 END IF;
 IF s.status='completed' OR EXISTS(SELECT FROM public.voxel_session_controls WHERE session_id=p_session AND desired_state='ended')
   THEN RAISE EXCEPTION 'moderation session ended' USING ERRCODE='55000'; END IF;
 -- Only school-child accounts are targets. Existing inactive children can be
 -- blocked before reactivation; teacher/admin supervision cannot be displaced.
 PERFORM 1 FROM public.kid_profiles WHERE id=p_target AND role='kid' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'moderation target forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO previous FROM public.voxel_actor_access WHERE session_id=p_session AND actor_id=p_target;
 noop:=p_action='unban' AND NOT coalesce(previous.banned,false);
 IF NOT noop AND s.voxel_roster_revision=9007199254740991 THEN RAISE EXCEPTION 'moderation revision exhausted' USING ERRCODE='54000'; END IF;
 revision:=CASE WHEN noop THEN coalesce(previous.revision,0) ELSE s.voxel_roster_revision+1 END;
 blocked:=CASE p_action WHEN 'ban' THEN true WHEN 'unban' THEN false ELSE coalesce(previous.banned,false) END;
 INSERT INTO public.audit_log(actor_id,actor_kind,action,entity_type,entity_id,metadata)
   VALUES(p_actor,kind,'VOXEL_'||upper(p_action),'game_session',p_session,
     jsonb_build_object('correlation_id',p_request::text,'request_id',p_request::text,
       'target_id',p_target,'revision',revision,'banned',blocked,'status','policy_applied')) RETURNING id INTO audit;
 -- A role/target/audit row lock must not extend the original proof.
 IF p_authorized_until<=clock_timestamp()
   THEN RAISE EXCEPTION 'moderation authorization expired' USING ERRCODE='42501'; END IF;
 IF NOT noop THEN
 INSERT INTO public.voxel_actor_access(session_id,actor_id,revision,accepted_revision,banned)
   VALUES(p_session,p_target,revision,s.voxel_roster_revision,blocked)
   ON CONFLICT(session_id,actor_id) DO UPDATE SET revision=EXCLUDED.revision,banned=EXCLUDED.banned;
 UPDATE public.game_sessions SET voxel_roster_revision=revision,last_activity=clock_timestamp(),
   connected_player_ids=CASE WHEN p_action='unban' THEN connected_player_ids ELSE array_remove(connected_player_ids,p_target) END,
   connected_player_names=CASE WHEN p_action='unban' THEN connected_player_names ELSE
     ARRAY(SELECT n FROM unnest(connected_player_ids,connected_player_names) AS c(id,n) WHERE c.id<>p_target) END
   WHERE id=p_session;
 END IF;
 INSERT INTO public.voxel_moderation_commands(session_id,request_id,actor_id,target_id,action,revision,banned,audit_id)
   VALUES(p_session,p_request,p_actor,p_target,p_action,revision,blocked,audit);
 RETURN public.voxel_moderation_receipt(p_session,p_request,p_actor);
END $$;
CREATE FUNCTION public.voxel_moderation_status() RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('schema',1,'revisionFencing',true) $$;
REVOKE ALL ON FUNCTION public.voxel_actor_policy(UUID,UUID),public.voxel_moderation_receipt(UUID,UUID,UUID),
 public.voxel_moderate(UUID,UUID,UUID,UUID,TEXT,TIMESTAMPTZ),public.voxel_moderation_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_actor_policy(UUID,UUID),public.voxel_moderation_receipt(UUID,UUID,UUID),
 public.voxel_moderate(UUID,UUID,UUID,UUID,TEXT,TIMESTAMPTZ),public.voxel_moderation_status() TO service_role;

-- Admission, projection and child-host control repeat policy under their existing locks.
CREATE OR REPLACE FUNCTION public.voxel_accept_member_revision(p_session UUID,p_world UUID,p_owner UUID,
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
  IF EXISTS(SELECT FROM public.voxel_actor_access WHERE session_id=p_session AND actor_id=p_actor AND banned) THEN RETURN false; END IF;
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
  UPDATE public.voxel_actor_access SET accepted_revision=p_revision WHERE session_id=p_session AND actor_id=p_actor;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.voxel_project_session(p_session UUID, p_world UUID, p_owner UUID, p_epoch BIGINT,
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
    WHERE r.id=ANY(p_participants) AND NOT EXISTS(SELECT FROM public.voxel_actor_access a
      WHERE a.session_id=p_session AND a.actor_id=r.id AND (a.banned OR a.revision>a.accepted_revision));
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
  IF kind IS NULL OR (kind='kid' AND EXISTS(SELECT FROM public.voxel_actor_access WHERE session_id=p_session AND actor_id=p_actor AND (banned OR revision>accepted_revision))) OR (kind='kid' AND (s.host_id IS DISTINCT FROM p_actor OR NOT EXISTS(
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



-- Staff-only roster/policy view includes offline members so bans can be lifted.
CREATE FUNCTION public.voxel_moderation_targets(p_session UUID,p_actor UUID,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind TEXT; ts TIMESTAMPTZ; result JSONB;
BEGIN
 ts:=clock_timestamp();kind:=public.voxel_actor_kind(p_actor);
 IF kind IS NULL OR kind NOT IN ('teacher','admin') OR NOT EXISTS(SELECT FROM public.game_sessions s
   JOIN public.games g ON g.id=s.game_id WHERE s.id=p_session AND g.game_url='minecraft' AND g.is_active)
   THEN RAISE EXCEPTION 'moderation view forbidden' USING ERRCODE='42501'; END IF;
 IF p_authorized_until IS NULL OR p_authorized_until<=ts OR p_authorized_until>ts+interval '5 seconds'
   THEN RAISE EXCEPTION 'moderation view expired' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('targets',coalesce(jsonb_agg(jsonb_build_object('id',k.id,'name',k.full_name,
    'banned',coalesce(a.banned,false),'pendingReadmission',coalesce(a.revision>a.accepted_revision,false)) ORDER BY r.ord),'[]'::jsonb)) INTO result
 FROM public.game_sessions s CROSS JOIN LATERAL unnest(s.player_ids) WITH ORDINALITY AS r(id,ord)
 JOIN public.kid_profiles k ON k.id=r.id AND k.role='kid'
 LEFT JOIN public.voxel_actor_access a ON a.session_id=p_session AND a.actor_id=k.id WHERE s.id=p_session;
 IF p_authorized_until<=clock_timestamp() THEN RAISE EXCEPTION 'moderation view expired' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.voxel_moderation_targets(UUID,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_moderation_targets(UUID,UUID,TIMESTAMPTZ) TO service_role;
