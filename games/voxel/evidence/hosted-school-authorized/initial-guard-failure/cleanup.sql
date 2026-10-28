BEGIN;
DO $owned$ DECLARE worlds uuid[]; BEGIN
 IF EXISTS(SELECT FROM public.game_sessions WHERE id='378c32e4-9c06-4825-9f8c-573b2a386dc3'::uuid AND (host_id IS DISTINCT FROM 'f7d25c65-53c9-4313-8298-5e535e1c8a3e'::uuid OR invitation_code IS DISTINCT FROM 'vq-3c6c91b8-1462-41e4-82a3-547546ee7a56')) THEN RAISE EXCEPTION 'qualification session ownership mismatch'; END IF;
 SELECT array_agg(world_id) INTO worlds FROM public.voxel_worlds WHERE session_id='378c32e4-9c06-4825-9f8c-573b2a386dc3'::uuid;
 DELETE FROM public.audit_log WHERE actor_id IN ('f7d25c65-53c9-4313-8298-5e535e1c8a3e'::uuid,'4f53c31f-0690-40ad-97ff-9b88f12398e9'::uuid) AND entity_type='game_session' AND entity_id='378c32e4-9c06-4825-9f8c-573b2a386dc3';
 DELETE FROM public.game_sessions WHERE id='378c32e4-9c06-4825-9f8c-573b2a386dc3'::uuid AND host_id='f7d25c65-53c9-4313-8298-5e535e1c8a3e'::uuid AND invitation_code='vq-3c6c91b8-1462-41e4-82a3-547546ee7a56';
 DELETE FROM public.voxel_objects WHERE world_id=ANY(worlds);
END $owned$;
COMMIT;
SELECT count(*) AS remaining_sessions FROM public.game_sessions WHERE id='378c32e4-9c06-4825-9f8c-573b2a386dc3'::uuid;
