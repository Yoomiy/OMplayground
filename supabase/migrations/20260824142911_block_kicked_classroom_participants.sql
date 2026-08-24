-- Removing a LiveKit participant revokes only already-issued tokens. Keep an
-- authoritative classroom-scoped admission block so the token endpoint cannot
-- mint a replacement token for a kicked participant.
CREATE TABLE public.classroom_participant_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  participant_identity TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, participant_key)
);

CREATE INDEX idx_classroom_participant_blocks_classroom
  ON public.classroom_participant_blocks (classroom_id);

ALTER TABLE public.classroom_participant_blocks ENABLE ROW LEVEL SECURITY;

-- Admission and moderation are trusted-server operations. Do not expose the
-- block list, especially guest identifiers, through the Data API.
REVOKE ALL ON TABLE public.classroom_participant_blocks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.classroom_participant_blocks TO service_role;
