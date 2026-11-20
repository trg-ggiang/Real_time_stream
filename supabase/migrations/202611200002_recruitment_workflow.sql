-- Requires the existing clubspace v2 schema. Compatible with prior typed-form columns.
BEGIN;
ALTER TABLE public.recruitment_campaigns ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.recruitment_campaigns ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE public.recruitment_campaigns ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS public.recruitment_form_versions(
 form_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recruitment_department_id uuid NOT NULL REFERENCES public.recruitment_departments,
 version_number integer NOT NULL, created_by uuid NOT NULL REFERENCES public.users,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), sealed_at timestamptz,
 UNIQUE(recruitment_department_id,version_number), UNIQUE(form_version_id,recruitment_department_id)
);
ALTER TABLE public.recruitment_departments ADD COLUMN IF NOT EXISTS current_form_version_id uuid REFERENCES public.recruitment_form_versions;
ALTER TABLE public.recruitment_questions ADD COLUMN IF NOT EXISTS form_version_id uuid REFERENCES public.recruitment_form_versions;
ALTER TABLE public.recruitment_questions ADD COLUMN IF NOT EXISTS field_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.recruitment_questions ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'paragraph';
ALTER TABLE public.recruitment_questions ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.recruitment_questions ADD COLUMN IF NOT EXISTS validation jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.recruitment_questions ADD COLUMN IF NOT EXISTS profile_field text;
ALTER TABLE public.recruitment_applications ADD COLUMN IF NOT EXISTS form_version_id uuid REFERENCES public.recruitment_form_versions;
ALTER TABLE public.application_answers ADD COLUMN IF NOT EXISTS answer_value jsonb;
-- Backfill old forms without rewriting old answers or existing version identity.
ALTER TABLE public.recruitment_questions DISABLE TRIGGER a_v2_question;
ALTER TABLE public.recruitment_departments DISABLE TRIGGER a_v2_recruit_config;
ALTER TABLE public.recruitment_applications DISABLE TRIGGER a_v2_application;
ALTER TABLE public.application_answers DISABLE TRIGGER a_v2_answer;
INSERT INTO public.recruitment_form_versions(recruitment_department_id,version_number,created_by,sealed_at)
 SELECT d.recruitment_department_id,coalesce((SELECT max(version_number)+1 FROM public.recruitment_form_versions v WHERE v.recruitment_department_id=d.recruitment_department_id),1),d.created_by,clock_timestamp()
 FROM public.recruitment_departments d WHERE current_form_version_id IS NULL;
UPDATE public.recruitment_departments d SET current_form_version_id=(SELECT form_version_id FROM public.recruitment_form_versions v WHERE v.recruitment_department_id=d.recruitment_department_id ORDER BY version_number DESC LIMIT 1) WHERE current_form_version_id IS NULL;
UPDATE public.recruitment_questions q SET form_version_id=d.current_form_version_id FROM public.recruitment_departments d WHERE q.recruitment_department_id=d.recruitment_department_id AND q.form_version_id IS NULL;
UPDATE public.recruitment_applications a SET form_version_id=d.current_form_version_id FROM public.recruitment_departments d WHERE a.recruitment_department_id=d.recruitment_department_id AND a.form_version_id IS NULL;
UPDATE public.application_answers SET answer_value=to_jsonb(answer_text) WHERE answer_value IS NULL;
ALTER TABLE public.recruitment_questions ENABLE TRIGGER a_v2_question;
ALTER TABLE public.recruitment_departments ENABLE TRIGGER a_v2_recruit_config;
ALTER TABLE public.recruitment_applications ENABLE TRIGGER a_v2_application;
ALTER TABLE public.application_answers ENABLE TRIGGER a_v2_answer;
ALTER TABLE public.recruitment_questions DROP CONSTRAINT IF EXISTS recruitment_questions_recruitment_department_id_sort_order_key;
CREATE UNIQUE INDEX IF NOT EXISTS recruitment_question_version_order_v3 ON public.recruitment_questions(form_version_id,sort_order);
CREATE TABLE IF NOT EXISTS public.recruitment_files(
 file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.recruitment_campaigns,
 uploaded_by uuid NOT NULL REFERENCES public.users, question_id uuid REFERENCES public.recruitment_questions,
 application_id uuid REFERENCES public.recruitment_applications, purpose text NOT NULL,
 bucket text NOT NULL, object_path text NOT NULL, file_name text NOT NULL,mime_type text NOT NULL,size_bytes integer NOT NULL,
 state text NOT NULL DEFAULT 'staged', created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '2 hours',UNIQUE(bucket,object_path)
);
ALTER TABLE public.recruitment_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recruitment_form_versions,public.recruitment_files FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.recruitment_form_versions TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.recruitment_files TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('recruitment-covers','recruitment-covers',true,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('recruitment-attachments','recruitment-attachments',false,5242880,ARRAY['application/pdf','image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF EXISTS(SELECT FROM storage.buckets WHERE id='recruitment-attachments' AND public) OR EXISTS(SELECT FROM storage.buckets WHERE id='recruitment-covers' AND NOT public) THEN RAISE EXCEPTION 'Invalid recruitment bucket visibility'; END IF; END $$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.recruitment_reviewer(p_actor uuid,p_club uuid,p_department uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM clubspace_v2_private.require_member(p_actor,p_club);
 IF NOT EXISTS(SELECT FROM public.club_memberships WHERE club_id=p_club AND user_id=p_actor AND status='active' AND (role='chairperson' OR (role='head' AND department_id=p_department))) THEN RAISE EXCEPTION 'Reviewer access denied' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION clubspace_v2_private.recruitment_reviewer(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_recruit_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE camp public.recruitment_campaigns; dept public.club_departments; rd public.recruitment_departments;
BEGIN
 IF TG_TABLE_NAME='recruitment_departments' THEN
  SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=NEW.campaign_id FOR UPDATE;
  SELECT * INTO dept FROM public.club_departments WHERE department_id=NEW.department_id;
  IF TG_OP='UPDATE' AND ROW(NEW.recruitment_department_id,NEW.campaign_id,NEW.department_id,NEW.created_by) IS DISTINCT FROM ROW(OLD.recruitment_department_id,OLD.campaign_id,OLD.department_id,OLD.created_by) THEN RAISE EXCEPTION 'Department identity immutable'; END IF;
 ELSE
  SELECT * INTO rd FROM public.recruitment_departments WHERE recruitment_department_id=NEW.recruitment_department_id;
  SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=rd.campaign_id FOR UPDATE;
  SELECT * INTO dept FROM public.club_departments WHERE department_id=rd.department_id;
  IF TG_OP='UPDATE' AND ROW(NEW.question_id,NEW.recruitment_department_id,NEW.created_by,NEW.form_version_id) IS DISTINCT FROM ROW(OLD.question_id,OLD.recruitment_department_id,OLD.created_by,OLD.form_version_id) THEN RAISE EXCEPTION 'Question identity immutable'; END IF;
 END IF;
 PERFORM clubspace_v2_private.require_chair(NEW.updated_by,camp.club_id);
 IF camp.status<>'draft' OR dept.club_id IS DISTINCT FROM camp.club_id OR dept.is_management OR dept.status<>'active' THEN RAISE EXCEPTION 'Draft and active ordinary department required'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM clubspace_v2_private.require_chair(NEW.updated_by,NEW.club_id);
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NEW.created_by<>NEW.updated_by THEN RAISE EXCEPTION 'Create own draft'; END IF;
 ELSE
  IF ROW(NEW.campaign_id,NEW.club_id,NEW.created_by) IS DISTINCT FROM ROW(OLD.campaign_id,OLD.club_id,OLD.created_by) THEN RAISE EXCEPTION 'Campaign identity immutable'; END IF;
  IF OLD.status<>'draft' AND ROW(NEW.title,NEW.description,NEW.cover_url,NEW.application_opens_at,NEW.application_closes_at) IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.cover_url,OLD.application_opens_at,OLD.application_closes_at) THEN RAISE EXCEPTION 'Published configuration frozen'; END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='draft' AND NEW.status IN('open','cancelled')) OR (OLD.status='open' AND NEW.status IN('closed','cancelled')) OR (OLD.status='closed' AND NEW.status IN('completed','cancelled'))) THEN RAISE EXCEPTION 'Invalid campaign transition'; END IF;
 END IF;
 IF NEW.status='open' AND (TG_OP='INSERT' OR OLD.status<>'open') THEN
  IF NOT EXISTS(SELECT FROM public.recruitment_departments WHERE campaign_id=NEW.campaign_id) OR EXISTS(SELECT FROM public.recruitment_departments rd JOIN public.club_departments d USING(department_id) WHERE rd.campaign_id=NEW.campaign_id AND (d.status<>'active' OR d.is_management OR NOT EXISTS(SELECT FROM public.recruitment_questions q WHERE q.form_version_id=rd.current_form_version_id))) THEN RAISE EXCEPTION 'Configure active departments and forms before publishing'; END IF;
  NEW.published_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.recruitment_validate_value(p_question uuid,p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.recruitment_questions; txt text; n numeric; v jsonb;
BEGIN
 SELECT * INTO STRICT q FROM public.recruitment_questions WHERE question_id=p_question;
 IF p_value IS NULL OR p_value='null' OR p_value='[]' OR (jsonb_typeof(p_value)='string' AND btrim(p_value#>>'{}')='') THEN
  IF q.is_required THEN RAISE EXCEPTION 'Required answer missing' USING ERRCODE='22023'; END IF; RETURN;
 END IF;
 IF q.question_type IN('number','rating') THEN
  IF jsonb_typeof(p_value)<>'number' THEN RAISE EXCEPTION 'Expected numeric answer' USING ERRCODE='22023'; END IF;
  n:=(p_value#>>'{}')::numeric;
  IF n<coalesce((q.validation->>'min')::numeric,-1e12) OR n>coalesce((q.validation->>'max')::numeric,1e12) OR (q.question_type='rating' AND (n<>trunc(n) OR n<1 OR n>5)) THEN RAISE EXCEPTION 'Numeric answer out of range' USING ERRCODE='22023'; END IF;
 ELSIF q.question_type IN('single_choice','dropdown','checkboxes') THEN
  v:=CASE WHEN q.question_type='checkboxes' THEN p_value ELSE jsonb_build_array(p_value) END;
  IF jsonb_typeof(v)<>'array' THEN RAISE EXCEPTION 'Invalid choices' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(v) x WHERE jsonb_typeof(x)<>'string' OR NOT EXISTS(SELECT FROM jsonb_array_elements(q.options) o WHERE o->>'option_id'=x#>>'{}')) OR (SELECT count(DISTINCT x) FROM jsonb_array_elements(v) x)<>jsonb_array_length(v) THEN RAISE EXCEPTION 'Invalid choice' USING ERRCODE='22023'; END IF;
 ELSIF q.question_type='file' THEN
  IF jsonb_typeof(p_value)<>'array' THEN RAISE EXCEPTION 'Invalid files' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_value)>coalesce((q.validation->>'max_files')::int,1) OR (SELECT count(DISTINCT x) FROM jsonb_array_elements(p_value) x)<>jsonb_array_length(p_value) THEN RAISE EXCEPTION 'Too many or duplicate files' USING ERRCODE='22023'; END IF;
 ELSE
  IF jsonb_typeof(p_value)<>'string' THEN RAISE EXCEPTION 'Expected text answer' USING ERRCODE='22023'; END IF;
  txt:=p_value#>>'{}';
  IF char_length(txt)<coalesce((q.validation->>'min_length')::int,0) OR char_length(txt)>coalesce((q.validation->>'max_length')::int,10000) OR (q.question_type='email' AND txt!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR (q.question_type='phone' AND txt!~'^\+?[0-9][0-9 .()-]{7,24}$') THEN RAISE EXCEPTION 'Invalid text answer' USING ERRCODE='22023'; END IF;
  IF q.question_type='date' THEN IF txt!~'^\d{4}-\d{2}-\d{2}$' OR to_char(txt::date,'YYYY-MM-DD')<>txt THEN RAISE EXCEPTION 'Invalid date' USING ERRCODE='22023'; END IF; END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION clubspace_v2_private.recruitment_validate_value(uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE app public.recruitment_applications; q public.recruitment_questions;
BEGIN
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id=NEW.application_id FOR UPDATE;
 SELECT * INTO q FROM public.recruitment_questions WHERE question_id=NEW.question_id;
 IF app.status<>'draft' OR NEW.updated_by<>app.applicant_id OR q.form_version_id IS DISTINCT FROM app.form_version_id THEN RAISE EXCEPTION 'Answer access denied'; END IF;
 PERFORM clubspace_v2_private.recruitment_validate_value(NEW.question_id,NEW.answer_value);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE camp public.recruitment_campaigns; rd public.recruitment_departments; prof public.student_profiles; q record; mid uuid;
BEGIN
 SELECT * INTO camp FROM public.recruitment_campaigns WHERE campaign_id=NEW.campaign_id FOR SHARE;
 SELECT * INTO rd FROM public.recruitment_departments WHERE recruitment_department_id=NEW.recruitment_department_id AND campaign_id=NEW.campaign_id;
 IF rd.recruitment_department_id IS NULL THEN RAISE EXCEPTION 'Invalid department'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NEW.updated_by<>NEW.applicant_id OR NEW.profile_snapshot IS NOT NULL OR NEW.submitted_at IS NOT NULL OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL OR NEW.admitted_membership_id IS NOT NULL OR NEW.result_message IS NOT NULL OR NEW.withdrawn_at IS NOT NULL THEN RAISE EXCEPTION 'Create own empty draft'; END IF;
 ELSE
  IF ROW(NEW.application_id,NEW.campaign_id,NEW.applicant_id,NEW.recruitment_department_id,NEW.form_version_id) IS DISTINCT FROM ROW(OLD.application_id,OLD.campaign_id,OLD.applicant_id,OLD.recruitment_department_id,OLD.form_version_id) THEN RAISE EXCEPTION 'Application identity immutable'; END IF;
  IF OLD.status NOT IN('draft','submitted','interviewing') THEN RAISE EXCEPTION 'Decision already made' USING ERRCODE='40001'; END IF;
  IF ROW(NEW.profile_snapshot,NEW.submitted_at,NEW.decided_by,NEW.decided_at,NEW.admitted_membership_id,NEW.withdrawn_at) IS DISTINCT FROM ROW(OLD.profile_snapshot,OLD.submitted_at,OLD.decided_by,OLD.decided_at,OLD.admitted_membership_id,OLD.withdrawn_at) THEN RAISE EXCEPTION 'Managed system fields'; END IF;
 END IF;
 IF TG_OP='INSERT' OR OLD.status='draft' THEN
  IF camp.status<>'open' OR camp.deleted_at IS NOT NULL OR clock_timestamp()<camp.application_opens_at OR clock_timestamp()>=camp.application_closes_at OR NOT EXISTS(SELECT FROM public.clubs WHERE club_id=camp.club_id AND status='published') OR NOT EXISTS(SELECT FROM public.club_departments WHERE department_id=rd.department_id AND status='active') THEN RAISE EXCEPTION 'Recruitment window closed' USING ERRCODE='40001'; END IF;
  IF NEW.form_version_id IS DISTINCT FROM rd.current_form_version_id THEN RAISE EXCEPTION 'FORM_CHANGED' USING ERRCODE='40001'; END IF;
  IF EXISTS(SELECT FROM public.club_memberships WHERE club_id=camp.club_id AND user_id=NEW.applicant_id AND status='active') THEN RAISE EXCEPTION 'Already a club member' USING ERRCODE='23505'; END IF;
  IF TG_OP='UPDATE' THEN
   IF NEW.status<>'submitted' OR NEW.updated_by<>NEW.applicant_id THEN RAISE EXCEPTION 'Only own submission allowed'; END IF;
   SELECT * INTO prof FROM public.student_profiles WHERE user_id=NEW.applicant_id;
   IF prof.user_id IS NULL OR coalesce(btrim(prof.full_name),'')='' OR coalesce(btrim(prof.student_code),'')='' OR coalesce(btrim(prof.school_or_faculty),'')='' OR coalesce(btrim(prof.major),'')='' OR coalesce(btrim(prof.cohort),'')='' THEN RAISE EXCEPTION 'Complete student profile' USING ERRCODE='22023'; END IF;
   FOR q IN SELECT question_id FROM public.recruitment_questions WHERE form_version_id=NEW.form_version_id LOOP
    PERFORM clubspace_v2_private.recruitment_validate_value(q.question_id,(SELECT answer_value FROM public.application_answers WHERE application_id=NEW.application_id AND question_id=q.question_id));
   END LOOP;
   NEW.profile_snapshot:=jsonb_build_object('full_name',prof.full_name,'student_code',prof.student_code,'school_or_faculty',prof.school_or_faculty,'major',prof.major,'cohort',prof.cohort,'phone',prof.phone,'email',(SELECT email FROM public.users WHERE user_id=NEW.applicant_id));
   NEW.submitted_at:=clock_timestamp();
  END IF;
 ELSE
  IF NEW.status NOT IN('accepted','rejected') OR camp.status NOT IN('open','closed') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  PERFORM clubspace_v2_private.recruitment_reviewer(NEW.updated_by,camp.club_id,rd.department_id);
  NEW.decided_by:=NEW.updated_by; NEW.decided_at:=clock_timestamp();
  NEW.result_message:=coalesce(nullif(btrim(NEW.result_message),''),CASE WHEN NEW.status='accepted' THEN 'Chúc mừng! Bạn đã được thêm vào CLB.' ELSE 'Đơn ứng tuyển của bạn chưa được chấp thuận.' END);
  IF NEW.status='accepted' THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(camp.club_id::text||NEW.applicant_id::text,0));
   INSERT INTO public.club_memberships(club_id,user_id,department_id,role,status) VALUES(camp.club_id,NEW.applicant_id,rd.department_id,'member','active') RETURNING membership_id INTO mid;
   NEW.admitted_membership_id:=mid;
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_v3_save(p_actor uuid,p_club uuid,p_id uuid,p_expected timestamptz,p_input jsonb)
RETURNS public.recruitment_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.recruitment_campaigns; d jsonb; q jsonb; rd public.recruitment_departments; version_id uuid; ord integer;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 IF p_id IS NOT NULL THEN
  SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=p_id AND club_id=p_club FOR UPDATE;
  IF NOT FOUND OR c.status<>'draft' OR c.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Draft changed; reload' USING ERRCODE='40001'; END IF;
 ELSE
  INSERT INTO public.recruitment_campaigns(club_id,title,description,application_opens_at,application_closes_at,created_by,updated_by)
  VALUES(p_club,p_input->>'title',p_input->>'description',(p_input->>'application_opens_at')::timestamptz,(p_input->>'application_closes_at')::timestamptz,p_actor,p_actor) RETURNING * INTO c;
 END IF;
 UPDATE public.recruitment_campaigns SET title=p_input->>'title',description=p_input->>'description',summary=p_input->>'summary',cover_url=p_input->>'cover_url',application_opens_at=(p_input->>'application_opens_at')::timestamptz,application_closes_at=(p_input->>'application_closes_at')::timestamptz,updated_by=p_actor WHERE campaign_id=c.campaign_id;
 IF jsonb_typeof(p_input->'departments') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'departments') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Configure 1 to 30 departments' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT FROM public.recruitment_departments x WHERE x.campaign_id=c.campaign_id AND NOT EXISTS(SELECT FROM jsonb_array_elements(p_input->'departments') z WHERE (z->>'department_id')::uuid=x.department_id)) THEN RAISE EXCEPTION 'Cannot remove a saved department; create a new draft' USING ERRCODE='22023'; END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(p_input->'departments') LOOP
  INSERT INTO public.recruitment_departments(campaign_id,department_id,description,created_by,updated_by)
  VALUES(c.campaign_id,(d->>'department_id')::uuid,coalesce(nullif(d->>'description',''),'Thành viên CLB'),p_actor,p_actor)
  ON CONFLICT(campaign_id,department_id) DO UPDATE SET description=EXCLUDED.description,updated_by=p_actor RETURNING * INTO rd;
  IF jsonb_typeof(d->'questions') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'questions') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Configure 1 to 100 questions' USING ERRCODE='22023'; END IF;
  INSERT INTO public.recruitment_form_versions(recruitment_department_id,version_number,created_by)
  SELECT rd.recruitment_department_id,coalesce(max(version_number),0)+1,p_actor FROM public.recruitment_form_versions WHERE recruitment_department_id=rd.recruitment_department_id RETURNING form_version_id INTO version_id;
  ord:=0;
  FOR q IN SELECT value FROM jsonb_array_elements(d->'questions') LOOP
   ord:=ord+1;
   IF q->>'question_type' NOT IN('short_text','paragraph','single_choice','checkboxes','dropdown','number','email','phone','date','file','rating') OR coalesce(btrim(q->>'question_text'),'')='' THEN RAISE EXCEPTION 'Invalid question' USING ERRCODE='22023'; END IF;
   INSERT INTO public.recruitment_questions(recruitment_department_id,form_version_id,field_id,question_text,help_text,question_type,is_required,options,validation,profile_field,sort_order,created_by,updated_by)
   VALUES(rd.recruitment_department_id,version_id,coalesce((q->>'field_id')::uuid,gen_random_uuid()),q->>'question_text',q->>'help_text',q->>'question_type',coalesce((q->>'is_required')::boolean,false),coalesce(q->'options','[]'),coalesce(q->'validation','{}'),q->>'profile_field',ord,p_actor,p_actor);
  END LOOP;
  UPDATE public.recruitment_form_versions SET sealed_at=clock_timestamp() WHERE form_version_id=version_id;
  UPDATE public.recruitment_departments SET current_form_version_id=version_id,updated_by=p_actor WHERE recruitment_department_id=rd.recruitment_department_id;
 END LOOP;
 SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=c.campaign_id;
 RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_v3_publish(p_actor uuid,p_club uuid,p_id uuid,p_expected timestamptz,p_close boolean DEFAULT false)
RETURNS public.recruitment_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.recruitment_campaigns;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 UPDATE public.recruitment_campaigns SET status=CASE WHEN p_close THEN 'closed' ELSE 'open' END,updated_by=p_actor
 WHERE campaign_id=p_id AND club_id=p_club AND updated_at=p_expected AND status=CASE WHEN p_close THEN 'open' ELSE 'draft' END RETURNING * INTO c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recruitment changed; reload' USING ERRCODE='40001'; END IF;
 RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_v3_submit(p_actor uuid,p_campaign uuid,p_department uuid,p_version uuid,p_answers jsonb)
RETURNS public.recruitment_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.recruitment_applications; ans jsonb; q public.recruitment_questions; fid jsonb; f public.recruitment_files; c public.recruitment_campaigns; rec uuid;
BEGIN
 SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=p_campaign FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended(c.club_id::text||p_actor::text,0));
 IF jsonb_typeof(p_answers) IS DISTINCT FROM 'array' OR jsonb_array_length(p_answers)>100 OR (SELECT count(DISTINCT x->>'question_id') FROM jsonb_array_elements(p_answers) x)<>jsonb_array_length(p_answers) THEN RAISE EXCEPTION 'Invalid answers' USING ERRCODE='22023'; END IF;
 INSERT INTO public.recruitment_applications(campaign_id,recruitment_department_id,applicant_id,updated_by,form_version_id) VALUES(p_campaign,p_department,p_actor,p_actor,p_version) RETURNING * INTO a;
 FOR ans IN SELECT value FROM jsonb_array_elements(p_answers) LOOP
  SELECT * INTO q FROM public.recruitment_questions WHERE question_id=(ans->>'question_id')::uuid AND form_version_id=p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORM_CHANGED' USING ERRCODE='40001'; END IF;
  IF q.question_type='file' AND jsonb_typeof(ans->'value')='array' THEN
   FOR fid IN SELECT value FROM jsonb_array_elements(ans->'value') LOOP
    SELECT * INTO f FROM public.recruitment_files WHERE file_id=(fid#>>'{}')::uuid FOR UPDATE;
    IF NOT FOUND OR f.uploaded_by<>p_actor OR f.campaign_id<>p_campaign OR f.question_id<>q.question_id OR f.state<>'staged' OR f.expires_at<=clock_timestamp() OR f.size_bytes>coalesce((q.validation->>'max_size_bytes')::int,5242880) OR (q.validation?'allowed_mime_types' AND NOT (q.validation->'allowed_mime_types')?f.mime_type) THEN RAISE EXCEPTION 'Invalid or expired attachment' USING ERRCODE='22023'; END IF;
    UPDATE public.recruitment_files SET application_id=a.application_id,state='attached' WHERE file_id=f.file_id;
   END LOOP;
  END IF;
  INSERT INTO public.application_answers(application_id,question_id,answer_text,answer_value,updated_by) VALUES(a.application_id,q.question_id,CASE WHEN jsonb_typeof(ans->'value')='string' THEN ans->>'value' ELSE coalesce((ans->'value')::text,'') END,ans->'value',p_actor);
 END LOOP;
 UPDATE public.recruitment_applications SET status='submitted',updated_by=p_actor WHERE application_id=a.application_id RETURNING * INTO a;
 FOR rec IN SELECT DISTINCT user_id FROM public.club_memberships WHERE club_id=c.club_id AND status='active' AND (role='chairperson' OR (role='head' AND department_id=(SELECT department_id FROM public.recruitment_departments WHERE recruitment_department_id=p_department))) LOOP
  INSERT INTO public.notifications(recipient_id,actor_id,type,title,body,data,deduplication_key) VALUES(rec,p_actor,'recruitment.application','Có đơn ứng tuyển mới',left(coalesce(a.profile_snapshot->>'full_name','Sinh viên')||' đã ứng tuyển: '||c.title,5000),jsonb_build_object('club_id',c.club_id,'href','/workspace/'||c.club_id||'/recruitments/'||p_campaign||'/applications/'||a.application_id),'recruitment.application:'||a.application_id) ON CONFLICT(recipient_id,deduplication_key) DO NOTHING;
 END LOOP;
 RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_v3_decide(p_actor uuid,p_club uuid,p_campaign uuid,p_application uuid,p_expected timestamptz,p_approve boolean,p_reason text DEFAULT NULL)
RETURNS public.recruitment_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.recruitment_applications; c public.recruitment_campaigns;
BEGIN
 SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=p_campaign AND club_id=p_club;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO a FROM public.recruitment_applications WHERE application_id=p_application AND campaign_id=p_campaign FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='P0002'; END IF;
 PERFORM clubspace_v2_private.recruitment_reviewer(p_actor,p_club,(SELECT department_id FROM public.recruitment_departments WHERE recruitment_department_id=a.recruitment_department_id));
 IF a.updated_at IS DISTINCT FROM p_expected OR a.status NOT IN('submitted','interviewing') THEN RAISE EXCEPTION 'Decision already changed' USING ERRCODE='40001'; END IF;
 UPDATE public.recruitment_applications SET status=CASE WHEN p_approve THEN 'accepted' ELSE 'rejected' END,result_message=p_reason,updated_by=p_actor WHERE application_id=p_application RETURNING * INTO a;
 INSERT INTO public.notifications(recipient_id,actor_id,type,title,body,data,deduplication_key)
 VALUES(a.applicant_id,p_actor,CASE WHEN p_approve THEN 'recruitment.accepted' ELSE 'recruitment.rejected' END,CASE WHEN p_approve THEN 'Đơn ứng tuyển đã được duyệt' ELSE 'Kết quả ứng tuyển CLB' END,left(c.title||': '||a.result_message,5000),jsonb_build_object('club_id',p_club,'href','/me/recruitment-applications/'||a.application_id),'recruitment.decision:'||a.application_id) ON CONFLICT(recipient_id,deduplication_key) DO NOTHING;
 RETURN a;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_v3_cover(p_actor uuid,p_id uuid,p_expected timestamptz,p_file uuid,p_url text)
RETURNS public.recruitment_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.recruitment_campaigns; f public.recruitment_files;
BEGIN
 SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=p_id FOR UPDATE;
 PERFORM clubspace_v2_private.require_chair(p_actor,c.club_id);
 IF c.status<>'draft' OR c.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Draft changed' USING ERRCODE='40001'; END IF;
 SELECT * INTO f FROM public.recruitment_files WHERE file_id=p_file FOR UPDATE;
 IF NOT FOUND OR f.campaign_id<>p_id OR f.uploaded_by<>p_actor OR f.purpose<>'cover' OR f.state<>'staged' OR f.expires_at<=clock_timestamp() OR right(p_url,length('/storage/v1/object/public/'||f.bucket||'/'||f.object_path))<>('/storage/v1/object/public/'||f.bucket||'/'||f.object_path) THEN RAISE EXCEPTION 'Invalid cover' USING ERRCODE='22023'; END IF;
 UPDATE public.recruitment_campaigns SET cover_url=p_url,updated_by=p_actor WHERE campaign_id=p_id RETURNING * INTO c;
 UPDATE public.recruitment_files SET state='attached' WHERE file_id=p_file;
 RETURN c;
END $$;

CREATE OR REPLACE VIEW public.public_recruitment_campaigns AS
SELECT r.campaign_id,r.club_id,c.name AS club_name,c.logo_url AS club_logo_url,r.title,r.description,r.cover_url,r.application_opens_at,r.application_closes_at,r.status,r.created_at,r.updated_at,
 r.summary,NULL::text AS benefits,NULL::text AS contact_email,NULL::text AS contact_phone,r.published_at,
 CASE WHEN r.status='open' AND clock_timestamp()>=r.application_closes_at THEN 'expired' WHEN r.status='open' AND clock_timestamp()<r.application_opens_at THEN 'upcoming' ELSE r.status END AS effective_status,
 (r.status='open' AND clock_timestamp()>=r.application_opens_at AND clock_timestamp()<r.application_closes_at) AS accepting_applications
FROM public.recruitment_campaigns r JOIN public.clubs c USING(club_id) WHERE c.status='published' AND r.status IN('open','closed','completed') AND r.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.public_activity_feed AS
SELECT activity_id,club_id,club_name,club_logo_url,title,summary,description,cover_url,starts_at,ends_at,format,location_name,location_address,registration_opens_at,registration_closes_at,capacity,lifecycle_status,published_at,updated_at,'activity'::text AS entry_type,NULL::uuid AS campaign_id FROM public.public_club_activities
UNION ALL
SELECT campaign_id,club_id,club_name,club_logo_url,title,coalesce(summary,left(description,300)),description,cover_url,application_opens_at,application_closes_at,'online',NULL::text,NULL::text,application_opens_at,application_closes_at,NULL::integer,CASE WHEN accepting_applications THEN 'ongoing' ELSE 'scheduled' END,coalesce(published_at,created_at),updated_at,'recruitment',campaign_id FROM public.public_recruitment_campaigns;
REVOKE ALL ON public.public_activity_feed FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.public_activity_feed,public.public_recruitment_campaigns TO service_role;
CREATE OR REPLACE FUNCTION public.clubspace_read_head_notifications(p_actor uuid,p_through timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 UPDATE public.notifications SET read_at=greatest(clock_timestamp(),created_at) WHERE recipient_id=p_actor AND type IN('department.head_assigned','recruitment.application','recruitment.accepted','recruitment.rejected') AND read_at IS NULL AND created_at<=p_through;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('recruitment_v3_save','recruitment_v3_publish','recruitment_v3_submit','recruitment_v3_decide','recruitment_v3_cover','clubspace_read_head_notifications') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig); END LOOP;
END $$;
COMMIT;
