-- READ ONLY. Optional verification in Supabase SQL Editor before deploying personal writes.
-- Does not create/alter tables, roles, policies, functions or data.

-- Registration must have UNIQUE(activity_id,user_id), alongside the primary key.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.activity_registrations'::regclass
ORDER BY conname;

-- Expected enabled trigger: activity_registrations_guard -> guard_registration.
-- It must lock the activity FOR UPDATE, enforce capacity/time window, clear
-- cancellation on re-register and prevent cancellation after check-in.
SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS trigger_definition,
       p.proname, pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='public.activity_registrations'::regclass AND NOT t.tgisinternal;

-- service_role needs SELECT/INSERT/UPDATE on registrations, but no DELETE.
-- follows needs DELETE to support unfollow.
SELECT table_name,
  has_table_privilege('service_role','public.'||table_name,'SELECT') AS can_select,
  has_table_privilege('service_role','public.'||table_name,'INSERT') AS can_insert,
  has_table_privilege('service_role','public.'||table_name,'UPDATE') AS can_update,
  has_table_privilege('service_role','public.'||table_name,'DELETE') AS can_delete
FROM (VALUES ('student_profiles'),('club_follows'),('activity_registrations')) x(table_name);
