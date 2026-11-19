-- Recruitment phase 1. Based on the schema exported on 2026-11-19.
-- Apply ONCE to a development database, after reviewing/backing up that database.
-- No production execution is performed by the agent. Everything is transactional.
BEGIN;

ALTER TABLE public.recruitment_campaigns
  ADD COLUMN summary text CHECK (char_length(summary) <= 500),
  ADD COLUMN benefits text CHECK (char_length(benefits) <= 20000),
  ADD COLUMN contact_email text CHECK (char_length(contact_email) <= 320),
  ADD COLUMN contact_phone text CHECK (char_length(contact_phone) <= 32),
  ADD COLUMN published_at timestamptz,
  ADD COLUMN deleted_at timestamptz;

CREATE TABLE public.recruitment_form_versions (
  form_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruitment_department_id uuid NOT NULL REFERENCES public.recruitment_departments(recruitment_department_id),
  version_number integer NOT NULL CHECK (version_number > 0),
  created_by uuid NOT NULL REFERENCES public.users(user_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sealed_at timestamptz,
  UNIQUE (recruitment_department_id, version_number),
  UNIQUE (form_version_id, recruitment_department_id)
);
ALTER TABLE public.recruitment_departments
  ADD COLUMN current_form_version_id uuid REFERENCES public.recruitment_form_versions(form_version_id);
ALTER TABLE public.recruitment_questions
  ADD COLUMN form_version_id uuid,
  ADD COLUMN field_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN question_type text NOT NULL DEFAULT 'paragraph'
    CHECK (question_type IN ('short_text','paragraph','single_choice','checkboxes','dropdown','number','email','phone','date','file','rating')),
  ADD COLUMN options jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(options)='array' AND pg_column_size(options)<=65536),
  ADD COLUMN validation jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(validation)='object' AND pg_column_size(validation)<=4096),
  ADD COLUMN profile_field text CHECK (profile_field IN ('full_name','student_code','email','phone','school_or_faculty','major','cohort'));
ALTER TABLE public.recruitment_applications
  ADD COLUMN form_version_id uuid,
  ADD COLUMN admitted_department_id uuid REFERENCES public.club_departments(department_id);
ALTER TABLE public.application_answers
  ADD COLUMN answer_value jsonb;

-- Existing submitted/terminal rows must retain their original question snapshot.
-- Disable ONLY the named row guards while backfilling, under this transaction's
-- table locks; re-enable before commit. All other guards/events remain installed.
ALTER TABLE public.recruitment_questions DISABLE TRIGGER a_v2_question;
ALTER TABLE public.recruitment_departments DISABLE TRIGGER a_v2_recruit_config;
ALTER TABLE public.recruitment_applications DISABLE TRIGGER a_v2_application;
ALTER TABLE public.application_answers DISABLE TRIGGER a_v2_answer;
INSERT INTO public.recruitment_form_versions(recruitment_department_id,version_number,created_by,sealed_at)
  SELECT recruitment_department_id,1,created_by,clock_timestamp() FROM public.recruitment_departments;
UPDATE public.recruitment_departments d SET current_form_version_id=v.form_version_id
  FROM public.recruitment_form_versions v WHERE v.recruitment_department_id=d.recruitment_department_id;
UPDATE public.recruitment_questions q SET form_version_id=d.current_form_version_id,
  field_id=q.question_id,validation=jsonb_build_object('max_length',q.max_length)
  FROM public.recruitment_departments d WHERE d.recruitment_department_id=q.recruitment_department_id;
UPDATE public.recruitment_applications a SET form_version_id=d.current_form_version_id
  FROM public.recruitment_departments d WHERE d.recruitment_department_id=a.recruitment_department_id;
UPDATE public.recruitment_applications a SET admitted_department_id=m.department_id
  FROM public.club_memberships m WHERE m.membership_id=a.admitted_membership_id;
UPDATE public.application_answers SET answer_value=to_jsonb(answer_text);
ALTER TABLE public.recruitment_questions ENABLE TRIGGER a_v2_question;
ALTER TABLE public.recruitment_departments ENABLE TRIGGER a_v2_recruit_config;
ALTER TABLE public.recruitment_applications ENABLE TRIGGER a_v2_application;
ALTER TABLE public.application_answers ENABLE TRIGGER a_v2_answer;

ALTER TABLE public.recruitment_questions ALTER COLUMN form_version_id SET NOT NULL;
ALTER TABLE public.recruitment_applications ALTER COLUMN form_version_id SET NOT NULL;
ALTER TABLE public.application_answers ALTER COLUMN answer_value SET NOT NULL;
ALTER TABLE public.application_answers ADD CONSTRAINT application_answers_value_size CHECK(pg_column_size(answer_value)<=65536);
ALTER TABLE public.recruitment_questions DROP CONSTRAINT recruitment_questions_recruitment_department_id_sort_order_key;
ALTER TABLE public.recruitment_questions
  ADD UNIQUE(form_version_id,sort_order),
  ADD UNIQUE(form_version_id,field_id),
  ADD FOREIGN KEY(form_version_id,recruitment_department_id)
    REFERENCES public.recruitment_form_versions(form_version_id,recruitment_department_id);
ALTER TABLE public.recruitment_applications
  ADD FOREIGN KEY(form_version_id,recruitment_department_id)
    REFERENCES public.recruitment_form_versions(form_version_id,recruitment_department_id);
CREATE INDEX recruitment_campaign_queue_idx ON public.recruitment_applications(campaign_id,status,submitted_at DESC,application_id);
CREATE INDEX recruitment_applications_version_idx ON public.recruitment_applications(form_version_id);
CREATE INDEX recruitment_versions_creator_idx ON public.recruitment_form_versions(created_by);
CREATE INDEX recruitment_admitted_department_idx ON public.recruitment_applications(admitted_department_id);
CREATE INDEX recruitment_departments_form_idx ON public.recruitment_departments(current_form_version_id);

CREATE TABLE public.recruitment_files (
  file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.recruitment_campaigns(campaign_id),
  uploaded_by uuid NOT NULL REFERENCES public.users(user_id),
  question_id uuid REFERENCES public.recruitment_questions(question_id),
  application_id uuid REFERENCES public.recruitment_applications(application_id),
  purpose text NOT NULL CHECK(purpose IN('cover','answer')),
  bucket text NOT NULL CHECK(bucket IN('recruitment-covers','recruitment-attachments')),
  object_path text NOT NULL,
  file_name text NOT NULL CHECK(char_length(file_name) BETWEEN 1 AND 200),
  mime_type text NOT NULL CHECK(mime_type IN('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),
  state text NOT NULL DEFAULT 'staged' CHECK(state IN('staged','attached','deleting')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '2 hours'),
  UNIQUE(bucket,object_path),
  CHECK((purpose='cover' AND bucket='recruitment-covers' AND question_id IS NULL AND application_id IS NULL AND mime_type<>'application/pdf')
    OR (purpose='answer' AND bucket='recruitment-attachments' AND question_id IS NOT NULL)),
  CHECK(application_id IS NULL OR (purpose='answer' AND state='attached'))
);
CREATE INDEX recruitment_files_cleanup_idx ON public.recruitment_files(expires_at) WHERE state IN('staged','deleting');
CREATE INDEX recruitment_files_campaign_idx ON public.recruitment_files(campaign_id);
CREATE INDEX recruitment_files_owner_idx ON public.recruitment_files(uploaded_by);
CREATE INDEX recruitment_files_question_idx ON public.recruitment_files(question_id);
CREATE INDEX recruitment_files_application_idx ON public.recruitment_files(application_id);

ALTER TABLE public.recruitment_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recruitment_form_versions,public.recruitment_files FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.recruitment_form_versions TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.recruitment_files TO service_role;

CREATE OR REPLACE FUNCTION clubspace_v2_private.validate_recruitment_answer(p_question uuid,p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.recruitment_questions; val text; num numeric; v jsonb; count_values integer;
BEGIN
 SELECT * INTO STRICT q FROM public.recruitment_questions WHERE question_id=p_question;
 IF p_value IS NULL OR p_value='null'::jsonb OR p_value='""'::jsonb OR p_value='[]'::jsonb
   OR (jsonb_typeof(p_value)='string' AND btrim(p_value#>>'{}')='') THEN
  IF q.is_required THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END IF; RETURN;
 END IF;
 IF q.question_type IN('number','rating') THEN
  IF jsonb_typeof(p_value)<>'number' THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END IF;
  num:=(p_value#>>'{}')::numeric;
  IF (q.question_type='rating' AND (num<>trunc(num) OR num<1 OR num>5))
    OR (q.validation ? 'min' AND num<(q.validation->>'min')::numeric)
    OR (q.validation ? 'max' AND num>(q.validation->>'max')::numeric) THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END IF;
 ELSIF q.question_type IN('single_choice','dropdown','checkboxes') THEN
  IF q.question_type<>'checkboxes' THEN
   IF jsonb_typeof(p_value)<>'string' THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END IF;
   v:=jsonb_build_array(p_value);
  ELSE
   IF jsonb_typeof(p_value)<>'array' THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END IF; v:=p_value;
  END IF;
  SELECT count(DISTINCT x) INTO count_values FROM jsonb_array_elements(v) x;
  IF count_values<>jsonb_array_length(v) OR EXISTS(
   SELECT FROM jsonb_array_elements(v) x WHERE jsonb_typeof(x)<>'string'
    OR NOT EXISTS(SELECT FROM jsonb_array_elements(q.options) o WHERE o->>'option_id'=x#>>'{}')
  ) THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END IF;
 ELSIF q.question_type='file' THEN
  IF jsonb_typeof(p_value)<>'array' THEN RAISE EXCEPTION 'INVALID_FILE' USING ERRCODE='22023'; END IF;
  SELECT count(DISTINCT x) INTO count_values FROM jsonb_array_elements(p_value) x;
  IF count_values<>jsonb_array_length(p_value) OR count_values>coalesce((q.validation->>'max_files')::integer,1)
    OR EXISTS(SELECT FROM jsonb_array_elements(p_value) x WHERE jsonb_typeof(x)<>'string'
      OR (x#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    THEN RAISE EXCEPTION 'INVALID_FILE' USING ERRCODE='22023'; END IF;
 ELSE
  IF jsonb_typeof(p_value)<>'string' THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END IF;
  val:=p_value#>>'{}';
  IF char_length(val)<coalesce((q.validation->>'min_length')::integer,0)
    OR char_length(val)>coalesce((q.validation->>'max_length')::integer,q.max_length)
    OR (q.question_type='email' AND val!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    OR (q.question_type='phone' AND val!~'^\+?[0-9][0-9 .()-]{7,24}$')
    THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END IF;
  IF q.question_type='date' THEN
   BEGIN
    IF val!~'^\d{4}-\d{2}-\d{2}$' OR to_char(val::date,'YYYY-MM-DD')<>val THEN RAISE EXCEPTION 'invalid date'; END IF;
   EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'FORM_INVALID' USING ERRCODE='22023'; END;
  END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM clubspace_v2_private.require_chair(NEW.updated_by,NEW.club_id);
 IF TG_OP='INSERT' THEN
  IF NEW.created_by<>NEW.updated_by OR NEW.status<>'draft' OR NEW.deleted_at IS NOT NULL OR NEW.published_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 ELSE
  IF ROW(NEW.campaign_id,NEW.club_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.campaign_id,OLD.club_id,OLD.created_by,OLD.created_at)
    OR OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='draft' AND NEW.status IN('open','cancelled'))
    OR (OLD.status='open' AND NEW.status IN('closed','cancelled'))
    OR (OLD.status='closed' AND NEW.status IN('completed','cancelled'))) THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 END IF;
 IF NEW.status='open' AND (TG_OP='INSERT' OR OLD.status<>'open') THEN
  IF clock_timestamp()>=NEW.application_closes_at THEN RAISE EXCEPTION 'WINDOW_CLOSED'; END IF;
  IF NOT EXISTS(SELECT FROM public.recruitment_departments WHERE campaign_id=NEW.campaign_id)
    OR EXISTS(SELECT FROM public.recruitment_departments rd JOIN public.club_departments d USING(department_id)
      WHERE rd.campaign_id=NEW.campaign_id AND (d.status<>'active' OR d.is_management
      OR rd.current_form_version_id IS NULL OR NOT EXISTS(SELECT FROM public.recruitment_questions q WHERE q.form_version_id=rd.current_form_version_id)))
    THEN RAISE EXCEPTION 'Configure departments and forms before opening'; END IF;
  NEW.published_at:=coalesce(NEW.published_at,clock_timestamp());
 END IF;
 IF NEW.status='completed' AND EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=NEW.campaign_id AND status IN('submitted','interviewing')) THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_recruit_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE camp public.recruitment_campaigns; rd public.recruitment_departments; dep public.club_departments; sealed timestamptz; option_count integer;
BEGIN
 IF TG_TABLE_NAME='recruitment_departments' THEN
  SELECT * INTO dep FROM public.club_departments WHERE department_id=NEW.department_id FOR SHARE;
  SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=NEW.campaign_id FOR UPDATE;
  IF camp.club_id IS DISTINCT FROM dep.club_id OR dep.is_management OR dep.status<>'active' THEN RAISE EXCEPTION 'Invalid recruiting department'; END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.recruitment_department_id,NEW.campaign_id,NEW.department_id,NEW.created_by,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.recruitment_department_id,OLD.campaign_id,OLD.department_id,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Department identity immutable'; END IF;
  IF NEW.current_form_version_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.recruitment_form_versions
    WHERE form_version_id=NEW.current_form_version_id AND recruitment_department_id=NEW.recruitment_department_id AND sealed_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Invalid form version'; END IF;
 ELSE
  SELECT * INTO rd FROM public.recruitment_departments WHERE recruitment_department_id=NEW.recruitment_department_id;
  SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=rd.campaign_id FOR UPDATE;
  SELECT sealed_at INTO sealed FROM public.recruitment_form_versions
    WHERE form_version_id=NEW.form_version_id AND recruitment_department_id=NEW.recruitment_department_id;
  IF NOT FOUND OR sealed IS NOT NULL OR TG_OP='UPDATE' THEN RAISE EXCEPTION 'Published form questions are immutable'; END IF;
  IF NEW.question_type IN('single_choice','checkboxes','dropdown') THEN
   SELECT count(DISTINCT o->>'option_id') INTO option_count FROM jsonb_array_elements(NEW.options) o;
   IF jsonb_array_length(NEW.options) NOT BETWEEN 2 AND 100 OR option_count<>jsonb_array_length(NEW.options)
    OR EXISTS(SELECT FROM jsonb_array_elements(NEW.options) o WHERE coalesce(o->>'label','')!~'[^[:space:]]'
      OR coalesce(o->>'option_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'Invalid question options'; END IF;
  ELSIF NEW.options<>'[]'::jsonb THEN RAISE EXCEPTION 'Unexpected question options'; END IF;
 END IF;
 IF camp.campaign_id IS NULL OR camp.status NOT IN('draft','open','closed') OR camp.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 PERFORM clubspace_v2_private.require_chair(NEW.updated_by,camp.club_id);
 IF TG_OP='INSERT' AND NEW.created_by<>NEW.updated_by THEN RAISE EXCEPTION 'Invalid creator'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app public.recruitment_applications; q public.recruitment_questions;
BEGIN
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id=NEW.application_id FOR UPDATE;
 IF app.status<>'draft' OR NEW.updated_by<>app.applicant_id THEN RAISE EXCEPTION 'Only applicant edits own draft' USING ERRCODE='42501'; END IF;
 SELECT * INTO q FROM public.recruitment_questions WHERE question_id=NEW.question_id;
 IF q.form_version_id IS DISTINCT FROM app.form_version_id THEN RAISE EXCEPTION 'FORM_CHANGED'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.answer_id,NEW.application_id,NEW.question_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.answer_id,OLD.application_id,OLD.question_id,OLD.created_at) THEN RAISE EXCEPTION 'Answer identity immutable'; END IF;
 PERFORM 1 FROM public.recruitment_campaigns WHERE campaign_id=app.campaign_id AND deleted_at IS NULL AND status='open'
   AND clock_timestamp()>=application_opens_at AND clock_timestamp()<application_closes_at FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WINDOW_CLOSED'; END IF;
 PERFORM clubspace_v2_private.validate_recruitment_answer(NEW.question_id,NEW.answer_value);
 NEW.answer_text:=CASE WHEN jsonb_typeof(NEW.answer_value)='string' THEN NEW.answer_value#>>'{}' ELSE NEW.answer_value::text END;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE camp public.recruitment_campaigns; rd public.recruitment_departments; prof public.student_profiles;
  target_department uuid; new_member uuid; rec record;
BEGIN
 SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=NEW.campaign_id FOR SHARE;
 SELECT * INTO rd FROM public.recruitment_departments WHERE recruitment_department_id=NEW.recruitment_department_id AND campaign_id=NEW.campaign_id FOR SHARE;
 IF rd.recruitment_department_id IS NULL THEN RAISE EXCEPTION 'Invalid recruiting department'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NEW.updated_by<>NEW.applicant_id OR NEW.profile_snapshot IS NOT NULL OR NEW.submitted_at IS NOT NULL
    OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL OR NEW.admitted_membership_id IS NOT NULL
    OR NEW.withdrawn_at IS NOT NULL OR NEW.result_message IS NOT NULL OR NEW.admitted_department_id IS NOT NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 ELSE
  IF ROW(NEW.application_id,NEW.campaign_id,NEW.applicant_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.application_id,OLD.campaign_id,OLD.applicant_id,OLD.created_at)
    OR OLD.status IN('accepted','rejected','withdrawn') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  IF ROW(NEW.profile_snapshot,NEW.submitted_at,NEW.decided_by,NEW.decided_at,NEW.admitted_membership_id,NEW.withdrawn_at)
    IS DISTINCT FROM ROW(OLD.profile_snapshot,OLD.submitted_at,OLD.decided_by,OLD.decided_at,OLD.admitted_membership_id,OLD.withdrawn_at) THEN RAISE EXCEPTION 'System fields are managed by the database'; END IF;
  IF ROW(NEW.recruitment_department_id,NEW.form_version_id) IS DISTINCT FROM ROW(OLD.recruitment_department_id,OLD.form_version_id)
    AND (OLD.status<>'draft' OR EXISTS(SELECT FROM public.application_answers WHERE application_id=OLD.application_id)) THEN RAISE EXCEPTION 'FORM_CHANGED'; END IF;
  IF NEW.status=OLD.status THEN
   IF OLD.status<>'draft' OR NEW.updated_by<>OLD.applicant_id OR NEW.result_message IS DISTINCT FROM OLD.result_message THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
  ELSIF NEW.status='submitted' AND OLD.status='draft' THEN
   IF NEW.updated_by<>NEW.applicant_id THEN RAISE EXCEPTION 'Only applicant submits' USING ERRCODE='42501'; END IF;
   SELECT * INTO prof FROM public.student_profiles WHERE user_id=NEW.applicant_id FOR SHARE;
   IF prof.user_id IS NULL OR coalesce(btrim(prof.full_name),'')='' OR coalesce(btrim(prof.student_code),'')=''
     OR coalesce(btrim(prof.school_or_faculty),'')='' OR coalesce(btrim(prof.major),'')='' OR coalesce(btrim(prof.cohort),'')='' THEN RAISE EXCEPTION 'Complete student profile'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(camp.club_id::text||':'||NEW.applicant_id::text,0));
   IF EXISTS(SELECT FROM public.club_memberships WHERE club_id=camp.club_id AND user_id=NEW.applicant_id AND status='active') THEN RAISE EXCEPTION 'ALREADY_MEMBER'; END IF;
   FOR rec IN SELECT q.question_id,a.answer_value FROM public.recruitment_questions q
     LEFT JOIN public.application_answers a ON a.application_id=NEW.application_id AND a.question_id=q.question_id
     WHERE q.form_version_id=NEW.form_version_id LOOP
    PERFORM clubspace_v2_private.validate_recruitment_answer(rec.question_id,rec.answer_value);
   END LOOP;
   NEW.profile_snapshot:=jsonb_build_object('full_name',prof.full_name,'student_code',prof.student_code,'school_or_faculty',prof.school_or_faculty,
     'major',prof.major,'cohort',prof.cohort,'phone',prof.phone,'email',(SELECT email FROM public.users WHERE user_id=NEW.applicant_id));
   NEW.submitted_at:=clock_timestamp();
  ELSIF NEW.status='withdrawn' AND OLD.status IN('draft','submitted','interviewing') THEN
   IF NEW.updated_by<>NEW.applicant_id THEN RAISE EXCEPTION 'Only applicant withdraws' USING ERRCODE='42501'; END IF;
   NEW.withdrawn_at:=clock_timestamp();
  ELSIF OLD.status IN('submitted','interviewing') AND NEW.status IN('accepted','rejected','interviewing') AND NEW.status<>OLD.status THEN
   IF camp.status NOT IN('open','closed') OR camp.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
   PERFORM clubspace_v2_private.require_chair(NEW.updated_by,camp.club_id);
   IF NEW.status IN('accepted','rejected') THEN
    NEW.result_message:=coalesce(nullif(btrim(NEW.result_message),''),CASE WHEN NEW.status='accepted'
      THEN 'Đơn ứng tuyển của bạn đã được duyệt.' ELSE 'Đơn ứng tuyển của bạn chưa được chấp nhận.' END);
    NEW.decided_by:=NEW.updated_by; NEW.decided_at:=clock_timestamp();
   END IF;
   IF NEW.status='accepted' THEN
    target_department:=coalesce(NEW.admitted_department_id,rd.department_id);
    PERFORM 1 FROM public.club_departments WHERE department_id=target_department AND club_id=camp.club_id AND status='active' AND NOT is_management FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid admission department' USING ERRCODE='22023'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(camp.club_id::text||':'||NEW.applicant_id::text,0));
    IF EXISTS(SELECT FROM public.club_memberships WHERE club_id=camp.club_id AND user_id=NEW.applicant_id AND status='active') THEN RAISE EXCEPTION 'ALREADY_MEMBER'; END IF;
    INSERT INTO public.club_memberships(club_id,user_id,department_id,role,status)
      VALUES(camp.club_id,NEW.applicant_id,target_department,'member','active') RETURNING membership_id INTO new_member;
    NEW.admitted_membership_id:=new_member; NEW.admitted_department_id:=target_department;
   END IF;
  ELSE RAISE EXCEPTION 'INVALID_STATE'; END IF;
 END IF;
 IF NEW.status<>'accepted' AND NEW.admitted_department_id IS NOT NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND OLD.status='draft' AND NEW.status IN('draft','submitted')) THEN
  IF camp.status<>'open' OR camp.deleted_at IS NOT NULL OR clock_timestamp()<camp.application_opens_at
    OR clock_timestamp()>=camp.application_closes_at
    OR NOT EXISTS(SELECT FROM public.clubs WHERE club_id=camp.club_id AND status='published')
    OR NOT EXISTS(SELECT FROM public.club_departments WHERE department_id=rd.department_id AND status='active') THEN RAISE EXCEPTION 'WINDOW_CLOSED'; END IF;
  IF NEW.form_version_id IS DISTINCT FROM rd.current_form_version_id THEN RAISE EXCEPTION 'FORM_CHANGED' USING ERRCODE='40001'; END IF;
 END IF;
 IF (TG_OP='INSERT' OR NEW.updated_by=NEW.applicant_id) AND NEW.result_message IS NOT NULL THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_save_campaign(p_actor uuid,p_club uuid,p_campaign uuid,p_expected timestamptz,p_input jsonb)
RETURNS public.recruitment_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.recruitment_campaigns;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 IF p_campaign IS NULL THEN
  INSERT INTO public.recruitment_campaigns(club_id,title,description,summary,benefits,contact_email,contact_phone,cover_url,application_opens_at,application_closes_at,created_by,updated_by)
   VALUES(p_club,btrim(p_input->>'title'),btrim(p_input->>'description'),p_input->>'summary',p_input->>'benefits',p_input->>'contact_email',
    p_input->>'contact_phone',p_input->>'cover_url',(p_input->>'application_opens_at')::timestamptz,(p_input->>'application_closes_at')::timestamptz,p_actor,p_actor)
   RETURNING * INTO r;
 ELSE
  UPDATE public.recruitment_campaigns SET title=btrim(p_input->>'title'),description=btrim(p_input->>'description'),
   summary=p_input->>'summary',benefits=p_input->>'benefits',contact_email=p_input->>'contact_email',contact_phone=p_input->>'contact_phone',
   cover_url=p_input->>'cover_url',application_opens_at=(p_input->>'application_opens_at')::timestamptz,application_closes_at=(p_input->>'application_closes_at')::timestamptz,
   updated_by=p_actor WHERE campaign_id=p_campaign AND club_id=p_club AND deleted_at IS NULL AND updated_at=p_expected RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='40001'; END IF;
 END IF;
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_campaign_action(p_actor uuid,p_club uuid,p_campaign uuid,p_expected timestamptz,p_action text)
RETURNS public.recruitment_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.recruitment_campaigns;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 IF p_action NOT IN('open','close','archive') THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023'; END IF;
 UPDATE public.recruitment_campaigns SET
  status=CASE WHEN p_action='open' THEN 'open' WHEN p_action='close' THEN 'closed'
    WHEN status IN('draft','open','closed') THEN 'cancelled' ELSE status END,
  deleted_at=CASE WHEN p_action='archive' THEN clock_timestamp() ELSE deleted_at END,
  updated_by=p_actor
 WHERE campaign_id=p_campaign AND club_id=p_club AND deleted_at IS NULL AND updated_at=p_expected
  AND (p_action='archive' OR (p_action='open' AND status='draft') OR (p_action='close' AND status='open')) RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='40001'; END IF;
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_add_department(p_actor uuid,p_club uuid,p_campaign uuid,p_expected timestamptz,p_input jsonb)
RETURNS public.recruitment_departments LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.recruitment_departments;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 PERFORM 1 FROM public.recruitment_campaigns WHERE campaign_id=p_campaign AND club_id=p_club
   AND updated_at=p_expected AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='40001'; END IF;
 INSERT INTO public.recruitment_departments(campaign_id,department_id,description,requirements,target_quantity,created_by,updated_by)
  VALUES(p_campaign,(p_input->>'department_id')::uuid,btrim(p_input->>'description'),p_input->>'requirements',(p_input->>'target_quantity')::integer,p_actor,p_actor) RETURNING * INTO r;
 UPDATE public.recruitment_campaigns SET updated_by=p_actor WHERE campaign_id=p_campaign;
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_save_form(p_actor uuid,p_club uuid,p_campaign uuid,p_department uuid,p_expected timestamptz,p_questions jsonb,p_ack boolean DEFAULT false)
RETURNS public.recruitment_form_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.recruitment_form_versions; camp public.recruitment_campaigns; rd public.recruitment_departments; x record;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=p_campaign AND club_id=p_club AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR camp.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='40001'; END IF;
 SELECT * INTO rd FROM public.recruitment_departments WHERE recruitment_department_id=p_department AND campaign_id=p_campaign FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recruiting department not found' USING ERRCODE='P0002'; END IF;
 IF jsonb_typeof(p_questions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_questions) NOT BETWEEN 1 AND 100
   OR pg_column_size(p_questions)>1048576 THEN RAISE EXCEPTION 'Invalid form' USING ERRCODE='22023'; END IF;
 IF NOT coalesce(p_ack,false) AND EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=p_campaign AND submitted_at IS NOT NULL) THEN RAISE EXCEPTION 'ACK_REQUIRED'; END IF;
 INSERT INTO public.recruitment_form_versions(recruitment_department_id,version_number,created_by)
  SELECT p_department,coalesce(max(version_number),0)+1,p_actor FROM public.recruitment_form_versions WHERE recruitment_department_id=p_department RETURNING * INTO v;
 FOR x IN SELECT value,ordinality FROM jsonb_array_elements(p_questions) WITH ORDINALITY LOOP
  INSERT INTO public.recruitment_questions(recruitment_department_id,form_version_id,field_id,question_text,help_text,is_required,max_length,sort_order,question_type,options,validation,profile_field,created_by,updated_by)
   VALUES(p_department,v.form_version_id,coalesce((x.value->>'field_id')::uuid,gen_random_uuid()),btrim(x.value->>'question_text'),x.value->>'help_text',
    (x.value->>'is_required')::boolean,coalesce((x.value->'validation'->>'max_length')::integer,10000),x.ordinality,
    x.value->>'question_type',coalesce(x.value->'options','[]'::jsonb),coalesce(x.value->'validation','{}'::jsonb),x.value->>'profile_field',p_actor,p_actor);
 END LOOP;
 UPDATE public.recruitment_form_versions SET sealed_at=clock_timestamp() WHERE form_version_id=v.form_version_id RETURNING * INTO v;
 UPDATE public.recruitment_departments SET current_form_version_id=v.form_version_id,updated_by=p_actor WHERE recruitment_department_id=p_department;
 UPDATE public.recruitment_campaigns SET updated_by=p_actor WHERE campaign_id=p_campaign;
 RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_submit_application(p_actor uuid,p_campaign uuid,p_department uuid,p_version uuid,p_answers jsonb)
RETURNS public.recruitment_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE camp public.recruitment_campaigns; rd public.recruitment_departments; app public.recruitment_applications; x jsonb; q public.recruitment_questions; f public.recruitment_files; file_value jsonb;
BEGIN
 SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=p_campaign AND deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found' USING ERRCODE='P0002'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(camp.club_id::text||':'||p_actor::text,0));
 SELECT * INTO rd FROM public.recruitment_departments WHERE recruitment_department_id=p_department AND campaign_id=p_campaign FOR SHARE;
 IF NOT FOUND OR rd.current_form_version_id IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'FORM_CHANGED' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT FROM public.club_memberships WHERE club_id=camp.club_id AND user_id=p_actor AND status='active') THEN RAISE EXCEPTION 'ALREADY_MEMBER'; END IF;
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR jsonb_array_length(p_answers)>100 OR pg_column_size(p_answers)>1048576 THEN RAISE EXCEPTION 'Invalid answers' USING ERRCODE='22023'; END IF;
 SELECT * INTO app FROM public.recruitment_applications WHERE campaign_id=p_campaign AND applicant_id=p_actor FOR UPDATE;
 IF FOUND THEN
  IF app.status<>'draft' THEN RAISE EXCEPTION 'APPLICATION_EXISTS'; END IF;
  PERFORM public.clubspace_clear_draft_answers(p_actor,app.application_id);
  UPDATE public.recruitment_applications SET recruitment_department_id=p_department,form_version_id=p_version,updated_by=p_actor
    WHERE application_id=app.application_id RETURNING * INTO app;
 ELSE
  INSERT INTO public.recruitment_applications(campaign_id,recruitment_department_id,applicant_id,updated_by,form_version_id)
    VALUES(p_campaign,p_department,p_actor,p_actor,p_version) RETURNING * INTO app;
 END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_answers) LOOP
  SELECT * INTO q FROM public.recruitment_questions WHERE question_id=(x->>'question_id')::uuid AND form_version_id=p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORM_CHANGED'; END IF;
  INSERT INTO public.application_answers(application_id,question_id,answer_text,answer_value,updated_by)
    VALUES(app.application_id,q.question_id,'',coalesce(x->'value','null'::jsonb),p_actor);
  IF q.question_type='file' AND jsonb_typeof(x->'value')='array' THEN
   FOR file_value IN SELECT value FROM jsonb_array_elements(x->'value') LOOP
    SELECT * INTO f FROM public.recruitment_files WHERE file_id=(file_value#>>'{}')::uuid FOR UPDATE;
    IF NOT FOUND OR f.campaign_id<>p_campaign OR f.uploaded_by<>p_actor OR f.question_id<>q.question_id OR f.purpose<>'answer'
      OR f.state<>'staged' OR f.expires_at<=clock_timestamp()
      OR f.size_bytes>coalesce((q.validation->>'max_size_bytes')::integer,5242880)
      OR (q.validation ? 'allowed_mime_types' AND NOT (q.validation->'allowed_mime_types' ? f.mime_type)) THEN RAISE EXCEPTION 'INVALID_FILE'; END IF;
    UPDATE public.recruitment_files SET state='attached',application_id=app.application_id WHERE file_id=f.file_id;
   END LOOP;
  END IF;
 END LOOP;
 UPDATE public.recruitment_applications SET status='submitted',updated_by=p_actor WHERE application_id=app.application_id RETURNING * INTO app;
 RETURN app;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_decide_application(p_actor uuid,p_club uuid,p_campaign uuid,p_application uuid,p_expected timestamptz,p_decision text,p_reason text DEFAULT NULL,p_department uuid DEFAULT NULL)
RETURNS public.recruitment_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app public.recruitment_applications;
BEGIN
 -- The existing deferred membership structure trigger locks this club row.
 -- Take that lock first to serialize concurrent admissions without lock upgrades.
 PERFORM 1 FROM public.clubs WHERE club_id=p_club FOR UPDATE;
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 PERFORM 1 FROM public.recruitment_campaigns WHERE campaign_id=p_campaign AND club_id=p_club FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found' USING ERRCODE='P0002'; END IF;
 IF p_decision NOT IN('approve','reject') THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='22023'; END IF;
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id=p_application AND campaign_id=p_campaign;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='P0002'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_club::text||':'||app.applicant_id::text,0));
 UPDATE public.recruitment_applications SET status=CASE WHEN p_decision='approve' THEN 'accepted' ELSE 'rejected' END,
  result_message=nullif(btrim(p_reason),''),admitted_department_id=CASE WHEN p_decision='approve' THEN p_department ELSE NULL END,updated_by=p_actor
 WHERE application_id=p_application AND campaign_id=p_campaign AND status IN('submitted','interviewing') AND updated_at=p_expected RETURNING * INTO app;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='40001'; END IF;
 RETURN app;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_list_applications(p_actor uuid,p_club uuid,p_campaign uuid,p_page integer DEFAULT 1,p_limit integer DEFAULT 12,p_search text DEFAULT '',p_status text DEFAULT 'all',p_sort text DEFAULT 'newest')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 PERFORM 1 FROM public.recruitment_campaigns WHERE campaign_id=p_campaign AND club_id=p_club;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found' USING ERRCODE='P0002'; END IF;
 IF p_page NOT BETWEEN 1 AND 10000 OR p_limit NOT BETWEEN 1 AND 100 OR p_status NOT IN('all','pending','approved','rejected') OR p_sort NOT IN('newest','oldest') THEN RAISE EXCEPTION 'Invalid query' USING ERRCODE='22023'; END IF;
 WITH base AS (
  SELECT a.*,CASE WHEN status IN('submitted','interviewing') THEN 'pending' WHEN status='accepted' THEN 'approved' ELSE status END AS display_status
  FROM public.recruitment_applications a WHERE campaign_id=p_campaign AND submitted_at IS NOT NULL AND status<>'withdrawn'
 ), filtered AS (
  SELECT * FROM base WHERE (p_status='all' OR display_status=p_status)
   AND (coalesce(p_search,'')='' OR position(lower(p_search) IN lower(concat_ws(' ',profile_snapshot->>'full_name',profile_snapshot->>'student_code',profile_snapshot->>'email')))>0)
 ), page_rows AS (
  SELECT * FROM filtered ORDER BY
   CASE WHEN p_sort='newest' THEN submitted_at END DESC,
   CASE WHEN p_sort='oldest' THEN submitted_at END ASC,application_id
  OFFSET (p_page-1)*p_limit LIMIT p_limit
 )
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page_rows p),'[]'::jsonb),
  'total',(SELECT count(*) FROM filtered),'page',p_page,'limit',p_limit,
  'hasMore',p_page*p_limit<(SELECT count(*) FROM filtered),
  'stats',jsonb_build_object('total',(SELECT count(*) FROM base),'pending',(SELECT count(*) FROM base WHERE display_status='pending'),
    'approved',(SELECT count(*) FROM base WHERE display_status='approved'),'rejected',(SELECT count(*) FROM base WHERE display_status='rejected'))) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_attach_cover(p_actor uuid,p_campaign uuid,p_file uuid,p_url text,p_expected timestamptz)
RETURNS public.recruitment_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE camp public.recruitment_campaigns; f public.recruitment_files;
BEGIN
 SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=p_campaign FOR UPDATE;
 IF NOT FOUND OR camp.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='40001'; END IF;
 PERFORM clubspace_v2_private.require_chair(p_actor,camp.club_id);
 SELECT * INTO f FROM public.recruitment_files WHERE file_id=p_file FOR UPDATE;
 IF NOT FOUND OR f.campaign_id<>p_campaign OR f.uploaded_by<>p_actor OR f.purpose<>'cover' OR f.state<>'staged' OR f.expires_at<=clock_timestamp()
   OR right(p_url,length('/storage/v1/object/public/'||f.bucket||'/'||f.object_path))<>('/storage/v1/object/public/'||f.bucket||'/'||f.object_path)
   THEN RAISE EXCEPTION 'INVALID_FILE'; END IF;
 UPDATE public.recruitment_campaigns SET cover_url=p_url,updated_by=p_actor WHERE campaign_id=p_campaign RETURNING * INTO camp;
 UPDATE public.recruitment_files SET state='attached' WHERE file_id=p_file;
 RETURN camp;
END $$;

-- Preserve the existing public view's first columns and only append safe fields.
CREATE OR REPLACE VIEW public.public_recruitment_campaigns AS
 SELECT r.campaign_id,r.club_id,c.name AS club_name,c.logo_url AS club_logo_url,r.title,r.description,r.cover_url,
  r.application_opens_at,r.application_closes_at,r.status,r.created_at,r.updated_at,
  r.summary,r.benefits,r.contact_email,r.contact_phone,r.published_at,
  CASE WHEN r.status='open' AND clock_timestamp()>=r.application_closes_at THEN 'expired'
    WHEN r.status='open' AND clock_timestamp()<r.application_opens_at THEN 'upcoming' ELSE r.status END AS effective_status,
  (r.status='open' AND clock_timestamp()>=r.application_opens_at AND clock_timestamp()<r.application_closes_at) AS accepting_applications
 FROM public.recruitment_campaigns r JOIN public.clubs c USING(club_id)
 WHERE c.status='published' AND r.status IN('open','closed','completed') AND r.deleted_at IS NULL;
GRANT SELECT ON public.public_recruitment_campaigns TO service_role;

-- Store only cover images publicly. Attachments have no anonymous/public policy.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('recruitment-covers','recruitment-covers',true,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('recruitment-attachments','recruitment-attachments',false,5242880,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
 ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF EXISTS(SELECT FROM storage.buckets WHERE id='recruitment-attachments' AND public)
   OR EXISTS(SELECT FROM storage.buckets WHERE id='recruitment-covers' AND NOT public) THEN
  RAISE EXCEPTION 'Recruitment bucket access configuration does not match its purpose';
 END IF;
END $$;
DO $$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN('recruitment_save_campaign','recruitment_campaign_action','recruitment_add_department',
   'recruitment_save_form','recruitment_submit_application','recruitment_decide_application','recruitment_list_applications','recruitment_attach_cover')
 LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION clubspace_v2_private.validate_recruitment_answer(uuid,jsonb) FROM PUBLIC,anon,authenticated;
COMMIT;

