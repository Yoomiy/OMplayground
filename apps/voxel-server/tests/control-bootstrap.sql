-- Local platform audit/admin metadata fixtures, separate from real SQL authority.
CREATE TABLE public.admin_profiles(id UUID PRIMARY KEY);
CREATE TABLE public.audit_log(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),actor_id UUID,
 actor_kind TEXT NOT NULL CHECK(actor_kind IN ('admin','teacher')),action TEXT NOT NULL,
 entity_type TEXT NOT NULL,entity_id UUID,metadata JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM PUBLIC,anon,authenticated;
