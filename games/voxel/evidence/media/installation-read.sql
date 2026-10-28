SELECT 'migration' AS kind,version AS name,NULL::jsonb AS detail
FROM supabase_migrations.schema_migrations WHERE version IN
('20261025010000','20261025020000','20261025030000','20261025040000','20261025050000','20261025060000','20261025070000','20261025080000','20261026162928')
UNION ALL
SELECT 'function',p.proname,jsonb_build_object('bodyMd5',md5(p.prosrc),'definer',p.prosecdef,'settings',p.proconfig,
 'signature',pg_get_function_identity_arguments(p.oid),
 'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE'),
 'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'browserExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND p.proname IN ('voxel_media_scope','voxel_media_authorize','voxel_media_receipt','voxel_media_moderate','voxel_media_state','voxel_media_status')
UNION ALL
SELECT 'table',c.relname,jsonb_build_object('rls',c.relrowsecurity,
 'serviceSelect',has_table_privilege('service_role',c.oid,'SELECT'),
 'serviceInsert',has_table_privilege('service_role',c.oid,'INSERT'),
 'serviceUpdate',has_table_privilege('service_role',c.oid,'UPDATE'),
 'serviceDelete',has_table_privilege('service_role',c.oid,'DELETE'),
 'browserSelect',has_table_privilege('authenticated',c.oid,'SELECT'),
 'browserInsert',has_table_privilege('authenticated',c.oid,'INSERT'),
 'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,
   'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a
   LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(pg_get_constraintdef(co.oid) ORDER BY co.conname) FROM pg_constraint co WHERE co.conrelid=c.oid))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname IN ('voxel_media_policy','voxel_media_actors','voxel_media_commands')
ORDER BY kind,name;
