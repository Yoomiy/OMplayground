SELECT 'migration' AS kind,version AS name,NULL::text AS body_md5,
 NULL::boolean AS service_execute,NULL::boolean AS anon_execute,NULL::boolean AS browser_execute
FROM supabase_migrations.schema_migrations WHERE version IN
 ('20261025010000','20261025020000','20261025030000','20261025040000','20261025050000')
UNION ALL
SELECT 'function',p.proname,md5(p.prosrc),
 has_function_privilege('service_role',p.oid,'EXECUTE'),
 has_function_privilege('anon',p.oid,'EXECUTE'),
 has_function_privilege('authenticated',p.oid,'EXECUTE')
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('voxel_actor_kind','voxel_staff_receipt','voxel_begin_staff','voxel_finish_staff','voxel_staff_status','voxel_begin_control')
ORDER BY kind,name;
