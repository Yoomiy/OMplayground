BEGIN;
DO $owned$ DECLARE worlds uuid[]; BEGIN
 IF EXISTS(SELECT FROM public.game_sessions WHERE id='16bb7296-7228-4024-9775-58afcd57f0a8'::uuid AND (host_id IS DISTINCT FROM '68212e1c-496e-46f5-b66d-b0ccdde1dd6b'::uuid OR invitation_code IS DISTINCT FROM 'vq-33c5672a-89a3-47e6-b6af-635cfac47bc9')) THEN RAISE EXCEPTION 'qualification session ownership mismatch'; END IF;
 SELECT array_agg(world_id) INTO worlds FROM public.voxel_worlds WHERE session_id='16bb7296-7228-4024-9775-58afcd57f0a8'::uuid;
 DELETE FROM public.audit_log WHERE actor_id IN ('68212e1c-496e-46f5-b66d-b0ccdde1dd6b'::uuid,'45c9bfd8-805b-49fd-a5e4-677832512ef0'::uuid) AND entity_type='game_session' AND entity_id='16bb7296-7228-4024-9775-58afcd57f0a8';
 DELETE FROM public.game_sessions WHERE id='16bb7296-7228-4024-9775-58afcd57f0a8'::uuid AND host_id='68212e1c-496e-46f5-b66d-b0ccdde1dd6b'::uuid AND invitation_code='vq-33c5672a-89a3-47e6-b6af-635cfac47bc9';
 DELETE FROM public.voxel_objects WHERE world_id=ANY(worlds);
END $owned$;
COMMIT;
SELECT count(*) AS remaining_sessions FROM public.game_sessions WHERE id='16bb7296-7228-4024-9775-58afcd57f0a8'::uuid;
