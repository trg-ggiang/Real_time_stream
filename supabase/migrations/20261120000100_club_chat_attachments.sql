-- Apply after the uniCircle platform extension (20261117000100).
-- Run the entire file as postgres in Supabase SQL Editor.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.channel_messages') IS NULL
     OR to_regprocedure('clubspace_v2_private.require_channel(uuid,uuid)') IS NULL
     OR to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Apply the uniCircle platform extension first and use a Supabase database with Storage.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'storage.objects'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Storage object RLS must be enabled.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.channel_messages'::regclass
      AND conname = 'channel_messages_content_check'
      AND contype = 'c'
      AND pg_get_constraintdef(oid) = 'CHECK (((content ~ ''[^[:space:]]''::text) AND (char_length(content) <= 5000)))'
  ) THEN
    RAISE EXCEPTION 'The current channel_messages content constraint differs from the expected platform schema.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.channel_messages'::regclass
      AND tgname = 'v2_channel_message' AND tgenabled IN ('O', 'A')
  ) THEN
    RAISE EXCEPTION 'The platform channel message authorization trigger is missing or disabled.';
  END IF;
END $$;

-- The same allowlist applies to Storage and attachment metadata.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-chat-attachments', 'club-chat-attachments', false, 15728640,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
);

-- A permissive policy from another module must not expose this bucket.
CREATE POLICY club_chat_attachments_backend_only ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'club-chat-attachments')
  WITH CHECK (bucket_id <> 'club-chat-attachments');

CREATE TABLE public.channel_message_attachments (
  attachment_id uuid PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.channel_messages(message_id) ON DELETE RESTRICT,
  object_path text NOT NULL UNIQUE,
  original_name text NOT NULL CHECK (
    original_name ~ '[^[:space:]]' AND char_length(original_name) <= 255
  ),
  mime_type text NOT NULL CHECK (mime_type IN (
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 15728640),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_message_attachments_message_position_key UNIQUE (message_id, position)
);

ALTER TABLE public.channel_message_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.channel_message_attachments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.channel_message_attachments TO service_role;

-- Preserve existing text validation and the 5000-character DB limit.
-- The empty string is reserved for messages with attachments.
ALTER TABLE public.channel_messages
  DROP CONSTRAINT channel_messages_content_check,
  ADD CONSTRAINT channel_messages_content_check CHECK (
    content = '' OR (content ~ '[^[:space:]]' AND char_length(content) <= 5000)
  );

CREATE FUNCTION clubspace_v2_private.check_channel_message_body()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.channel_messages m
    WHERE m.message_id = NEW.message_id AND m.content = ''
  ) AND NOT EXISTS (
    SELECT 1 FROM public.channel_message_attachments a WHERE a.message_id = NEW.message_id
  ) THEN
    RAISE EXCEPTION 'A channel message requires text or an attachment.' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION clubspace_v2_private.check_channel_message_body()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE CONSTRAINT TRIGGER channel_messages_require_body
  AFTER INSERT OR UPDATE ON public.channel_messages
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (NEW.content = '')
  EXECUTE FUNCTION clubspace_v2_private.check_channel_message_body();

-- Called by NestJS after uploading the objects through the Storage API.
-- p_actor comes from the verified application JWT. The caller allocates stable
-- UUIDs, uploads with upsert disabled to <channel UUID>/<attachment UUID>,
-- and reuses the same client message ID and attachment UUIDs on retry.
-- p_attachments is an ordered JSON array with attachment_id, original_name,
-- mime_type and size_bytes. The function derives the object path itself.
CREATE FUNCTION public.clubspace_send_channel_message_with_attachments(
  p_actor uuid,
  p_channel uuid,
  p_client_message_id uuid,
  p_content text,
  p_attachments jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  sender_id uuid;
  saved public.channel_messages%ROWTYPE;
  body text := coalesce(p_content, '');
  attachment_count integer;
  inserted_count integer;
  saved_attachments jsonb;
  request_attachments jsonb;
BEGIN
  sender_id := clubspace_v2_private.require_channel(p_actor, p_channel);

  IF jsonb_typeof(p_attachments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Attachments must be a JSON array.' USING ERRCODE = '22023';
  END IF;
  attachment_count := jsonb_array_length(p_attachments);
  IF attachment_count NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Send from one to three attachments.' USING ERRCODE = '22023';
  END IF;
  IF body !~ '[^[:space:]]' THEN
    body := '';
  END IF;
  IF char_length(body) > 2000 THEN
    RAISE EXCEPTION 'The caption exceeds 2000 characters.' USING ERRCODE = '22023';
  END IF;

  WITH input AS (
    SELECT input_item.position, f.*
    FROM jsonb_array_elements(p_attachments) WITH ORDINALITY AS input_item(value, position)
    CROSS JOIN LATERAL jsonb_to_record(input_item.value) AS f(
      attachment_id uuid, original_name text, mime_type text, size_bytes bigint
    )
  )
  SELECT jsonb_agg(to_jsonb(input) - 'position' ORDER BY input.position)
  INTO request_attachments
  FROM input
  HAVING count(size_bytes) = attachment_count
     AND bool_and(size_bytes BETWEEN 1 AND 15728640)
     AND sum(size_bytes) <= 15728640;

  IF request_attachments IS NULL THEN
    RAISE EXCEPTION 'The total attachment size must be at most 15 MiB.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.channel_messages
    (channel_id, sender_membership_id, client_message_id, content, updated_by)
  VALUES (p_channel, sender_id, p_client_message_id, body, p_actor)
  ON CONFLICT (channel_id, sender_membership_id, client_message_id) DO NOTHING
  RETURNING * INTO saved;

  IF NOT FOUND THEN
    SELECT m.* INTO STRICT saved FROM public.channel_messages m
    WHERE m.channel_id = p_channel AND m.sender_membership_id = sender_id
      AND m.client_message_id = p_client_message_id FOR SHARE;

    SELECT jsonb_agg(jsonb_build_object(
      'attachment_id', a.attachment_id, 'original_name', a.original_name,
      'mime_type', a.mime_type, 'size_bytes', a.size_bytes
    ) ORDER BY a.position)
    INTO saved_attachments
    FROM public.channel_message_attachments a WHERE a.message_id = saved.message_id;

    IF saved.deleted_at IS NOT NULL OR saved.content IS DISTINCT FROM body
       OR saved_attachments IS DISTINCT FROM request_attachments THEN
      RAISE EXCEPTION 'This message ID has already been used for a different message.' USING ERRCODE = '23505';
    END IF;
    RETURN saved.message_id;
  END IF;

  INSERT INTO public.channel_message_attachments
    (attachment_id, message_id, object_path, original_name, mime_type, size_bytes, position)
  SELECT f.attachment_id, saved.message_id, o.name, f.original_name,
    f.mime_type, f.size_bytes, input_item.position::smallint
  FROM jsonb_array_elements(request_attachments) WITH ORDINALITY AS input_item(value, position)
  CROSS JOIN LATERAL jsonb_to_record(input_item.value) AS f(
    attachment_id uuid, original_name text, mime_type text, size_bytes bigint
  )
  JOIN storage.objects o
    ON o.bucket_id = 'club-chat-attachments'
   AND o.name = (p_channel::text || '/' || f.attachment_id::text);

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> attachment_count THEN
    RAISE EXCEPTION 'Upload all attachments to Storage before sending.' USING ERRCODE = '23514';
  END IF;
  RETURN saved.message_id;
END $$;

REVOKE ALL ON FUNCTION public.clubspace_send_channel_message_with_attachments(uuid, uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clubspace_send_channel_message_with_attachments(uuid, uuid, uuid, text, jsonb)
  TO service_role;

COMMENT ON TABLE public.channel_message_attachments IS
  'Private channel file metadata. API checks current channel access and non-deleted message before issuing a short-lived download URL.';
COMMENT ON FUNCTION public.clubspace_send_channel_message_with_attachments(uuid, uuid, uuid, text, jsonb) IS
  'Atomically finalizes a message and uploaded attachment metadata. Backend validates actual bytes and cleans abandoned uploads via the Storage API.';

COMMIT;
