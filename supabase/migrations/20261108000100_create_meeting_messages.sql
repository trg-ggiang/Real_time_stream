-- Run once in Supabase SQL Editor as the database owner (postgres).
-- Prerequisites: public.users and public.meeting_sessions already exist.
-- This migration creates only meeting_messages; existing tables/data are unchanged.
-- Application JWTs are verified by NestJS, not by Supabase Auth.

BEGIN;

CREATE TABLE public.meeting_messages (
  message_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  client_message_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT meeting_messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT meeting_messages_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES public.meeting_sessions (session_id)
    ON DELETE RESTRICT,
  CONSTRAINT meeting_messages_sender_id_fkey
    FOREIGN KEY (sender_id)
    REFERENCES public.users (user_id)
    ON DELETE RESTRICT,
  CONSTRAINT meeting_messages_client_message_key
    UNIQUE (session_id, sender_id, client_message_id),
  CONSTRAINT meeting_messages_content_length_check
    CHECK (char_length(content) BETWEEN 1 AND 2000),
  CONSTRAINT meeting_messages_content_not_blank_check
    CHECK (content ~ '[^[:space:]]')
);

-- Supports session-scoped cursor pagination by (created_at, message_id).
CREATE INDEX meeting_messages_session_history_idx
  ON public.meeting_messages (session_id, created_at DESC, message_id DESC);

-- The history index starts with session_id, so sender_id needs its own index
-- for FK checks and future sender-scoped administration.
CREATE INDEX meeting_messages_sender_id_idx
  ON public.meeting_messages (sender_id);

ALTER TABLE public.meeting_messages ENABLE ROW LEVEL SECURITY;

-- Remove inherited/default table grants. Do not expose chat to browser keys.
REVOKE ALL PRIVILEGES ON TABLE public.meeting_messages
  FROM PUBLIC, anon, authenticated, service_role;

-- Backend-only, append-only access for the initial chat module.
-- service_role bypasses RLS; NestJS MUST enforce session/membership access.
GRANT SELECT, INSERT ON TABLE public.meeting_messages TO service_role;

COMMENT ON TABLE public.meeting_messages IS
  'Text chat per meeting session. Backend verifies sender identity, membership, admission, removal and session access before reading or inserting.';
COMMENT ON COLUMN public.meeting_messages.client_message_id IS
  'Client-generated UUID retained across retries. Duplicate sends must return the original message; never overwrite its content.';
COMMENT ON COLUMN public.meeting_messages.content IS
  'Plain text, 1 to 2000 PostgreSQL characters, with at least one non-whitespace character.';
COMMENT ON COLUMN public.meeting_messages.created_at IS
  'Database timestamp. Backend omits this field on insert; history uses created_at plus message_id as cursor.';

-- No anon/authenticated policies: browser access is intentionally denied.
-- Session status and active attendance are application rules, not CHECK constraints.
-- No INSERT seed data, no triggers, and no changes to existing tables.

COMMIT;
