BEGIN;

CREATE TABLE public.channel_message_hides (
  message_id uuid NOT NULL REFERENCES public.channel_messages(message_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX channel_message_hides_user_idx ON public.channel_message_hides(user_id);
ALTER TABLE public.channel_message_hides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.channel_message_hides FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.channel_message_hides TO service_role;

CREATE FUNCTION clubspace_v2_private.enforce_channel_message_edit_window()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF clock_timestamp() >= OLD.created_at + interval '5 minutes' THEN
    RAISE EXCEPTION 'Channel message edit window expired' USING ERRCODE = 'PT409';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION clubspace_v2_private.enforce_channel_message_edit_window()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER channel_message_edit_window
  BEFORE UPDATE ON public.channel_messages
  FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL)
  EXECUTE FUNCTION clubspace_v2_private.enforce_channel_message_edit_window();

NOTIFY pgrst, 'reload schema';
COMMIT;
