-- Recipients may mark a private message as read, but cannot rewrite its body
-- or identity. Existing recipient RLS still determines which rows may change.
REVOKE UPDATE ON TABLE public.private_messages FROM PUBLIC, anon, authenticated;
GRANT UPDATE (is_read) ON TABLE public.private_messages TO authenticated;

-- Board, Rocket and Wobble chat already uses authenticated game services.
-- Keep sender identity, system messages and participation checks on that path.
DROP POLICY IF EXISTS "chat_messages_insert_participant" ON public.chat_messages;
REVOKE INSERT ON TABLE public.chat_messages FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.chat_messages TO service_role;
