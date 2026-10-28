SELECT 'migration' AS kind,version AS name,NULL::jsonb AS detail FROM supabase_migrations.schema_migrations
WHERE version IN ('20261025010000','20261025020000','20261025030000','20261025040000','20261025050000','20261025060000')
UNION ALL
SELECT 'function',p.proname,jsonb_build_object('bodyMd5',md5(p.prosrc),
 'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE'),
 'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'browserExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('voxel_actor_policy','voxel_moderation_receipt','voxel_moderate','voxel_moderation_status','voxel_accept_member_revision','voxel_project_session','voxel_begin_control','voxel_moderation_targets','voxel_actor_kind')
UNION ALL
SELECT 'table',c.relname,jsonb_build_object('rls',c.relrowsecurity,
 'serviceSelect',has_table_privilege('service_role',c.oid,'SELECT'),
 'browserSelect',has_table_privilege('authenticated',c.oid,'SELECT'),
 'constraints',(SELECT jsonb_agg(pg_get_constraintdef(co.oid) ORDER BY co.conname) FROM pg_constraint co WHERE co.conrelid=c.oid AND co.contype='c'))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 AND c.relname IN ('voxel_actor_access','voxel_moderation_commands')
ORDER BY kind,name;
