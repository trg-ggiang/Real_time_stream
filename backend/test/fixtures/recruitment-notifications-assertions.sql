DO $$
DECLARE r jsonb; before_count bigint; job uuid; other_job uuid;
BEGIN
 ASSERT NOT has_function_privilege('anon','public.recruitment_deliver_notifications(integer)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.recruitment_read_notifications(uuid,uuid)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.recruitment_deliver_notifications(integer)','EXECUTE');
 INSERT INTO public.notification_jobs(event_type,entity_type,entity_id,deduplication_key)
 VALUES('post.published','post',gen_random_uuid(),'unrelated-domain') RETURNING job_id INTO other_job;
 r:=public.recruitment_deliver_notifications(100);
 ASSERT jsonb_array_length(r->'recipient_ids')>=2;
 ASSERT EXISTS(SELECT FROM public.notifications WHERE recipient_id='00000000-0000-4000-8000-000000000001' AND type='application.submitted' AND data->>'href' LIKE '/workspace/%/applications/%');
 ASSERT EXISTS(SELECT FROM public.notifications WHERE recipient_id='00000000-0000-4000-8000-000000000003' AND type='application.accepted' AND data->>'href' LIKE '/me/recruitment-applications/%');
 ASSERT EXISTS(SELECT FROM public.notifications WHERE recipient_id='00000000-0000-4000-8000-000000000004' AND type='application.rejected');
 ASSERT NOT EXISTS(SELECT FROM public.notifications WHERE recipient_id IN('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000009'));
 ASSERT (SELECT status='pending' FROM public.notification_jobs WHERE job_id=other_job);
 SELECT count(*) INTO before_count FROM public.notifications;
 UPDATE public.notification_jobs SET status='pending',processed_at=NULL WHERE status='completed';
 PERFORM public.recruitment_deliver_notifications(100);
 ASSERT (SELECT count(*)=before_count FROM public.notifications);
 r:=public.recruitment_read_notifications('00000000-0000-4000-8000-000000000009',(SELECT notification_id FROM public.notifications LIMIT 1));
 ASSERT (r->>'updated')::int=0;
 r:=public.recruitment_read_notifications('00000000-0000-4000-8000-000000000003',NULL);
 ASSERT (r->>'updated')::int=1;
 ASSERT NOT EXISTS(SELECT FROM public.notifications WHERE recipient_id='00000000-0000-4000-8000-000000000003' AND read_at IS NULL);
 -- Recover a lease abandoned by an earlier worker, without duplicate inbox rows.
 UPDATE public.notification_jobs SET status='processing',claim_token=gen_random_uuid(),locked_until=clock_timestamp()-interval '1 minute' WHERE event_type='application.accepted';
 PERFORM public.recruitment_deliver_notifications(100);
 ASSERT (SELECT count(*)=before_count FROM public.notifications);
 -- A malformed event retries with backoff, then stops at five attempts.
 INSERT INTO public.notification_jobs(event_type,entity_type,entity_id,payload,deduplication_key)
 SELECT 'application.accepted','application',application_id,'{"actor_id":"invalid"}'::jsonb,'retry-check' FROM public.recruitment_applications LIMIT 1 RETURNING job_id INTO job;
 PERFORM public.recruitment_deliver_notifications(100);
 ASSERT (SELECT status='pending' AND attempt_count=1 AND run_at>clock_timestamp() AND claim_token IS NULL FROM public.notification_jobs WHERE job_id=job);
 UPDATE public.notification_jobs SET attempt_count=4,run_at=clock_timestamp() WHERE job_id=job;
 PERFORM public.recruitment_deliver_notifications(100);
 ASSERT (SELECT status='failed' AND attempt_count=5 AND last_error IS NOT NULL FROM public.notification_jobs WHERE job_id=job);
 ASSERT (SELECT count(*)=before_count FROM public.notifications);
END $$;
