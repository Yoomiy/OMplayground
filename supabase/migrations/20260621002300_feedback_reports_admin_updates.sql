-- Add status column to feedback_reports
ALTER TABLE public.feedback_reports 
  ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved'));

-- Modify reporter_id foreign key to point to public.kid_profiles instead of auth.users
-- This enables direct, permission-safe joins in PostgREST queries.
ALTER TABLE public.feedback_reports 
  DROP CONSTRAINT IF EXISTS feedback_reports_reporter_id_fkey;

ALTER TABLE public.feedback_reports 
  ADD CONSTRAINT feedback_reports_reporter_id_fkey 
  FOREIGN KEY (reporter_id) REFERENCES public.kid_profiles(id) ON DELETE SET NULL;
