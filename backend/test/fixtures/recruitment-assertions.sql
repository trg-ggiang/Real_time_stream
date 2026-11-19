CREATE TABLE test_ids(key text PRIMARY KEY,value uuid);
CREATE FUNCTION test_expect_error(p_sql text,p_code text,p_message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE succeeded boolean:=false;
BEGIN
 BEGIN EXECUTE p_sql; succeeded:=true;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>p_code OR (p_message IS NOT NULL AND position(p_message IN SQLERRM)=0) THEN RAISE; END IF;
 END;
 IF succeeded THEN RAISE EXCEPTION 'Expected error %, got success: %',p_code,p_sql; END IF;
END $$;

CREATE FUNCTION test_make_campaign(p_all_types boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE c public.recruitment_campaigns; d public.recruitment_departments; v public.recruitment_form_versions; questions jsonb;
 actor uuid:='00000000-0000-4000-8000-000000000001'; club uuid:='00000000-0000-4000-8000-000000000101';
BEGIN
 c:=public.recruitment_save_campaign(actor,club,NULL,NULL,jsonb_build_object('title','Recruitment test','description','Recruitment test description',
  'application_opens_at',clock_timestamp()-interval '1 hour','application_closes_at',clock_timestamp()+interval '1 hour'));
 d:=public.recruitment_add_department(actor,club,c.campaign_id,c.updated_at,jsonb_build_object('department_id','00000000-0000-4000-8000-000000000203','description','New department recruitment'));
 SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=c.campaign_id;
 IF p_all_types THEN
  SELECT jsonb_agg(jsonb_build_object('question_text',t,'question_type',t,'is_required',t<>'file',
   'options',CASE WHEN t IN('single_choice','checkboxes','dropdown') THEN '[{"option_id":"00000000-0000-4000-8000-000000000901","label":"A"},{"option_id":"00000000-0000-4000-8000-000000000902","label":"B"}]'::jsonb ELSE '[]'::jsonb END))
  INTO questions FROM unnest(ARRAY['short_text','paragraph','single_choice','checkboxes','dropdown','number','email','phone','date','file','rating']) t;
 ELSE
  questions:='[{"question_text":"Motivation","question_type":"paragraph","is_required":true},{"question_text":"CV","question_type":"file","is_required":false,"validation":{"max_files":1,"max_size_bytes":1024,"allowed_mime_types":["application/pdf"]}}]'::jsonb;
 END IF;
 v:=public.recruitment_save_form(actor,club,c.campaign_id,d.recruitment_department_id,c.updated_at,questions,false);
 SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=c.campaign_id;
 c:=public.recruitment_campaign_action(actor,club,c.campaign_id,c.updated_at,'open');
 RETURN c.campaign_id;
END $$;

DO $$
DECLARE app public.recruitment_applications; old_version uuid;
BEGIN
 SELECT form_version_id INTO old_version FROM public.recruitment_questions WHERE question_id='00000000-0000-4000-8000-000000000501';
 ASSERT old_version IS NOT NULL;
 ASSERT (SELECT form_version_id=old_version FROM public.recruitment_applications WHERE application_id='00000000-0000-4000-8000-000000000601');
 ASSERT (SELECT answer_value='"Unchanged legacy answer"'::jsonb FROM public.application_answers WHERE application_id='00000000-0000-4000-8000-000000000601');
 ASSERT NOT has_function_privilege('anon','public.recruitment_submit_application(uuid,uuid,uuid,uuid,jsonb)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.recruitment_decide_application(uuid,uuid,uuid,uuid,timestamptz,text,text,uuid)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.recruitment_submit_application(uuid,uuid,uuid,uuid,jsonb)','EXECUTE');
 ASSERT NOT has_table_privilege('anon','public.recruitment_files','SELECT');
 ASSERT NOT (SELECT public FROM storage.buckets WHERE id='recruitment-attachments');
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id='00000000-0000-4000-8000-000000000601';
 PERFORM test_expect_error(format('SELECT public.recruitment_decide_application(%L,%L,%L,%L,%L,%L,NULL,NULL)',
  '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000101',app.campaign_id,app.application_id,app.updated_at,'approve'),'42501');
 PERFORM test_expect_error(format('SELECT public.recruitment_decide_application(%L,%L,%L,%L,%L,%L,NULL,NULL)',
  '00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000101',app.campaign_id,app.application_id,app.updated_at,'approve'),'42501');
 app:=public.recruitment_decide_application('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101',app.campaign_id,app.application_id,app.updated_at,'approve',NULL,'00000000-0000-4000-8000-000000000203');
 ASSERT app.status='accepted' AND app.result_message IS NOT NULL AND app.admitted_membership_id IS NOT NULL;
 ASSERT (SELECT department_id='00000000-0000-4000-8000-000000000203' AND role='member' AND status='active' FROM public.club_memberships WHERE membership_id=app.admitted_membership_id);
 ASSERT (SELECT count(*)=1 FROM public.notification_jobs WHERE entity_id=app.application_id AND event_type='application.accepted');
 PERFORM test_expect_error(format('SELECT public.recruitment_decide_application(%L,%L,%L,%L,%L,%L,NULL,NULL)',
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101',app.campaign_id,app.application_id,app.updated_at,'reject'),'40001');
END $$;

DO $$
DECLARE c uuid; d public.recruitment_departments; answers jsonb; app public.recruitment_applications;
BEGIN
 c:=test_make_campaign(true);
 SELECT * INTO d FROM public.recruitment_departments WHERE campaign_id=c;
 SELECT jsonb_agg(jsonb_build_object('question_id',question_id,'value',CASE question_type
  WHEN 'number' THEN '0'::jsonb WHEN 'rating' THEN '5'::jsonb
  WHEN 'email' THEN '"student@example.edu"'::jsonb WHEN 'phone' THEN '"0912345678"'::jsonb
  WHEN 'date' THEN '"2026-02-28"'::jsonb WHEN 'file' THEN '[]'::jsonb
  WHEN 'single_choice' THEN '"00000000-0000-4000-8000-000000000901"'::jsonb
  WHEN 'dropdown' THEN '"00000000-0000-4000-8000-000000000901"'::jsonb
  WHEN 'checkboxes' THEN '["00000000-0000-4000-8000-000000000901"]'::jsonb
  ELSE '"Valid response"'::jsonb END)) INTO answers FROM public.recruitment_questions WHERE form_version_id=d.current_form_version_id;
 PERFORM test_expect_error(format('SELECT public.recruitment_submit_application(%L,%L,%L,%L,%L::jsonb)',
  '00000000-0000-4000-8000-000000000004',c,d.recruitment_department_id,d.current_form_version_id,'[]'),'22023','FORM_INVALID');
 ASSERT NOT EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=c);
 app:=public.recruitment_submit_application('00000000-0000-4000-8000-000000000004',c,d.recruitment_department_id,d.current_form_version_id,answers);
 ASSERT app.status='submitted' AND app.profile_snapshot->>'phone'='0912345678' AND app.profile_snapshot->>'email'='test4@example.invalid';
 ASSERT (SELECT count(*)=11 FROM public.application_answers WHERE application_id=app.application_id);
 PERFORM test_expect_error(format('SELECT public.recruitment_submit_application(%L,%L,%L,%L,%L::jsonb)',
  '00000000-0000-4000-8000-000000000004',c,d.recruitment_department_id,d.current_form_version_id,answers),'P0001','APPLICATION_EXISTS');
 app:=public.recruitment_decide_application('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101',c,app.application_id,app.updated_at,'reject',NULL,NULL);
 ASSERT app.status='rejected' AND btrim(app.result_message)<>'' AND app.admitted_membership_id IS NULL;
END $$;

DO $$
DECLARE c public.recruitment_campaigns; d public.recruitment_departments; app public.recruitment_applications;
 q_text uuid; q_file uuid; f uuid:=gen_random_uuid(); answers jsonb; v public.recruitment_form_versions; old_version uuid; stats jsonb; new_campaign uuid;
BEGIN
 new_campaign:=test_make_campaign();
 SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=new_campaign;
 INSERT INTO test_ids VALUES('campaign',c.campaign_id);
 SELECT * INTO d FROM public.recruitment_departments WHERE campaign_id=c.campaign_id;
 SELECT question_id INTO q_text FROM public.recruitment_questions WHERE form_version_id=d.current_form_version_id AND question_type='paragraph';
 SELECT question_id INTO q_file FROM public.recruitment_questions WHERE form_version_id=d.current_form_version_id AND question_type='file';
 INSERT INTO public.recruitment_files(file_id,campaign_id,uploaded_by,question_id,purpose,bucket,object_path,file_name,mime_type,size_bytes)
  VALUES(f,c.campaign_id,'00000000-0000-4000-8000-000000000005',q_file,'answer','recruitment-attachments',f::text,'cv.pdf','application/pdf',100);
 answers:=jsonb_build_array(jsonb_build_object('question_id',q_text,'value','Motivation'),jsonb_build_object('question_id',q_file,'value',jsonb_build_array(f)));
 PERFORM test_expect_error(format('SELECT public.recruitment_submit_application(%L,%L,%L,%L,%L::jsonb)',
  '00000000-0000-4000-8000-000000000006',c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers),'P0001','INVALID_FILE');
 ASSERT NOT EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=c.campaign_id AND applicant_id='00000000-0000-4000-8000-000000000006');
 ASSERT (SELECT state='staged' FROM public.recruitment_files WHERE file_id=f);
 app:=public.recruitment_submit_application('00000000-0000-4000-8000-000000000005',c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers);
 ASSERT (SELECT state='attached' AND application_id=app.application_id FROM public.recruitment_files WHERE file_id=f);
 UPDATE public.student_profiles SET full_name='Changed later' WHERE user_id=app.applicant_id;
 ASSERT app.profile_snapshot->>'full_name'='Test 5';
 old_version:=app.form_version_id;
 PERFORM test_expect_error(format('SELECT public.recruitment_save_form(%L,%L,%L,%L,%L,%L::jsonb,false)',
  '00000000-0000-4000-8000-000000000001',c.club_id,c.campaign_id,d.recruitment_department_id,c.updated_at,
  '[{"question_text":"New wording","question_type":"paragraph","is_required":true}]'),'P0001','ACK_REQUIRED');
 v:=public.recruitment_save_form('00000000-0000-4000-8000-000000000001',c.club_id,c.campaign_id,d.recruitment_department_id,c.updated_at,
  '[{"question_text":"New wording","question_type":"paragraph","is_required":true}]',true);
 ASSERT v.form_version_id<>old_version;
 ASSERT (SELECT question_text='Motivation' FROM public.recruitment_questions WHERE question_id=q_text);
 ASSERT (SELECT form_version_id=old_version FROM public.recruitment_applications WHERE application_id=app.application_id);
 PERFORM test_expect_error(format('UPDATE public.recruitment_questions SET question_text=%L WHERE question_id=%L','Tampered',q_text),'P0001','immutable');
 PERFORM test_expect_error(format('SELECT public.recruitment_submit_application(%L,%L,%L,%L,%L::jsonb)',
  '00000000-0000-4000-8000-000000000006',c.campaign_id,d.recruitment_department_id,old_version,answers),'40001','FORM_CHANGED');
 stats:=public.recruitment_list_applications('00000000-0000-4000-8000-000000000001',c.club_id,c.campaign_id,1,12,'Test 5','pending','newest');
 ASSERT (stats->>'total')::int=1 AND (stats->'stats'->>'pending')::int=1;
 PERFORM test_expect_error(format('SELECT public.recruitment_list_applications(%L,%L,%L)',
  '00000000-0000-4000-8000-000000000009',c.club_id,c.campaign_id),'42501');
END $$;

DO $$
DECLARE c public.recruitment_campaigns; d public.recruitment_departments; answers jsonb; q uuid; new_campaign uuid;
BEGIN
 new_campaign:=test_make_campaign();
 SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=new_campaign;
 SELECT * INTO d FROM public.recruitment_departments WHERE campaign_id=c.campaign_id;
 SELECT question_id INTO q FROM public.recruitment_questions WHERE form_version_id=d.current_form_version_id AND question_type='paragraph';
 answers:=jsonb_build_array(jsonb_build_object('question_id',q,'value','Valid response'));
 PERFORM test_expect_error(format('SELECT public.recruitment_submit_application(%L,%L,%L,%L,%L::jsonb)',
  '00000000-0000-4000-8000-000000000003',c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers),'P0001','ALREADY_MEMBER');
 UPDATE public.recruitment_campaigns SET application_closes_at=clock_timestamp()+interval '150 milliseconds' WHERE campaign_id=c.campaign_id;
 PERFORM pg_sleep(0.25);
 -- now() is still earlier than the deadline in this transaction; wall-clock must win.
 PERFORM test_expect_error(format('SELECT public.recruitment_submit_application(%L,%L,%L,%L,%L::jsonb)',
  '00000000-0000-4000-8000-000000000006',c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers),'P0001','WINDOW_CLOSED');
 ASSERT NOT EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=c.campaign_id);
 ASSERT (SELECT effective_status='expired' AND NOT accepting_applications FROM public.public_recruitment_campaigns WHERE campaign_id=c.campaign_id);
END $$;
