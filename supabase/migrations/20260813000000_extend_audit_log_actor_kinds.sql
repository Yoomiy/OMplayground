-- Operational server actions may be attributable to an enrolled delegate or system.
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_actor_kind_check;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_kind_check
  CHECK (actor_kind IN ('admin', 'teacher', 'delegate', 'system'));
