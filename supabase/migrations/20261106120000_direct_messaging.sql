-- Admins have separate profiles; identified DM participants reference auth identities.
ALTER TABLE public.private_messages DROP CONSTRAINT IF EXISTS private_messages_from_kid_id_fkey;
ALTER TABLE public.private_messages DROP CONSTRAINT IF EXISTS private_messages_to_kid_id_fkey;
ALTER TABLE public.private_messages ADD CONSTRAINT private_messages_from_kid_id_fkey FOREIGN KEY(from_kid_id) REFERENCES auth.users(id);
ALTER TABLE public.private_messages ADD CONSTRAINT private_messages_to_kid_id_fkey FOREIGN KEY(to_kid_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- A child can report an identified administrator as well as a kid or teacher.
ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_reported_kid_id_fkey;
ALTER TABLE public.moderation_reports ADD CONSTRAINT moderation_reports_reported_kid_id_fkey FOREIGN KEY(reported_kid_id) REFERENCES auth.users(id);
-- Identified conversations coexist with the legacy anonymous admin notice feed.
ALTER TABLE public.private_messages ADD COLUMN client_request_id uuid;
ALTER TABLE public.private_messages ADD COLUMN sender_role text CHECK (sender_role IN ('kid','teacher','admin'));
UPDATE public.private_messages SET sender_role = CASE WHEN is_from_admin THEN 'admin' ELSE 'kid' END;
CREATE UNIQUE INDEX private_messages_request ON public.private_messages(from_kid_id,client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX private_messages_pair_history ON public.private_messages(from_kid_id,to_kid_id,created_at DESC,id DESC);

CREATE FUNCTION public.dm_can_send(p_target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND auth.uid()<>p_target AND (
   (EXISTS(SELECT 1 FROM admin_profiles WHERE id=auth.uid()) AND EXISTS(SELECT 1 FROM kid_profiles WHERE id=p_target AND role='kid' AND is_active)) OR
   EXISTS(SELECT 1 FROM kid_profiles me WHERE me.id=auth.uid() AND me.is_active AND (
     EXISTS(SELECT 1 FROM kid_profiles them WHERE them.id=p_target AND them.is_active AND (
       (me.role='kid' AND them.role='kid' AND me.gender=them.gender) OR
       (me.role='teacher' AND them.role='kid' AND me.gender=them.gender) OR
       (me.role='kid' AND them.role='teacher' AND EXISTS(SELECT 1 FROM private_messages WHERE from_kid_id=them.id AND to_kid_id=me.id AND sender_role='teacher'))
     )) OR (me.role='kid' AND EXISTS(SELECT 1 FROM admin_profiles WHERE id=p_target) AND EXISTS(SELECT 1 FROM private_messages WHERE from_kid_id=p_target AND to_kid_id=me.id AND sender_role='admin'))
   ))
 ) AND NOT EXISTS(SELECT 1 FROM kid_blocks WHERE (blocker_id=auth.uid() AND blocked_id=p_target) OR (blocker_id=p_target AND blocked_id=auth.uid()));
$$;
CREATE FUNCTION public.dm_participant(p_partner text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_partner='__admin__' THEN
   IF NOT EXISTS(SELECT 1 FROM private_messages WHERE to_kid_id=auth.uid() AND is_from_admin) THEN RAISE EXCEPTION 'DM_NOT_AVAILABLE'; END IF;
   RETURN jsonb_build_object('id','__admin__','full_name','הודעות הנהלה','role','admin','can_send',false);
 END IF;
 target:=p_partner::uuid;
 IF NOT public.dm_can_send(target) AND NOT EXISTS(SELECT 1 FROM private_messages WHERE
 (from_kid_id=auth.uid() AND to_kid_id=target) OR (from_kid_id=target AND to_kid_id=auth.uid())) THEN RAISE EXCEPTION 'DM_NOT_AVAILABLE'; END IF;
 IF EXISTS(SELECT 1 FROM admin_profiles WHERE id=target) THEN RETURN (SELECT jsonb_build_object('id',id,'full_name',full_name,'role','admin','can_send',public.dm_can_send(id)) FROM admin_profiles WHERE id=target); END IF;
 IF EXISTS(SELECT 1 FROM kid_profiles WHERE id=target) THEN
   RETURN (SELECT jsonb_build_object('id',id,'full_name',full_name,'role',role,'can_send',public.dm_can_send(id)) FROM kid_profiles WHERE id=target);
 END IF;
 -- Keep history readable when a participant profile has been removed.
 RETURN (SELECT jsonb_build_object('id',target,'full_name',CASE WHEN from_kid_id=target THEN from_display_name ELSE to_display_name END,
 'role',CASE WHEN from_kid_id=target THEN coalesce(sender_role,'kid') ELSE 'kid' END,'can_send',false)
 FROM private_messages WHERE (from_kid_id=target AND to_kid_id=auth.uid()) OR (from_kid_id=auth.uid() AND to_kid_id=target) ORDER BY created_at DESC,id DESC LIMIT 1);
END; $$;
CREATE FUNCTION public.send_private_message(p_to uuid,p_content text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me kid_profiles%ROWTYPE; message private_messages%ROWTYPE; sender_name text; target_name text; actor_role text;
BEGIN
 IF NOT public.dm_can_send(p_to) THEN RAISE EXCEPTION 'DM_NOT_ALLOWED'; END IF;
 IF p_request_id IS NULL OR length(btrim(p_content)) NOT BETWEEN 1 AND 300 OR p_content IS NULL THEN RAISE EXCEPTION 'INVALID_MESSAGE'; END IF;
 SELECT * INTO me FROM kid_profiles WHERE id=auth.uid();
 SELECT full_name INTO sender_name FROM admin_profiles WHERE id=auth.uid();
 IF FOUND THEN actor_role:='admin'; ELSE sender_name:=me.full_name; actor_role:=me.role::text; END IF;
 SELECT full_name INTO target_name FROM admin_profiles WHERE id=p_to;
 IF NOT FOUND THEN SELECT full_name INTO target_name FROM kid_profiles WHERE id=p_to; END IF;
 INSERT INTO private_messages(from_kid_id,from_display_name,to_kid_id,to_display_name,sender_gender,content,is_from_admin,sender_role,client_request_id)
 VALUES(auth.uid(),sender_name,p_to,target_name,me.gender,btrim(p_content),false,actor_role,p_request_id)
 ON CONFLICT(from_kid_id,client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING RETURNING * INTO message;
 IF NOT FOUND THEN SELECT * INTO message FROM private_messages WHERE from_kid_id=auth.uid() AND client_request_id=p_request_id; END IF;
 IF message.to_kid_id<>p_to OR message.content<>btrim(p_content) THEN RAISE EXCEPTION 'REQUEST_MISMATCH'; END IF;
 RETURN to_jsonb(message);
END; $$;
CREATE FUNCTION public.list_private_threads(p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH involved AS (
 SELECT m.*, CASE WHEN from_kid_id=auth.uid() THEN to_kid_id::text ELSE coalesce(from_kid_id::text,'__admin__') END AS partner
 FROM private_messages m WHERE auth.uid() IN (from_kid_id,to_kid_id)
 ), latest AS (SELECT DISTINCT ON (partner) * FROM involved ORDER BY partner,created_at DESC,id DESC), page AS (
 SELECT * FROM latest WHERE p_before IS NULL OR (created_at,id)<(p_before,p_before_id) ORDER BY created_at DESC,id DESC LIMIT 31
 ) SELECT jsonb_build_object('unread_total',(SELECT count(*) FROM involved WHERE to_kid_id=auth.uid() AND NOT is_read),
 'threads',coalesce((SELECT jsonb_agg(jsonb_build_object('partnerId',partner,'partner',public.dm_participant(partner),'lastMessage',to_jsonb(page)-'partner',
 'unreadCount',(SELECT count(*) FROM involved i WHERE i.partner=page.partner AND i.to_kid_id=auth.uid() AND NOT i.is_read)) ORDER BY created_at DESC,id DESC) FROM page),'[]'::jsonb));
$$;
CREATE FUNCTION public.get_private_thread(p_partner text,p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE participant jsonb;
BEGIN
 participant:=public.dm_participant(p_partner);
 RETURN jsonb_build_object('partner',participant,'messages',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id DESC) FROM (
 SELECT * FROM private_messages WHERE ((from_kid_id=auth.uid() AND to_kid_id::text=p_partner) OR
 (to_kid_id=auth.uid() AND coalesce(from_kid_id::text,'__admin__')=p_partner)) AND (p_before IS NULL OR (created_at,id)<(p_before,p_before_id)) ORDER BY created_at DESC,id DESC LIMIT 51
 ) page),'[]'::jsonb));
END; $$;
CREATE FUNCTION public.mark_private_messages_read(p_ids uuid[]) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE private_messages SET is_read=true WHERE id=ANY(p_ids) AND to_kid_id=auth.uid() AND NOT is_read;
$$;
REVOKE INSERT,UPDATE ON public.private_messages FROM PUBLIC,anon,authenticated;
REVOKE UPDATE(is_read) ON public.private_messages FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.dm_can_send(uuid),public.dm_participant(text),public.send_private_message(uuid,text,uuid),public.list_private_threads(timestamptz,uuid),public.get_private_thread(text,timestamptz,uuid),public.mark_private_messages_read(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dm_can_send(uuid),public.dm_participant(text),public.send_private_message(uuid,text,uuid),public.list_private_threads(timestamptz,uuid),public.get_private_thread(text,timestamptz,uuid),public.mark_private_messages_read(uuid[]) TO authenticated;
