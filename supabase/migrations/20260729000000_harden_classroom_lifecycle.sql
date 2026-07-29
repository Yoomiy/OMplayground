-- Classroom lifecycle writes are performed by the trusted application server.
-- Do not expose SECURITY DEFINER maintenance functions through the public API.

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

CREATE OR REPLACE FUNCTION public.cleanup_old_classroom_sessions(p_days_old INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    IF p_days_old < 1 OR p_days_old > 365 THEN
        RAISE EXCEPTION 'p_days_old must be between 1 and 365';
    END IF;

    DELETE FROM public.classroom_sessions
    WHERE is_persistent = FALSE
      AND (
          status = 'ended'
          OR last_activity < (now() - make_interval(days => p_days_old))
      );

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.end_classroom_session(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_classroom_sessions(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_classroom_session(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_classroom_sessions(INT) TO service_role;

-- Classroom drawing sessions are a reserved server-coordinated namespace.
-- A student must never win a creation race and become the persistent board host.
DROP POLICY IF EXISTS "game_sessions_insert_host" ON public.game_sessions;
CREATE POLICY "game_sessions_insert_host"
    ON public.game_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = host_id
        AND (
            invitation_code NOT LIKE 'class-draw-%'
            OR EXISTS (
                SELECT 1
                FROM public.kid_profiles kp
                WHERE kp.id = auth.uid() AND kp.role = 'teacher'
            )
        )
    );

DROP POLICY IF EXISTS "Teachers and admins can insert classroom sessions" ON public.classroom_sessions;
CREATE POLICY "Teachers can insert their own classroom sessions"
    ON public.classroom_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        teacher_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.kid_profiles kp
            WHERE kp.id = auth.uid() AND kp.role = 'teacher'
        )
    );
CREATE POLICY "Admins can insert classroom sessions"
    ON public.classroom_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Teachers and admins can update classroom sessions" ON public.classroom_sessions;
CREATE POLICY "Teachers can update their own classroom sessions"
    ON public.classroom_sessions
    FOR UPDATE
    TO authenticated
    USING (
        teacher_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.kid_profiles kp
            WHERE kp.id = auth.uid() AND kp.role = 'teacher'
        )
    )
    WITH CHECK (
        teacher_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.kid_profiles kp
            WHERE kp.id = auth.uid() AND kp.role = 'teacher'
        )
    );
CREATE POLICY "Admins can update classroom sessions"
    ON public.classroom_sessions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    );
