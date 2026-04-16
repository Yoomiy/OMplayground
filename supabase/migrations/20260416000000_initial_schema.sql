-- Playground initial schema (Supabase Postgres)
-- Kid/teacher synthetic email: [username]@playground.school.local (Auth only; never show in UI)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --- Enums ---
CREATE TYPE public.user_role AS ENUM ('kid', 'teacher');
CREATE TYPE public.gender_type AS ENUM ('boy', 'girl');
CREATE TYPE public.game_session_status AS ENUM ('waiting', 'playing', 'paused', 'completed');
CREATE TYPE public.game_type AS ENUM ('custom', 'embedded');
CREATE TYPE public.game_gender AS ENUM ('boy', 'girl', 'both');
CREATE TYPE public.private_message_type AS ENUM ('message', 'friend_request');
CREATE TYPE public.friend_request_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed');
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'declined');

-- --- kid_profiles (kid + teacher; id = auth.users.id) ---
CREATE TABLE public.kid_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  full_name text NOT NULL,
  gender public.gender_type NOT NULL,
  grade integer NOT NULL DEFAULT 1 CHECK (grade >= 1 AND grade <= 7),
  role public.user_role NOT NULL DEFAULT 'kid',
  is_active boolean NOT NULL DEFAULT true,
  avatar_color text NOT NULL DEFAULT '#3B82F6',
  avatar_preset_id text,
  avatar_url text,
  last_seen timestamptz,
  best_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_challenge jsonb,
  unread_message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kid_profiles_username_lower ON public.kid_profiles (lower(username));

-- --- Admin (separate from kid_profiles) ---
CREATE TABLE public.admin_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --- Catalog ---
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he text NOT NULL,
  description_he text,
  type public.game_type NOT NULL,
  game_url text NOT NULL,
  thumbnail_url text,
  max_players integer NOT NULL DEFAULT 2,
  min_players integer NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  for_gender public.game_gender NOT NULL DEFAULT 'both',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --- Session metadata (persisted; live play on Railway) ---
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games (id),
  host_id uuid NOT NULL REFERENCES public.kid_profiles (id),
  host_name text NOT NULL,
  player_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  player_names text[] NOT NULL DEFAULT ARRAY[]::text[],
  status public.game_session_status NOT NULL DEFAULT 'waiting',
  is_open boolean NOT NULL DEFAULT true,
  invitation_code text NOT NULL UNIQUE,
  game_state jsonb,
  started_at timestamptz,
  last_activity timestamptz NOT NULL DEFAULT now(),
  gender public.gender_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX game_sessions_status ON public.game_sessions (status);
CREATE INDEX game_sessions_gender ON public.game_sessions (gender);

-- --- In-game chat (persisted) ---
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions (id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.kid_profiles (id),
  is_system boolean NOT NULL DEFAULT false,
  sender_name text NOT NULL,
  message text NOT NULL,
  audio_url text,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_session ON public.chat_messages (session_id);

-- --- Private messaging ---
CREATE TABLE public.private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_kid_id uuid REFERENCES public.kid_profiles (id),
  is_from_admin boolean NOT NULL DEFAULT false,
  from_display_name text NOT NULL,
  to_kid_id uuid NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  to_display_name text NOT NULL,
  sender_gender public.gender_type,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  type public.private_message_type NOT NULL DEFAULT 'message',
  friend_request_status public.friend_request_status,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT private_messages_sender_chk CHECK (
    (is_from_admin = true AND from_kid_id IS NULL)
    OR (is_from_admin = false AND from_kid_id IS NOT NULL)
  )
);

CREATE INDEX private_messages_to ON public.private_messages (to_kid_id);
CREATE INDEX private_messages_from ON public.private_messages (from_kid_id);

-- --- Moderation ---
CREATE TABLE public.moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_kid_id uuid NOT NULL REFERENCES public.kid_profiles (id),
  reporter_kid_name text NOT NULL,
  reported_kid_id uuid NOT NULL REFERENCES public.kid_profiles (id),
  reported_kid_name text NOT NULL,
  message_content text NOT NULL,
  reporter_note text,
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --- Recess (Asia/Jerusalem interpreted in app; day 0 = Sunday) ---
CREATE TABLE public.recess_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time text NOT NULL,
  end_time text NOT NULL,
  name_he text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- --- Avatar presets ---
CREATE TABLE public.avatar_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label_he text NOT NULL,
  emoji text NOT NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

-- --- Social: normalized friendships ---
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_pair_unique UNIQUE (requester_id, addressee_id)
);

CREATE INDEX friendships_requester ON public.friendships (requester_id);
CREATE INDEX friendships_addressee ON public.friendships (addressee_id);

CREATE TABLE public.kid_blocks (
  blocker_id uuid NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT kid_blocks_no_self CHECK (blocker_id <> blocked_id)
);

-- --- Public profile view (no synthetic email; safe fields) ---
CREATE VIEW public.public_kid_profiles AS
SELECT
  id,
  username,
  full_name,
  gender,
  grade,
  role,
  avatar_color,
  avatar_preset_id,
  avatar_url,
  last_seen,
  created_at
FROM public.kid_profiles
WHERE is_active = true;

-- --- Helper: is current time in Israel inside any active recess window (kid role) ---
CREATE OR REPLACE FUNCTION public.is_within_recess_now()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH now_j AS (
    SELECT (now() AT TIME ZONE 'Asia/Jerusalem') AS t
  ),
  parts AS (
    SELECT
      EXTRACT(DOW FROM t)::integer AS dow,
      to_char(t, 'HH24:MI') AS hm
    FROM now_j
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.recess_schedules rs, parts p
    WHERE rs.is_active = true
      AND rs.day_of_week = p.dow
      AND p.hm >= rs.start_time
      AND p.hm <= rs.end_time
  );
$$;

-- --- updated_at trigger ---
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER kid_profiles_updated
BEFORE UPDATE ON public.kid_profiles
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER friendships_updated
BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- --- Realtime ---
ALTER PUBLICATION supabase_realtime ADD TABLE public.kid_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
