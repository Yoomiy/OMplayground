-- 1. Fix foreign key: reporter_id should reference auth.users(id) so admins, teachers, and kids can all submit feedback
ALTER TABLE public.feedback_reports 
  DROP CONSTRAINT IF EXISTS feedback_reports_reporter_id_fkey;

ALTER TABLE public.feedback_reports 
  ADD CONSTRAINT feedback_reports_reporter_id_fkey 
  FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Add RLS policy for updating feedback reports (allows admins and teachers to resolve/update reports)
DROP POLICY IF EXISTS "Admins and teachers can update feedback" ON public.feedback_reports;
CREATE POLICY "Admins and teachers can update feedback"
  ON public.feedback_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.kid_profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.kid_profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- 3. Add RLS policy for deleting feedback reports
DROP POLICY IF EXISTS "Admins can delete feedback" ON public.feedback_reports;
CREATE POLICY "Admins can delete feedback"
  ON public.feedback_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
  );

-- 4. Function to retrieve feedback reports with reporter details (handles kid_profiles and admin_profiles)
CREATE OR REPLACE FUNCTION public.get_feedback_reports(
  p_status text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  reporter_id uuid,
  user_message text,
  category text,
  browser_info jsonb,
  hardware_info jsonb,
  console_logs jsonb,
  screenshot_url text,
  canvas_screenshot_url text,
  status text,
  created_at timestamptz,
  reporter jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role / postgres, or admins and teachers
  IF auth.role() IS NOT NULL AND auth.role() <> 'service_role' AND NOT (
    EXISTS (SELECT 1 FROM public.admin_profiles ap WHERE ap.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.kid_profiles kp WHERE kp.id = auth.uid() AND kp.role = 'teacher')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    fr.id,
    fr.reporter_id,
    fr.user_message,
    fr.category,
    fr.browser_info,
    fr.hardware_info,
    fr.console_logs,
    fr.screenshot_url,
    fr.canvas_screenshot_url,
    fr.status,
    fr.created_at,
    CASE 
      WHEN kp.id IS NOT NULL THEN
        jsonb_build_object(
          'username', kp.username,
          'full_name', kp.full_name,
          'role', kp.role::text
        )
      WHEN ap.id IS NOT NULL THEN
        jsonb_build_object(
          'username', ap.email,
          'full_name', ap.full_name,
          'role', 'admin'
        )
      ELSE NULL
    END AS reporter
  FROM public.feedback_reports fr
  LEFT JOIN public.kid_profiles kp ON fr.reporter_id = kp.id
  LEFT JOIN public.admin_profiles ap ON fr.reporter_id = ap.id
  WHERE (p_status IS NULL OR fr.status = p_status)
    AND (p_category IS NULL OR fr.category = p_category)
  ORDER BY fr.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_feedback_reports(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feedback_reports(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feedback_reports(text, text) TO service_role;
