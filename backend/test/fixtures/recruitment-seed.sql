BEGIN;
INSERT INTO public.users(user_id,email,display_name,role)
 SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'test'||n||'@example.invalid','Test '||n,'student' FROM generate_series(1,10) n;
INSERT INTO public.student_profiles(user_id,full_name,student_code,school_or_faculty,major,cohort,phone)
 SELECT user_id,display_name,'TEST-'||display_name,'Test faculty','Test major','K68','0912345678' FROM public.users;
INSERT INTO public.clubs(club_id,name,summary,description,status,created_by,reviewed_by,reviewed_at,published_at)
 VALUES('00000000-0000-4000-8000-000000000101','Test Club','Test club summary','Test club description','published','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',now(),now()),
 ('00000000-0000-4000-8000-000000000102','Other Club','Other club summary','Other club description','published','00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000009',now(),now());
INSERT INTO public.club_departments(department_id,club_id,name,is_management) VALUES
 ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','Management',true),
 ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101','Legacy department',false),
 ('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000101','New department without head',false),
 ('00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000102','Other management',true);
INSERT INTO public.club_memberships(club_id,user_id,department_id,role) VALUES
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000201','chairperson'),
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000202','head'),
 ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000204','chairperson');
INSERT INTO public.recruitment_campaigns(campaign_id,club_id,title,description,application_opens_at,application_closes_at,created_by,updated_by)
 VALUES('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101','Legacy campaign','Legacy description',now()-interval '1 hour',now()+interval '1 hour','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
INSERT INTO public.recruitment_departments(recruitment_department_id,campaign_id,department_id,description,created_by,updated_by)
 VALUES('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000202','Legacy recruitment','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
INSERT INTO public.recruitment_questions(question_id,recruitment_department_id,question_text,is_required,sort_order,created_by,updated_by)
 VALUES('00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000401','Legacy question',true,1,'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
UPDATE public.recruitment_campaigns SET status='open' WHERE campaign_id='00000000-0000-4000-8000-000000000301';
INSERT INTO public.recruitment_applications(application_id,campaign_id,recruitment_department_id,applicant_id,updated_by)
 VALUES('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003');
INSERT INTO public.application_answers(application_id,question_id,answer_text,updated_by)
 VALUES('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000501','Unchanged legacy answer','00000000-0000-4000-8000-000000000003');
UPDATE public.recruitment_applications SET status='submitted' WHERE application_id='00000000-0000-4000-8000-000000000601';
COMMIT;
