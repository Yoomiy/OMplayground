-- Roll back the abandoned stored-media board prototype. The new live
-- presentation path has no persistent media assets, boards, or stage metadata.

-- Storage objects and the bucket are removed through the Storage API before
-- this migration. Direct SQL deletion is intentionally blocked by Supabase.

DROP TABLE IF EXISTS public.classroom_media_boards;
DROP TABLE IF EXISTS public.classroom_media_assets;
DROP TABLE IF EXISTS public.classroom_media_cleanup_jobs;

ALTER TABLE public.classroom_sessions
  DROP COLUMN IF EXISTS board_stage,
  DROP COLUMN IF EXISTS board_revision;

-- Restore the lifecycle function that existed before the media-board migration.
CREATE OR REPLACE FUNCTION public.end_classroom_session(p_room_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.classroom_sessions
    SET
        status = 'ended',
        ended_at = now(),
        whiteboard_data = NULL,
        last_activity = now()
    WHERE room_code = p_room_code;
END;
$$;

REVOKE ALL ON FUNCTION public.end_classroom_session(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_classroom_session(TEXT) TO service_role;

-- The new live-presentation implementation retains its dedicated authority,
-- but removes the two permissions that only served stored media boards.
UPDATE public.classroom_host_delegates
SET scopes = array_remove(array_remove(scopes, 'manage_boards'), 'manage_media')
WHERE scopes && ARRAY['manage_boards', 'manage_media']::TEXT[];
