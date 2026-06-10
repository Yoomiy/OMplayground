-- Extend append_audit_log to stash correlation_id in metadata (Option 1).

CREATE OR REPLACE FUNCTION public.append_audit_log(
  p_actor_id uuid,
  p_actor_kind text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_correlation_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, actor_kind, action, entity_type, entity_id, metadata)
  VALUES (
    p_actor_id,
    p_actor_kind,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb) || CASE
      WHEN p_correlation_id IS NOT NULL AND btrim(p_correlation_id) <> ''
      THEN jsonb_build_object('correlation_id', btrim(p_correlation_id))
      ELSE '{}'::jsonb
    END
  );
END;
$$;

CREATE INDEX IF NOT EXISTS audit_log_metadata_correlation_id
  ON public.audit_log ((metadata->>'correlation_id'))
  WHERE metadata ? 'correlation_id';
