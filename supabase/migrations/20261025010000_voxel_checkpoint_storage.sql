-- New voxel format only. No conversion or deletion of existing game state.
-- Browser clients have no table, RPC or object access. The trusted voxel service
-- checks session/school admission before acquiring these service-only leases.
CREATE TABLE public.voxel_worlds (
  session_id UUID PRIMARY KEY REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  world_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL UNIQUE CHECK (namespace = encode(sha256(convert_to(world_id::text, 'UTF8')), 'hex')),
  owner_id UUID,
  owner_epoch BIGINT NOT NULL DEFAULT 0 CHECK (owner_epoch BETWEEN 0 AND 9007199254740991),
  lease_expires_at TIMESTAMPTZ,
  checkpoint_sequence BIGINT NOT NULL DEFAULT 0 CHECK (checkpoint_sequence BETWEEN 0 AND 9007199254740991),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.voxel_objects (
  object_key TEXT PRIMARY KEY,
  -- Intentionally independent of the session FK: session removal must leave an
  -- orphan catalog for asynchronous Storage cleanup, not lose object addresses.
  world_id UUID NOT NULL,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 9007199254740991),
  state TEXT NOT NULL CHECK (state IN ('uploading', 'ready', 'deleting')),
  upload_token UUID NOT NULL DEFAULT gen_random_uuid(),
  protected_until TIMESTAMPTZ NOT NULL,
  delete_token UUID,
  delete_claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.voxel_checkpoints (
  world_id UUID NOT NULL REFERENCES public.voxel_worlds(world_id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL CHECK (sequence BETWEEN 1 AND 9007199254740991),
  owner_epoch BIGINT NOT NULL CHECK (owner_epoch BETWEEN 1 AND 9007199254740991),
  manifest_key TEXT NOT NULL REFERENCES public.voxel_objects(object_key),
  manifest_sha256 TEXT NOT NULL,
  manifest_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, sequence)
);
CREATE TABLE public.voxel_checkpoint_objects (
  world_id UUID NOT NULL,
  sequence BIGINT NOT NULL,
  object_key TEXT NOT NULL REFERENCES public.voxel_objects(object_key),
  PRIMARY KEY (world_id, sequence, object_key),
  FOREIGN KEY (world_id, sequence) REFERENCES public.voxel_checkpoints(world_id, sequence) ON DELETE CASCADE
);
CREATE INDEX voxel_checkpoint_objects_key ON public.voxel_checkpoint_objects(object_key);
CREATE INDEX voxel_objects_cleanup ON public.voxel_objects(protected_until) WHERE state <> 'deleting';
CREATE INDEX voxel_checkpoints_retention ON public.voxel_checkpoints(created_at);

ALTER TABLE public.voxel_worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxel_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxel_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxel_checkpoint_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voxel_worlds, public.voxel_objects, public.voxel_checkpoints,
  public.voxel_checkpoint_objects FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.voxel_worlds, public.voxel_objects, public.voxel_checkpoints,
  public.voxel_checkpoint_objects TO service_role;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voxel-checkpoints', 'voxel-checkpoints', false, NULL, ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE SET public = false, allowed_mime_types = EXCLUDED.allowed_mime_types;
-- No storage.objects policies or signed browser URLs are added for this bucket.

CREATE FUNCTION public.voxel_valid_object(p_object JSONB, p_namespace TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p_object) = 'object'
    AND p_object ?& ARRAY['key','sha256','bytes']
    AND p_object - ARRAY['key','sha256','bytes'] = '{}'::jsonb
    AND jsonb_typeof(p_object->'sha256') = 'string'
    AND (p_object->>'sha256') ~ '^[a-f0-9]{64}$'
    AND (p_object->>'key') = 'v1/' || p_namespace || '/' || (p_object->>'sha256') || '.json'
    AND jsonb_typeof(p_object->'bytes') = 'number'
    AND (p_object->>'bytes') ~ '^[1-9][0-9]{0,15}$'
  THEN (p_object->>'bytes')::numeric <= 9007199254740991 ELSE false END
$$;

CREATE FUNCTION public.voxel_acquire_room(p_session UUID, p_owner UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; c public.voxel_checkpoints%ROWTYPE; ts timestamptz;
  new_world UUID := gen_random_uuid();
BEGIN
  IF p_session IS NULL OR p_owner IS NULL THEN RAISE EXCEPTION 'invalid room owner' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.voxel_worlds(session_id,world_id,namespace)
    VALUES(p_session,new_world,encode(sha256(convert_to(new_world::text,'UTF8')),'hex'))
    ON CONFLICT (session_id) DO NOTHING;
  SELECT * INTO STRICT w FROM public.voxel_worlds WHERE session_id = p_session FOR UPDATE;
  ts := clock_timestamp();
  IF w.lease_expires_at > ts AND w.owner_id IS DISTINCT FROM p_owner THEN RETURN NULL; END IF;
  IF w.owner_id IS DISTINCT FROM p_owner OR w.lease_expires_at IS NULL OR w.lease_expires_at <= ts THEN
    IF w.owner_epoch = 9007199254740991 THEN RAISE EXCEPTION 'owner epoch exhausted' USING ERRCODE = '54000'; END IF;
    w.owner_epoch := w.owner_epoch + 1;
  END IF;
  UPDATE public.voxel_worlds SET owner_id = p_owner, owner_epoch = w.owner_epoch,
    lease_expires_at = ts + interval '30 seconds' WHERE session_id = p_session;
  SELECT * INTO c FROM public.voxel_checkpoints WHERE world_id = w.world_id AND sequence = w.checkpoint_sequence;
  IF w.checkpoint_sequence > 0 AND NOT FOUND THEN RAISE EXCEPTION 'checkpoint pointer missing' USING ERRCODE = '55000'; END IF;
  RETURN jsonb_build_object('room',p_session::text,'worldId',w.world_id::text,'owner',p_owner::text,
    'epoch',w.owner_epoch,'sequence',w.checkpoint_sequence,'validForMs',30000,
    'checkpoint',CASE WHEN w.checkpoint_sequence = 0 THEN NULL ELSE jsonb_build_object(
      'ownerEpoch',c.owner_epoch,'sequence',c.sequence,'object',jsonb_build_object(
        'key',c.manifest_key,'sha256',c.manifest_sha256,'bytes',c.manifest_bytes)) END);
END $$;

CREATE FUNCTION public.voxel_renew_room(p_session UUID, p_world UUID, p_owner UUID, p_epoch BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; ts timestamptz;
BEGIN
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id = p_session AND world_id = p_world FOR UPDATE;
  ts := clock_timestamp();
  IF NOT FOUND OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at <= ts THEN RETURN NULL; END IF;
  UPDATE public.voxel_worlds SET lease_expires_at = ts + interval '30 seconds' WHERE session_id = p_session;
  RETURN jsonb_build_object('validForMs',30000);
END $$;

CREATE FUNCTION public.voxel_release_room(p_session UUID, p_world UUID, p_owner UUID, p_epoch BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.voxel_worlds SET lease_expires_at = clock_timestamp()
    WHERE session_id = p_session AND world_id = p_world AND owner_id = p_owner AND owner_epoch = p_epoch;
END $$;

CREATE FUNCTION public.voxel_prepare_object(p_object JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; o public.voxel_objects%ROWTYPE; ts timestamptz;
BEGIN
  SELECT * INTO w FROM public.voxel_worlds WHERE namespace = split_part(p_object->>'key','/',2);
  IF NOT FOUND OR NOT coalesce(public.voxel_valid_object(p_object,w.namespace),false)
    THEN RAISE EXCEPTION 'invalid object reference' USING ERRCODE = '22023'; END IF;
  ts := clock_timestamp();
  INSERT INTO public.voxel_objects(object_key,world_id,sha256,size_bytes,state,protected_until)
    VALUES(p_object->>'key',w.world_id,p_object->>'sha256',(p_object->>'bytes')::bigint,'uploading',ts + interval '24 hours')
    ON CONFLICT (object_key) DO NOTHING;
  SELECT * INTO STRICT o FROM public.voxel_objects WHERE object_key = p_object->>'key' FOR UPDATE;
  IF o.world_id <> w.world_id OR o.sha256 <> p_object->>'sha256' OR o.size_bytes <> (p_object->>'bytes')::bigint
    THEN RAISE EXCEPTION 'immutable object mismatch' USING ERRCODE = '22023'; END IF;
  IF o.state = 'deleting' THEN RETURN NULL; END IF;
  UPDATE public.voxel_objects SET protected_until = greatest(protected_until,ts + interval '24 hours') WHERE object_key = o.object_key;
  RETURN jsonb_build_object('token',o.upload_token::text);
END $$;

CREATE FUNCTION public.voxel_complete_object(p_key TEXT, p_token UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.voxel_objects SET state = 'ready' WHERE object_key = p_key AND upload_token = p_token
    AND state <> 'deleting' AND protected_until > clock_timestamp();
  RETURN FOUND;
END $$;

CREATE FUNCTION public.voxel_commit_checkpoint(p_session UUID, p_world UUID, p_owner UUID,
  p_epoch BIGINT, p_previous BIGINT, p_pointer JSONB, p_objects JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.voxel_worlds%ROWTYPE; c public.voxel_checkpoints%ROWTYPE;
  ref jsonb; object_row public.voxel_objects%ROWTYPE; seen text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO w FROM public.voxel_worlds WHERE session_id = p_session AND world_id = p_world FOR UPDATE;
  IF NOT FOUND OR w.owner_id IS DISTINCT FROM p_owner OR w.owner_epoch IS DISTINCT FROM p_epoch
    OR w.lease_expires_at IS NULL OR w.lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;
  IF p_previous IS NULL OR p_previous < 0 OR p_previous >= 9007199254740991
    OR NOT coalesce(jsonb_typeof(p_pointer) = 'object' AND p_pointer ?& ARRAY['ownerEpoch','sequence','object']
      AND p_pointer - ARRAY['ownerEpoch','sequence','object'] = '{}'::jsonb
      AND p_pointer @> jsonb_build_object('ownerEpoch',p_epoch,'sequence',p_previous + 1)
      AND public.voxel_valid_object(p_pointer->'object',w.namespace),false)
    THEN RAISE EXCEPTION 'invalid checkpoint pointer' USING ERRCODE = '22023'; END IF;
  SELECT * INTO c FROM public.voxel_checkpoints WHERE world_id = p_world AND sequence = w.checkpoint_sequence;
  IF w.checkpoint_sequence = p_previous + 1 AND c.owner_epoch = p_epoch
    AND c.manifest_key = p_pointer->'object'->>'key'
    AND c.manifest_sha256 = p_pointer->'object'->>'sha256'
    AND c.manifest_bytes = (p_pointer->'object'->>'bytes')::bigint THEN RETURN true; END IF;
  IF w.checkpoint_sequence <> p_previous THEN RETURN false; END IF;
  IF p_objects IS NULL OR jsonb_typeof(p_objects) <> 'array' OR jsonb_array_length(p_objects) = 0
    THEN RAISE EXCEPTION 'invalid checkpoint graph' USING ERRCODE = '22023'; END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(p_objects) ORDER BY value->>'key' LOOP
    IF NOT coalesce(public.voxel_valid_object(ref,w.namespace),false) OR (ref->>'key') = ANY(seen)
      THEN RAISE EXCEPTION 'invalid checkpoint graph object' USING ERRCODE = '22023'; END IF;
    seen := array_append(seen,ref->>'key');
    SELECT * INTO object_row FROM public.voxel_objects WHERE object_key = ref->>'key' FOR UPDATE;
    IF NOT FOUND OR object_row.world_id <> p_world OR object_row.state <> 'ready'
      OR object_row.sha256 <> ref->>'sha256' OR object_row.size_bytes <> (ref->>'bytes')::bigint
      THEN RAISE EXCEPTION 'checkpoint object not ready' USING ERRCODE = '55000'; END IF;
  END LOOP;
  IF NOT (p_pointer->'object'->>'key') = ANY(seen) THEN RAISE EXCEPTION 'manifest absent from graph' USING ERRCODE = '22023'; END IF;
  -- Recheck after object locks. A delayed transaction cannot revive expired ownership.
  IF w.lease_expires_at <= clock_timestamp() THEN RETURN false; END IF;
  INSERT INTO public.voxel_checkpoints(world_id,sequence,owner_epoch,manifest_key,manifest_sha256,manifest_bytes)
    VALUES(p_world,p_previous + 1,p_epoch,p_pointer->'object'->>'key',
      p_pointer->'object'->>'sha256',(p_pointer->'object'->>'bytes')::bigint);
  INSERT INTO public.voxel_checkpoint_objects(world_id,sequence,object_key)
    SELECT p_world,p_previous + 1,value FROM unnest(seen) AS value;
  UPDATE public.voxel_worlds SET checkpoint_sequence = p_previous + 1 WHERE session_id = p_session;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.voxel_valid_object(JSONB,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voxel_acquire_room(UUID,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voxel_renew_room(UUID,UUID,UUID,BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voxel_release_room(UUID,UUID,UUID,BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voxel_prepare_object(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voxel_complete_object(TEXT,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voxel_commit_checkpoint(UUID,UUID,UUID,BIGINT,BIGINT,JSONB,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_acquire_room(UUID,UUID),
  public.voxel_renew_room(UUID,UUID,UUID,BIGINT), public.voxel_release_room(UUID,UUID,UUID,BIGINT),
  public.voxel_prepare_object(JSONB), public.voxel_complete_object(TEXT,UUID),
  public.voxel_commit_checkpoint(UUID,UUID,UUID,BIGINT,BIGINT,JSONB,JSONB) TO service_role;

CREATE FUNCTION public.voxel_persistence_status()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('schema',1,'privateBucket',EXISTS(
    SELECT FROM storage.buckets WHERE id = 'voxel-checkpoints' AND public = false))
$$;

CREATE FUNCTION public.voxel_prune_checkpoints()
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE removed bigint;
BEGIN
  DELETE FROM public.voxel_checkpoints AS c USING public.voxel_worlds AS w
    WHERE c.world_id = w.world_id AND c.sequence <> w.checkpoint_sequence
      AND c.created_at < clock_timestamp() - interval '24 hours';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;

CREATE FUNCTION public.voxel_claim_garbage(p_limit INTEGER DEFAULT 64)
RETURNS SETOF JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.voxel_objects%ROWTYPE; token uuid;
BEGIN
  -- This is a bounded cleanup work batch, not an object/player/room admission cap.
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 256 THEN RAISE EXCEPTION 'invalid cleanup batch' USING ERRCODE = '22023'; END IF;
  FOR o IN SELECT * FROM public.voxel_objects AS candidate WHERE (
      (state <> 'deleting' AND protected_until < clock_timestamp() AND created_at < clock_timestamp() - interval '24 hours')
      OR (state = 'deleting' AND delete_claimed_at < clock_timestamp() - interval '10 minutes'))
      AND NOT EXISTS(SELECT FROM public.voxel_checkpoint_objects AS ref WHERE ref.object_key = candidate.object_key)
      ORDER BY created_at, object_key LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    -- Recheck in a separate statement after locking the object. An earlier
    -- statement's snapshot must not miss references from a just-committed graph.
    IF EXISTS(SELECT FROM public.voxel_checkpoint_objects WHERE object_key = o.object_key) THEN CONTINUE; END IF;
    token := gen_random_uuid();
    UPDATE public.voxel_objects SET state = 'deleting', delete_token = token,
      delete_claimed_at = clock_timestamp() WHERE object_key = o.object_key;
    RETURN NEXT jsonb_build_object('key',o.object_key,'token',token::text);
  END LOOP;
END $$;

CREATE FUNCTION public.voxel_finish_garbage(p_key TEXT, p_token UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.voxel_objects%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.voxel_objects WHERE object_key = p_key FOR UPDATE;
  IF NOT FOUND THEN RETURN true; END IF;
  IF o.state <> 'deleting' OR o.delete_token IS DISTINCT FROM p_token THEN RETURN false; END IF;
  IF EXISTS(SELECT FROM public.voxel_checkpoint_objects WHERE object_key = p_key) THEN RETURN false; END IF;
  DELETE FROM public.voxel_objects WHERE object_key = p_key;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.voxel_persistence_status(),public.voxel_prune_checkpoints(),
  public.voxel_claim_garbage(INTEGER),public.voxel_finish_garbage(TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_persistence_status(),public.voxel_prune_checkpoints(),
  public.voxel_claim_garbage(INTEGER),public.voxel_finish_garbage(TEXT,UUID) TO service_role;
