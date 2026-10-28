-- Local platform metadata fixture. Admission/Auth remain separate qualifications.
CREATE TYPE public.game_session_status AS ENUM ('waiting','playing','paused','completed');
CREATE TABLE public.games(id UUID PRIMARY KEY,game_url TEXT NOT NULL,is_active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE public.kid_profiles(id UUID PRIMARY KEY,full_name TEXT NOT NULL,gender TEXT NOT NULL,
  grade TEXT,role TEXT NOT NULL DEFAULT 'kid',is_active BOOLEAN NOT NULL DEFAULT true);
ALTER TABLE public.game_sessions ADD COLUMN game_id UUID REFERENCES public.games(id),
  ADD COLUMN host_id UUID REFERENCES public.kid_profiles(id),ADD COLUMN host_name TEXT,
  ADD COLUMN host_grade TEXT,ADD COLUMN player_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN player_names TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN connected_player_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN connected_player_names TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN status public.game_session_status NOT NULL DEFAULT 'waiting',
  ADD COLUMN gender TEXT, ADD COLUMN started_at TIMESTAMPTZ,ADD COLUMN ended_at TIMESTAMPTZ,
  ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT true,ADD COLUMN last_activity TIMESTAMPTZ;
-- Deliberately permissive fixture policies: the authoritative trigger must also
-- protect against pre-existing browser RLS and legacy definer functions.
GRANT USAGE ON SCHEMA public TO authenticated,anon;
GRANT SELECT,UPDATE,DELETE ON public.game_sessions TO authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.game_sessions TO service_role;
