-- Feedback reports table
CREATE TABLE public.feedback_reports (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_message          text        NOT NULL,
  category              text        NOT NULL CHECK (category IN ('bug', 'suggestion', 'other')),
  browser_info          jsonb       NOT NULL,
  hardware_info         jsonb       NOT NULL,
  console_logs          jsonb       NOT NULL DEFAULT '[]',
  screenshot_url        text,       -- Storage object URL for full screenshot or game canvas screenshot
  canvas_screenshot_url text,       -- Storage object URL for game-only canvas screenshot when full screenshot is taken
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user (kid / teacher / admin) can submit feedback
CREATE POLICY "Authenticated users can insert feedback"
  ON public.feedback_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admins and teachers can read feedback reports
CREATE POLICY "Admins and teachers can view feedback"
  ON public.feedback_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.kid_profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- Create feedback-screenshots storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-screenshots',
  'feedback-screenshots',
  false, -- private
  524288, -- 512 KB size limit
  '{"image/jpeg"}'
)
ON CONFLICT (id) DO NOTHING;

-- 1. Allow authenticated users to upload screenshots to the feedback-screenshots bucket
CREATE POLICY "Allow authenticated uploads to feedback-screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'feedback-screenshots');

-- 2. Allow admins and teachers to view/read feedback screenshots
CREATE POLICY "Allow admins and teachers to view feedback-screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (
      EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.kid_profiles
        WHERE id = auth.uid() AND role = 'teacher'
      )
    )
  );
