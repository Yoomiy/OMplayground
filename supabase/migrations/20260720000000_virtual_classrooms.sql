-- Create virtual classrooms table and RPCs
CREATE TABLE IF NOT EXISTS public.classroom_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject TEXT,
    teacher_id UUID REFERENCES public.kid_profiles(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL,
    room_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    settings JSONB NOT NULL DEFAULT '{
      "allowStudentMic": false,
      "allowStudentCam": true,
      "allowStudentChat": false,
      "allowStudentScreenShare": false,
      "allowWhiteboardDraw": false
    }'::jsonb,
    whiteboard_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index room_code and status for fast lookups
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_room_code ON public.classroom_sessions(room_code);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_status ON public.classroom_sessions(status);
CREATE INDEX IF NOT EXISTS idx_classroom_sessions_teacher ON public.classroom_sessions(teacher_id);

-- Enable RLS
ALTER TABLE public.classroom_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read active rooms (enables guest students to join via room_code link)
CREATE POLICY "Anyone can view active classroom sessions"
    ON public.classroom_sessions
    FOR SELECT
    USING (status = 'active');

-- Authenticated teachers and admins can view all classroom sessions
CREATE POLICY "Teachers and admins can view all classroom sessions"
    ON public.classroom_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.kid_profiles kp
            WHERE kp.id = auth.uid() AND kp.role = 'teacher'
        )
        OR EXISTS (
            SELECT 1 FROM public.admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    );

-- Teachers and admins can insert classroom sessions
CREATE POLICY "Teachers and admins can insert classroom sessions"
    ON public.classroom_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.kid_profiles kp
            WHERE kp.id = auth.uid() AND kp.role = 'teacher'
        )
        OR EXISTS (
            SELECT 1 FROM public.admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    );

-- Teachers and admins can update their own or any classroom session
CREATE POLICY "Teachers and admins can update classroom sessions"
    ON public.classroom_sessions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.kid_profiles kp
            WHERE kp.id = auth.uid() AND kp.role = 'teacher'
        )
        OR EXISTS (
            SELECT 1 FROM public.admin_profiles ap
            WHERE ap.id = auth.uid()
        )
    );

-- Function to end classroom session and wipe whiteboard data
CREATE OR REPLACE FUNCTION public.end_classroom_session(p_room_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.end_classroom_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_classroom_session(TEXT) TO anon;

-- Enable Supabase Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'classroom_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_sessions;
    END IF;
END $$;
