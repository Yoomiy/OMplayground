-- New classrooms launch with chat enabled. Existing sessions are intentionally
-- left unchanged because the classroom feature has not launched yet.
ALTER TABLE public.classroom_sessions
  ALTER COLUMN settings SET DEFAULT '{
    "allowStudentMic": true,
    "allowStudentCam": true,
    "allowStudentChat": true,
    "allowWhiteboardDraw": false,
    "whiteboardVisible": true
  }'::jsonb;

CREATE TABLE public.classroom_whiteboard_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  participant_identity TEXT NOT NULL,
  display_name TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT classroom_whiteboard_permissions_key_unique UNIQUE (classroom_id, participant_key)
);

CREATE INDEX classroom_whiteboard_permissions_classroom
  ON public.classroom_whiteboard_permissions (classroom_id);

ALTER TABLE public.classroom_whiteboard_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.classroom_whiteboard_permissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.classroom_whiteboard_permissions TO service_role;
