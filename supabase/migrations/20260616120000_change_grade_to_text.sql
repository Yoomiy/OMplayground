-- Convert grade to text (Hebrew letters א-ח)

-- Drop view that depends on grade column
DROP VIEW IF EXISTS public.public_kid_profiles CASCADE;

-- Drop constraints
ALTER TABLE public.kid_profiles DROP CONSTRAINT IF EXISTS kid_profiles_grade_check;
ALTER TABLE public.game_sessions DROP CONSTRAINT IF EXISTS game_sessions_host_grade_check;

-- Alter column types to TEXT
ALTER TABLE public.kid_profiles ALTER COLUMN grade TYPE text;
ALTER TABLE public.kid_profiles ALTER COLUMN grade SET DEFAULT 'א';

ALTER TABLE public.game_sessions ALTER COLUMN host_grade TYPE text;

-- Temporarily disable immutable columns guard trigger for migrations
ALTER TABLE public.kid_profiles DISABLE TRIGGER kid_profiles_guard_immutable;

-- Map existing numeric values to Hebrew letters
UPDATE public.kid_profiles
SET grade = CASE
  WHEN grade = '1' THEN 'א'
  WHEN grade = '2' THEN 'ב'
  WHEN grade = '3' THEN 'ג'
  WHEN grade = '4' THEN 'ד'
  WHEN grade = '5' THEN 'ה'
  WHEN grade = '6' THEN 'ו'
  WHEN grade = '7' THEN 'ז'
  WHEN grade = '8' THEN 'ח'
  ELSE 'א'
END;

ALTER TABLE public.kid_profiles ENABLE TRIGGER kid_profiles_guard_immutable;

-- Temporarily disable authoritative column updates guard trigger for migrations
ALTER TABLE public.game_sessions DISABLE TRIGGER game_sessions_guard_authoritative;

UPDATE public.game_sessions
SET host_grade = CASE
  WHEN host_grade = '1' THEN 'א'
  WHEN host_grade = '2' THEN 'ב'
  WHEN host_grade = '3' THEN 'ג'
  WHEN host_grade = '4' THEN 'ד'
  WHEN host_grade = '5' THEN 'ה'
  WHEN host_grade = '6' THEN 'ו'
  WHEN host_grade = '7' THEN 'ז'
  WHEN host_grade = '8' THEN 'ח'
  ELSE NULL
END;

ALTER TABLE public.game_sessions ENABLE TRIGGER game_sessions_guard_authoritative;

-- Re-apply constraints
ALTER TABLE public.kid_profiles ADD CONSTRAINT kid_profiles_grade_check CHECK (grade IN ('א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'));
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_host_grade_check CHECK (host_grade IS NULL OR host_grade IN ('א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'));

-- Re-create view public_kid_profiles
CREATE OR REPLACE VIEW public.public_kid_profiles
WITH (security_invoker = true)
AS
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

-- Update admin_update_kid_profile RPC
CREATE OR REPLACE FUNCTION public.admin_update_kid_profile(
  p_kid_id uuid,
  p_updates jsonb
)
RETURNS public.kid_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'username',
    'full_name',
    'gender',
    'grade',
    'role',
    'is_active',
    'avatar_color',
    'avatar_preset_id',
    'avatar_url',
    'best_scores',
    'unread_message_count'
  ];
  v_key text;
  v_profile public.kid_profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(COALESCE(p_updates, '{}'::jsonb))
  LOOP
    IF NOT v_key = ANY (v_allowed) THEN
      RAISE EXCEPTION 'FIELD_NOT_ALLOWED: %', v_key;
    END IF;
  END LOOP;

  IF p_updates ? 'full_name' AND length(trim(COALESCE(p_updates->>'full_name', ''))) = 0 THEN
    RAISE EXCEPTION 'FULL_NAME_REQUIRED';
  END IF;

  IF p_updates ? 'username' AND length(trim(COALESCE(p_updates->>'username', ''))) = 0 THEN
    RAISE EXCEPTION 'USERNAME_REQUIRED';
  END IF;

  IF p_updates ? 'grade' AND NOT (p_updates->>'grade' IN ('א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח')) THEN
    RAISE EXCEPTION 'GRADE_OUT_OF_RANGE';
  END IF;

  UPDATE public.kid_profiles kp
  SET
    username = CASE
      WHEN p_updates ? 'username' THEN lower(trim(p_updates->>'username'))
      ELSE kp.username
    END,
    full_name = CASE
      WHEN p_updates ? 'full_name' THEN trim(p_updates->>'full_name')
      ELSE kp.full_name
    END,
    gender = CASE
      WHEN p_updates ? 'gender' THEN (p_updates->>'gender')::public.gender_type
      ELSE kp.gender
    END,
    grade = CASE
      WHEN p_updates ? 'grade' THEN p_updates->>'grade'
      ELSE kp.grade
    END,
    role = CASE
      WHEN p_updates ? 'role' THEN (p_updates->>'role')::public.user_role
      ELSE kp.role
    END,
    is_active = CASE
      WHEN p_updates ? 'is_active' THEN (p_updates->>'is_active')::boolean
      ELSE kp.is_active
    END,
    avatar_color = CASE
      WHEN p_updates ? 'avatar_color' THEN COALESCE(NULLIF(p_updates->>'avatar_color', ''), kp.avatar_color)
      ELSE kp.avatar_color
    END,
    avatar_preset_id = CASE
      WHEN p_updates ? 'avatar_preset_id' THEN NULLIF(p_updates->>'avatar_preset_id', '')
      ELSE kp.avatar_preset_id
    END,
    avatar_url = CASE
      WHEN p_updates ? 'avatar_url' THEN NULLIF(p_updates->>'avatar_url', '')
      ELSE kp.avatar_url
    END,
    best_scores = CASE
      WHEN p_updates ? 'best_scores' THEN COALESCE(p_updates->'best_scores', '{}'::jsonb)
      ELSE kp.best_scores
    END,
    unread_message_count = CASE
      WHEN p_updates ? 'unread_message_count' THEN GREATEST(0, (p_updates->>'unread_message_count')::integer)
      ELSE kp.unread_message_count
    END
  WHERE kp.id = p_kid_id
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  PERFORM public.append_audit_log(
    auth.uid(),
    'admin',
    'update_kid_profile',
    'kid_profile',
    p_kid_id,
    p_updates
  );

  RETURN v_profile;
END;
$$;
