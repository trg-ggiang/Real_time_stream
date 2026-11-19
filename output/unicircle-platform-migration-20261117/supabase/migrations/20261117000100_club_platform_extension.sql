-- uniCircle: additive platform extension, PostgreSQL 15+, Supabase SQL Editor.
-- RUN ONCE, IN FULL, as database owner. NEVER run the historical core SQL again.
-- Prerequisite: existing club core + users/meetings/meeting_sessions.
-- No existing rows are deleted; old meetings keep club_id NULL.
-- Custom NestJS JWTs are NOT Supabase Auth JWTs: backend-only access is intentional.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';
SELECT pg_advisory_xact_lock(hashtextextended('unicircle-platform-extension-20261117',0));
DO $$
DECLARE t text; c text;
BEGIN
 IF current_setting('server_version_num')::int < 150000 THEN RAISE EXCEPTION 'PostgreSQL 15+ required'; END IF;
 FOREACH t IN ARRAY ARRAY['users','student_profiles','clubs','club_departments','club_memberships','club_follows','club_posts','club_activities','activity_registrations','meetings','meeting_sessions','meeting_messages'] LOOP
  IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'Missing prerequisite table public.%',t; END IF;
 END LOOP;
 IF to_regnamespace('clubspace_v2_private') IS NOT NULL THEN RAISE EXCEPTION 'Extension already installed or name collision. Stop; do not drop data.'; END IF;
 FOREACH t IN ARRAY ARRAY['recruitment_campaigns','recruitment_departments','recruitment_questions','recruitment_applications','application_answers','application_reviews','interview_appointments','interview_panel_members','notification_jobs','notifications','club_change_requests','club_channels','channel_members','channel_messages','channel_read_states','audit_logs'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN RAISE EXCEPTION 'public.% already exists; compare schemas before importing',t; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=t) THEN RAISE EXCEPTION 'Missing Supabase role %',t; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role' AND data_type='text') THEN RAISE EXCEPTION 'Expected existing users.role text'; END IF;
 IF EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='meetings' AND column_name='club_id') THEN RAISE EXCEPTION 'meetings.club_id already exists; compare migration first'; END IF;
 IF EXISTS(SELECT FROM public.club_memberships WHERE role NOT IN('chairperson','member','head')) THEN RAISE EXCEPTION 'Unexpected membership role'; END IF;
 IF to_regprocedure('clubspace_private.provision_club()') IS NULL OR to_regprocedure('clubspace_private.guard_membership()') IS NULL OR to_regprocedure('clubspace_private.check_club_structure()') IS NULL THEN RAISE EXCEPTION 'Expected core provisioning/membership/structure functions missing; compare core schema first'; END IF;
 IF NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid='public.clubs'::regclass AND tgfoid='clubspace_private.provision_club()'::regprocedure AND tgenabled IN('O','A')) THEN RAISE EXCEPTION 'Core club provisioning trigger must be enabled'; END IF;
 -- Replace only single-column role checks, never unrelated structural constraints.
 FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attname='role'
  WHERE con.conrelid='public.club_memberships'::regclass AND con.contype='c' AND con.conkey=ARRAY[a.attnum] LOOP
  EXECUTE format('ALTER TABLE public.club_memberships DROP CONSTRAINT %I',c);
 END LOOP;
END $$;
ALTER TABLE public.club_memberships ADD CONSTRAINT club_memberships_role_v2_check CHECK(role IN('chairperson','head','member'));
CREATE INDEX club_memberships_active_heads_idx ON public.club_memberships(department_id,user_id) WHERE status='active' AND role='head';
COMMENT ON COLUMN public.club_memberships.role IS 'Club scoped: chairperson/head/member. Head manages only own department channel/recruitment; no platform admin or delegated channel manager.';
ALTER TABLE public.meetings ADD COLUMN club_id uuid REFERENCES public.clubs(club_id) ON DELETE RESTRICT;
CREATE INDEX meetings_club_id_idx ON public.meetings(club_id) WHERE club_id IS NOT NULL;
CREATE SCHEMA clubspace_v2_private;
REVOKE ALL ON SCHEMA clubspace_v2_private FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.recruitment_campaigns(
 campaign_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES public.clubs ON DELETE RESTRICT,
 title text NOT NULL CHECK(title ~ '[^[:space:]]' AND char_length(title)<=200), description text NOT NULL CHECK(description ~ '[^[:space:]]' AND char_length(description)<=50000),
 cover_url text CHECK(cover_url IS NULL OR (cover_url ~ '^https?://' AND char_length(cover_url)<=2048)),
 application_opens_at timestamptz NOT NULL, application_closes_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','open','closed','completed','cancelled')),
 created_by uuid NOT NULL REFERENCES public.users(user_id), updated_by uuid NOT NULL REFERENCES public.users(user_id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(application_closes_at>application_opens_at)
);
CREATE INDEX recruitment_campaigns_club_time_idx ON public.recruitment_campaigns(club_id,created_at DESC,campaign_id);
CREATE INDEX recruitment_campaigns_open_idx ON public.recruitment_campaigns(application_closes_at) WHERE status='open';
CREATE TABLE public.recruitment_departments(
 recruitment_department_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.recruitment_campaigns,
 department_id uuid NOT NULL REFERENCES public.club_departments,
 description text NOT NULL CHECK(description ~ '[^[:space:]]' AND char_length(description)<=20000), requirements text CHECK(char_length(requirements)<=20000),
 target_quantity integer CHECK(target_quantity>0), created_by uuid NOT NULL REFERENCES public.users(user_id), updated_by uuid NOT NULL REFERENCES public.users(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(campaign_id,department_id), UNIQUE(recruitment_department_id,campaign_id)
);
CREATE INDEX recruitment_departments_department_idx ON public.recruitment_departments(department_id);
CREATE TABLE public.recruitment_questions(
 question_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recruitment_department_id uuid NOT NULL REFERENCES public.recruitment_departments,
 question_text text NOT NULL CHECK(question_text ~ '[^[:space:]]' AND char_length(question_text)<=2000), help_text text CHECK(char_length(help_text)<=2000),
 is_required boolean NOT NULL DEFAULT true, max_length integer NOT NULL DEFAULT 5000 CHECK(max_length BETWEEN 1 AND 10000),
 sort_order integer NOT NULL CHECK(sort_order>0), created_by uuid NOT NULL REFERENCES public.users(user_id),updated_by uuid NOT NULL REFERENCES public.users(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(recruitment_department_id,sort_order)
);
CREATE TABLE public.recruitment_applications(
 application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.recruitment_campaigns,
 recruitment_department_id uuid NOT NULL, applicant_id uuid NOT NULL REFERENCES public.users(user_id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','submitted','interviewing','accepted','rejected','withdrawn')),
 profile_snapshot jsonb CHECK(profile_snapshot IS NULL OR (jsonb_typeof(profile_snapshot)='object' AND pg_column_size(profile_snapshot)<=16384)),
 submitted_at timestamptz,withdrawn_at timestamptz,decided_by uuid REFERENCES public.users(user_id),decided_at timestamptz,
 result_message text CHECK(char_length(result_message)<=5000),admitted_membership_id uuid UNIQUE REFERENCES public.club_memberships,
 updated_by uuid NOT NULL REFERENCES public.users(user_id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(campaign_id,applicant_id),
 FOREIGN KEY(recruitment_department_id,campaign_id) REFERENCES public.recruitment_departments(recruitment_department_id,campaign_id),
 CHECK(status IN('draft','withdrawn') OR submitted_at IS NOT NULL),
 CHECK((status IN('accepted','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR (status NOT IN('accepted','rejected') AND decided_by IS NULL AND decided_at IS NULL)),
 CHECK((submitted_at IS NULL)=(profile_snapshot IS NULL)),
 CHECK((status IN('accepted','rejected') AND result_message IS NOT NULL AND result_message ~ '[^[:space:]]') OR (status NOT IN('accepted','rejected') AND result_message IS NULL)),
 CHECK((status='accepted')=(admitted_membership_id IS NOT NULL)),CHECK((status='withdrawn')=(withdrawn_at IS NOT NULL))
);
CREATE INDEX recruitment_applications_department_queue_idx ON public.recruitment_applications(recruitment_department_id,status,submitted_at,application_id);
CREATE INDEX recruitment_applications_applicant_idx ON public.recruitment_applications(applicant_id,created_at DESC,application_id);
CREATE TABLE public.application_answers(
 answer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),application_id uuid NOT NULL REFERENCES public.recruitment_applications,
 question_id uuid NOT NULL REFERENCES public.recruitment_questions,answer_text text NOT NULL CHECK(char_length(answer_text)<=10000),
 updated_by uuid NOT NULL REFERENCES public.users(user_id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(application_id,question_id)
);
CREATE INDEX application_answers_question_idx ON public.application_answers(question_id);
CREATE TABLE public.application_reviews(
 review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),application_id uuid NOT NULL REFERENCES public.recruitment_applications,
 reviewer_id uuid NOT NULL REFERENCES public.users(user_id),stage text NOT NULL CHECK(stage IN('application','interview')),
 score numeric(5,2) CHECK(score BETWEEN 0 AND 100),recommendation text NOT NULL DEFAULT 'undecided' CHECK(recommendation IN('pass','fail','undecided')),
 internal_note text NOT NULL CHECK(internal_note ~ '[^[:space:]]' AND char_length(internal_note)<=10000),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(application_id,reviewer_id,stage)
);
CREATE INDEX application_reviews_reviewer_idx ON public.application_reviews(reviewer_id);
CREATE TABLE public.interview_appointments(
 appointment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),application_id uuid NOT NULL REFERENCES public.recruitment_applications,
 session_id uuid NOT NULL UNIQUE REFERENCES public.meeting_sessions(session_id),scheduled_start_at timestamptz NOT NULL,scheduled_end_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','completed','cancelled','no_show')),
 candidate_note text CHECK(char_length(candidate_note)<=5000),created_by uuid NOT NULL REFERENCES public.users(user_id),updated_by uuid NOT NULL REFERENCES public.users(user_id),
 cancelled_at timestamptz,cancellation_reason text CHECK(char_length(cancellation_reason)<=2000),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(scheduled_end_at>scheduled_start_at),CHECK((status='cancelled')=(cancelled_at IS NOT NULL))
);
CREATE UNIQUE INDEX interview_appointments_one_scheduled_idx ON public.interview_appointments(application_id) WHERE status='scheduled';
CREATE INDEX interview_appointments_time_idx ON public.interview_appointments(scheduled_start_at) WHERE status='scheduled';
CREATE TABLE public.interview_panel_members(
 appointment_id uuid NOT NULL REFERENCES public.interview_appointments,membership_id uuid NOT NULL REFERENCES public.club_memberships,
 assigned_by uuid NOT NULL REFERENCES public.users(user_id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(appointment_id,membership_id)
);
CREATE INDEX interview_panel_members_membership_idx ON public.interview_panel_members(membership_id);

CREATE TABLE public.notification_jobs(
 job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_type text NOT NULL CHECK(event_type ~ '^[a-z][a-z0-9_.]{1,99}$'),
 entity_type text NOT NULL CHECK(entity_type IN('club','campaign','post','activity','registration','application','interview','club_change','channel_member')),
 entity_id uuid NOT NULL,payload jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(payload)='object' AND pg_column_size(payload)<=32768),
 deduplication_key text NOT NULL UNIQUE CHECK(char_length(deduplication_key) BETWEEN 1 AND 500),run_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','completed','cancelled','failed')),attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 claim_token uuid,locked_until timestamptz,processed_at timestamptz,last_error text CHECK(char_length(last_error)<=2000),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((status='processing' AND claim_token IS NOT NULL AND locked_until IS NOT NULL) OR (status<>'processing' AND claim_token IS NULL AND locked_until IS NULL)),CHECK(status<>'completed' OR processed_at IS NOT NULL)
);
CREATE INDEX notification_jobs_due_idx ON public.notification_jobs(run_at,job_id) WHERE status='pending';
CREATE INDEX notification_jobs_lease_idx ON public.notification_jobs(locked_until) WHERE status='processing';
CREATE INDEX notification_jobs_entity_idx ON public.notification_jobs(entity_type,entity_id);
CREATE TABLE public.notifications(
 notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid NOT NULL REFERENCES public.users(user_id),actor_id uuid REFERENCES public.users(user_id),
 type text NOT NULL CHECK(type ~ '^[a-z][a-z0-9_.]{1,99}$'),title text NOT NULL CHECK(title ~ '[^[:space:]]' AND char_length(title)<=200),body text NOT NULL CHECK(char_length(body)<=5000),
 data jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(data)='object' AND pg_column_size(data)<=16384),deduplication_key text NOT NULL CHECK(char_length(deduplication_key) BETWEEN 1 AND 500),
 read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(recipient_id,deduplication_key),CHECK(read_at IS NULL OR read_at>=created_at)
);
CREATE INDEX notifications_recipient_history_idx ON public.notifications(recipient_id,created_at DESC,notification_id DESC);
CREATE INDEX notifications_unread_idx ON public.notifications(recipient_id,created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_actor_idx ON public.notifications(actor_id) WHERE actor_id IS NOT NULL;

CREATE TABLE public.club_change_requests(
 change_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid NOT NULL REFERENCES public.clubs,requested_by uuid NOT NULL REFERENCES public.users(user_id),
 proposed_data jsonb NOT NULL CHECK(jsonb_typeof(proposed_data)='object' AND proposed_data<>'{}'::jsonb AND pg_column_size(proposed_data)<=262144),
 base_club_updated_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','cancelled')),
 reviewed_by uuid REFERENCES public.users(user_id),reviewed_at timestamptz,review_note text CHECK(char_length(review_note)<=5000),
 updated_by uuid NOT NULL REFERENCES public.users(user_id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((status IN('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR (status NOT IN('approved','rejected') AND reviewed_by IS NULL AND reviewed_at IS NULL))
);
CREATE UNIQUE INDEX club_change_requests_one_pending_idx ON public.club_change_requests(club_id) WHERE status='pending';
CREATE INDEX club_change_requests_queue_idx ON public.club_change_requests(status,created_at,change_request_id);
CREATE INDEX club_change_requests_requester_idx ON public.club_change_requests(requested_by);
CREATE TABLE public.club_channels(
 channel_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),club_id uuid NOT NULL REFERENCES public.clubs,department_id uuid REFERENCES public.club_departments,
 kind text NOT NULL CHECK(kind IN('general','department')),name text NOT NULL CHECK(name ~ '[^[:space:]]' AND char_length(name)<=160),description text CHECK(char_length(description)<=5000),
 created_at timestamptz NOT NULL DEFAULT now(),CHECK((kind='department')=(department_id IS NOT NULL))
);
CREATE UNIQUE INDEX club_channels_one_general_idx ON public.club_channels(club_id) WHERE kind='general';
CREATE UNIQUE INDEX club_channels_one_department_idx ON public.club_channels(department_id) WHERE kind='department';
CREATE TABLE public.channel_members(
 channel_member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel_id uuid NOT NULL REFERENCES public.club_channels,membership_id uuid NOT NULL REFERENCES public.club_memberships,
 added_by uuid NOT NULL REFERENCES public.users(user_id),joined_at timestamptz NOT NULL DEFAULT now(),removed_at timestamptz,removed_by uuid REFERENCES public.users(user_id),
 CHECK((removed_at IS NULL)=(removed_by IS NULL)),CHECK(removed_at IS NULL OR removed_at>=joined_at)
);
CREATE UNIQUE INDEX channel_members_one_grant_idx ON public.channel_members(channel_id,membership_id) WHERE removed_at IS NULL;
CREATE INDEX channel_members_membership_idx ON public.channel_members(membership_id,channel_id) WHERE removed_at IS NULL;
CREATE TABLE public.channel_messages(
 message_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel_id uuid NOT NULL REFERENCES public.club_channels,sender_membership_id uuid NOT NULL REFERENCES public.club_memberships,
 client_message_id uuid NOT NULL,content text NOT NULL CHECK(content ~ '[^[:space:]]' AND char_length(content)<=5000),
 updated_by uuid NOT NULL REFERENCES public.users(user_id),created_at timestamptz NOT NULL DEFAULT now(),edited_at timestamptz,deleted_at timestamptz,deleted_by uuid REFERENCES public.users(user_id),
 UNIQUE(channel_id,sender_membership_id,client_message_id),UNIQUE(message_id,channel_id),CHECK((deleted_at IS NULL)=(deleted_by IS NULL))
);
CREATE INDEX channel_messages_history_idx ON public.channel_messages(channel_id,created_at DESC,message_id DESC);
CREATE INDEX channel_messages_sender_idx ON public.channel_messages(sender_membership_id);
CREATE TABLE public.channel_read_states(
 channel_id uuid NOT NULL REFERENCES public.club_channels,membership_id uuid NOT NULL REFERENCES public.club_memberships,
 last_read_message_id uuid,last_read_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(channel_id,membership_id),
 FOREIGN KEY(last_read_message_id,channel_id) REFERENCES public.channel_messages(message_id,channel_id)
);
CREATE INDEX channel_read_states_membership_idx ON public.channel_read_states(membership_id);
CREATE TABLE public.audit_logs(
 audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES public.users(user_id),club_id uuid REFERENCES public.clubs,
 action text NOT NULL CHECK(char_length(action) BETWEEN 1 AND 100),entity_type text NOT NULL CHECK(char_length(entity_type) BETWEEN 1 AND 100),entity_id uuid NOT NULL,
 change_data jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(change_data)='object' AND pg_column_size(change_data)<=32768),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_club_time_idx ON public.audit_logs(club_id,created_at DESC,audit_id DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs(entity_type,entity_id,created_at DESC);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs(actor_id) WHERE actor_id IS NOT NULL;

-- Helpers lock authorization rows during writes. Actor IDs MUST come from NestJS JWT,
-- never from an untrusted browser body. These helpers are not browser callable.
CREATE FUNCTION clubspace_v2_private.touch() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' THEN NEW.updated_at:=greatest(clock_timestamp(),OLD.updated_at+interval '1 microsecond'); END IF; RETURN NEW; END $$;
CREATE FUNCTION clubspace_v2_private.require_member(p_user uuid,p_club uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m uuid; BEGIN
 SELECT x.membership_id INTO m FROM public.club_memberships x JOIN public.clubs c ON c.club_id=x.club_id
 JOIN public.club_departments d ON d.department_id=x.department_id
 WHERE x.user_id=p_user AND x.club_id=p_club AND x.status='active' AND c.status='published' AND d.status='active' FOR SHARE OF x,c,d;
 IF m IS NULL THEN RAISE EXCEPTION 'Active membership in a published club required' USING ERRCODE='42501'; END IF; RETURN m; END $$;
CREATE FUNCTION clubspace_v2_private.require_chair(p_user uuid,p_club uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m uuid; BEGIN m:=clubspace_v2_private.require_member(p_user,p_club);
 IF NOT EXISTS(SELECT FROM public.club_memberships WHERE membership_id=m AND role='chairperson') THEN RAISE EXCEPTION 'Current chairperson required' USING ERRCODE='42501'; END IF; END $$;
CREATE FUNCTION clubspace_v2_private.require_head(p_user uuid,p_department uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m uuid; BEGIN
 SELECT x.membership_id INTO m FROM public.club_memberships x JOIN public.club_departments d ON d.department_id=x.department_id JOIN public.clubs c ON c.club_id=x.club_id
 WHERE x.user_id=p_user AND x.department_id=p_department AND x.role='head' AND x.status='active' AND d.status='active' AND c.status='published' FOR SHARE OF x,d,c;
 IF m IS NULL THEN RAISE EXCEPTION 'Only the active head of this department may perform this action' USING ERRCODE='42501'; END IF; END $$;
CREATE FUNCTION clubspace_v2_private.require_admin(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM public.users WHERE user_id=p_user AND role='admin' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Platform admin required' USING ERRCODE='42501'; END IF; END $$;
CREATE FUNCTION clubspace_v2_private.config_actor(p_user uuid,p_department uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c uuid; BEGIN SELECT club_id INTO c FROM public.club_departments WHERE department_id=p_department;
 IF EXISTS(SELECT FROM public.club_memberships WHERE user_id=p_user AND club_id=c AND role='chairperson' AND status='active') THEN
  PERFORM clubspace_v2_private.require_chair(p_user,c);
 ELSE PERFORM clubspace_v2_private.require_head(p_user,p_department); END IF; END $$;
CREATE FUNCTION clubspace_v2_private.audit(p_actor uuid,p_club uuid,p_action text,p_type text,p_id uuid,p_data jsonb DEFAULT '{}') RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.audit_logs(actor_id,club_id,action,entity_type,entity_id,change_data) VALUES(p_actor,p_club,p_action,p_type,p_id,p_data) $$;
CREATE FUNCTION clubspace_v2_private.enqueue(p_event text,p_type text,p_id uuid,p_key text,p_payload jsonb DEFAULT '{}',p_at timestamptz DEFAULT now()) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.notification_jobs(event_type,entity_type,entity_id,deduplication_key,payload,run_at) VALUES(p_event,p_type,p_id,p_key,p_payload,p_at) ON CONFLICT(deduplication_key) DO NOTHING $$;
CREATE FUNCTION clubspace_v2_private.guard_head_membership() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.role='head' AND NOT EXISTS(SELECT FROM public.club_departments WHERE department_id=NEW.department_id AND club_id=NEW.club_id) THEN RAISE EXCEPTION 'Head must belong to a department of the same club'; END IF; RETURN NEW; END $$;
CREATE TRIGGER v2_head_membership BEFORE INSERT OR UPDATE ON public.club_memberships FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_head_membership();
CREATE FUNCTION public.clubspace_set_department_head(p_actor uuid,p_membership uuid,p_is_head boolean,p_expected_updated_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.club_memberships; BEGIN
 IF p_is_head IS NULL OR p_expected_updated_at IS NULL OR p_actor IS NULL THEN RAISE EXCEPTION 'Actor, head flag and expected version are required'; END IF;
 SELECT * INTO m FROM public.club_memberships WHERE membership_id=p_membership; IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found'; END IF;
 PERFORM clubspace_v2_private.require_chair(p_actor,m.club_id);
 SELECT * INTO m FROM public.club_memberships WHERE membership_id=p_membership FOR UPDATE;
 IF m.status<>'active' OR m.role='chairperson' OR m.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Membership changed or not eligible'; END IF;
 UPDATE public.club_memberships SET role=CASE WHEN p_is_head THEN 'head' ELSE 'member' END WHERE membership_id=m.membership_id;
 PERFORM clubspace_v2_private.audit(p_actor,m.club_id,'department.head_changed','membership',m.membership_id,jsonb_build_object('old_role',m.role,'new_role',CASE WHEN p_is_head THEN 'head' ELSE 'member' END)); END $$;
CREATE FUNCTION clubspace_v2_private.guard_meeting_club() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND OLD.club_id IS NOT NULL AND NEW.club_id IS DISTINCT FROM OLD.club_id THEN RAISE EXCEPTION 'A linked meeting cannot change club'; END IF;
 IF TG_OP='UPDATE' AND OLD.club_id IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN RAISE EXCEPTION 'Linked meeting owner immutable'; END IF;
 IF NEW.club_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.club_id IS DISTINCT FROM OLD.club_id) THEN PERFORM clubspace_v2_private.require_member(NEW.created_by,NEW.club_id); END IF; RETURN NEW; END $$;
CREATE TRIGGER v2_meeting_club BEFORE INSERT OR UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_meeting_club();

CREATE FUNCTION clubspace_v2_private.guard_campaign() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM clubspace_v2_private.require_chair(NEW.updated_by,NEW.club_id);
 IF TG_OP='INSERT' THEN
  IF NEW.created_by<>NEW.updated_by OR NEW.status<>'draft' THEN RAISE EXCEPTION 'Create campaign as draft with server actor'; END IF;
 ELSE
  IF ROW(NEW.campaign_id,NEW.club_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.campaign_id,OLD.club_id,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Campaign identity immutable'; END IF;
  IF OLD.status<>'draft' AND ROW(NEW.title,NEW.description,NEW.cover_url,NEW.application_opens_at,NEW.application_closes_at) IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.cover_url,OLD.application_opens_at,OLD.application_closes_at) THEN RAISE EXCEPTION 'Campaign configuration is frozen after opening'; END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='draft' AND NEW.status IN('open','cancelled')) OR (OLD.status='open' AND NEW.status IN('closed','cancelled')) OR (OLD.status='closed' AND NEW.status IN('completed','cancelled'))) THEN RAISE EXCEPTION 'Invalid campaign transition'; END IF;
 END IF;
 IF NEW.status='open' AND (TG_OP='INSERT' OR OLD.status<>'open') THEN
  IF NOT EXISTS(SELECT FROM public.recruitment_departments WHERE campaign_id=NEW.campaign_id) THEN RAISE EXCEPTION 'Configure at least one recruiting department first'; END IF;
  IF EXISTS(SELECT FROM public.recruitment_departments rd JOIN public.club_departments d USING(department_id) WHERE rd.campaign_id=NEW.campaign_id AND (d.status<>'active' OR d.is_management OR NOT EXISTS(SELECT FROM public.recruitment_questions q WHERE q.recruitment_department_id=rd.recruitment_department_id) OR NOT EXISTS(SELECT FROM public.club_memberships m WHERE m.department_id=rd.department_id AND m.status='active' AND m.role='head'))) THEN RAISE EXCEPTION 'Every recruiting department needs active ordinary department, questions and head'; END IF;
 END IF;
 IF NEW.status='completed' AND EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=NEW.campaign_id AND status IN('submitted','interviewing')) THEN RAISE EXCEPTION 'Resolve submitted applications before completing campaign'; END IF; RETURN NEW; END $$;
CREATE TRIGGER a_v2_campaign BEFORE INSERT OR UPDATE ON public.recruitment_campaigns FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_campaign();
CREATE FUNCTION clubspace_v2_private.guard_recruit_config() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE camp public.recruitment_campaigns; rd public.recruitment_departments; dep public.club_departments; BEGIN
 IF TG_TABLE_NAME='recruitment_departments' THEN
  SELECT * INTO dep FROM public.club_departments WHERE department_id=NEW.department_id FOR SHARE;
  SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=NEW.campaign_id FOR UPDATE;
  IF camp.club_id IS DISTINCT FROM dep.club_id OR dep.is_management OR dep.status<>'active' THEN RAISE EXCEPTION 'Recruiting department must be ordinary active department of campaign club'; END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.recruitment_department_id,NEW.campaign_id,NEW.department_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.recruitment_department_id,OLD.campaign_id,OLD.department_id,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Recruiting department identity immutable'; END IF;
 ELSE
  SELECT * INTO rd FROM public.recruitment_departments WHERE recruitment_department_id=NEW.recruitment_department_id;
  SELECT * INTO dep FROM public.club_departments WHERE department_id=rd.department_id FOR SHARE;
  SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=rd.campaign_id FOR UPDATE;
  IF TG_OP='UPDATE' AND ROW(NEW.question_id,NEW.recruitment_department_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.question_id,OLD.recruitment_department_id,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Question identity immutable'; END IF;
 END IF;
 IF camp.campaign_id IS NULL OR camp.status<>'draft' THEN RAISE EXCEPTION 'Questions and recruiting department configuration are frozen once campaign opens'; END IF;
 PERFORM clubspace_v2_private.config_actor(NEW.updated_by,dep.department_id);
 IF TG_OP='INSERT' AND NEW.created_by<>NEW.updated_by THEN RAISE EXCEPTION 'Creator must equal server actor'; END IF; RETURN NEW; END $$;
CREATE TRIGGER a_v2_recruit_config BEFORE INSERT OR UPDATE ON public.recruitment_departments FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_recruit_config();
CREATE TRIGGER a_v2_question BEFORE INSERT OR UPDATE ON public.recruitment_questions FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_recruit_config();

CREATE FUNCTION clubspace_v2_private.guard_application() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE camp public.recruitment_campaigns; rd public.recruitment_departments; prof public.student_profiles; new_member uuid; BEGIN
 SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=NEW.campaign_id FOR SHARE;
 SELECT * INTO rd FROM public.recruitment_departments WHERE recruitment_department_id=NEW.recruitment_department_id AND campaign_id=NEW.campaign_id FOR SHARE;
 IF rd.recruitment_department_id IS NULL THEN RAISE EXCEPTION 'Selected department does not belong to campaign'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NEW.updated_by<>NEW.applicant_id OR NEW.profile_snapshot IS NOT NULL OR NEW.submitted_at IS NOT NULL OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL OR NEW.admitted_membership_id IS NOT NULL OR NEW.withdrawn_at IS NOT NULL OR NEW.result_message IS NOT NULL THEN RAISE EXCEPTION 'Create application as own empty draft'; END IF;
 ELSE
  IF ROW(NEW.application_id,NEW.campaign_id,NEW.applicant_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.application_id,OLD.campaign_id,OLD.applicant_id,OLD.created_at) THEN RAISE EXCEPTION 'Applicant and campaign are immutable'; END IF;
  IF OLD.status IN('accepted','rejected','withdrawn') THEN RAISE EXCEPTION 'Terminal application cannot be rewritten'; END IF;
  IF ROW(NEW.profile_snapshot,NEW.submitted_at,NEW.decided_by,NEW.decided_at,NEW.admitted_membership_id,NEW.withdrawn_at) IS DISTINCT FROM ROW(OLD.profile_snapshot,OLD.submitted_at,OLD.decided_by,OLD.decided_at,OLD.admitted_membership_id,OLD.withdrawn_at) THEN RAISE EXCEPTION 'Application system fields are database managed'; END IF;
  IF NEW.recruitment_department_id<>OLD.recruitment_department_id AND (OLD.status<>'draft' OR EXISTS(SELECT FROM public.application_answers WHERE application_id=OLD.application_id)) THEN RAISE EXCEPTION 'Change department only in draft after clearing old answers'; END IF;
  IF NEW.status=OLD.status THEN
   IF OLD.status<>'draft' OR NEW.updated_by<>OLD.applicant_id OR NEW.result_message IS DISTINCT FROM OLD.result_message THEN RAISE EXCEPTION 'Only applicant can edit draft'; END IF;
  ELSIF NEW.status='submitted' AND OLD.status='draft' THEN
   IF NEW.updated_by<>NEW.applicant_id THEN RAISE EXCEPTION 'Only applicant submits own application'; END IF;
   SELECT * INTO prof FROM public.student_profiles WHERE user_id=NEW.applicant_id FOR SHARE;
   IF prof.user_id IS NULL OR coalesce(btrim(prof.full_name),'')='' OR coalesce(btrim(prof.student_code),'')='' OR coalesce(btrim(prof.school_or_faculty),'')='' OR coalesce(btrim(prof.major),'')='' OR coalesce(btrim(prof.cohort),'')='' THEN RAISE EXCEPTION 'Complete student profile before submitting'; END IF;
   IF EXISTS(SELECT FROM public.club_memberships WHERE club_id=camp.club_id AND user_id=NEW.applicant_id AND status='active') THEN RAISE EXCEPTION 'Applicant is already an active club member'; END IF;
   IF EXISTS(SELECT FROM public.recruitment_questions q WHERE q.recruitment_department_id=NEW.recruitment_department_id AND q.is_required AND NOT EXISTS(SELECT FROM public.application_answers a WHERE a.application_id=NEW.application_id AND a.question_id=q.question_id AND a.answer_text ~ '[^[:space:]]')) THEN RAISE EXCEPTION 'Required answers missing'; END IF;
   NEW.profile_snapshot:=jsonb_build_object('full_name',prof.full_name,'student_code',prof.student_code,'school_or_faculty',prof.school_or_faculty,'major',prof.major,'cohort',prof.cohort);NEW.submitted_at:=clock_timestamp();
  ELSIF NEW.status='withdrawn' AND OLD.status IN('draft','submitted','interviewing') THEN
   IF NEW.updated_by<>NEW.applicant_id THEN RAISE EXCEPTION 'Only applicant withdraws'; END IF; NEW.withdrawn_at:=clock_timestamp();
  ELSIF (OLD.status='submitted' AND NEW.status IN('interviewing','rejected')) OR (OLD.status='interviewing' AND NEW.status IN('accepted','rejected')) THEN
   IF camp.status NOT IN('open','closed') THEN RAISE EXCEPTION 'Campaign is not processing applications'; END IF;
   PERFORM clubspace_v2_private.require_head(NEW.updated_by,rd.department_id);
   IF NEW.status IN('accepted','rejected') THEN
    IF coalesce(btrim(NEW.result_message),'')='' THEN RAISE EXCEPTION 'Candidate-visible result message required'; END IF;
    NEW.decided_by:=NEW.updated_by;NEW.decided_at:=clock_timestamp();
   END IF;
   IF NEW.status='accepted' THEN
    INSERT INTO public.club_memberships(club_id,user_id,department_id,role,status) VALUES(camp.club_id,NEW.applicant_id,rd.department_id,'member','active') RETURNING membership_id INTO new_member;
    NEW.admitted_membership_id:=new_member;
   END IF;
  ELSE RAISE EXCEPTION 'Invalid application transition'; END IF;
 END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND OLD.status='draft' AND NEW.status IN('draft','submitted')) THEN
  IF camp.status<>'open' OR now()<camp.application_opens_at OR now()>=camp.application_closes_at OR NOT EXISTS(SELECT FROM public.clubs WHERE club_id=camp.club_id AND status='published') OR NOT EXISTS(SELECT FROM public.club_departments WHERE department_id=rd.department_id AND status='active') THEN RAISE EXCEPTION 'Application window or department unavailable'; END IF;
 END IF;
 IF (TG_OP='INSERT' OR NEW.updated_by=NEW.applicant_id) AND NEW.result_message IS NOT NULL THEN RAISE EXCEPTION 'Applicant cannot set result'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER a_v2_application BEFORE INSERT OR UPDATE ON public.recruitment_applications FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_application();
CREATE FUNCTION clubspace_v2_private.guard_answer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app public.recruitment_applications; q public.recruitment_questions; cid uuid; BEGIN
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id=NEW.application_id FOR UPDATE;
 IF app.status<>'draft' OR NEW.updated_by<>app.applicant_id THEN RAISE EXCEPTION 'Only applicant edits answers in draft'; END IF;
 SELECT * INTO q FROM public.recruitment_questions WHERE question_id=NEW.question_id;
 IF q.recruitment_department_id IS DISTINCT FROM app.recruitment_department_id OR char_length(NEW.answer_text)>q.max_length THEN RAISE EXCEPTION 'Answer does not match question or length limit'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.answer_id,NEW.application_id,NEW.question_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.answer_id,OLD.application_id,OLD.question_id,OLD.created_at) THEN RAISE EXCEPTION 'Answer identity immutable'; END IF;
 PERFORM 1 FROM public.recruitment_campaigns WHERE campaign_id=app.campaign_id AND status='open' AND now()>=application_opens_at AND now()<application_closes_at FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application window closed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER a_v2_answer BEFORE INSERT OR UPDATE ON public.application_answers FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_answer();
CREATE FUNCTION public.clubspace_clear_draft_answers(p_actor uuid,p_application uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM public.recruitment_applications WHERE application_id=p_application AND applicant_id=p_actor AND status='draft' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Own draft required' USING ERRCODE='42501'; END IF;
 DELETE FROM public.application_answers WHERE application_id=p_application; END $$;
CREATE FUNCTION public.clubspace_transition_application(p_actor uuid,p_application uuid,p_expected_updated_at timestamptz,p_status text,p_message text DEFAULT NULL) RETURNS public.recruitment_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.recruitment_applications; BEGIN
 UPDATE public.recruitment_applications SET status=p_status,result_message=p_message,updated_by=p_actor WHERE application_id=p_application AND updated_at=p_expected_updated_at RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application changed; reload before acting' USING ERRCODE='40001'; END IF; RETURN r; END $$;

CREATE FUNCTION clubspace_v2_private.guard_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app public.recruitment_applications; dep uuid; cid uuid; BEGIN
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id=NEW.application_id FOR SHARE;
 SELECT rd.department_id,c.club_id INTO dep,cid FROM public.recruitment_departments rd JOIN public.recruitment_campaigns c USING(campaign_id) WHERE rd.recruitment_department_id=app.recruitment_department_id;
 IF app.status NOT IN('submitted','interviewing') THEN RAISE EXCEPTION 'Review only while application is being processed'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.review_id,NEW.application_id,NEW.reviewer_id,NEW.stage,NEW.created_at) IS DISTINCT FROM ROW(OLD.review_id,OLD.application_id,OLD.reviewer_id,OLD.stage,OLD.created_at) THEN RAISE EXCEPTION 'Review ownership immutable'; END IF;
 PERFORM clubspace_v2_private.require_member(NEW.reviewer_id,cid);
 IF EXISTS(SELECT FROM public.club_memberships WHERE user_id=NEW.reviewer_id AND department_id=dep AND role='head' AND status='active') THEN PERFORM clubspace_v2_private.require_head(NEW.reviewer_id,dep);
 ELSIF NEW.stage<>'interview' OR NOT EXISTS(SELECT FROM public.interview_panel_members pm JOIN public.interview_appointments a USING(appointment_id) JOIN public.club_memberships m USING(membership_id) WHERE a.application_id=app.application_id AND a.status IN('scheduled','completed') AND m.user_id=NEW.reviewer_id AND m.status='active') THEN RAISE EXCEPTION 'Only department head or assigned interviewer can review' USING ERRCODE='42501'; END IF;
 IF NEW.stage='interview' AND app.status<>'interviewing' THEN RAISE EXCEPTION 'Interview stage required'; END IF; RETURN NEW; END $$;
CREATE TRIGGER a_v2_review BEFORE INSERT OR UPDATE ON public.application_reviews FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_review();
CREATE FUNCTION clubspace_v2_private.guard_appointment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app public.recruitment_applications; dep uuid; cid uuid; BEGIN
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id=NEW.application_id FOR SHARE;
 SELECT rd.department_id,c.club_id INTO dep,cid FROM public.recruitment_departments rd JOIN public.recruitment_campaigns c USING(campaign_id) WHERE rd.recruitment_department_id=app.recruitment_department_id;
 PERFORM clubspace_v2_private.require_head(NEW.updated_by,dep);
 IF TG_OP='INSERT' AND (NEW.status<>'scheduled' OR NEW.created_by<>NEW.updated_by) THEN RAISE EXCEPTION 'Create own scheduled appointment'; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.appointment_id,NEW.application_id,NEW.session_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.appointment_id,OLD.application_id,OLD.session_id,OLD.created_by,OLD.created_at) OR OLD.status<>'scheduled' THEN RAISE EXCEPTION 'Appointment identity or terminal state immutable'; END IF;
 END IF;
 IF NEW.status<>'cancelled' AND app.status<>'interviewing' THEN RAISE EXCEPTION 'Application must be at interview stage'; END IF;
 IF NEW.status='cancelled' THEN NEW.cancelled_at:=clock_timestamp();IF coalesce(btrim(NEW.cancellation_reason),'')='' THEN RAISE EXCEPTION 'Cancellation reason required'; END IF;
 ELSE NEW.cancelled_at:=NULL;NEW.cancellation_reason:=NULL; END IF;
 IF NOT EXISTS(SELECT FROM public.meeting_sessions s JOIN public.meetings m USING(meeting_id) WHERE s.session_id=NEW.session_id AND m.club_id=cid) THEN RAISE EXCEPTION 'Interview session must belong to the same club'; END IF;
 -- Serialize schedules for this candidate, including different clubs/campaigns.
 PERFORM 1 FROM public.users WHERE user_id=app.applicant_id FOR UPDATE;
 IF NEW.status='scheduled' AND EXISTS(SELECT FROM public.interview_appointments a JOIN public.recruitment_applications other_app USING(application_id) WHERE other_app.applicant_id=app.applicant_id AND a.status='scheduled' AND a.appointment_id<>NEW.appointment_id AND a.scheduled_start_at<NEW.scheduled_end_at AND a.scheduled_end_at>NEW.scheduled_start_at) THEN RAISE EXCEPTION 'Candidate has overlapping interview'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER a_v2_appointment BEFORE INSERT OR UPDATE ON public.interview_appointments FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_appointment();
CREATE FUNCTION clubspace_v2_private.guard_panel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.interview_appointments; dep uuid; cid uuid; m public.club_memberships; BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Panel assignments are immutable; remove and assign again'; END IF;
 SELECT * INTO a FROM public.interview_appointments WHERE appointment_id=NEW.appointment_id FOR SHARE;
 SELECT rd.department_id,c.club_id INTO dep,cid FROM public.recruitment_applications ap JOIN public.recruitment_departments rd USING(recruitment_department_id) JOIN public.recruitment_campaigns c ON c.campaign_id=ap.campaign_id WHERE ap.application_id=a.application_id;
 PERFORM clubspace_v2_private.require_head(NEW.assigned_by,dep);
 SELECT * INTO m FROM public.club_memberships WHERE membership_id=NEW.membership_id FOR SHARE;
 IF a.status<>'scheduled' OR m.club_id IS DISTINCT FROM cid OR m.status<>'active' THEN RAISE EXCEPTION 'Active interviewer in same club and scheduled appointment required'; END IF;
 IF EXISTS(SELECT FROM public.recruitment_applications WHERE application_id=a.application_id AND applicant_id=m.user_id) THEN RAISE EXCEPTION 'Candidate cannot interview self'; END IF;
 PERFORM 1 FROM public.users WHERE user_id=m.user_id FOR UPDATE;
 IF EXISTS(SELECT FROM public.interview_panel_members pm JOIN public.interview_appointments other_a USING(appointment_id) JOIN public.club_memberships om USING(membership_id) WHERE om.user_id=m.user_id AND other_a.status='scheduled' AND other_a.appointment_id<>a.appointment_id AND other_a.scheduled_start_at<a.scheduled_end_at AND other_a.scheduled_end_at>a.scheduled_start_at) THEN RAISE EXCEPTION 'Interviewer has overlapping appointment'; END IF; RETURN NEW; END $$;
CREATE TRIGGER a_v2_panel BEFORE INSERT OR UPDATE ON public.interview_panel_members FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_panel();
CREATE FUNCTION public.clubspace_remove_interviewer(p_actor uuid,p_appointment uuid,p_membership uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE dep uuid; BEGIN
 SELECT rd.department_id INTO dep FROM public.interview_appointments a JOIN public.recruitment_applications ap USING(application_id) JOIN public.recruitment_departments rd USING(recruitment_department_id) WHERE a.appointment_id=p_appointment AND a.status='scheduled' FOR SHARE OF a;
 PERFORM clubspace_v2_private.require_head(p_actor,dep);DELETE FROM public.interview_panel_members WHERE appointment_id=p_appointment AND membership_id=p_membership; END $$;
-- Deferred synchronization permits rescheduling session and appointment in ONE transaction.
CREATE FUNCTION clubspace_v2_private.check_interview_consistency() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid; a public.interview_appointments; s public.meeting_sessions; u uuid; BEGIN
 sid:=NEW.session_id;
 SELECT * INTO a FROM public.interview_appointments WHERE session_id=sid;
 IF NOT FOUND OR a.status<>'scheduled' THEN RETURN NULL; END IF;
 SELECT * INTO s FROM public.meeting_sessions WHERE session_id=sid;
 IF s.scheduled_start_at IS DISTINCT FROM a.scheduled_start_at OR s.scheduled_end_at IS DISTINCT FROM a.scheduled_end_at THEN RAISE EXCEPTION 'Scheduled interview/session times must match at commit'; END IF;
 FOR u IN SELECT m.user_id FROM public.interview_panel_members pm JOIN public.club_memberships m USING(membership_id) WHERE pm.appointment_id=a.appointment_id ORDER BY m.user_id LOOP
  PERFORM 1 FROM public.users WHERE user_id=u FOR UPDATE;
  IF EXISTS(SELECT FROM public.interview_panel_members pm JOIN public.club_memberships m USING(membership_id) JOIN public.interview_appointments oa USING(appointment_id) WHERE m.user_id=u AND oa.appointment_id<>a.appointment_id AND oa.status='scheduled' AND oa.scheduled_start_at<a.scheduled_end_at AND oa.scheduled_end_at>a.scheduled_start_at) THEN RAISE EXCEPTION 'Reschedule overlaps interviewer appointment'; END IF;
 END LOOP; RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER v2_interview_consistency AFTER INSERT OR UPDATE ON public.interview_appointments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.check_interview_consistency();
CREATE CONSTRAINT TRIGGER v2_session_consistency AFTER INSERT OR UPDATE ON public.meeting_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.check_interview_consistency();

-- Channel access derives from ACTIVE CLUB MEMBERSHIP, then department/privacy/grants.
-- No chairperson/admin bypass. Only head of the owning department can manage grants.
CREATE FUNCTION public.clubspace_can_read_channel(p_actor uuid,p_channel uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT FROM public.club_channels ch JOIN public.clubs c ON c.club_id=ch.club_id JOIN public.club_memberships m ON m.club_id=ch.club_id
 LEFT JOIN public.club_departments d ON d.department_id=ch.department_id
 WHERE ch.channel_id=p_channel AND m.user_id=p_actor AND m.status='active' AND c.status='published'
 AND (ch.kind='general' OR (d.status='active' AND (NOT d.is_private OR m.department_id=ch.department_id OR EXISTS(SELECT FROM public.channel_members cm WHERE cm.channel_id=ch.channel_id AND cm.membership_id=m.membership_id AND cm.removed_at IS NULL))))) $$;
CREATE FUNCTION clubspace_v2_private.require_channel(p_actor uuid,p_channel uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.club_channels; m uuid; BEGIN
 SELECT * INTO c FROM public.club_channels WHERE channel_id=p_channel FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel not found'; END IF;m:=clubspace_v2_private.require_member(p_actor,c.club_id);
 PERFORM 1 FROM public.club_departments WHERE department_id=c.department_id FOR SHARE;
 PERFORM 1 FROM public.channel_members WHERE channel_id=p_channel AND membership_id=m AND removed_at IS NULL FOR SHARE;
 IF NOT public.clubspace_can_read_channel(p_actor,p_channel) THEN RAISE EXCEPTION 'Channel access denied' USING ERRCODE='42501'; END IF; RETURN m; END $$;
CREATE FUNCTION clubspace_v2_private.guard_channel() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.kind='department' AND NOT EXISTS(SELECT FROM public.club_departments WHERE department_id=NEW.department_id AND club_id=NEW.club_id) THEN RAISE EXCEPTION 'Channel department must belong to club'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.channel_id,NEW.club_id,NEW.department_id,NEW.kind,NEW.created_at) IS DISTINCT FROM ROW(OLD.channel_id,OLD.club_id,OLD.department_id,OLD.kind,OLD.created_at) THEN RAISE EXCEPTION 'Channel scope immutable'; END IF;RETURN NEW; END $$;
CREATE TRIGGER v2_channel_guard BEFORE INSERT OR UPDATE ON public.club_channels FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_channel();
CREATE FUNCTION clubspace_v2_private.provision_channel() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_TABLE_NAME='clubs' THEN INSERT INTO public.club_channels(club_id,kind,name) VALUES(NEW.club_id,'general','Chung') ON CONFLICT DO NOTHING;
 ELSE INSERT INTO public.club_channels(club_id,department_id,kind,name) VALUES(NEW.club_id,NEW.department_id,'department',NEW.name) ON CONFLICT DO NOTHING; END IF;RETURN NEW; END $$;
CREATE TRIGGER v2_club_channel AFTER INSERT ON public.clubs FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.provision_channel();
CREATE TRIGGER v2_department_channel AFTER INSERT ON public.club_departments FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.provision_channel();
INSERT INTO public.club_channels(club_id,kind,name) SELECT club_id,'general','Chung' FROM public.clubs;
INSERT INTO public.club_channels(club_id,department_id,kind,name) SELECT club_id,department_id,'department',name FROM public.club_departments;
CREATE FUNCTION clubspace_v2_private.guard_channel_grant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ch public.club_channels; m public.club_memberships; BEGIN
 SELECT * INTO ch FROM public.club_channels WHERE channel_id=NEW.channel_id FOR SHARE;
 IF ch.kind<>'department' THEN RAISE EXCEPTION 'General channel needs no individual access grants'; END IF;
 IF TG_OP='INSERT' THEN
  PERFORM clubspace_v2_private.require_head(NEW.added_by,ch.department_id);
  SELECT * INTO m FROM public.club_memberships WHERE membership_id=NEW.membership_id FOR SHARE;
  IF m.club_id IS DISTINCT FROM ch.club_id OR m.status<>'active' OR m.department_id=ch.department_id THEN RAISE EXCEPTION 'Grant only to active member of same club outside this department'; END IF;
  IF NEW.removed_at IS NOT NULL OR NEW.removed_by IS NOT NULL THEN RAISE EXCEPTION 'Create active grant only'; END IF;NEW.joined_at:=clock_timestamp();
 ELSE
  IF ROW(NEW.channel_member_id,NEW.channel_id,NEW.membership_id,NEW.added_by,NEW.joined_at) IS DISTINCT FROM ROW(OLD.channel_member_id,OLD.channel_id,OLD.membership_id,OLD.added_by,OLD.joined_at) OR OLD.removed_at IS NOT NULL OR NEW.removed_by IS NULL THEN RAISE EXCEPTION 'Only revoke an active grant; insert a new history row to grant again'; END IF;
  PERFORM clubspace_v2_private.require_head(NEW.removed_by,ch.department_id);NEW.removed_at:=clock_timestamp();
 END IF;RETURN NEW; END $$;
CREATE TRIGGER v2_channel_grant BEFORE INSERT OR UPDATE ON public.channel_members FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_channel_grant();
CREATE FUNCTION clubspace_v2_private.guard_channel_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m uuid; owner_user uuid; dep uuid; BEGIN
 m:=clubspace_v2_private.require_channel(NEW.updated_by,NEW.channel_id);
 SELECT user_id INTO owner_user FROM public.club_memberships WHERE membership_id=NEW.sender_membership_id;
 IF TG_OP='INSERT' THEN
  IF NEW.sender_membership_id<>m OR NEW.edited_at IS NOT NULL OR NEW.deleted_at IS NOT NULL OR NEW.deleted_by IS NOT NULL THEN RAISE EXCEPTION 'Only send as own current membership'; END IF;NEW.created_at:=clock_timestamp();
 ELSE
  IF ROW(NEW.message_id,NEW.channel_id,NEW.sender_membership_id,NEW.client_message_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.message_id,OLD.channel_id,OLD.sender_membership_id,OLD.client_message_id,OLD.created_at) OR OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Message scope or deleted message immutable'; END IF;
  IF NEW.deleted_at IS NOT NULL THEN
   IF NEW.content IS DISTINCT FROM OLD.content THEN RAISE EXCEPTION 'Do not change body during soft delete'; END IF;
   IF NEW.updated_by<>owner_user THEN SELECT department_id INTO dep FROM public.club_channels WHERE channel_id=NEW.channel_id;PERFORM clubspace_v2_private.require_head(NEW.updated_by,dep); END IF;
   NEW.deleted_at:=clock_timestamp();NEW.deleted_by:=NEW.updated_by;NEW.edited_at:=OLD.edited_at;
  ELSE
   IF NEW.updated_by<>owner_user OR m<>NEW.sender_membership_id OR NEW.deleted_by IS NOT NULL THEN RAISE EXCEPTION 'Only original active sender edits message'; END IF;
   NEW.edited_at:=clock_timestamp();
  END IF;
 END IF;RETURN NEW; END $$;
CREATE TRIGGER v2_channel_message BEFORE INSERT OR UPDATE ON public.channel_messages FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_channel_message();
CREATE FUNCTION public.clubspace_mark_channel_read(p_actor uuid,p_channel uuid,p_message uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m uuid; incoming_time timestamptz; old_id uuid; old_time timestamptz; BEGIN
 m:=clubspace_v2_private.require_channel(p_actor,p_channel);
 SELECT created_at INTO incoming_time FROM public.channel_messages WHERE message_id=p_message AND channel_id=p_channel;
 IF NOT FOUND THEN RAISE EXCEPTION 'Message does not belong to channel'; END IF;
 INSERT INTO public.channel_read_states(channel_id,membership_id,last_read_message_id) VALUES(p_channel,m,p_message) ON CONFLICT DO NOTHING;
 SELECT rs.last_read_message_id,msg.created_at INTO old_id,old_time FROM public.channel_read_states rs LEFT JOIN public.channel_messages msg ON msg.message_id=rs.last_read_message_id WHERE rs.channel_id=p_channel AND rs.membership_id=m FOR UPDATE OF rs;
 IF old_id IS NULL OR ROW(incoming_time,p_message)>=ROW(old_time,old_id) THEN UPDATE public.channel_read_states SET last_read_message_id=p_message,last_read_at=clock_timestamp() WHERE channel_id=p_channel AND membership_id=m; END IF;END $$;
CREATE FUNCTION public.clubspace_channel_history(p_actor uuid,p_channel uuid,p_before_time timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 30)
RETURNS TABLE(message_id uuid,sender_membership_id uuid,content text,created_at timestamptz,edited_at timestamptz,deleted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM clubspace_v2_private.require_channel(p_actor,p_channel);
 IF p_limit NOT BETWEEN 1 AND 100 OR (p_before_time IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid cursor/limit'; END IF;
 RETURN QUERY SELECT msg.message_id,msg.sender_membership_id,CASE WHEN msg.deleted_at IS NULL THEN msg.content ELSE NULL END,msg.created_at,msg.edited_at,msg.deleted_at FROM public.channel_messages msg
 WHERE msg.channel_id=p_channel AND (p_before_time IS NULL OR ROW(msg.created_at,msg.message_id)<ROW(p_before_time,p_before_id)) ORDER BY msg.created_at DESC,msg.message_id DESC LIMIT p_limit; END $$;

CREATE FUNCTION clubspace_v2_private.guard_club_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; v jsonb; max_len integer; current_club public.clubs; BEGIN
 SELECT * INTO current_club FROM public.clubs WHERE club_id=NEW.club_id FOR UPDATE;
 IF current_club.status IS DISTINCT FROM 'published' THEN RAISE EXCEPTION 'Only published clubs may request revisions'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(NEW.proposed_data) LOOP
  IF k NOT IN('name','summary','description','mission') THEN RAISE EXCEPTION 'Only name, summary, description and mission are revision fields'; END IF;
  max_len:=CASE k WHEN 'name' THEN 200 WHEN 'summary' THEN 500 WHEN 'description' THEN 50000 ELSE 5000 END;
  IF NOT(k='mission' AND v='null'::jsonb) AND (jsonb_typeof(v)<>'string' OR char_length(v#>>'{}')>max_len OR (k<>'mission' AND NOT((v#>>'{}') ~ '[^[:space:]]'))) THEN RAISE EXCEPTION 'Invalid proposed field %',k; END IF;
 END LOOP;
 IF TG_OP='INSERT' THEN
  PERFORM clubspace_v2_private.require_chair(NEW.requested_by,NEW.club_id);
  IF NEW.updated_by<>NEW.requested_by OR NEW.status<>'pending' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.review_note IS NOT NULL OR NEW.base_club_updated_at IS DISTINCT FROM current_club.updated_at THEN RAISE EXCEPTION 'Create own pending revision against current club version'; END IF;
 ELSE
  IF ROW(NEW.change_request_id,NEW.club_id,NEW.requested_by,NEW.proposed_data,NEW.base_club_updated_at,NEW.created_at) IS DISTINCT FROM ROW(OLD.change_request_id,OLD.club_id,OLD.requested_by,OLD.proposed_data,OLD.base_club_updated_at,OLD.created_at) OR OLD.status<>'pending' THEN RAISE EXCEPTION 'Revision content and processed requests immutable'; END IF;
  IF NEW.status='cancelled' THEN
   PERFORM clubspace_v2_private.require_chair(NEW.updated_by,NEW.club_id);NEW.reviewed_by:=NULL;NEW.reviewed_at:=NULL;NEW.review_note:=NULL;
  ELSIF NEW.status IN('approved','rejected') THEN
   PERFORM clubspace_v2_private.require_admin(NEW.updated_by);NEW.reviewed_by:=NEW.updated_by;NEW.reviewed_at:=clock_timestamp();
   IF NEW.status='rejected' AND coalesce(btrim(NEW.review_note),'')='' THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
   IF NEW.status='approved' THEN
    IF current_club.updated_at IS DISTINCT FROM NEW.base_club_updated_at THEN RAISE EXCEPTION 'Public club has changed; cancel and submit a fresh revision' USING ERRCODE='40001'; END IF;
    NEW.review_note:=NULL;
   END IF;
  ELSE RAISE EXCEPTION 'Only approve, reject or cancel a pending revision'; END IF;
 END IF;RETURN NEW; END $$;
CREATE TRIGGER a_v2_club_change BEFORE INSERT OR UPDATE ON public.club_change_requests FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_club_change();
CREATE FUNCTION public.clubspace_decide_club_change(p_actor uuid,p_request uuid,p_expected_updated_at timestamptz,p_status text,p_note text DEFAULT NULL) RETURNS public.club_change_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.club_change_requests; BEGIN
 UPDATE public.club_change_requests SET status=p_status,review_note=p_note,updated_by=p_actor WHERE change_request_id=p_request AND status='pending' AND updated_at=p_expected_updated_at RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Revision changed; reload' USING ERRCODE='40001'; END IF; RETURN r; END $$;

CREATE FUNCTION public.clubspace_claim_notification_jobs(p_limit integer DEFAULT 20,p_lease_seconds integer DEFAULT 120) RETURNS SETOF public.notification_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 30 AND 900 THEN RAISE EXCEPTION 'Invalid worker batch/lease'; END IF;
 WITH exhausted AS(SELECT job_id FROM public.notification_jobs WHERE status='processing' AND locked_until<clock_timestamp() AND attempt_count>=5 ORDER BY locked_until LIMIT p_limit FOR UPDATE SKIP LOCKED)
 UPDATE public.notification_jobs j SET status='failed',claim_token=NULL,locked_until=NULL,last_error='Lease expired after maximum attempts' FROM exhausted e WHERE j.job_id=e.job_id;
 RETURN QUERY WITH due AS(SELECT job_id FROM public.notification_jobs WHERE attempt_count<5 AND ((status='pending' AND run_at<=clock_timestamp()) OR (status='processing' AND locked_until<clock_timestamp())) ORDER BY run_at,job_id LIMIT p_limit FOR UPDATE SKIP LOCKED)
 UPDATE public.notification_jobs j SET status='processing',claim_token=gen_random_uuid(),locked_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempt_count=j.attempt_count+1 FROM due WHERE j.job_id=due.job_id RETURNING j.*; END $$;
CREATE FUNCTION public.clubspace_finish_notification_job(p_job uuid,p_claim uuid,p_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.notification_jobs SET status=CASE WHEN p_error IS NULL THEN 'completed' WHEN attempt_count>=5 THEN 'failed' ELSE 'pending' END,
 processed_at=CASE WHEN p_error IS NULL THEN clock_timestamp() ELSE NULL END,
 run_at=CASE WHEN p_error IS NULL THEN run_at ELSE clock_timestamp()+make_interval(secs=>least(3600,(30*power(2,attempt_count))::int)) END,
 last_error=left(p_error,2000),claim_token=NULL,locked_until=NULL
 WHERE job_id=p_job AND status='processing' AND claim_token=p_claim AND locked_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Stale or expired job lease' USING ERRCODE='40001'; END IF; END $$;
CREATE FUNCTION public.clubspace_mark_notification_read(p_actor uuid,p_notification uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.notifications SET read_at=coalesce(read_at,clock_timestamp()) WHERE notification_id=p_notification AND recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Notification not owned by actor' USING ERRCODE='42501'; END IF; END $$;
CREATE FUNCTION clubspace_v2_private.domain_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event_name text; entity text; obj uuid; key_version text; cid uuid; actor uuid; rid uuid; reminder_key text; BEGIN
 IF TG_TABLE_NAME='recruitment_applications' THEN
  IF TG_OP='INSERT' OR NEW.status=OLD.status THEN RETURN NEW; END IF;
  event_name:='application.'||NEW.status;entity:='application';obj:=NEW.application_id;actor:=NEW.updated_by;
  SELECT club_id INTO cid FROM public.recruitment_campaigns WHERE campaign_id=NEW.campaign_id;
 ELSIF TG_TABLE_NAME='interview_appointments' THEN
  event_name:='interview.'||CASE WHEN TG_OP='INSERT' THEN 'scheduled' WHEN NEW.status<>OLD.status THEN NEW.status ELSE 'updated' END;
  entity:='interview';obj:=NEW.appointment_id;actor:=NEW.updated_by;
  SELECT c.club_id INTO cid FROM public.recruitment_applications ap JOIN public.recruitment_campaigns c USING(campaign_id) WHERE ap.application_id=NEW.application_id;
 ELSIF TG_TABLE_NAME='club_change_requests' THEN
  event_name:='club_change.'||NEW.status;entity:='club_change';obj:=NEW.change_request_id;cid:=NEW.club_id;actor:=NEW.updated_by;
 ELSIF TG_TABLE_NAME='clubs' THEN
  IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
  event_name:='club.'||CASE WHEN NEW.status='pending' THEN 'request_submitted' ELSE NEW.status END;entity:='club';obj:=NEW.club_id;cid:=NEW.club_id;actor:=coalesce(NEW.reviewed_by,NEW.created_by);
 ELSIF TG_TABLE_NAME='club_posts' THEN
  IF NEW.publication_status='published' AND NEW.visibility='public' THEN event_name:='post.published';
  ELSIF TG_OP='UPDATE' AND NEW.publication_status IS DISTINCT FROM OLD.publication_status THEN event_name:='post.'||NEW.publication_status;
  ELSE RETURN NEW; END IF;
  entity:='post';obj:=NEW.post_id;cid:=NEW.club_id;actor:=coalesce(NEW.reviewed_by,NEW.author_id);
 ELSIF TG_TABLE_NAME='club_activities' THEN
  -- Invalidate old reminders on edits/unpublish/cancellation; no notification means access.
  IF TG_OP='UPDATE' OR NEW.publication_status<>'published' OR NEW.lifecycle_status IN('cancelled','completed') THEN
   UPDATE public.notification_jobs SET status='cancelled',claim_token=NULL,locked_until=NULL WHERE entity_type='activity' AND entity_id=NEW.activity_id AND event_type='activity.reminder' AND status IN('pending','processing');
  END IF;
  IF NEW.publication_status='published' AND NEW.lifecycle_status IN('scheduled','ongoing') THEN
   FOREACH reminder_key IN ARRAY ARRAY['24h','1h'] LOOP
    IF NEW.starts_at-(CASE WHEN reminder_key='24h' THEN interval '24 hours' ELSE interval '1 hour' END)>clock_timestamp() THEN
     PERFORM clubspace_v2_private.enqueue('activity.reminder','activity',NEW.activity_id,'reminder:'||NEW.activity_id||':'||NEW.starts_at||':'||reminder_key||':'||NEW.updated_at,jsonb_build_object('activity_id',NEW.activity_id,'starts_at',NEW.starts_at,'offset',reminder_key),NEW.starts_at-(CASE WHEN reminder_key='24h' THEN interval '24 hours' ELSE interval '1 hour' END));
    END IF;
   END LOOP;
   event_name:=CASE WHEN TG_OP='INSERT' OR OLD.publication_status<>'published' THEN 'activity.published' ELSE 'activity.updated' END;
  ELSIF NEW.lifecycle_status='cancelled' THEN event_name:='activity.cancelled';
  ELSIF TG_OP='UPDATE' AND NEW.publication_status<>OLD.publication_status THEN event_name:='activity.'||NEW.publication_status;
  ELSE RETURN NEW; END IF;
  entity:='activity';obj:=NEW.activity_id;cid:=NEW.club_id;actor:=coalesce(NEW.reviewed_by,NEW.created_by);
 ELSIF TG_TABLE_NAME='activity_registrations' THEN
  IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
  event_name:='registration.'||NEW.status;entity:='registration';obj:=NEW.registration_id;actor:=NEW.user_id;
  SELECT club_id INTO cid FROM public.club_activities WHERE activity_id=NEW.activity_id;
 ELSIF TG_TABLE_NAME='recruitment_campaigns' THEN
  IF TG_OP='INSERT' OR NEW.status=OLD.status THEN RETURN NEW; END IF;
  event_name:='recruitment.'||NEW.status;entity:='campaign';obj:=NEW.campaign_id;cid:=NEW.club_id;actor:=NEW.updated_by;
 ELSE RETURN NEW; END IF;
 key_version:=CASE WHEN TG_TABLE_NAME='clubs' THEN NEW.updated_at::text ELSE to_jsonb(NEW)->>'updated_at' END;
 PERFORM clubspace_v2_private.enqueue(event_name,entity,obj,event_name||':'||obj||':'||coalesce(key_version,clock_timestamp()::text),jsonb_build_object('entity_id',obj,'club_id',cid,'actor_id',actor));
 IF TG_TABLE_NAME IN('recruitment_applications','interview_appointments','club_change_requests','clubs','recruitment_campaigns') THEN
  PERFORM clubspace_v2_private.audit(actor,cid,event_name,entity,obj,jsonb_build_object('status',to_jsonb(NEW)->>'status'));
 END IF;RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['recruitment_applications','interview_appointments','club_change_requests','clubs','club_posts','club_activities','activity_registrations','recruitment_campaigns'] LOOP
  EXECUTE format('CREATE TRIGGER v2_domain_events AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.domain_events()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['recruitment_campaigns','recruitment_departments','recruitment_questions','recruitment_applications','application_answers','application_reviews','interview_appointments','notification_jobs','club_change_requests'] LOOP
  EXECUTE format('CREATE TRIGGER z_v2_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch()',t);
 END LOOP;
END $$;
-- Membership events from legacy APIs have no reliable application actor in SQL;
-- actor_id stays NULL instead of inventing one. Head RPC additionally logs its actor.
CREATE FUNCTION clubspace_v2_private.audit_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.role,NEW.status,NEW.department_id) IS DISTINCT FROM ROW(OLD.role,OLD.status,OLD.department_id) THEN
 PERFORM clubspace_v2_private.audit(NULL,NEW.club_id,'membership.changed','membership',NEW.membership_id,jsonb_build_object('old_role',OLD.role,'new_role',NEW.role,'old_status',OLD.status,'new_status',NEW.status,'old_department_id',OLD.department_id,'new_department_id',NEW.department_id)); END IF;RETURN NEW; END $$;
CREATE TRIGGER v2_membership_audit AFTER UPDATE ON public.club_memberships FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.audit_membership();

-- Backend only. No browser grants/policies, and no DELETE on historical tables.
DO $$ DECLARE t text; p regprocedure; BEGIN
 FOREACH t IN ARRAY ARRAY['recruitment_campaigns','recruitment_departments','recruitment_questions','recruitment_applications','application_answers','application_reviews','interview_appointments','interview_panel_members','notification_jobs','notifications','club_change_requests','club_channels','channel_members','channel_messages','channel_read_states','audit_logs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['recruitment_campaigns','recruitment_departments','recruitment_questions','recruitment_applications','application_answers','application_reviews','interview_appointments','club_change_requests','channel_members','channel_messages'] LOOP
  EXECUTE format('GRANT INSERT,UPDATE ON TABLE public.%I TO service_role',t);
 END LOOP;
 GRANT INSERT ON public.interview_panel_members,public.notifications,public.audit_logs TO service_role;
 REVOKE ALL ON ALL FUNCTIONS IN SCHEMA clubspace_v2_private FROM PUBLIC,anon,authenticated,service_role;
 FOR p IN SELECT x.oid::regprocedure FROM pg_proc x JOIN pg_namespace n ON n.oid=x.pronamespace WHERE n.nspname='public' AND x.proname IN('clubspace_set_department_head','clubspace_clear_draft_answers','clubspace_transition_application','clubspace_remove_interviewer','clubspace_can_read_channel','clubspace_mark_channel_read','clubspace_channel_history','clubspace_decide_club_change','clubspace_claim_notification_jobs','clubspace_finish_notification_job','clubspace_mark_notification_read') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',p);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',p);
 END LOOP;
END $$;
COMMENT ON TABLE public.channel_members IS 'Explicit outside-department grants only; head of owning department alone adds/revokes. No delegated manager flag. Access additionally requires same active club membership.';
COMMENT ON TABLE public.recruitment_applications IS 'One application per campaign/student, including withdrawn/rejected history. Acceptance inserts membership atomically; actor comes from verified backend JWT.';
COMMENT ON TABLE public.notification_jobs IS 'Transactional outbox, not an automatically running scheduler. A backend worker must claim leases, recheck current audiences/privacy and create deduplicated notifications.';
COMMENT ON TABLE public.application_reviews IS 'Internal assessment. Never expose internal_note via applicant/public endpoints.';
COMMENT ON TABLE public.club_channels IS 'One general channel per club and one per department. Privacy derives from current department.is_private; chairperson/platform admin have no private-read bypass.';
COMMENT ON COLUMN public.recruitment_departments.target_quantity IS 'Planning target only; not an automatic hard admission capacity.';
COMMENT ON TABLE public.audit_logs IS 'Append only. Metadata only; never record passwords, JWTs or full application answers.';


-- Enforce that important public identity fields change only through an approved revision.
CREATE FUNCTION clubspace_v2_private.guard_public_club_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF OLD.status='published' AND ROW(NEW.name,NEW.summary,NEW.description,NEW.mission) IS DISTINCT FROM ROW(OLD.name,OLD.summary,OLD.description,OLD.mission) THEN
  IF NOT EXISTS(SELECT FROM public.club_change_requests r WHERE r.club_id=OLD.club_id AND r.status='approved' AND r.base_club_updated_at=OLD.updated_at
   AND ROW(NEW.name,NEW.summary,NEW.description,NEW.mission) IS NOT DISTINCT FROM ROW(
    CASE WHEN r.proposed_data?'name' THEN btrim(r.proposed_data->>'name') ELSE OLD.name END,
    CASE WHEN r.proposed_data?'summary' THEN btrim(r.proposed_data->>'summary') ELSE OLD.summary END,
    CASE WHEN r.proposed_data?'description' THEN btrim(r.proposed_data->>'description') ELSE OLD.description END,
    CASE WHEN r.proposed_data?'mission' THEN r.proposed_data->>'mission' ELSE OLD.mission END)) THEN RAISE EXCEPTION 'Published club identity requires an approved current revision'; END IF;
 END IF;RETURN NEW; END $$;
CREATE TRIGGER v2_public_club_identity BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_public_club_identity();
CREATE FUNCTION clubspace_v2_private.apply_club_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.status='approved' AND OLD.status='pending' THEN
  UPDATE public.clubs SET name=CASE WHEN NEW.proposed_data?'name' THEN btrim(NEW.proposed_data->>'name') ELSE name END,
   summary=CASE WHEN NEW.proposed_data?'summary' THEN btrim(NEW.proposed_data->>'summary') ELSE summary END,
   description=CASE WHEN NEW.proposed_data?'description' THEN btrim(NEW.proposed_data->>'description') ELSE description END,
   mission=CASE WHEN NEW.proposed_data?'mission' THEN NEW.proposed_data->>'mission' ELSE mission END
  WHERE club_id=NEW.club_id AND updated_at=NEW.base_club_updated_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'Club revision conflict' USING ERRCODE='40001'; END IF;
 END IF;RETURN NEW; END $$;
CREATE TRIGGER a_v2_apply_club_change AFTER UPDATE ON public.club_change_requests FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.apply_club_change();
CREATE TRIGGER zz_v2_club_version BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
CREATE TRIGGER zz_v2_membership_version BEFORE UPDATE ON public.club_memberships FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
CREATE TRIGGER zz_v2_activity_version BEFORE UPDATE ON public.club_activities FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
CREATE TRIGGER zz_v2_post_version BEFORE UPDATE ON public.club_posts FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
CREATE FUNCTION clubspace_v2_private.channel_grant_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; actor uuid; event_name text; BEGIN
 SELECT club_id INTO cid FROM public.club_channels WHERE channel_id=NEW.channel_id;
 actor:=CASE WHEN TG_OP='INSERT' THEN NEW.added_by ELSE NEW.removed_by END;
 event_name:=CASE WHEN TG_OP='INSERT' THEN 'channel.member_added' ELSE 'channel.member_removed' END;
 PERFORM clubspace_v2_private.audit(actor,cid,event_name,'channel_member',NEW.channel_member_id,jsonb_build_object('channel_id',NEW.channel_id,'membership_id',NEW.membership_id));
 PERFORM clubspace_v2_private.enqueue(event_name,'channel_member',NEW.channel_member_id,event_name||':'||NEW.channel_member_id,jsonb_build_object('channel_id',NEW.channel_id,'membership_id',NEW.membership_id,'actor_id',actor));RETURN NEW; END $$;
CREATE TRIGGER v2_channel_grant_event AFTER INSERT OR UPDATE ON public.channel_members FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.channel_grant_event();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA clubspace_v2_private FROM PUBLIC,anon,authenticated,service_role;


-- Meeting chat is ephemeral: no deletion at import; FUTURE end/cancel transitions
-- purge that session's messages. Session locks prevent a late concurrent insert.
CREATE FUNCTION clubspace_v2_private.guard_ephemeral_meeting_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE session_state text; BEGIN
 SELECT status INTO session_state FROM public.meeting_sessions WHERE session_id=NEW.session_id FOR SHARE;
 IF session_state IS DISTINCT FROM 'ongoing' THEN RAISE EXCEPTION 'Meeting chat requires an ongoing session'; END IF;
 NEW.created_at:=clock_timestamp();RETURN NEW; END $$;
CREATE TRIGGER v2_meeting_message_state BEFORE INSERT ON public.meeting_messages FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_ephemeral_meeting_message();
CREATE FUNCTION clubspace_v2_private.purge_ended_meeting_chat() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.status IN('ended','cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
 DELETE FROM public.meeting_messages WHERE session_id=NEW.session_id;
 END IF;RETURN NEW; END $$;
CREATE TRIGGER v2_purge_meeting_chat AFTER UPDATE ON public.meeting_sessions FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.purge_ended_meeting_chat();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA clubspace_v2_private FROM PUBLIC,anon,authenticated,service_role;

-- Read projections are still BACKEND-ONLY, matching existing public-view access.
CREATE VIEW public.public_recruitment_campaigns AS
 SELECT r.campaign_id,r.club_id,c.name AS club_name,c.logo_url AS club_logo_url,r.title,r.description,r.cover_url,r.application_opens_at,r.application_closes_at,r.status,r.created_at,r.updated_at
 FROM public.recruitment_campaigns r JOIN public.clubs c USING(club_id)
 WHERE c.status='published' AND r.status IN('open','closed','completed');
CREATE VIEW public.public_recruitment_departments AS
 SELECT rd.recruitment_department_id,rd.campaign_id,rd.department_id,d.name AS department_name,rd.description,rd.requirements,rd.target_quantity
 FROM public.recruitment_departments rd JOIN public.public_recruitment_campaigns c USING(campaign_id) JOIN public.club_departments d USING(department_id)
 WHERE d.status='active';
REVOKE ALL ON public.public_recruitment_campaigns,public.public_recruitment_departments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.public_recruitment_campaigns,public.public_recruitment_departments TO service_role;

CREATE FUNCTION public.clubspace_update_channel(p_actor uuid,p_channel uuid,p_name text,p_description text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ch public.club_channels; BEGIN
 SELECT * INTO ch FROM public.club_channels WHERE channel_id=p_channel FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Channel not found'; END IF;
 IF ch.kind='general' THEN PERFORM clubspace_v2_private.require_chair(p_actor,ch.club_id);ELSE PERFORM clubspace_v2_private.require_head(p_actor,ch.department_id);END IF;
 UPDATE public.club_channels SET name=btrim(p_name),description=p_description WHERE channel_id=p_channel;
 PERFORM clubspace_v2_private.audit(p_actor,ch.club_id,'channel.updated','channel',p_channel); END $$;
REVOKE ALL ON FUNCTION public.clubspace_update_channel(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.clubspace_update_channel(uuid,uuid,text,text) TO service_role;

-- Ordinary membership admission is recruitment-only. Core chair provisioning and
-- accepted-application triggers run as their owner, so they remain operational.
-- Legacy backend POST /workspace/:clubId/members must now be retired, not used.
REVOKE INSERT,UPDATE ON public.club_memberships FROM service_role;
REVOKE INSERT(membership_id,club_id,user_id,department_id,role,status,joined_at,left_at,created_at,updated_at),UPDATE(membership_id,club_id,user_id,department_id,role,status,joined_at,left_at,created_at,updated_at) ON public.club_memberships FROM service_role;
GRANT UPDATE(department_id,status,left_at) ON public.club_memberships TO service_role;


-- Deliver a bounded notification batch and optionally acknowledge its lease in ONE
-- transaction, so Supabase REST workers need no direct SQL connection to do this.
CREATE FUNCTION public.clubspace_deliver_notification_job(p_job uuid,p_claim uuid,p_notifications jsonb,p_finish boolean DEFAULT true) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inserted_count integer; BEGIN
 IF p_finish IS NULL OR jsonb_typeof(p_notifications) IS DISTINCT FROM 'array' OR jsonb_array_length(p_notifications)>1000 OR pg_column_size(p_notifications)>16777216 THEN RAISE EXCEPTION 'Expected bounded notification array and finish flag'; END IF;
 PERFORM 1 FROM public.notification_jobs WHERE job_id=p_job AND status='processing' AND claim_token=p_claim AND locked_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stale or expired job lease' USING ERRCODE='40001'; END IF;
 INSERT INTO public.notifications(recipient_id,actor_id,type,title,body,data,deduplication_key)
 SELECT x.recipient_id,x.actor_id,x.type,x.title,x.body,coalesce(x.data,'{}'::jsonb),x.deduplication_key
 FROM jsonb_to_recordset(p_notifications) x(recipient_id uuid,actor_id uuid,type text,title text,body text,data jsonb,deduplication_key text)
 ON CONFLICT(recipient_id,deduplication_key) DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 IF p_finish THEN PERFORM public.clubspace_finish_notification_job(p_job,p_claim); END IF;
 RETURN inserted_count; END $$;
REVOKE ALL ON FUNCTION public.clubspace_deliver_notification_job(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.clubspace_deliver_notification_job(uuid,uuid,jsonb,boolean) TO service_role;


-- Prevent a chair from bypassing private-channel access by flipping department
-- privacy directly. Metadata updates remain possible, privacy is a head-only RPC.
REVOKE UPDATE ON public.club_departments FROM service_role;
REVOKE UPDATE(department_id,club_id,name,description,is_management,is_private,status,created_at,updated_at) ON public.club_departments FROM service_role;
GRANT UPDATE(name,description,status) ON public.club_departments TO service_role;
CREATE TRIGGER zz_v2_department_version BEFORE UPDATE ON public.club_departments FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
CREATE FUNCTION public.clubspace_set_department_privacy(p_actor uuid,p_department uuid,p_is_private boolean,p_expected_updated_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE dep public.club_departments; old_private boolean; BEGIN
 IF p_is_private IS NULL OR p_expected_updated_at IS NULL THEN RAISE EXCEPTION 'Privacy flag and expected version required'; END IF;
 PERFORM clubspace_v2_private.require_head(p_actor,p_department);
 SELECT * INTO dep FROM public.club_departments WHERE department_id=p_department FOR UPDATE;
 IF dep.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Department changed; reload' USING ERRCODE='40001'; END IF;
 old_private:=dep.is_private;UPDATE public.club_departments SET is_private=p_is_private WHERE department_id=p_department;
 PERFORM clubspace_v2_private.audit(p_actor,dep.club_id,'department.privacy_changed','department',p_department,jsonb_build_object('old_private',old_private,'new_private',p_is_private));END $$;
REVOKE ALL ON FUNCTION public.clubspace_set_department_privacy(uuid,uuid,boolean,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.clubspace_set_department_privacy(uuid,uuid,boolean,timestamptz) TO service_role;

-- Cover foreign keys with a non-partial index when no suitable left prefix exists.
DO $$ DECLARE f record; cols text; idx text; BEGIN
 FOR f IN SELECT con.conrelid,con.conkey,cl.relname,con.oid AS constraint_oid FROM pg_constraint con JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace
 WHERE ns.nspname='public' AND con.contype='f' AND cl.relname IN('recruitment_campaigns','recruitment_departments','recruitment_questions','recruitment_applications','application_answers','application_reviews','interview_appointments','interview_panel_members','notification_jobs','notifications','club_change_requests','club_channels','channel_members','channel_messages','channel_read_states','audit_logs') LOOP
 IF NOT EXISTS(SELECT FROM pg_index i WHERE i.indrelid=f.conrelid AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND ARRAY(SELECT x.att FROM unnest(i.indkey) WITH ORDINALITY x(att,ord) WHERE x.ord<=cardinality(f.conkey) ORDER BY x.ord)=f.conkey) THEN
 SELECT string_agg(quote_ident(a.attname),',' ORDER BY x.ord) INTO cols FROM unnest(f.conkey) WITH ORDINALITY x(att,ord) JOIN pg_attribute a ON a.attrelid=f.conrelid AND a.attnum=x.att;
 idx:='v2_fk_'||left(f.relname,35)||'_'||substr(md5(f.relname||':'||cols),1,10);
 EXECUTE format('CREATE INDEX %I ON public.%I (%s)',idx,f.relname,cols);
 END IF;END LOOP;END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
