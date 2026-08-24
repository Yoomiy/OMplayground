-- Per-class recess exceptions. The existing recess_schedules table remains
-- the school-wide default; a grade+gender override can explicitly mark a
-- period as either recess or class time.

CREATE TABLE public.class_recess_schedule_settings (
  grade text NOT NULL CHECK (grade IN ('א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח')),
  gender public.gender_type NOT NULL,
  override_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grade, gender)
);

CREATE TABLE public.class_recess_schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade text NOT NULL,
  gender public.gender_type NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time text NOT NULL CHECK (start_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text NOT NULL CHECK (end_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  mode text NOT NULL CHECK (mode IN ('recess', 'class_time')),
  name_he text NOT NULL CHECK (length(btrim(name_he)) > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_recess_exception_time_order CHECK (start_time < end_time),
  CONSTRAINT class_recess_exception_settings_fk
    FOREIGN KEY (grade, gender)
    REFERENCES public.class_recess_schedule_settings (grade, gender)
    ON DELETE CASCADE
);

CREATE INDEX class_recess_schedule_exceptions_lookup_idx
  ON public.class_recess_schedule_exceptions (grade, gender, day_of_week, start_time)
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.reject_overlapping_class_recess_exceptions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active AND EXISTS (
    SELECT 1
    FROM public.class_recess_schedule_exceptions AS existing
    WHERE existing.grade = NEW.grade
      AND existing.gender = NEW.gender
      AND existing.day_of_week = NEW.day_of_week
      AND existing.is_active
      AND existing.id IS DISTINCT FROM NEW.id
      AND NEW.start_time < existing.end_time
      AND existing.start_time < NEW.end_time
  ) THEN
    RAISE EXCEPTION 'Class recess exceptions may not overlap';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER class_recess_exception_no_overlap
  BEFORE INSERT OR UPDATE ON public.class_recess_schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.reject_overlapping_class_recess_exceptions();

CREATE TRIGGER class_recess_schedule_settings_updated_at
  BEFORE UPDATE ON public.class_recess_schedule_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER class_recess_schedule_exceptions_updated_at
  BEFORE UPDATE ON public.class_recess_schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.class_recess_schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_recess_schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_recess_settings_select_own_or_admin"
  ON public.class_recess_schedule_settings FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.kid_profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.grade = class_recess_schedule_settings.grade
        AND profile.gender = class_recess_schedule_settings.gender
    )
  );

CREATE POLICY "class_recess_exceptions_select_own_or_admin"
  ON public.class_recess_schedule_exceptions FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.kid_profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.grade = class_recess_schedule_exceptions.grade
        AND profile.gender = class_recess_schedule_exceptions.gender
    )
  );

CREATE POLICY "class_recess_settings_admin_write"
  ON public.class_recess_schedule_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "class_recess_exceptions_admin_write"
  ON public.class_recess_schedule_exceptions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.class_recess_schedule_settings FROM anon, authenticated;
REVOKE ALL ON public.class_recess_schedule_exceptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_recess_schedule_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_recess_schedule_exceptions TO authenticated;
