-- Persistent classroom delegates are managed only by the trusted RTC server.
-- These tables are intentionally inaccessible through the public Data API.

CREATE TABLE IF NOT EXISTS public.classroom_host_delegates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY[
        'manage_settings',
        'remove_participants',
        'manage_whiteboard',
        'manage_delegates'
    ]::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_classroom_host_delegates_classroom
    ON public.classroom_host_delegates(classroom_id)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.classroom_delegate_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegate_id UUID NOT NULL REFERENCES public.classroom_host_delegates(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    target_livekit_identity TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classroom_delegate_enrollments_lookup
    ON public.classroom_delegate_enrollments(code_hash)
    WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS public.classroom_delegate_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegate_id UUID NOT NULL REFERENCES public.classroom_host_delegates(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_classroom_delegate_sessions_delegate
    ON public.classroom_delegate_sessions(delegate_id)
    WHERE revoked_at IS NULL;

ALTER TABLE public.classroom_host_delegates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_delegate_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_delegate_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.classroom_host_delegates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.classroom_delegate_enrollments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.classroom_delegate_sessions FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.classroom_host_delegates TO service_role;
GRANT ALL ON TABLE public.classroom_delegate_enrollments TO service_role;
GRANT ALL ON TABLE public.classroom_delegate_sessions TO service_role;
