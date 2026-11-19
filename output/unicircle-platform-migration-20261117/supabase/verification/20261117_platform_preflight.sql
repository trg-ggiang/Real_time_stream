-- READ ONLY. Run BEFORE importing the 20261117 extension. One result grid.
WITH required(name) AS (VALUES ('users'),('student_profiles'),('clubs'),('club_departments'),('club_memberships'),('club_follows'),('club_posts'),('club_activities'),('activity_registrations'),('meetings'),('meeting_sessions'),('meeting_messages'))
SELECT '01_existing_tables' AS section,jsonb_agg(jsonb_build_object('table',name,'exists',to_regclass('public.'||name) IS NOT NULL) ORDER BY name) AS result FROM required
UNION ALL
SELECT '02_existing_membership_role_check',coalesce(jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid))),'[]') FROM pg_constraint WHERE conrelid=to_regclass('public.club_memberships') AND contype='c'
UNION ALL
SELECT '03_core_triggers',coalesce(jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid))),'[]') FROM pg_trigger WHERE tgrelid IN(to_regclass('public.clubs'),to_regclass('public.club_departments'),to_regclass('public.club_memberships')) AND NOT tgisinternal
UNION ALL
SELECT '04_extension_not_installed',jsonb_build_object('private_schema_exists',to_regnamespace('clubspace_v2_private') IS NOT NULL,'campaign_table_exists',to_regclass('public.recruitment_campaigns') IS NOT NULL,'meetings_club_id_exists',EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='meetings' AND column_name='club_id'))
UNION ALL
SELECT '05_runtime_roles',jsonb_agg(jsonb_build_object('role',rolname,'bypasses_rls',rolbypassrls) ORDER BY rolname) FROM pg_roles WHERE rolname IN('anon','authenticated','service_role')
ORDER BY section;
