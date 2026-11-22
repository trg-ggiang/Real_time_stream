CREATE FUNCTION test_id(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
CREATE FUNCTION test_error(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$ DECLARE succeeded boolean:=false; BEGIN BEGIN EXECUTE statement; succeeded:=true; EXCEPTION WHEN OTHERS THEN IF SQLSTATE<>expected THEN RAISE; END IF; END; IF succeeded THEN RAISE EXCEPTION 'Expected %, got success: %',expected,statement; END IF; END $$;
CREATE FUNCTION test_fail_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF current_setting('test.fail_notification',true)='on' AND NEW.type='recruitment.accepted' THEN RAISE EXCEPTION 'Simulated notification failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$;
CREATE TRIGGER test_fail_notification BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION test_fail_notification();
DO $$
DECLARE c public.recruitment_campaigns; d public.recruitment_departments; app public.recruitment_applications; inp jsonb; answers jsonb; questions jsonb; cutoff timestamptz; file_question uuid;
BEGIN
 ASSERT NOT has_function_privilege('anon','public.recruitment_v3_decide(uuid,uuid,uuid,uuid,timestamptz,boolean,text)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.recruitment_v3_save(uuid,uuid,uuid,timestamptz,jsonb)','EXECUTE');
 ASSERT (SELECT answer_value='"Original answer"'::jsonb FROM public.application_answers WHERE application_id=test_id(701));
 ASSERT (SELECT form_version_id IS NOT NULL FROM public.recruitment_applications WHERE application_id=test_id(701));
 -- Chairperson can now decide without an interview; the department stays correct.
 SELECT * INTO app FROM public.recruitment_applications WHERE application_id=test_id(701);
 app:=public.recruitment_v3_decide(test_id(1),test_id(101),test_id(401),app.application_id,app.updated_at,true,NULL);
 ASSERT app.status='accepted' AND app.admitted_membership_id IS NOT NULL;
 ASSERT (SELECT role='member' AND department_id=test_id(202) FROM public.club_memberships WHERE membership_id=app.admitted_membership_id);
 PERFORM test_error(format('SELECT public.recruitment_v3_decide(%L,%L,%L,%L,%L,false,NULL)',test_id(2),test_id(101),test_id(401),app.application_id,app.updated_at),'40001');
 ASSERT (SELECT count(*)=1 FROM public.notifications WHERE recipient_id=test_id(4) AND type='recruitment.accepted');
 SELECT jsonb_agg(jsonb_build_object('question_text',t,'question_type',t,'is_required',t<>'file','options',CASE WHEN t IN('single_choice','checkboxes','dropdown') THEN '[{"option_id":"00000000-0000-4000-8000-000000000901","label":"One"},{"option_id":"00000000-0000-4000-8000-000000000902","label":"Two"}]'::jsonb ELSE '[]'::jsonb END,'validation','{}'::jsonb)) INTO questions FROM unnest(ARRAY['short_text','paragraph','single_choice','checkboxes','dropdown','number','email','phone','date','file','rating']) t;
 inp:=jsonb_build_object('title','New recruitment','description','Recruitment detailed description','application_opens_at',clock_timestamp()-interval '1 hour','application_closes_at',clock_timestamp()+interval '1 hour','departments',jsonb_build_array(jsonb_build_object('department_id',test_id(202),'description','Technical recruiting','questions',questions)));
 PERFORM test_error(format('SELECT public.recruitment_v3_save(%L,%L,NULL,NULL,%L::jsonb)',test_id(2),test_id(101),inp),'42501');
 c:=public.recruitment_v3_save(test_id(1),test_id(101),NULL,NULL,inp);
 ASSERT NOT EXISTS(SELECT FROM public.public_activity_feed WHERE campaign_id=c.campaign_id);
 ASSERT NOT has_function_privilege('authenticated','public.recruitment_v3_review(uuid,uuid,uuid,timestamptz,boolean)','EXECUTE');
 PERFORM test_error(format('SELECT public.recruitment_v3_publish(%L,%L,%L,%L,false)',test_id(1),test_id(101),c.campaign_id,c.updated_at),'40001');
 c:=public.recruitment_v3_review(test_id(1),test_id(101),c.campaign_id,c.updated_at,false);
 ASSERT c.status='pending_review';
 ASSERT NOT EXISTS(SELECT FROM public.public_activity_feed WHERE campaign_id=c.campaign_id);
 PERFORM test_error(format('SELECT public.recruitment_v3_publish(%L,%L,%L,%L,false)',test_id(2),test_id(101),c.campaign_id,c.updated_at),'42501');
 c:=public.recruitment_v3_review(test_id(1),test_id(101),c.campaign_id,c.updated_at,true);
 ASSERT c.status='draft';
 c:=public.recruitment_v3_review(test_id(1),test_id(101),c.campaign_id,c.updated_at,false);
 c:=public.recruitment_v3_publish(test_id(1),test_id(101),c.campaign_id,c.updated_at,false);
 ASSERT (SELECT count(*)=1 FROM public.public_activity_feed WHERE campaign_id=c.campaign_id AND entry_type='recruitment');
 SELECT * INTO d FROM public.recruitment_departments WHERE campaign_id=c.campaign_id;
 SELECT jsonb_agg(jsonb_build_object('question_id',question_id,'value',CASE question_type WHEN 'number' THEN '0'::jsonb WHEN 'rating' THEN '5'::jsonb WHEN 'email' THEN '"student@example.edu"'::jsonb WHEN 'phone' THEN '"0912345678"'::jsonb WHEN 'date' THEN '"2026-02-28"'::jsonb WHEN 'file' THEN '[]'::jsonb WHEN 'single_choice' THEN '"00000000-0000-4000-8000-000000000901"'::jsonb WHEN 'dropdown' THEN '"00000000-0000-4000-8000-000000000901"'::jsonb WHEN 'checkboxes' THEN '["00000000-0000-4000-8000-000000000901"]'::jsonb ELSE '"Valid answer"'::jsonb END)) INTO answers FROM public.recruitment_questions WHERE form_version_id=d.current_form_version_id;
 PERFORM test_error(format('SELECT public.recruitment_v3_submit(%L,%L,%L,%L,%L::jsonb)',test_id(8),c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers),'23505');
 PERFORM test_error(format('SELECT public.recruitment_v3_submit(%L,%L,%L,%L,%L::jsonb)',test_id(5),c.campaign_id,d.recruitment_department_id,d.current_form_version_id,'[]'),'22023');
 ASSERT NOT EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=c.campaign_id);
 app:=public.recruitment_v3_submit(test_id(5),c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers);
 ASSERT app.status='submitted';
 ASSERT (SELECT count(*)=11 FROM public.application_answers WHERE application_id=app.application_id);
 ASSERT (SELECT count(*)=2 FROM public.notifications WHERE type='recruitment.application' AND data->>'href' LIKE '%'||app.application_id);
 ASSERT NOT EXISTS(SELECT FROM public.notifications WHERE type='recruitment.application' AND recipient_id IN(test_id(3),test_id(6),test_id(8)));
 PERFORM test_error(format('SELECT public.recruitment_v3_submit(%L,%L,%L,%L,%L::jsonb)',test_id(5),c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers),'23505');
 PERFORM test_error(format('SELECT public.recruitment_v3_decide(%L,%L,%L,%L,%L,true,NULL)',test_id(3),test_id(101),c.campaign_id,app.application_id,app.updated_at),'42501');
 PERFORM test_error(format('SELECT public.recruitment_v3_decide(%L,%L,%L,%L,%L,true,NULL)',test_id(8),test_id(101),c.campaign_id,app.application_id,app.updated_at),'42501');
 app:=public.recruitment_v3_decide(test_id(2),test_id(101),c.campaign_id,app.application_id,app.updated_at,false,'Try again next time');
 ASSERT app.status='rejected' AND app.admitted_membership_id IS NULL;
 ASSERT NOT EXISTS(SELECT FROM public.club_memberships WHERE user_id=test_id(5) AND club_id=test_id(101));
 ASSERT (SELECT count(*)=1 FROM public.notifications WHERE recipient_id=test_id(5) AND type='recruitment.rejected');
 cutoff:=clock_timestamp();
 ASSERT public.clubspace_read_head_notifications(test_id(5),cutoff)=1;
 ASSERT public.clubspace_read_head_notifications(test_id(5),cutoff)=0;
 ASSERT EXISTS(SELECT FROM public.notifications WHERE recipient_id=test_id(1) AND read_at IS NULL);
 -- Attachment ownership is atomic with answers and submission.
 SELECT question_id INTO file_question FROM public.recruitment_questions WHERE form_version_id=d.current_form_version_id AND question_type='file';
 INSERT INTO public.recruitment_files(file_id,campaign_id,question_id,uploaded_by,purpose,bucket,object_path,file_name,mime_type,size_bytes)
 VALUES(test_id(801),c.campaign_id,file_question,test_id(4),'answer','recruitment-attachments','test/foreign.pdf','foreign.pdf','application/pdf',100),
 (test_id(802),c.campaign_id,file_question,test_id(7),'answer','recruitment-attachments','test/own.pdf','own.pdf','application/pdf',100);
 SELECT jsonb_agg(CASE WHEN x->>'question_id'=file_question::text THEN jsonb_set(x,'{value}',jsonb_build_array(test_id(801))) ELSE x END) INTO answers FROM jsonb_array_elements(answers) x;
 PERFORM test_error(format('SELECT public.recruitment_v3_submit(%L,%L,%L,%L,%L::jsonb)',test_id(7),c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers),'22023');
 ASSERT NOT EXISTS(SELECT FROM public.recruitment_applications WHERE campaign_id=c.campaign_id AND applicant_id=test_id(7));
 ASSERT (SELECT state='staged' AND application_id IS NULL FROM public.recruitment_files WHERE file_id=test_id(801));
 SELECT jsonb_agg(CASE WHEN x->>'question_id'=file_question::text THEN jsonb_set(x,'{value}',jsonb_build_array(test_id(802))) ELSE x END) INTO answers FROM jsonb_array_elements(answers) x;
 app:=public.recruitment_v3_submit(test_id(7),c.campaign_id,d.recruitment_department_id,d.current_form_version_id,answers);
 ASSERT (SELECT state='attached' AND application_id=app.application_id FROM public.recruitment_files WHERE file_id=test_id(802));
 -- A failed inbox write rolls back admission as well as the decision.
 PERFORM set_config('test.fail_notification','on',true);
 PERFORM test_error(format('SELECT public.recruitment_v3_decide(%L,%L,%L,%L,%L,true,NULL)',test_id(2),test_id(101),c.campaign_id,app.application_id,app.updated_at),'P0001');
 ASSERT (SELECT status='submitted' FROM public.recruitment_applications WHERE application_id=app.application_id);
 ASSERT NOT EXISTS(SELECT FROM public.club_memberships WHERE club_id=test_id(101) AND user_id=test_id(7));
 PERFORM set_config('test.fail_notification','off',true);
 app:=public.recruitment_v3_decide(test_id(2),test_id(101),c.campaign_id,app.application_id,app.updated_at,true,NULL);
 ASSERT app.status='accepted';
 ASSERT (SELECT role='member' AND department_id=test_id(202) FROM public.club_memberships WHERE membership_id=app.admitted_membership_id);
 -- Deadline uses wall-clock across a transaction, not now().
 inp:=jsonb_set(inp,'{application_closes_at}',to_jsonb(clock_timestamp()+interval '150 milliseconds'));
 c:=public.recruitment_v3_save(test_id(1),test_id(101),NULL,NULL,inp);
 c:=public.recruitment_v3_review(test_id(1),test_id(101),c.campaign_id,c.updated_at,false);
 c:=public.recruitment_v3_publish(test_id(1),test_id(101),c.campaign_id,c.updated_at,false);
 SELECT * INTO d FROM public.recruitment_departments WHERE campaign_id=c.campaign_id;
 PERFORM pg_sleep(0.25);
 PERFORM test_error(format('SELECT public.recruitment_v3_submit(%L,%L,%L,%L,%L::jsonb)',test_id(5),c.campaign_id,d.recruitment_department_id,d.current_form_version_id,'[]'),'40001');
 ASSERT (SELECT count(*)=1 FROM public.club_memberships WHERE club_id=test_id(101) AND role='chairperson' AND user_id=test_id(1));
END $$;
