-- Synthetic test baseline, reconstructed from the supplied schema metadata.
-- Run ONLY in the disposable cluster created by recruitment-db.cjs.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA clubspace_private; CREATE SCHEMA clubspace_v2_private; CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE public.audit_logs(audit_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,actor_id uuid,club_id uuid,action text,entity_type text,entity_id uuid,change_data jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE public."users" (
 "user_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "email" text NOT NULL,
 "display_name" text NOT NULL,
 "avatar_url" text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "password_hash" text,
 "email_verified_at" timestamp with time zone,
 "role" text NOT NULL DEFAULT 'student'::text
);
CREATE TABLE public."student_profiles" (
 "user_id" uuid NOT NULL,
 "full_name" text,
 "student_code" text,
 "school_or_faculty" text,
 "major" text,
 "cohort" text,
 "phone" text,
 "bio" text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."clubs" (
 "club_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "name" text NOT NULL,
 "summary" text NOT NULL,
 "description" text NOT NULL,
 "mission" text,
 "logo_url" text,
 "cover_url" text,
 "organization_id" uuid,
 "contact_email" text,
 "contact_phone" text,
 "status" text NOT NULL DEFAULT 'pending'::text,
 "created_by" uuid NOT NULL,
 "reviewed_by" uuid,
 "reviewed_at" timestamp with time zone,
 "review_note" text,
 "published_at" timestamp with time zone,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."club_departments" (
 "department_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "club_id" uuid NOT NULL,
 "name" text NOT NULL,
 "description" text,
 "is_management" boolean NOT NULL DEFAULT false,
 "is_private" boolean NOT NULL DEFAULT false,
 "status" text NOT NULL DEFAULT 'active'::text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."club_memberships" (
 "membership_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "club_id" uuid NOT NULL,
 "user_id" uuid NOT NULL,
 "department_id" uuid NOT NULL,
 "role" text NOT NULL DEFAULT 'member'::text,
 "status" text NOT NULL DEFAULT 'active'::text,
 "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
 "left_at" timestamp with time zone,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."recruitment_campaigns" (
 "campaign_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "club_id" uuid NOT NULL,
 "title" text NOT NULL,
 "description" text NOT NULL,
 "cover_url" text,
 "application_opens_at" timestamp with time zone NOT NULL,
 "application_closes_at" timestamp with time zone NOT NULL,
 "status" text NOT NULL DEFAULT 'draft'::text,
 "created_by" uuid NOT NULL,
 "updated_by" uuid NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public."recruitment_departments" (
 "recruitment_department_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "campaign_id" uuid NOT NULL,
 "department_id" uuid NOT NULL,
 "description" text NOT NULL,
 "requirements" text,
 "target_quantity" integer,
 "created_by" uuid NOT NULL,
 "updated_by" uuid NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public."recruitment_questions" (
 "question_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "recruitment_department_id" uuid NOT NULL,
 "question_text" text NOT NULL,
 "help_text" text,
 "is_required" boolean NOT NULL DEFAULT true,
 "max_length" integer NOT NULL DEFAULT 5000,
 "sort_order" integer NOT NULL,
 "created_by" uuid NOT NULL,
 "updated_by" uuid NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public."recruitment_applications" (
 "application_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "campaign_id" uuid NOT NULL,
 "recruitment_department_id" uuid NOT NULL,
 "applicant_id" uuid NOT NULL,
 "status" text NOT NULL DEFAULT 'draft'::text,
 "profile_snapshot" jsonb,
 "submitted_at" timestamp with time zone,
 "withdrawn_at" timestamp with time zone,
 "decided_by" uuid,
 "decided_at" timestamp with time zone,
 "result_message" text,
 "admitted_membership_id" uuid,
 "updated_by" uuid NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public."application_answers" (
 "answer_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "application_id" uuid NOT NULL,
 "question_id" uuid NOT NULL,
 "answer_text" text NOT NULL,
 "updated_by" uuid NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public."notification_jobs" (
 "job_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "event_type" text NOT NULL,
 "entity_type" text NOT NULL,
 "entity_id" uuid NOT NULL,
 "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "deduplication_key" text NOT NULL,
 "run_at" timestamp with time zone NOT NULL DEFAULT now(),
 "status" text NOT NULL DEFAULT 'pending'::text,
 "attempt_count" integer NOT NULL DEFAULT 0,
 "claim_token" uuid,
 "locked_until" timestamp with time zone,
 "processed_at" timestamp with time zone,
 "last_error" text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public."notifications" (
 "notification_id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "recipient_id" uuid NOT NULL,
 "actor_id" uuid,
 "type" text NOT NULL,
 "title" text NOT NULL,
 "body" text NOT NULL,
 "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "deduplication_key" text NOT NULL,
 "read_at" timestamp with time zone,
 "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_pkey" PRIMARY KEY (club_id);
ALTER TABLE public."club_departments" ADD CONSTRAINT "club_departments_pkey" PRIMARY KEY (department_id);
ALTER TABLE public."club_memberships" ADD CONSTRAINT "club_memberships_pkey" PRIMARY KEY (membership_id);
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_pkey" PRIMARY KEY (campaign_id);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_pkey" PRIMARY KEY (recruitment_department_id);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_pkey" PRIMARY KEY (question_id);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_pkey" PRIMARY KEY (application_id);
ALTER TABLE public."application_answers" ADD CONSTRAINT "application_answers_pkey" PRIMARY KEY (answer_id);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_pkey" PRIMARY KEY (job_id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (notification_id);
ALTER TABLE public."users" ADD CONSTRAINT "users_email_key" UNIQUE (email);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_student_code_key" UNIQUE (student_code);
ALTER TABLE public."club_departments" ADD CONSTRAINT "club_departments_id_club_key" UNIQUE (department_id, club_id);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_campaign_id_department_id_key" UNIQUE (campaign_id, department_id);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_recruitment_department_id_campaign__key" UNIQUE (recruitment_department_id, campaign_id);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_recruitment_department_id_sort_order_key" UNIQUE (recruitment_department_id, sort_order);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_admitted_membership_id_key" UNIQUE (admitted_membership_id);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_campaign_id_applicant_id_key" UNIQUE (campaign_id, applicant_id);
ALTER TABLE public."application_answers" ADD CONSTRAINT "application_answers_application_id_question_id_key" UNIQUE (application_id, question_id);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_deduplication_key_key" UNIQUE (deduplication_key);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_recipient_id_deduplication_key_key" UNIQUE (recipient_id, deduplication_key);
ALTER TABLE public."users" ADD CONSTRAINT "users_role_check" CHECK (role = ANY (ARRAY['admin'::text, 'student'::text]));
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_bio_check" CHECK (char_length(bio) <= 2000);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_cohort_check" CHECK (char_length(cohort) <= 40);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_full_name_check" CHECK (full_name IS NULL OR full_name ~ '[^[:space:]]'::text AND char_length(full_name) <= 160);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_major_check" CHECK (char_length(major) <= 200);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_phone_check" CHECK (char_length(phone) <= 32);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_school_or_faculty_check" CHECK (char_length(school_or_faculty) <= 200);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_student_code_check" CHECK (student_code IS NULL OR student_code ~ '[^[:space:]]'::text AND char_length(student_code) <= 32);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_contact_email_check" CHECK (char_length(contact_email) <= 320);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_contact_phone_check" CHECK (char_length(contact_phone) <= 32);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_cover_url_check" CHECK (char_length(cover_url) <= 2048);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_description_check" CHECK (description ~ '[^[:space:]]'::text AND char_length(description) <= 50000);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_logo_url_check" CHECK (char_length(logo_url) <= 2048);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_mission_check" CHECK (char_length(mission) <= 5000);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_name_check" CHECK (name ~ '[^[:space:]]'::text AND char_length(name) <= 200);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_publication_check" CHECK (status <> 'published'::text OR reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND published_at IS NOT NULL);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_review_note_check" CHECK (char_length(review_note) <= 5000);
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'published'::text, 'rejected'::text, 'suspended'::text, 'archived'::text]));
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_summary_check" CHECK (summary ~ '[^[:space:]]'::text AND char_length(summary) <= 500);
ALTER TABLE public."club_departments" ADD CONSTRAINT "club_departments_description_check" CHECK (char_length(description) <= 5000);
ALTER TABLE public."club_departments" ADD CONSTRAINT "club_departments_name_check" CHECK (name ~ '[^[:space:]]'::text AND char_length(name) <= 160);
ALTER TABLE public."club_departments" ADD CONSTRAINT "club_departments_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));
ALTER TABLE public."club_memberships" ADD CONSTRAINT "club_memberships_dates_check" CHECK (status = 'active'::text AND left_at IS NULL OR (status = ANY (ARRAY['left'::text, 'removed'::text])) AND left_at IS NOT NULL AND left_at >= joined_at);
ALTER TABLE public."club_memberships" ADD CONSTRAINT "club_memberships_role_v2_check" CHECK (role = ANY (ARRAY['chairperson'::text, 'head'::text, 'member'::text]));
ALTER TABLE public."club_memberships" ADD CONSTRAINT "club_memberships_status_check" CHECK (status = ANY (ARRAY['active'::text, 'left'::text, 'removed'::text]));
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_check" CHECK (application_closes_at > application_opens_at);
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_cover_url_check" CHECK (cover_url IS NULL OR cover_url ~ '^https?://'::text AND char_length(cover_url) <= 2048);
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_description_check" CHECK (description ~ '[^[:space:]]'::text AND char_length(description) <= 50000);
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'completed'::text, 'cancelled'::text]));
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_title_check" CHECK (title ~ '[^[:space:]]'::text AND char_length(title) <= 200);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_description_check" CHECK (description ~ '[^[:space:]]'::text AND char_length(description) <= 20000);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_requirements_check" CHECK (char_length(requirements) <= 20000);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_target_quantity_check" CHECK (target_quantity > 0);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_help_text_check" CHECK (char_length(help_text) <= 2000);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_max_length_check" CHECK (max_length >= 1 AND max_length <= 10000);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_question_text_check" CHECK (question_text ~ '[^[:space:]]'::text AND char_length(question_text) <= 2000);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_sort_order_check" CHECK (sort_order > 0);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_check" CHECK ((status = ANY (ARRAY['draft'::text, 'withdrawn'::text])) OR submitted_at IS NOT NULL);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_check1" CHECK ((status = ANY (ARRAY['accepted'::text, 'rejected'::text])) AND decided_by IS NOT NULL AND decided_at IS NOT NULL OR (status <> ALL (ARRAY['accepted'::text, 'rejected'::text])) AND decided_by IS NULL AND decided_at IS NULL);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_check2" CHECK ((submitted_at IS NULL) = (profile_snapshot IS NULL));
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_check3" CHECK ((status = ANY (ARRAY['accepted'::text, 'rejected'::text])) AND result_message IS NOT NULL AND result_message ~ '[^[:space:]]'::text OR (status <> ALL (ARRAY['accepted'::text, 'rejected'::text])) AND result_message IS NULL);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_check4" CHECK ((status = 'accepted'::text) = (admitted_membership_id IS NOT NULL));
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_check5" CHECK ((status = 'withdrawn'::text) = (withdrawn_at IS NOT NULL));
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_profile_snapshot_check" CHECK (profile_snapshot IS NULL OR jsonb_typeof(profile_snapshot) = 'object'::text AND pg_column_size(profile_snapshot) <= 16384);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_result_message_check" CHECK (char_length(result_message) <= 5000);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'interviewing'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text]));
ALTER TABLE public."application_answers" ADD CONSTRAINT "application_answers_answer_text_check" CHECK (char_length(answer_text) <= 10000);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_attempt_count_check" CHECK (attempt_count >= 0);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_check" CHECK (status = 'processing'::text AND claim_token IS NOT NULL AND locked_until IS NOT NULL OR status <> 'processing'::text AND claim_token IS NULL AND locked_until IS NULL);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_check1" CHECK (status <> 'completed'::text OR processed_at IS NOT NULL);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_deduplication_key_check" CHECK (char_length(deduplication_key) >= 1 AND char_length(deduplication_key) <= 500);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_entity_type_check" CHECK (entity_type = ANY (ARRAY['club'::text, 'campaign'::text, 'post'::text, 'activity'::text, 'registration'::text, 'application'::text, 'interview'::text, 'club_change'::text, 'channel_member'::text]));
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_event_type_check" CHECK (event_type ~ '^[a-z][a-z0-9_.]{1,99}$'::text);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_last_error_check" CHECK (char_length(last_error) <= 2000);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_payload_check" CHECK (jsonb_typeof(payload) = 'object'::text AND pg_column_size(payload) <= 32768);
ALTER TABLE public."notification_jobs" ADD CONSTRAINT "notification_jobs_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'cancelled'::text, 'failed'::text]));
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_body_check" CHECK (char_length(body) <= 5000);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_check" CHECK (read_at IS NULL OR read_at >= created_at);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_data_check" CHECK (jsonb_typeof(data) = 'object'::text AND pg_column_size(data) <= 16384);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_deduplication_key_check" CHECK (char_length(deduplication_key) >= 1 AND char_length(deduplication_key) <= 500);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_title_check" CHECK (title ~ '[^[:space:]]'::text AND char_length(title) <= 200);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_type_check" CHECK (type ~ '^[a-z][a-z0-9_.]{1,99}$'::text);
ALTER TABLE public."student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT;
ALTER TABLE public."clubs" ADD CONSTRAINT "clubs_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE RESTRICT;
ALTER TABLE public."club_departments" ADD CONSTRAINT "club_departments_club_id_fkey" FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE RESTRICT;
ALTER TABLE public."club_memberships" ADD CONSTRAINT "club_memberships_club_id_fkey" FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE RESTRICT;
ALTER TABLE public."club_memberships" ADD CONSTRAINT "club_memberships_department_fkey" FOREIGN KEY (department_id, club_id) REFERENCES club_departments(department_id, club_id) ON DELETE RESTRICT;
ALTER TABLE public."club_memberships" ADD CONSTRAINT "club_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT;
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_club_id_fkey" FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE RESTRICT;
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(user_id);
ALTER TABLE public."recruitment_campaigns" ADD CONSTRAINT "recruitment_campaigns_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(user_id);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES recruitment_campaigns(campaign_id);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(user_id);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_department_id_fkey" FOREIGN KEY (department_id) REFERENCES club_departments(department_id);
ALTER TABLE public."recruitment_departments" ADD CONSTRAINT "recruitment_departments_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(user_id);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(user_id);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_recruitment_department_id_fkey" FOREIGN KEY (recruitment_department_id) REFERENCES recruitment_departments(recruitment_department_id);
ALTER TABLE public."recruitment_questions" ADD CONSTRAINT "recruitment_questions_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(user_id);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_admitted_membership_id_fkey" FOREIGN KEY (admitted_membership_id) REFERENCES club_memberships(membership_id);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_applicant_id_fkey" FOREIGN KEY (applicant_id) REFERENCES users(user_id);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES recruitment_campaigns(campaign_id);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_decided_by_fkey" FOREIGN KEY (decided_by) REFERENCES users(user_id);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_recruitment_department_id_campaig_fkey" FOREIGN KEY (recruitment_department_id, campaign_id) REFERENCES recruitment_departments(recruitment_department_id, campaign_id);
ALTER TABLE public."recruitment_applications" ADD CONSTRAINT "recruitment_applications_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(user_id);
ALTER TABLE public."application_answers" ADD CONSTRAINT "application_answers_application_id_fkey" FOREIGN KEY (application_id) REFERENCES recruitment_applications(application_id);
ALTER TABLE public."application_answers" ADD CONSTRAINT "application_answers_question_id_fkey" FOREIGN KEY (question_id) REFERENCES recruitment_questions(question_id);
ALTER TABLE public."application_answers" ADD CONSTRAINT "application_answers_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES users(user_id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES users(user_id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES users(user_id);
CREATE UNIQUE INDEX users_email_lower_uidx ON public.users USING btree (lower(email));
CREATE INDEX clubs_created_by_idx ON public.clubs USING btree (created_by);
CREATE INDEX clubs_organization_id_idx ON public.clubs USING btree (organization_id);
CREATE INDEX clubs_reviewed_by_idx ON public.clubs USING btree (reviewed_by);
CREATE INDEX clubs_status_created_at_idx ON public.clubs USING btree (status, created_at DESC);
CREATE UNIQUE INDEX club_departments_name_key ON public.club_departments USING btree (club_id, lower(btrim(name)));
CREATE UNIQUE INDEX club_departments_one_management ON public.club_departments USING btree (club_id) WHERE is_management;
CREATE INDEX club_memberships_active_heads_idx ON public.club_memberships USING btree (department_id, user_id) WHERE ((status = 'active'::text) AND (role = 'head'::text));
CREATE INDEX club_memberships_department_club_idx ON public.club_memberships USING btree (department_id, club_id);
CREATE UNIQUE INDEX club_memberships_one_active_chair ON public.club_memberships USING btree (club_id) WHERE ((role = 'chairperson'::text) AND (status = 'active'::text));
CREATE UNIQUE INDEX club_memberships_one_active_user ON public.club_memberships USING btree (club_id, user_id) WHERE (status = 'active'::text);
CREATE INDEX club_memberships_user_id_idx ON public.club_memberships USING btree (user_id);
CREATE INDEX recruitment_campaigns_club_time_idx ON public.recruitment_campaigns USING btree (club_id, created_at DESC, campaign_id);
CREATE INDEX recruitment_campaigns_open_idx ON public.recruitment_campaigns USING btree (application_closes_at) WHERE (status = 'open'::text);
CREATE INDEX v2_fk_recruitment_campaigns_78c6b0ac38 ON public.recruitment_campaigns USING btree (updated_by);
CREATE INDEX v2_fk_recruitment_campaigns_a1d79346f5 ON public.recruitment_campaigns USING btree (created_by);
CREATE INDEX recruitment_departments_department_idx ON public.recruitment_departments USING btree (department_id);
CREATE INDEX v2_fk_recruitment_departments_3261e320c2 ON public.recruitment_departments USING btree (created_by);
CREATE INDEX v2_fk_recruitment_departments_a662060778 ON public.recruitment_departments USING btree (updated_by);
CREATE INDEX v2_fk_recruitment_questions_a6a04240d2 ON public.recruitment_questions USING btree (updated_by);
CREATE INDEX v2_fk_recruitment_questions_d9838002f5 ON public.recruitment_questions USING btree (created_by);
CREATE INDEX recruitment_applications_applicant_idx ON public.recruitment_applications USING btree (applicant_id, created_at DESC, application_id);
CREATE INDEX recruitment_applications_department_queue_idx ON public.recruitment_applications USING btree (recruitment_department_id, status, submitted_at, application_id);
CREATE INDEX v2_fk_recruitment_applications_26575ada11 ON public.recruitment_applications USING btree (updated_by);
CREATE INDEX v2_fk_recruitment_applications_54a4cd10c8 ON public.recruitment_applications USING btree (recruitment_department_id, campaign_id);
CREATE INDEX v2_fk_recruitment_applications_e9c3849371 ON public.recruitment_applications USING btree (decided_by);
CREATE INDEX application_answers_question_idx ON public.application_answers USING btree (question_id);
CREATE INDEX v2_fk_application_answers_36af5e1722 ON public.application_answers USING btree (updated_by);
CREATE INDEX notification_jobs_due_idx ON public.notification_jobs USING btree (run_at, job_id) WHERE (status = 'pending'::text);
CREATE INDEX notification_jobs_entity_idx ON public.notification_jobs USING btree (entity_type, entity_id);
CREATE INDEX notification_jobs_lease_idx ON public.notification_jobs USING btree (locked_until) WHERE (status = 'processing'::text);
CREATE INDEX notifications_actor_idx ON public.notifications USING btree (actor_id) WHERE (actor_id IS NOT NULL);
CREATE INDEX notifications_recipient_history_idx ON public.notifications USING btree (recipient_id, created_at DESC, notification_id DESC);
CREATE INDEX notifications_unread_idx ON public.notifications USING btree (recipient_id, created_at DESC) WHERE (read_at IS NULL);
CREATE INDEX v2_fk_notifications_ff78a34f7f ON public.notifications USING btree (actor_id);
CREATE OR REPLACE FUNCTION clubspace_v2_private.touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
 IF TG_OP='UPDATE' THEN NEW.updated_at:=greatest(clock_timestamp(),OLD.updated_at+interval '1 microsecond'); END IF; RETURN NEW; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.require_member(p_user uuid, p_club uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m uuid; BEGIN
 SELECT x.membership_id INTO m FROM public.club_memberships x JOIN public.clubs c ON c.club_id=x.club_id
 JOIN public.club_departments d ON d.department_id=x.department_id
 WHERE x.user_id=p_user AND x.club_id=p_club AND x.status='active' AND c.status='published' AND d.status='active' FOR SHARE OF x,c,d;
 IF m IS NULL THEN RAISE EXCEPTION 'Active membership in a published club required' USING ERRCODE='42501'; END IF; RETURN m; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.require_chair(p_user uuid, p_club uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m uuid; BEGIN m:=clubspace_v2_private.require_member(p_user,p_club);
 IF NOT EXISTS(SELECT FROM public.club_memberships WHERE membership_id=m AND role='chairperson') THEN RAISE EXCEPTION 'Current chairperson required' USING ERRCODE='42501'; END IF; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.require_head(p_user uuid, p_department uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m uuid; BEGIN
 SELECT x.membership_id INTO m FROM public.club_memberships x JOIN public.club_departments d ON d.department_id=x.department_id JOIN public.clubs c ON c.club_id=x.club_id
 WHERE x.user_id=p_user AND x.department_id=p_department AND x.role='head' AND x.status='active' AND d.status='active' AND c.status='published' FOR SHARE OF x,d,c;
 IF m IS NULL THEN RAISE EXCEPTION 'Only the active head of this department may perform this action' USING ERRCODE='42501'; END IF; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.config_actor(p_user uuid, p_department uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c uuid; BEGIN SELECT club_id INTO c FROM public.club_departments WHERE department_id=p_department;
 IF EXISTS(SELECT FROM public.club_memberships WHERE user_id=p_user AND club_id=c AND role='chairperson' AND status='active') THEN
  PERFORM clubspace_v2_private.require_chair(p_user,c);
 ELSE PERFORM clubspace_v2_private.require_head(p_user,p_department); END IF; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.audit(p_actor uuid, p_club uuid, p_action text, p_type text, p_id uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 INSERT INTO public.audit_logs(actor_id,club_id,action,entity_type,entity_id,change_data) VALUES(p_actor,p_club,p_action,p_type,p_id,p_data) $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.enqueue(p_event text, p_type text, p_id uuid, p_key text, p_payload jsonb DEFAULT '{}'::jsonb, p_at timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 INSERT INTO public.notification_jobs(event_type,entity_type,entity_id,deduplication_key,payload,run_at) VALUES(p_event,p_type,p_id,p_key,p_payload,p_at) ON CONFLICT(deduplication_key) DO NOTHING $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.domain_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 END IF;RETURN NEW; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_campaign()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN
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
 IF NEW.status='completed' AND EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=NEW.campaign_id AND status IN('submitted','interviewing')) THEN RAISE EXCEPTION 'Resolve submitted applications before completing campaign'; END IF; RETURN NEW; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_recruit_config()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 IF TG_OP='INSERT' AND NEW.created_by<>NEW.updated_by THEN RAISE EXCEPTION 'Creator must equal server actor'; END IF; RETURN NEW; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 RETURN NEW; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_answer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE app public.recruitment_applications; q public.recruitment_questions; cid uuid; BEGIN
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id=NEW.application_id FOR UPDATE;
 IF app.status<>'draft' OR NEW.updated_by<>app.applicant_id THEN RAISE EXCEPTION 'Only applicant edits answers in draft'; END IF;
 SELECT * INTO q FROM public.recruitment_questions WHERE question_id=NEW.question_id;
 IF q.recruitment_department_id IS DISTINCT FROM app.recruitment_department_id OR char_length(NEW.answer_text)>q.max_length THEN RAISE EXCEPTION 'Answer does not match question or length limit'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.answer_id,NEW.application_id,NEW.question_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.answer_id,OLD.application_id,OLD.question_id,OLD.created_at) THEN RAISE EXCEPTION 'Answer identity immutable'; END IF;
 PERFORM 1 FROM public.recruitment_campaigns WHERE campaign_id=app.campaign_id AND status='open' AND now()>=application_opens_at AND now()<application_closes_at FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application window closed'; END IF; RETURN NEW; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_head_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ BEGIN
 IF NEW.role='head' AND NOT EXISTS(SELECT FROM public.club_departments WHERE department_id=NEW.department_id AND club_id=NEW.club_id) THEN RAISE EXCEPTION 'Head must belong to a department of the same club'; END IF; RETURN NEW; END $function$
;
CREATE OR REPLACE FUNCTION clubspace_private.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION clubspace_private.guard_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.club_id IS DISTINCT FROM OLD.club_id THEN RAISE EXCEPTION 'A department cannot move to another club.'; END IF;
    IF OLD.is_management AND (NOT NEW.is_management OR NEW.status <> 'active') THEN
      RAISE EXCEPTION 'The management department must remain active and retain its type.';
    END IF;
  END IF;
  IF NEW.status = 'inactive' AND EXISTS (
    SELECT 1 FROM public.club_memberships WHERE department_id = NEW.department_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'Move active members before deactivating their department.'; END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION clubspace_private.guard_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE dept public.club_departments%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.club_id IS DISTINCT FROM OLD.club_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Membership user and club are immutable; create a new history row instead.';
  END IF;
  SELECT * INTO dept FROM public.club_departments
    WHERE department_id = NEW.department_id AND club_id = NEW.club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Department must belong to the membership club.'; END IF;
  IF NEW.status = 'active' AND dept.status <> 'active' THEN RAISE EXCEPTION 'Active members require an active department.'; END IF;
  IF NEW.role = 'chairperson' AND NOT dept.is_management THEN RAISE EXCEPTION 'Chairperson must belong to the management department.'; END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION clubspace_private.check_club_structure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE target_club uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN target_club := OLD.club_id; ELSE target_club := NEW.club_id; END IF;
  PERFORM 1 FROM public.clubs WHERE club_id = target_club FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM public.club_departments WHERE club_id = target_club AND is_management AND status = 'active') <> 1 THEN
    RAISE EXCEPTION 'Each club must have exactly one active management department.';
  END IF;
  IF (SELECT count(*) FROM public.club_memberships WHERE club_id = target_club AND role = 'chairperson' AND status = 'active') <> 1 THEN
    RAISE EXCEPTION 'Each club must have exactly one active chairperson.';
  END IF;
  RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.clubspace_clear_draft_answers(p_actor uuid, p_application uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN
 PERFORM 1 FROM public.recruitment_applications WHERE application_id=p_application AND applicant_id=p_actor AND status='draft' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Own draft required' USING ERRCODE='42501'; END IF;
 DELETE FROM public.application_answers WHERE application_id=p_application; END $function$
;
CREATE OR REPLACE FUNCTION public.clubspace_transition_application(p_actor uuid, p_application uuid, p_expected_updated_at timestamp with time zone, p_status text, p_message text DEFAULT NULL::text)
 RETURNS recruitment_applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.recruitment_applications; BEGIN
 UPDATE public.recruitment_applications SET status=p_status,result_message=p_message,updated_by=p_actor WHERE application_id=p_application AND updated_at=p_expected_updated_at RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application changed; reload before acting' USING ERRCODE='40001'; END IF; RETURN r; END $function$
;
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
GRANT DELETE ON public."users" TO service_role;
GRANT INSERT ON public."users" TO service_role;
GRANT REFERENCES ON public."users" TO service_role;
GRANT SELECT ON public."users" TO service_role;
GRANT TRIGGER ON public."users" TO service_role;
GRANT TRUNCATE ON public."users" TO service_role;
GRANT UPDATE ON public."users" TO service_role;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION clubspace_private.touch_updated_at();
ALTER TABLE public."student_profiles" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."student_profiles" TO service_role;
GRANT SELECT ON public."student_profiles" TO service_role;
GRANT UPDATE ON public."student_profiles" TO service_role;
CREATE CONSTRAINT TRIGGER clubs_structure_check AFTER INSERT OR UPDATE ON clubs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION clubspace_private.check_club_structure();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION clubspace_private.touch_updated_at();
CREATE TRIGGER v2_domain_events AFTER INSERT OR UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.domain_events();
ALTER TABLE public."clubs" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."clubs" TO service_role;
GRANT SELECT ON public."clubs" TO service_role;
GRANT UPDATE ON public."clubs" TO service_role;
CREATE TRIGGER club_departments_guard BEFORE INSERT OR UPDATE ON club_departments FOR EACH ROW EXECUTE FUNCTION clubspace_private.guard_department();
CREATE CONSTRAINT TRIGGER club_departments_structure_check AFTER INSERT OR DELETE OR UPDATE ON club_departments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION clubspace_private.check_club_structure();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON club_departments FOR EACH ROW EXECUTE FUNCTION clubspace_private.touch_updated_at();
ALTER TABLE public."club_departments" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."club_departments" TO service_role;
GRANT SELECT ON public."club_departments" TO service_role;
CREATE TRIGGER club_memberships_guard BEFORE INSERT OR UPDATE ON club_memberships FOR EACH ROW EXECUTE FUNCTION clubspace_private.guard_membership();
CREATE CONSTRAINT TRIGGER club_memberships_structure_check AFTER INSERT OR DELETE OR UPDATE ON club_memberships DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION clubspace_private.check_club_structure();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON club_memberships FOR EACH ROW EXECUTE FUNCTION clubspace_private.touch_updated_at();
CREATE TRIGGER v2_head_membership BEFORE INSERT OR UPDATE ON club_memberships FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_head_membership();
ALTER TABLE public."club_memberships" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."club_memberships" TO service_role;
GRANT SELECT ON public."club_memberships" TO service_role;
CREATE TRIGGER a_v2_campaign BEFORE INSERT OR UPDATE ON recruitment_campaigns FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_campaign();
CREATE TRIGGER v2_domain_events AFTER INSERT OR UPDATE ON recruitment_campaigns FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.domain_events();
CREATE TRIGGER z_v2_touch BEFORE UPDATE ON recruitment_campaigns FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
ALTER TABLE public."recruitment_campaigns" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."recruitment_campaigns" TO service_role;
GRANT SELECT ON public."recruitment_campaigns" TO service_role;
GRANT UPDATE ON public."recruitment_campaigns" TO service_role;
CREATE TRIGGER a_v2_recruit_config BEFORE INSERT OR UPDATE ON recruitment_departments FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_recruit_config();
CREATE TRIGGER z_v2_touch BEFORE UPDATE ON recruitment_departments FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
ALTER TABLE public."recruitment_departments" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."recruitment_departments" TO service_role;
GRANT SELECT ON public."recruitment_departments" TO service_role;
GRANT UPDATE ON public."recruitment_departments" TO service_role;
CREATE TRIGGER a_v2_question BEFORE INSERT OR UPDATE ON recruitment_questions FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_recruit_config();
CREATE TRIGGER z_v2_touch BEFORE UPDATE ON recruitment_questions FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
ALTER TABLE public."recruitment_questions" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."recruitment_questions" TO service_role;
GRANT SELECT ON public."recruitment_questions" TO service_role;
GRANT UPDATE ON public."recruitment_questions" TO service_role;
CREATE TRIGGER a_v2_application BEFORE INSERT OR UPDATE ON recruitment_applications FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_application();
CREATE TRIGGER v2_domain_events AFTER INSERT OR UPDATE ON recruitment_applications FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.domain_events();
CREATE TRIGGER z_v2_touch BEFORE UPDATE ON recruitment_applications FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
ALTER TABLE public."recruitment_applications" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."recruitment_applications" TO service_role;
GRANT SELECT ON public."recruitment_applications" TO service_role;
GRANT UPDATE ON public."recruitment_applications" TO service_role;
CREATE TRIGGER a_v2_answer BEFORE INSERT OR UPDATE ON application_answers FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.guard_answer();
CREATE TRIGGER z_v2_touch BEFORE UPDATE ON application_answers FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
ALTER TABLE public."application_answers" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."application_answers" TO service_role;
GRANT SELECT ON public."application_answers" TO service_role;
GRANT UPDATE ON public."application_answers" TO service_role;
CREATE TRIGGER z_v2_touch BEFORE UPDATE ON notification_jobs FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.touch();
ALTER TABLE public."notification_jobs" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public."notification_jobs" TO service_role;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public."notifications" TO service_role;
GRANT SELECT ON public."notifications" TO service_role;
CREATE VIEW public.public_recruitment_campaigns AS  SELECT r.campaign_id,
    r.club_id,
    c.name AS club_name,
    c.logo_url AS club_logo_url,
    r.title,
    r.description,
    r.cover_url,
    r.application_opens_at,
    r.application_closes_at,
    r.status,
    r.created_at,
    r.updated_at
   FROM recruitment_campaigns r
     JOIN clubs c USING (club_id)
  WHERE c.status = 'published'::text AND (r.status = ANY (ARRAY['open'::text, 'closed'::text, 'completed'::text]));;
REVOKE ALL ON FUNCTION public.clubspace_clear_draft_answers(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clubspace_clear_draft_answers(uuid,uuid) TO service_role;

