-- Supplemental READ-ONLY inspection for the schema export already received.
-- Run in Supabase SQL Editor and export the complete private_functions value.
-- One result row; reads function definitions, never application/personal rows.
SELECT jsonb_pretty(COALESCE(jsonb_agg(jsonb_build_object(
  'schema', n.nspname,
  'signature', p.oid::regprocedure::text,
  'security_definer', p.prosecdef,
  'settings', p.proconfig,
  'definition', pg_catalog.pg_get_functiondef(p.oid)
) ORDER BY n.nspname, p.proname, p.oid), '[]'::jsonb)) AS private_functions
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('clubspace_private', 'clubspace_v2_private')
  AND p.prokind = 'f';
