-- Hosted SQL qualification only. Run with the linked project's query tool.
-- All fixture rows and RPC mutations are inside a rolled-back transaction.
-- No accounts, messages, schema changes or Storage bytes are created here.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '20s';
DO $qualification$
DECLARE
  fixture UUID := 'd4cfac36-9b8b-4c3d-a307-1348722f5af7';
  game UUID; host UUID; first_owner UUID := gen_random_uuid(); second_owner UUID := gen_random_uuid();
  lease JSONB; replacement JSONB; world UUID; namespace TEXT;
  manifest JSONB; column_object JSONB; pointer JSONB; upload JSONB; failed BOOLEAN := false;
  payload TEXT := '{"qualification":"metadata-only"}';
  column_payload TEXT := '{"qualification":"column"}';
BEGIN
  IF EXISTS (SELECT 1 FROM public.game_sessions WHERE id = fixture) THEN
    RAISE EXCEPTION 'qualification fixture identity already exists';
  END IF;
  SELECT id INTO game FROM public.games WHERE game_url = 'minecraft' LIMIT 1;
  SELECT id INTO host FROM public.kid_profiles WHERE role = 'kid' LIMIT 1;
  IF game IS NULL OR host IS NULL THEN RAISE EXCEPTION 'qualification catalog/profile prerequisite missing'; END IF;
  INSERT INTO public.game_sessions(id,game_id,host_id,host_name,gender,status,is_open,invitation_code)
    VALUES(fixture,game,host,'voxel-qualification','boy','paused',false,'voxel-qualification-' || fixture::text);

  SET LOCAL ROLE service_role;
  lease := public.voxel_acquire_room(fixture,first_owner);
  IF lease IS NULL OR (lease->>'epoch')::bigint <> 1 OR lease->'checkpoint' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'fresh lease mismatch';
  END IF;
  IF public.voxel_acquire_room(fixture,second_owner) IS NOT NULL THEN
    RAISE EXCEPTION 'competing owner was admitted';
  END IF;
  world := (lease->>'worldId')::uuid;
  namespace := encode(sha256(convert_to(world::text,'UTF8')),'hex');
  manifest := jsonb_build_object('key','v1/' || namespace || '/' || encode(sha256(convert_to(payload,'UTF8')),'hex') || '.json',
    'sha256',encode(sha256(convert_to(payload,'UTF8')),'hex'),'bytes',octet_length(payload));
  column_object := jsonb_build_object('key','v1/' || namespace || '/' || encode(sha256(convert_to(column_payload,'UTF8')),'hex') || '.json',
    'sha256',encode(sha256(convert_to(column_payload,'UTF8')),'hex'),'bytes',octet_length(column_payload));
  upload := public.voxel_prepare_object(manifest);
  IF upload IS NULL OR NOT public.voxel_complete_object(manifest->>'key',(upload->>'token')::uuid) THEN
    RAISE EXCEPTION 'manifest readiness failed';
  END IF;
  upload := public.voxel_prepare_object(column_object);
  pointer := jsonb_build_object('ownerEpoch',1,'sequence',1,'object',manifest);
  BEGIN
    PERFORM public.voxel_commit_checkpoint(fixture,world,first_owner,1,0,pointer,jsonb_build_array(manifest,column_object));
  EXCEPTION WHEN SQLSTATE '55000' THEN failed := true;
  END;
  IF NOT failed OR EXISTS (SELECT 1 FROM public.voxel_checkpoints WHERE world_id = world)
    OR (SELECT checkpoint_sequence FROM public.voxel_worlds WHERE session_id = fixture) <> 0 THEN
    RAISE EXCEPTION 'unready graph was not atomic';
  END IF;
  IF NOT public.voxel_complete_object(column_object->>'key',(upload->>'token')::uuid) THEN
    RAISE EXCEPTION 'column readiness failed';
  END IF;
  IF NOT public.voxel_commit_checkpoint(fixture,world,first_owner,1,0,pointer,jsonb_build_array(manifest,column_object))
    OR NOT public.voxel_commit_checkpoint(fixture,world,first_owner,1,0,pointer,jsonb_build_array(manifest,column_object)) THEN
    RAISE EXCEPTION 'commit or identical retry failed';
  END IF;
  IF (SELECT count(*) FROM public.voxel_checkpoints WHERE world_id = world) <> 1
    OR (SELECT count(*) FROM public.voxel_checkpoint_objects WHERE world_id = world) <> 2 THEN
    RAISE EXCEPTION 'committed graph/history mismatch';
  END IF;
  IF public.voxel_commit_checkpoint(fixture,world,second_owner,1,0,pointer,jsonb_build_array(manifest,column_object)) THEN
    RAISE EXCEPTION 'wrong owner committed';
  END IF;
  PERFORM public.voxel_release_room(fixture,world,first_owner,1);
  replacement := public.voxel_acquire_room(fixture,second_owner);
  IF replacement IS NULL OR (replacement->>'epoch')::bigint <> 2 OR replacement->'checkpoint' <> pointer THEN
    RAISE EXCEPTION 'replacement owner lost committed pointer';
  END IF;
  PERFORM public.voxel_release_room(fixture,world,first_owner,1);
  IF public.voxel_renew_room(fixture,world,second_owner,2) IS NULL
    OR public.voxel_renew_room(fixture,world,first_owner,1) IS NOT NULL THEN
    RAISE EXCEPTION 'old owner affected replacement lease';
  END IF;
  IF has_table_privilege('service_role','public.voxel_worlds','INSERT')
    OR has_table_privilege('anon','public.voxel_worlds','SELECT')
    OR has_table_privilege('authenticated','public.voxel_objects','SELECT')
    OR has_function_privilege('anon','public.voxel_acquire_room(uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.voxel_commit_checkpoint(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'private metadata grants mismatch';
  END IF;
END $qualification$;
ROLLBACK;
SELECT jsonb_build_object(
  'result','PASS',
  'scope','Hosted checkpoint SQL functions with fixture object metadata; no Storage-byte or full recovery claim',
  'rollbackOnly',true,
  'fixtureSessionAbsent',NOT EXISTS(SELECT 1 FROM public.game_sessions WHERE id = 'd4cfac36-9b8b-4c3d-a307-1348722f5af7'),
  'checks',jsonb_build_array('competing owner denied','unready graph atomic','complete graph committed','identical retry idempotent','wrong owner denied','replacement pointer retained','old release fenced','renewal fenced','private grants')
) AS qualification;
