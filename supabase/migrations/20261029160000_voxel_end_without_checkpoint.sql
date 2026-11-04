-- Explicit session end does not require a final world checkpoint.
-- Keeps the owner/epoch, permission, audit and idempotent receipt boundaries.
-- Compatible with existing servers that still save before ending.

CREATE OR REPLACE FUNCTION public.voxel_finish_control(p_session UUID,p_world UUID,p_owner UUID,p_epoch BIGINT,
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
  -- Pause must be durable; ending may discard the live world. Historical end
  -- requests with a committed checkpoint remain valid for older deployments.
  IF (r.action='resume' AND p_saved IS NOT NULL)
    OR (r.action='pause' AND p_saved IS NULL)
    OR (p_saved IS NOT NULL AND NOT EXISTS(
      SELECT FROM public.voxel_checkpoints WHERE world_id=p_world AND sequence=p_saved AND owner_epoch=p_epoch)) THEN
    RAISE EXCEPTION 'control checkpoint uncommitted' USING ERRCODE='55000'; END IF;
  UPDATE public.voxel_session_commands SET completed=true,saved_sequence=p_saved,completed_at=clock_timestamp()
    WHERE session_id=p_session AND request_id=p_request;
  IF r.audit_id IS NOT NULL THEN UPDATE public.audit_log SET metadata=metadata||jsonb_build_object(
    'status','completed','saved_sequence',p_saved) WHERE id=r.audit_id; END IF;
  IF w.lease_expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'voxel owner unavailable' USING ERRCODE='55000'; END IF;
  RETURN public.voxel_control_receipt(p_session,p_request,p_actor);
END $$;
