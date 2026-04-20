-- Fix 42P17: infinite recursion on kid_profiles — the same-gender SELECT policy
-- queried kid_profiles inside a policy on kid_profiles, re-entering RLS.

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
      WHERE me.id = auth.uid()
        AND me.role = 'kid'
        AND me.gender = p_target_gender
    );
$$;

COMMENT ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type)
  IS 'RLS helper: same-gender visibility without re-entering kid_profiles policies.';

REVOKE ALL ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kid_profiles_same_gender_visible(uuid, public.user_role, public.gender_type) TO service_role;

DROP POLICY IF EXISTS "kid_profiles_select_same_gender" ON public.kid_profiles;

CREATE POLICY "kid_profiles_select_same_gender"
  ON public.kid_profiles FOR SELECT
  USING (
    public.kid_profiles_same_gender_visible(
      public.kid_profiles.id,
      public.kid_profiles.role,
      public.kid_profiles.gender
    )
  );
