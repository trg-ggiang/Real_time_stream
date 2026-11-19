-- Read-only recruitment schema inspection. Run in the Supabase SQL Editor.
-- Returns ONE JSON value so the editor's 100-row limit cannot truncate tables.
-- Export the complete recruitment_schema value as JSON/text and send it back.
-- Reads schema metadata only; does not read applications or personal records.
-- Does not create/alter tables, functions, policies, permissions, or data.

WITH target_relations AS (
  SELECT c.oid, n.nspname AS schema_name, c.relname AS relation_name,
         c.relkind, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm')
    AND (
      c.relname IN (
        'users', 'student_profiles', 'clubs', 'club_departments',
        'club_memberships', 'club_activities', 'club_posts',
        'activity_registrations', 'public_clubs',
        'public_club_activities', 'public_club_posts'
      )
      OR c.relname ~ '(recruit|application|notification|media_asset)'
    )
), target_functions AS (
  SELECT p.oid, n.nspname AS schema_name, p.proname AS function_name,
         p.prosecdef, p.proconfig
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'clubspace_private', 'clubspace_v2_private')
    AND p.prokind = 'f'
    AND (
      n.nspname <> 'public'
      OR p.proname ~ '(recruit|application|notification|clubspace)'
      OR p.oid IN (
        SELECT t.tgfoid
        FROM pg_catalog.pg_trigger t
        JOIN target_relations r ON r.oid = t.tgrelid
        WHERE NOT t.tgisinternal
      )
    )
)
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at', statement_timestamp(),
  'relations', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', r.schema_name,
      'name', r.relation_name,
      'kind', r.relkind,
      'rls_enabled', r.relrowsecurity,
      'rls_forced', r.relforcerowsecurity,
      'columns', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'nullable', NOT a.attnotnull,
          'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
          'identity', a.attidentity,
          'generated', a.attgenerated
        ) ORDER BY a.attnum)
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef d
          ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
      ), '[]'::jsonb),
      'constraints', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', co.conname,
          'type', co.contype,
          'definition', pg_catalog.pg_get_constraintdef(co.oid, true)
        ) ORDER BY co.conname)
        FROM pg_catalog.pg_constraint co WHERE co.conrelid = r.oid
      ), '[]'::jsonb),
      'indexes', COALESCE((
        SELECT jsonb_agg(pg_catalog.pg_get_indexdef(i.indexrelid)
                         ORDER BY i.indexrelid::regclass::text)
        FROM pg_catalog.pg_index i WHERE i.indrelid = r.oid
      ), '[]'::jsonb),
      'triggers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', t.tgname,
          'enabled', t.tgenabled,
          'definition', pg_catalog.pg_get_triggerdef(t.oid, true)
        ) ORDER BY t.tgname)
        FROM pg_catalog.pg_trigger t
        WHERE t.tgrelid = r.oid AND NOT t.tgisinternal
      ), '[]'::jsonb),
      'policies', COALESCE((
        SELECT jsonb_agg(to_jsonb(pol) ORDER BY pol.policyname)
        FROM pg_catalog.pg_policies pol
        WHERE pol.schemaname = r.schema_name AND pol.tablename = r.relation_name
      ), '[]'::jsonb),
      'grants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'grantee', g.grantee, 'privilege', g.privilege_type
        ) ORDER BY g.grantee, g.privilege_type)
        FROM information_schema.table_privileges g
        WHERE g.table_schema = r.schema_name AND g.table_name = r.relation_name
      ), '[]'::jsonb),
      'view_definition', CASE WHEN r.relkind IN ('v', 'm')
        THEN pg_catalog.pg_get_viewdef(r.oid, true) ELSE NULL END
    ) ORDER BY r.relation_name)
    FROM target_relations r
  ), '[]'::jsonb),
  'functions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'signature', f.oid::regprocedure::text,
      'security_definer', f.prosecdef,
      'settings', f.proconfig,
      'definition', pg_catalog.pg_get_functiondef(f.oid),
      'grants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'grantee', g.grantee, 'privilege', g.privilege_type
        ) ORDER BY g.grantee, g.privilege_type)
        FROM information_schema.routine_privileges g
        WHERE g.specific_schema = f.schema_name
          AND g.specific_name = f.function_name || '_' || f.oid::text
      ), '[]'::jsonb)
    ) ORDER BY f.function_name, f.oid)
    FROM target_functions f
  ), '[]'::jsonb),
  'enum_types', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', ty.typname,
      'labels', (
        SELECT jsonb_agg(en.enumlabel ORDER BY en.enumsortorder)
        FROM pg_catalog.pg_enum en WHERE en.enumtypid = ty.oid
      )
    ) ORDER BY ty.typname)
    FROM pg_catalog.pg_type ty
    JOIN pg_catalog.pg_namespace ns ON ns.oid = ty.typnamespace
    WHERE ns.nspname = 'public' AND ty.typtype = 'e'
  ), '[]'::jsonb)
)) AS recruitment_schema;
