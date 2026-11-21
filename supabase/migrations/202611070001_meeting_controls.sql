-- Meeting controls required by the backend module.
alter table public.meetings
  add column if not exists max_participants integer not null default 20
    check (max_participants between 1 and 1000),
  add column if not exists allow_self_unmute boolean not null default true;

create unique index if not exists meeting_members_one_active_user
  on public.meeting_members(meeting_id, user_id) where removed_at is null;

-- Reserve a seat and create an attendance row in one transaction. The advisory
-- lock serializes concurrent joins for each meeting, preventing overbooking.
create or replace function public.reserve_meeting_attendance(
  p_meeting_id uuid,
  p_meeting_member_id uuid,
  p_identity text,
  p_capacity integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_meeting_id::text, 0));
  if exists (
    select 1 from public.attendances
    where meeting_member_id = p_meeting_member_id and left_at is null
  ) then
    return true;
  end if;
  select count(*) into current_count
  from public.attendances a
  join public.meeting_members mm using (meeting_member_id)
  where mm.meeting_id = p_meeting_id and mm.removed_at is null and a.left_at is null;
  if current_count >= p_capacity then
    return false;
  end if;
  insert into public.attendances(meeting_member_id, livekit_identity)
  values (p_meeting_member_id, p_identity);
  return true;
end;
$$;

revoke all on function public.reserve_meeting_attendance(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_meeting_attendance(uuid, uuid, text, integer) to service_role;
