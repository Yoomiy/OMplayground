-- Add persistence column and cleanup RPC for classroom sessions

ALTER TABLE public.classroom_sessions
ADD COLUMN IF NOT EXISTS is_persistent BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for persistent rooms lookup
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_is_persistent ON public.classroom_sessions(is_persistent);

-- RPC Function to cleanup old, non-persistent classrooms older than p_days_old (default 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_classroom_sessions(p_days_old INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    -- Delete non-persistent classrooms that ended or have been inactive for more than p_days_old days
    DELETE FROM public.classroom_sessions
    WHERE is_persistent = FALSE
      AND (
          status = 'ended'
          OR last_activity < (now() - (p_days_old || ' days')::INTERVAL)
          OR created_at < (now() - (p_days_old || ' days')::INTERVAL)
      );
      
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_classroom_sessions(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_classroom_sessions(INT) TO anon;
