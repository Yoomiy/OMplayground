-- New worlds reserve a globally unique uint32 seed before their first checkpoint.
-- Existing checkpoint-backed worlds keep the seed embedded in their saved data.
CREATE TABLE public.voxel_world_seeds (
  world_id UUID PRIMARY KEY REFERENCES public.voxel_worlds(world_id) ON DELETE CASCADE,
  seed BIGINT NOT NULL UNIQUE CHECK (seed BETWEEN 0 AND 4294967295 AND seed <> 4242)
);
ALTER TABLE public.voxel_world_seeds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voxel_world_seeds FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.voxel_world_seeds TO service_role;

-- An odd multiplier permutes the uint32 range without collisions. The existing
-- generator independently hashes each seed into its noise streams. No cycling
-- or seed reuse when worlds are deleted; reserve 4242 for historical worlds.
CREATE SEQUENCE public.voxel_world_seed_counter AS BIGINT
  MINVALUE 0 MAXVALUE 4294967295 START WITH 0 NO CYCLE;
REVOKE ALL ON SEQUENCE public.voxel_world_seed_counter FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.voxel_acquire_seeded_room(p_session UUID, p_owner UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE lease JSONB; reserved BIGINT;
BEGIN
  -- The existing RPC holds the world row lock through this transaction and
  -- retains the same ownership/epoch/lease and checkpoint-pointer checks.
  lease := public.voxel_acquire_room(p_session, p_owner);
  IF lease IS NULL THEN RETURN NULL; END IF;
  SELECT seed INTO reserved FROM public.voxel_world_seeds
    WHERE world_id=(lease->>'worldId')::uuid;
  IF reserved IS NULL AND lease->'checkpoint'='null'::jsonb THEN
    LOOP
      reserved := (nextval('public.voxel_world_seed_counter'::regclass)*1664525+1013904223)%4294967296;
      EXIT WHEN reserved <> 4242;
    END LOOP;
    INSERT INTO public.voxel_world_seeds(world_id,seed)
      VALUES((lease->>'worldId')::uuid,reserved);
  END IF;
  RETURN lease || jsonb_build_object('seed',reserved);
END $$;
REVOKE ALL ON FUNCTION public.voxel_acquire_seeded_room(UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_acquire_seeded_room(UUID,UUID) TO service_role;

CREATE FUNCTION public.voxel_seed_schema_status()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('schema',1,'uniqueSeeds',true)
$$;
REVOKE ALL ON FUNCTION public.voxel_seed_schema_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_seed_schema_status() TO service_role;
