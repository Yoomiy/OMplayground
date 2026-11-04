-- Persisted voxel chat is independent of gameplay/checkpoint state and legacy
-- browser-writable chat tables. All reads/writes use fresh service authority.
CREATE TABLE public.voxel_chat_messages (
 session_id UUID NOT NULL REFERENCES public.voxel_worlds(session_id) ON DELETE CASCADE,
 id UUID NOT NULL,
 sequence BIGINT NOT NULL CHECK(sequence BETWEEN 1 AND 9007199254740991),
 sender_id UUID NOT NULL,
 sender_name TEXT NOT NULL,
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 500),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 is_deleted BOOLEAN NOT NULL DEFAULT false,
 PRIMARY KEY(session_id,id), UNIQUE(session_id,sequence)
);
CREATE TABLE public.voxel_chat_requests (
 session_id UUID NOT NULL REFERENCES public.voxel_worlds(session_id) ON DELETE CASCADE,
 request_id UUID NOT NULL,
 actor_id UUID NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('send','delete','clear')),
 message_id UUID,
 body_hash TEXT,
 audit_id UUID REFERENCES public.audit_log(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,request_id)
);
CREATE INDEX voxel_chat_visible_history ON public.voxel_chat_messages(session_id,sequence DESC) WHERE NOT is_deleted;
ALTER TABLE public.voxel_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxel_chat_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voxel_chat_messages,public.voxel_chat_requests FROM PUBLIC,anon,authenticated,service_role;

-- Serializes with admission, moderation, projection and lifecycle. Reads never
-- allocate metadata or a worker. The caller's JWT/recess proof expires in <=5s.
CREATE FUNCTION public.voxel_chat_authorize(p_session UUID,p_actor UUID,p_authorized_until TIMESTAMPTZ)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.game_sessions%ROWTYPE; kind TEXT; ts TIMESTAMPTZ;
BEGIN
 PERFORM 1 FROM public.voxel_worlds WHERE session_id=p_session FOR UPDATE;
 SELECT * INTO s FROM public.game_sessions WHERE id=p_session FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'chat forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.voxel_session_controls WHERE session_id=p_session FOR UPDATE;
 PERFORM 1 FROM public.games WHERE id=s.game_id AND game_url='minecraft' AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'chat forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.kid_profiles WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN PERFORM 1 FROM public.admin_profiles WHERE id=p_actor FOR SHARE; END IF;
 kind:=public.voxel_actor_kind(p_actor);ts:=clock_timestamp();
 IF kind IS NULL OR kind NOT IN ('kid','teacher','admin') OR p_authorized_until IS NULL
   OR p_authorized_until<=ts OR p_authorized_until>ts+interval '5 seconds'
   THEN RAISE EXCEPTION 'chat forbidden' USING ERRCODE='42501'; END IF;
 IF kind='kid' AND (NOT coalesce(p_actor=ANY(s.player_ids),false)
   OR NOT EXISTS(SELECT FROM public.kid_profiles WHERE id=p_actor AND gender=s.gender AND is_active)
   OR EXISTS(SELECT FROM public.voxel_actor_access WHERE session_id=p_session AND actor_id=p_actor
     AND (banned OR revision>accepted_revision)))
   THEN RAISE EXCEPTION 'chat forbidden' USING ERRCODE='42501'; END IF;
 RETURN kind;
END $$;
REVOKE ALL ON FUNCTION public.voxel_chat_authorize(UUID,UUID,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.voxel_chat_history(p_session UUID,p_actor UUID,p_before BIGINT,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result JSONB;
BEGIN
 IF p_before IS NOT NULL AND p_before NOT BETWEEN 1 AND 9007199254740991
   THEN RAISE EXCEPTION 'invalid chat cursor' USING ERRCODE='22023'; END IF;
 PERFORM public.voxel_chat_authorize(p_session,p_actor,p_authorized_until);
 WITH page AS (SELECT * FROM public.voxel_chat_messages WHERE session_id=p_session
   AND NOT is_deleted AND (p_before IS NULL OR sequence<p_before) ORDER BY sequence DESC LIMIT 101),
 visible AS (SELECT * FROM page ORDER BY sequence DESC LIMIT 100)
 SELECT jsonb_build_object('messages',coalesce(jsonb_agg(jsonb_build_object('id',id,'sequence',sequence,
   'senderId',sender_id,'senderName',sender_name,'message',message,'at',created_at) ORDER BY sequence),'[]'::jsonb),
   'before',CASE WHEN (SELECT count(*) FROM page)>100 THEN (SELECT min(sequence) FROM visible) ELSE NULL END)
 INTO result FROM visible;
 IF p_authorized_until<=clock_timestamp() THEN RAISE EXCEPTION 'chat expired' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.voxel_chat_send(p_session UUID,p_world UUID,p_owner UUID,p_epoch BIGINT,
 p_actor UUID,p_revision BIGINT,p_request UUID,p_message TEXT,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.game_sessions%ROWTYPE; w public.voxel_worlds%ROWTYPE; r public.voxel_chat_requests%ROWTYPE;
 seq BIGINT; label TEXT; body_hash TEXT; kind TEXT;
BEGIN
 IF p_request IS NULL OR p_message IS NULL OR length(p_message) NOT BETWEEN 1 AND 500
   OR p_message !~ '[^[:space:]]' OR p_message ~ E'[\001-\010\013\014\016-\037\177]'
   OR p_revision IS NULL OR p_revision NOT BETWEEN 0 AND 9007199254740991
   THEN RAISE EXCEPTION 'invalid chat message' USING ERRCODE='22023'; END IF;
 kind:=public.voxel_chat_authorize(p_session,p_actor,p_authorized_until);
 SELECT * INTO w FROM public.voxel_worlds WHERE session_id=p_session;
 SELECT * INTO s FROM public.game_sessions WHERE id=p_session;
 IF w.world_id IS DISTINCT FROM p_world OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
   OR w.lease_expires_at IS NULL OR w.lease_expires_at<=clock_timestamp()
   OR s.status='completed' OR EXISTS(SELECT FROM public.voxel_session_controls WHERE session_id=p_session AND desired_state='ended')
   OR NOT coalesce(p_actor=ANY(s.player_ids),false) OR p_revision>s.voxel_roster_revision
   OR NOT EXISTS(SELECT FROM public.kid_profiles WHERE id=p_actor AND is_active AND gender=s.gender AND role IN ('kid','teacher'))
   OR EXISTS(SELECT FROM public.voxel_actor_access WHERE session_id=p_session AND actor_id=p_actor AND revision>p_revision)
   THEN RAISE EXCEPTION 'chat participant unavailable' USING ERRCODE='42501'; END IF;
 body_hash:=encode(sha256(convert_to(p_message,'UTF8')),'hex');
 SELECT * INTO r FROM public.voxel_chat_requests WHERE session_id=p_session AND request_id=p_request;
 IF FOUND THEN
   IF r.actor_id IS DISTINCT FROM p_actor OR r.action<>'send' OR r.body_hash IS DISTINCT FROM body_hash
     THEN RAISE EXCEPTION 'chat request conflict' USING ERRCODE='22023'; END IF;
 ELSE
   SELECT coalesce(max(sequence),0)+1 INTO seq FROM public.voxel_chat_messages WHERE session_id=p_session;
   IF seq>9007199254740991 THEN RAISE EXCEPTION 'chat sequence exhausted' USING ERRCODE='54000'; END IF;
   SELECT left(coalesce(nullif(full_name,''),'משתתף'),160) INTO label FROM public.kid_profiles WHERE id=p_actor;
   INSERT INTO public.voxel_chat_messages(session_id,id,sequence,sender_id,sender_name,message)
     VALUES(p_session,p_request,seq,p_actor,label,p_message);
   INSERT INTO public.voxel_chat_requests(session_id,request_id,actor_id,action,message_id,body_hash)
     VALUES(p_session,p_request,p_actor,'send',p_request,body_hash);
 END IF;
 IF p_authorized_until<=clock_timestamp() OR w.lease_expires_at<=clock_timestamp()
   THEN RAISE EXCEPTION 'chat expired' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('requestId',p_request,'action','send','messageId',p_request,'applied',true,'persisted',true);
END $$;

CREATE FUNCTION public.voxel_chat_moderate(p_session UUID,p_actor UUID,p_request UUID,p_action TEXT,
 p_target UUID,p_authorized_until TIMESTAMPTZ)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind TEXT; r public.voxel_chat_requests%ROWTYPE; audit UUID;
BEGIN
 IF p_request IS NULL OR p_action IS NULL OR p_action NOT IN ('delete','clear')
   OR (p_action='delete' AND p_target IS NULL) OR (p_action='clear' AND p_target IS NOT NULL)
   THEN RAISE EXCEPTION 'invalid chat moderation' USING ERRCODE='22023'; END IF;
 kind:=public.voxel_chat_authorize(p_session,p_actor,p_authorized_until);
 IF kind NOT IN ('teacher','admin') THEN RAISE EXCEPTION 'chat moderation forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.voxel_chat_requests WHERE session_id=p_session AND request_id=p_request;
 IF FOUND THEN
   IF r.actor_id IS DISTINCT FROM p_actor OR r.action<>p_action OR r.message_id IS DISTINCT FROM p_target
     THEN RAISE EXCEPTION 'chat request conflict' USING ERRCODE='22023'; END IF;
 ELSE
   IF p_action='delete' AND NOT EXISTS(SELECT FROM public.voxel_chat_messages WHERE session_id=p_session AND id=p_target)
     THEN RAISE EXCEPTION 'chat message unavailable' USING ERRCODE='22023'; END IF;
   -- Empty never-allocated sessions need no durable clear receipt or worker.
   IF NOT EXISTS(SELECT FROM public.voxel_worlds WHERE session_id=p_session)
     THEN RAISE EXCEPTION 'chat metadata unavailable' USING ERRCODE='55000'; END IF;
   UPDATE public.voxel_chat_messages SET is_deleted=true WHERE session_id=p_session
     AND (p_action='clear' OR id=p_target) AND NOT is_deleted;
   INSERT INTO public.audit_log(actor_id,actor_kind,action,entity_type,entity_id,metadata)
     VALUES(p_actor,kind,'VOXEL_CHAT_'||upper(p_action),'game_session',p_session,
       jsonb_build_object('correlation_id',p_request::text,'request_id',p_request::text,'message_id',p_target,'status','applied'))
     RETURNING id INTO audit;
   INSERT INTO public.voxel_chat_requests(session_id,request_id,actor_id,action,message_id,audit_id)
     VALUES(p_session,p_request,p_actor,p_action,p_target,audit);
 END IF;
 IF p_authorized_until<=clock_timestamp() THEN RAISE EXCEPTION 'chat expired' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('requestId',p_request,'action',p_action,'messageId',p_target,'applied',true,'persisted',true);
END $$;
CREATE FUNCTION public.voxel_chat_status() RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('schema',1,'persistedModeration',true) $$;
REVOKE ALL ON FUNCTION public.voxel_chat_history(UUID,UUID,BIGINT,TIMESTAMPTZ),
 public.voxel_chat_send(UUID,UUID,UUID,BIGINT,UUID,BIGINT,UUID,TEXT,TIMESTAMPTZ),
 public.voxel_chat_moderate(UUID,UUID,UUID,TEXT,UUID,TIMESTAMPTZ),public.voxel_chat_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_chat_history(UUID,UUID,BIGINT,TIMESTAMPTZ),
 public.voxel_chat_send(UUID,UUID,UUID,BIGINT,UUID,BIGINT,UUID,TEXT,TIMESTAMPTZ),
 public.voxel_chat_moderate(UUID,UUID,UUID,TEXT,UUID,TIMESTAMPTZ),public.voxel_chat_status() TO service_role;
