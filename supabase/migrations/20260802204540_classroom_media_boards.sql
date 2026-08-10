-- Classroom media boards are kept separate from the existing Socket.IO/Yjs
-- whiteboard.  Browser clients never receive direct table or Storage access;
-- the trusted classroom server issues the narrow read/upload URLs they need.

ALTER TABLE public.classroom_sessions
  ADD COLUMN IF NOT EXISTS board_stage JSONB NOT NULL DEFAULT '{"visibleBoardIds":["whiteboard"],"revision":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS board_revision INTEGER NOT NULL DEFAULT 0;

UPDATE public.classroom_host_delegates
SET scopes = ARRAY[
  'manage_settings', 'remove_participants', 'manage_whiteboard',
  'manage_boards', 'manage_media', 'control_presentation', 'manage_delegates'
]::TEXT[]
WHERE scopes @> ARRAY['manage_whiteboard']::TEXT[];

CREATE TABLE IF NOT EXISTS public.classroom_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL UNIQUE,
  rendered_path TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'queued', 'processing', 'ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classroom_media_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.classroom_media_assets(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio', 'video', 'pdf')),
  control_mode TEXT NOT NULL DEFAULT 'presentation'
    CHECK (control_mode IN ('presentation', 'independent')),
  shared_state JSONB NOT NULL DEFAULT '{"playback":"paused","positionSeconds":0,"effectiveAt":0,"page":1}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classroom_media_assets_classroom
  ON public.classroom_media_assets(classroom_id, created_at);
CREATE INDEX IF NOT EXISTS idx_classroom_media_boards_classroom
  ON public.classroom_media_boards(classroom_id, created_at);

CREATE TABLE IF NOT EXISTS public.classroom_media_cleanup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_paths TEXT[] NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_media_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_media_cleanup_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.classroom_media_assets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.classroom_media_boards FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.classroom_media_cleanup_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.classroom_media_assets TO service_role;
GRANT ALL ON TABLE public.classroom_media_boards TO service_role;
GRANT ALL ON TABLE public.classroom_media_cleanup_jobs TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'classroom-media',
  'classroom-media',
  false,
  524288000,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4',
    'video/mp4', 'video/webm',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Deliberately no storage.objects policies: all uploads and reads use signed
-- URLs produced by the trusted application server.

-- The application server performs Storage cleanup before ending the classroom;
-- this function also clears the shared-stage metadata for any service caller.
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
    board_stage = '{"visibleBoardIds":[],"revision":0}'::jsonb,
    board_revision = board_revision + 1,
    last_activity = now()
  WHERE room_code = p_room_code;
END;
$$;

