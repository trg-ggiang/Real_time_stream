DO $$
DECLARE actor uuid:='00000000-0000-4000-8000-000000000001'; target uuid:='00000000-0000-4000-8000-000000000302'; stamp timestamptz; cutoff timestamptz;
BEGIN
 ASSERT NOT has_function_privilege('anon','public.clubspace_set_department_head(uuid,uuid,boolean,timestamptz)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.clubspace_read_head_notifications(uuid,timestamptz)','EXECUTE');
 SELECT updated_at INTO stamp FROM public.club_memberships WHERE membership_id=target;
 BEGIN PERFORM public.clubspace_set_department_head('00000000-0000-4000-8000-000000000002',target,true,stamp); RAISE EXCEPTION 'Expected denied'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.clubspace_set_department_head(actor,target,true,stamp);
 ASSERT (SELECT role='head' AND department_id='00000000-0000-4000-8000-000000000202' FROM public.club_memberships WHERE membership_id=target);
 ASSERT (SELECT count(*)=1 FROM public.club_memberships WHERE role='chairperson' AND user_id=actor);
 ASSERT (SELECT count(*)=1 FROM public.notifications WHERE recipient_id='00000000-0000-4000-8000-000000000002' AND type='department.head_assigned');
 BEGIN PERFORM public.clubspace_set_department_head(actor,target,true,stamp); RAISE EXCEPTION 'Expected conflict'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 ASSERT (SELECT count(*)=1 FROM public.notifications);
 SELECT updated_at INTO stamp FROM public.club_memberships WHERE membership_id=target;
 PERFORM public.clubspace_set_department_head(actor,target,false,stamp);
 ASSERT (SELECT role='member' FROM public.club_memberships WHERE membership_id=target);
 ASSERT (SELECT count(*)=1 FROM public.notifications);
 cutoff:=clock_timestamp();
 ASSERT public.clubspace_read_head_notifications(actor,cutoff)=0;
 ASSERT public.clubspace_read_head_notifications('00000000-0000-4000-8000-000000000002',cutoff)=1;
 ASSERT public.clubspace_read_head_notifications('00000000-0000-4000-8000-000000000002',cutoff)=0;
 SELECT updated_at INTO stamp FROM public.club_memberships WHERE membership_id=target;
 PERFORM public.clubspace_set_department_head(actor,target,true,stamp);
 ASSERT (SELECT count(*)=2 FROM public.notifications);
 ASSERT public.clubspace_read_head_notifications('00000000-0000-4000-8000-000000000002',cutoff)=0;
 ASSERT (SELECT count(*)=1 FROM public.notifications WHERE read_at IS NULL);
 SELECT updated_at INTO stamp FROM public.club_memberships WHERE user_id=actor;
 BEGIN PERFORM public.clubspace_set_department_head(actor,'00000000-0000-4000-8000-000000000301',false,stamp); RAISE EXCEPTION 'Expected chair protected'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 ASSERT (SELECT count(*)=1 FROM public.club_memberships WHERE role='chairperson' AND user_id=actor);
END $$;
CREATE FUNCTION public.test_notification_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic insert failure'; END $$;
CREATE TRIGGER test_notification_failure BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.test_notification_failure();
DO $$
DECLARE target uuid:='00000000-0000-4000-8000-000000000302'; stamp timestamptz;
BEGIN
 SELECT updated_at INTO stamp FROM public.club_memberships WHERE membership_id=target;
 PERFORM public.clubspace_set_department_head('00000000-0000-4000-8000-000000000001',target,false,stamp);
 SELECT updated_at INTO stamp FROM public.club_memberships WHERE membership_id=target;
 BEGIN
  PERFORM public.clubspace_set_department_head('00000000-0000-4000-8000-000000000001',target,true,stamp);
  RAISE EXCEPTION 'Expected insert failure';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'Synthetic insert failure' THEN RAISE; END IF;
 END;
 ASSERT (SELECT role='member' FROM public.club_memberships WHERE membership_id=target);
 ASSERT (SELECT count(*)=2 FROM public.notifications);
 ASSERT (SELECT count(*)=1 FROM public.club_memberships WHERE role='chairperson');
END $$;
