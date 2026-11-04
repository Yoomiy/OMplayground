-- Private durable media policy. Reusable SFU credentials never go to browsers.
-- Room/actor cutoffs fence immutable signaling admissions without changing the
-- gameplay roster or claiming that an external media plane acknowledged a mute.
CREATE TABLE public.voxel_media_policy (
 session_id UUID PRIMARY KEY REFERENCES public.voxel_worlds(session_id) ON DELETE CASCADE,
 revision BIGINT NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 9007199254740991),
 all_revision BIGINT NOT NULL DEFAULT 0 CHECK(all_revision BETWEEN 0 AND revision),
 all_muted BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE public.voxel_media_actors (
 session_id UUID NOT NULL REFERENCES public.voxel_media_policy(session_id) ON DELETE CASCADE,
 actor_id UUID NOT NULL,
 revision BIGINT NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
 muted BOOLEAN NOT NULL,
 PRIMARY KEY(session_id,actor_id)
);
CREATE TABLE public.voxel_media_commands (
 session_id UUID NOT NULL REFERENCES public.voxel_media_policy(session_id) ON DELETE CASCADE,
 request_id UUID NOT NULL,
 actor_id UUID NOT NULL,
 target_id UUID,
 action TEXT NOT NULL CHECK(action IN ('mute','unmute')),
 revision BIGINT NOT NULL CHECK(revision BETWEEN 0 AND 9007199254740991),
 muted BOOLEAN NOT NULL,
 audit_id UUID REFERENCES public.audit_log(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,request_id)
);
ALTER TABLE public.voxel_media_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxel_media_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxel_media_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voxel_media_policy,public.voxel_media_actors,public.voxel_media_commands
 FROM PUBLIC,anon,authenticated,service_role;

-- Private helper shares the world -> session -> controls -> profile lock order.
-- A role/lock wait cannot renew the caller's original <=5 second Auth proof.
CREATE FUNCTION public.voxel_media_scope(p_session UUID,p_actor UUID,p_authorized_until TIMESTAMPTZ)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.game_sessions%ROWTYPE; kind TEXT; ts TIMESTAMPTZ;
BEGIN
 PERFORM 1 FROM public.voxel_worlds WHERE session_id=p_session FOR UPDATE;
 SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'media forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
 PERFORM 1 FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'media forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.kid_profiles WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN PERFORM 1 FROM public.admin_profiles WHERE id=p_actor FOR SHARE; END IF;
 kind:=public.voxel_actor_kind(p_actor);ts:=clock_timestamp();
 IF kind IS NULL OR kind NOT IN ('kid','teacher','admin') OR p_authorized_until IS NULL
   OR p_authorized_until<=ts OR p_authorized_until>ts+interval '5 seconds'
   THEN RAISE EXCEPTION 'media forbidden' USING ERRCODE='42501'; END IF;
 RETURN kind;
END $$;
REVOKE ALL ON FUNCTION public.voxel_media_scope(UUID,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;

-- Called only with a live gateway connection, fresh school/recess authorization,
-- and the original accepted gameplay revision. NULL media revision is a fresh
-- admission; renewal retains its original revision, including across no-op and
-- unrelated-target commands. Hidden staff are always listen-only.
CREATE FUNCTION public.voxel_media_authorize(p_session UUID,p_world UUID,p_owner UUID,p_epoch BIGINT,
 p_actor UUID,p_revision BIGINT,p_participation TEXT,p_media_revision BIGINT,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind TEXT; w public.voxel_worlds%ROWTYPE; s public.game_sessions%ROWTYPE;
 policy public.voxel_media_policy%ROWTYPE; target public.voxel_media_actors%ROWTYPE;
 current_revision BIGINT; cutoff BIGINT; may_publish BOOLEAN;
BEGIN
 IF p_participation IS NULL OR p_participation NOT IN ('participant','observer')
   OR p_revision IS NULL OR p_revision NOT BETWEEN 0 AND 9007199254740991
   OR (p_media_revision IS NOT NULL AND p_media_revision NOT BETWEEN 0 AND 9007199254740991)
   THEN RAISE EXCEPTION 'invalid media proof' USING ERRCODE='22023'; END IF;
 kind:=public.voxel_media_scope(p_session,p_actor,p_authorized_until);
 SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session;
 SELECT * INTO s FROM public.game_sessions WHERE id=p_session;
 IF w.world_id IS DISTINCT FROM p_world OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
   OR w.lease_expires_at IS NULL OR w.lease_expires_at<=clock_timestamp()
   OR s.status='completed' OR NOT EXISTS(SELECT FROM public.voxel_session_controls
     WHERE session_id=p_session AND desired_state IN ('playing','paused'))
   OR p_revision>s.voxel_roster_revision
   THEN RAISE EXCEPTION 'media connection unavailable' USING ERRCODE='42501'; END IF;
 IF p_participation='observer' THEN
   IF kind NOT IN ('teacher','admin') THEN RAISE EXCEPTION 'media observer forbidden' USING ERRCODE='42501'; END IF;
 ELSE
   IF kind NOT IN ('kid','teacher') OR NOT coalesce(p_actor=ANY(s.player_ids),false)
     OR NOT EXISTS(SELECT FROM public.kid_profiles WHERE id=p_actor AND is_active AND gender=s.gender AND role IN ('kid','teacher'))
     OR EXISTS(SELECT FROM public.voxel_actor_access WHERE session_id=p_session AND actor_id=p_actor
       AND (banned OR revision>accepted_revision OR revision>p_revision))
     THEN RAISE EXCEPTION 'media participant forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT * INTO policy FROM public.voxel_media_policy WHERE session_id=p_session;
 SELECT * INTO target FROM public.voxel_media_actors WHERE session_id=p_session AND actor_id=p_actor;
 current_revision:=coalesce(policy.revision,0);
 cutoff:=CASE WHEN kind='kid' THEN greatest(coalesce(policy.all_revision,0),coalesce(target.revision,0)) ELSE 0 END;
 IF p_media_revision IS NOT NULL AND (p_media_revision<cutoff OR p_media_revision>current_revision)
   THEN RAISE EXCEPTION 'media admission revoked' USING ERRCODE='42501'; END IF;
 may_publish:=p_participation='participant' AND (kind='teacher' OR
   (kind='kid' AND NOT coalesce(policy.all_muted,false) AND NOT coalesce(target.muted,false)));
 IF p_authorized_until<=clock_timestamp() OR w.lease_expires_at<=clock_timestamp()
   THEN RAISE EXCEPTION 'media proof expired' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('revision',current_revision,'cutoff',cutoff,'publish',may_publish,'hidden',p_participation='observer');
END $$;

CREATE FUNCTION public.voxel_media_receipt(p_session UUID,p_request UUID,p_actor UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('requestId',r.request_id,'action',r.action,'target',r.target_id,'revision',r.revision,
   'muted',r.muted,'current',r.revision=CASE WHEN r.target_id IS NULL THEN p.all_revision ELSE coalesce(a.revision,0) END,
   'applied',true,'persisted',true)
 FROM public.voxel_media_commands r JOIN public.voxel_media_policy p ON p.session_id=r.session_id
 LEFT JOIN public.voxel_media_actors a ON a.session_id=r.session_id AND a.actor_id=r.target_id
 WHERE r.session_id=p_session AND r.request_id=p_request AND r.actor_id=p_actor
$$;
REVOKE ALL ON FUNCTION public.voxel_media_receipt(UUID,UUID,UUID) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.voxel_media_moderate(p_session UUID,p_actor UUID,p_request UUID,
 p_target UUID,p_action TEXT,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind TEXT; s public.game_sessions%ROWTYPE; policy public.voxel_media_policy%ROWTYPE;
 target public.voxel_media_actors%ROWTYPE; r public.voxel_media_commands%ROWTYPE;
 muted BOOLEAN; previous_muted BOOLEAN; previous_revision BIGINT; next_revision BIGINT; audit UUID; new_world UUID:=gen_random_uuid();
BEGIN
 IF p_request IS NULL OR p_action IS NULL OR p_action NOT IN ('mute','unmute')
   THEN RAISE EXCEPTION 'invalid media moderation' USING ERRCODE='22023'; END IF;
 -- Like gameplay moderation, offline policy needs metadata, never a worker,
 -- checkpoint, owner lease or gameplay presence mutation. Denial rolls it back.
 IF NOT EXISTS(SELECT FROM public.voxel_worlds WHERE session_id=p_session) THEN
   INSERT INTO public.voxel_worlds(session_id,world_id,namespace)
     VALUES(p_session,new_world,encode(sha256(convert_to(new_world::text,'UTF8')),'hex')) ON CONFLICT(session_id) DO NOTHING;
 END IF;
 kind:=public.voxel_media_scope(p_session,p_actor,p_authorized_until);
 IF kind NOT IN ('teacher','admin') THEN RAISE EXCEPTION 'media moderation forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.game_sessions WHERE id=p_session;
 SELECT * INTO r FROM public.voxel_media_commands WHERE session_id=p_session AND request_id=p_request;
 IF FOUND THEN
   IF r.actor_id IS DISTINCT FROM p_actor OR r.target_id IS DISTINCT FROM p_target OR r.action IS DISTINCT FROM p_action
     THEN RAISE EXCEPTION 'media moderation conflict' USING ERRCODE='22023'; END IF;
   RETURN public.voxel_media_receipt(p_session,p_request,p_actor);
 END IF;
 IF s.status='completed' OR EXISTS(SELECT FROM public.voxel_session_controls WHERE session_id=p_session AND desired_state='ended')
   THEN RAISE EXCEPTION 'media session ended' USING ERRCODE='55000'; END IF;
 IF p_target IS NOT NULL THEN
   PERFORM 1 FROM public.kid_profiles WHERE id=p_target AND role='kid' FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'media target forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 INSERT INTO public.voxel_media_policy(session_id) VALUES(p_session) ON CONFLICT DO NOTHING;
 SELECT * INTO policy FROM public.voxel_media_policy WHERE session_id=p_session;
 SELECT * INTO target FROM public.voxel_media_actors WHERE session_id=p_session AND actor_id=p_target;
 previous_muted:=CASE WHEN p_target IS NULL THEN policy.all_muted ELSE coalesce(target.muted,false) END;
 previous_revision:=CASE WHEN p_target IS NULL THEN policy.all_revision ELSE coalesce(target.revision,0) END;
 muted:=p_action='mute';next_revision:=previous_revision;
 IF muted IS DISTINCT FROM previous_muted THEN
   IF policy.revision=9007199254740991 THEN RAISE EXCEPTION 'media revision exhausted' USING ERRCODE='54000'; END IF;
   next_revision:=policy.revision+1;
 END IF;
 INSERT INTO public.audit_log(actor_id,actor_kind,action,entity_type,entity_id,metadata)
   VALUES(p_actor,kind,'VOXEL_MEDIA_'||upper(p_action),'game_session',p_session,
     jsonb_build_object('correlation_id',p_request::text,'request_id',p_request::text,'target_id',p_target,
       'revision',next_revision,'muted',muted,'status','policy_applied')) RETURNING id INTO audit;
 IF p_authorized_until<=clock_timestamp() THEN RAISE EXCEPTION 'media proof expired' USING ERRCODE='42501'; END IF;
 IF muted IS DISTINCT FROM previous_muted THEN
   UPDATE public.voxel_media_policy SET revision=next_revision WHERE session_id=p_session;
   IF p_target IS NULL THEN
     UPDATE public.voxel_media_policy SET all_revision=next_revision,all_muted=muted WHERE session_id=p_session;
   ELSE
     INSERT INTO public.voxel_media_actors(session_id,actor_id,revision,muted) VALUES(p_session,p_target,next_revision,muted)
       ON CONFLICT(session_id,actor_id) DO UPDATE SET revision=EXCLUDED.revision,muted=EXCLUDED.muted;
   END IF;
 END IF;
 INSERT INTO public.voxel_media_commands(session_id,request_id,actor_id,target_id,action,revision,muted,audit_id)
   VALUES(p_session,p_request,p_actor,p_target,p_action,next_revision,muted,audit);
 RETURN public.voxel_media_receipt(p_session,p_request,p_actor);
END $$;

CREATE FUNCTION public.voxel_media_state(p_session UUID,p_actor UUID,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind TEXT; result JSONB;
BEGIN
 kind:=public.voxel_media_scope(p_session,p_actor,p_authorized_until);
 IF kind NOT IN ('teacher','admin') THEN RAISE EXCEPTION 'media view forbidden' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('revision',coalesce(p.revision,0),'allMuted',coalesce(p.all_muted,false),'targets',
   coalesce((SELECT jsonb_agg(jsonb_build_object('id',k.id,'name',k.full_name,'muted',coalesce(a.muted,false),
     'effectiveMuted',coalesce(p.all_muted,false) OR coalesce(a.muted,false)) ORDER BY k.full_name,k.id)
     FROM public.kid_profiles k LEFT JOIN public.voxel_media_actors a ON a.session_id=s.id AND a.actor_id=k.id
     WHERE k.role='kid' AND (k.id=ANY(s.player_ids) OR a.actor_id IS NOT NULL)),'[]'::jsonb)) INTO result
   FROM public.game_sessions s LEFT JOIN public.voxel_media_policy p ON p.session_id=s.id WHERE s.id=p_session;
 IF p_authorized_until<=clock_timestamp() THEN RAISE EXCEPTION 'media proof expired' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.voxel_media_status() RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('schema',1,'revisionFencing',true)
$$;
REVOKE ALL ON FUNCTION public.voxel_media_authorize(UUID,UUID,UUID,BIGINT,UUID,BIGINT,TEXT,BIGINT,TIMESTAMPTZ),
 public.voxel_media_moderate(UUID,UUID,UUID,UUID,TEXT,TIMESTAMPTZ),public.voxel_media_state(UUID,UUID,TIMESTAMPTZ),
 public.voxel_media_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_media_authorize(UUID,UUID,UUID,BIGINT,UUID,BIGINT,TEXT,BIGINT,TIMESTAMPTZ),
 public.voxel_media_moderate(UUID,UUID,UUID,UUID,TEXT,TIMESTAMPTZ),public.voxel_media_state(UUID,UUID,TIMESTAMPTZ),
 public.voxel_media_status() TO service_role;
