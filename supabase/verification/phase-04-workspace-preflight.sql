-- Read-only verification. Run manually in Supabase SQL Editor if desired.
-- Does not modify schema, rows or permissions.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('clubs','club_memberships','club_departments','club_posts','club_activities')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('club_memberships','club_departments','club_posts','club_activities')
ORDER BY c.relname, con.conname;

SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal
  AND c.relname IN ('clubs','club_memberships','club_departments','club_posts','club_activities')
ORDER BY c.relname,t.tgname;

SELECT p.oid::regprocedure AS signature, p.prosecdef AS security_definer,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='clubspace_transfer_chair';

SELECT tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('club_memberships','club_departments','club_posts','club_activities')
ORDER BY tablename,indexname;
