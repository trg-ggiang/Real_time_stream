-- Read-only check. Run after 20261120000100_club_chat_attachments.sql.
WITH targets AS (
  SELECT
    to_regclass('public.channel_message_attachments') AS attachments,
    to_regprocedure('public.clubspace_send_channel_message_with_attachments(uuid,uuid,uuid,text,jsonb)') AS send_rpc
), checks AS (
  SELECT
    EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE id = 'club-chat-attachments' AND public IS FALSE
        AND file_size_limit = 15728640 AND cardinality(allowed_mime_types) = 7
    ) AS private_bucket,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = 'club_chat_attachments_backend_only' AND permissive = 'RESTRICTIVE'
    ) AS browser_storage_restricted,
    EXISTS (
      SELECT 1 FROM pg_class WHERE oid = targets.attachments AND relrowsecurity
    ) AS attachment_rls,
    coalesce(
      has_table_privilege('service_role', targets.attachments::oid, 'SELECT')
      AND NOT has_table_privilege('service_role', targets.attachments::oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
      AND NOT has_table_privilege('anon', targets.attachments::oid, 'SELECT, INSERT, UPDATE, DELETE')
      AND NOT has_table_privilege('authenticated', targets.attachments::oid, 'SELECT, INSERT, UPDATE, DELETE'),
      false
    ) AS attachment_grants,
    coalesce(
      has_function_privilege('service_role', targets.send_rpc::oid, 'EXECUTE')
      AND NOT has_function_privilege('anon', targets.send_rpc::oid, 'EXECUTE')
      AND NOT has_function_privilege('authenticated', targets.send_rpc::oid, 'EXECUTE'),
      false
    ) AS backend_send_rpc,
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.channel_messages'::regclass
        AND tgname = 'channel_messages_require_body'
        AND tgdeferrable AND tginitdeferred AND tgenabled IN ('O', 'A')
    ) AS message_body_constraint
  FROM targets
)
SELECT *,
  private_bucket AND browser_storage_restricted AND attachment_rls AND attachment_grants
    AND backend_send_rpc AND message_body_constraint AS ready
FROM checks;
