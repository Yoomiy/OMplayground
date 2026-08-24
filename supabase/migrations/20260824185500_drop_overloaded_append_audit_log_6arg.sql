-- Drop the legacy 6-argument overload of append_audit_log so PostgREST RPC
-- can resolve the 7-argument version (with default correlation_id) unambiguously.
DROP FUNCTION IF EXISTS public.append_audit_log(uuid, text, text, text, uuid, jsonb);
