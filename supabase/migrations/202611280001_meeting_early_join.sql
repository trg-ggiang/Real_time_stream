-- Allow a scheduled meeting to start when a participant joins before its planned time.
alter table public.meetings
  add column if not exists allow_early_join boolean not null default false;
