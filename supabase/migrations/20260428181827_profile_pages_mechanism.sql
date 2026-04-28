-- Profile pages mechanism:
--   * avatar storage bucket + RLS
--   * same-gender, unblocked public profile visibility
--   * narrow profile update RPCs for kids/admins

-- ---------- Avatar storage ----------
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'avatars',
  'avatars',
  true,
  524288,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
CREATE POLICY "avatars_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
CREATE POLICY "avatars_update_own_folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "avatars_delete_own_folder" ON storage.objects;
CREATE POLICY "avatars_delete_own_folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

-- ---------- Public profile visibility ----------
CREATE OR REPLACE FUNCTION public.kid_profiles_same_gender_visible(
  p_target_id uuid,
  p_target_role public.user_role,
  p_target_gender public.gender_type
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_target_role = 'kid'
    AND p_target_id IS DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.kid_profiles me
      INNER JOIN public.kid_profiles them ON them.id = p_target_id
      WHERE me.id = auth.uid()
        AND me.role = 'kid'
        AND me.is_active = true
        AND them.role = 'kid'
        AND them.is_active = true
        AND me.gender = p_target_gender
        AND them.gender = p_target_gender
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.kid_blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p_target_id)
         OR (b.blocker_id = p_target_id AND b.blocked_id = auth.uid())
    );
$$;

COMMENT ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type)
  IS 'RLS helper: same-gender active profile visibility, excluding mutual blocks.';

REVOKE ALL ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) TO service_role;

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

-- ---------- Narrow profile mutation ----------
CREATE OR REPLACE FUNCTION public.update_my_profile(p_updates jsonb)
RETURNS public.kid_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY['full_name', 'avatar_color', 'avatar_preset_id', 'avatar_url'];
  v_key text;
  v_profile public.kid_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
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

  UPDATE public.kid_profiles kp
  SET
    full_name = CASE
      WHEN p_updates ? 'full_name' THEN trim(p_updates->>'full_name')
      ELSE kp.full_name
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
    END
  WHERE kp.id = auth.uid()
    AND kp.is_active = true
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(jsonb) TO authenticated;

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

  IF p_updates ? 'grade' AND ((p_updates->>'grade')::integer < 1 OR (p_updates->>'grade')::integer > 7) THEN
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
      WHEN p_updates ? 'grade' THEN (p_updates->>'grade')::integer
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

REVOKE ALL ON FUNCTION public.admin_update_kid_profile(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_kid_profile(uuid, jsonb) TO authenticated;
