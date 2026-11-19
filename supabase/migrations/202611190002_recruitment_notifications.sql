-- Apply after 202611190001, on the development database. Uses existing outbox/inbox.
BEGIN;
CREATE OR REPLACE FUNCTION public.recruitment_deliver_notifications(p_limit integer DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.notification_jobs; a public.recruitment_applications; c public.recruitment_campaigns;
  recipient uuid; recipients uuid[] := '{}'; heading text; message text; link text; inserted integer;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid batch size' USING ERRCODE='22023'; END IF;
 FOR j IN SELECT * FROM public.notification_jobs
   WHERE event_type IN ('application.submitted','application.accepted','application.rejected','recruitment.open','recruitment.closed','recruitment.completed','recruitment.cancelled')
     AND ((status='pending' AND run_at<=clock_timestamp()) OR (status='processing' AND locked_until<=clock_timestamp()))
   ORDER BY run_at,job_id LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
  UPDATE public.notification_jobs SET status='processing',claim_token=gen_random_uuid(),locked_until=clock_timestamp()+interval '1 minute',attempt_count=attempt_count+1 WHERE job_id=j.job_id;
  BEGIN
   IF j.entity_type='application' THEN
    SELECT * INTO a FROM public.recruitment_applications WHERE application_id=j.entity_id;
    IF NOT FOUND THEN
     UPDATE public.notification_jobs SET status='cancelled',claim_token=NULL,locked_until=NULL WHERE job_id=j.job_id;
     CONTINUE;
    END IF;
    SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=a.campaign_id;
    IF j.event_type='application.submitted' THEN
     heading := 'Có đơn ứng tuyển mới';
     message := coalesce(a.profile_snapshot->>'full_name','Một sinh viên')||' đã ứng tuyển: '||c.title;
     link := '/workspace/'||c.club_id||'/recruitments/'||c.campaign_id||'/applications/'||a.application_id;
     FOR recipient IN SELECT user_id FROM public.club_memberships WHERE club_id=c.club_id AND role='chairperson' AND status='active'
     LOOP
      INSERT INTO public.notifications(recipient_id,actor_id,type,title,body,data,deduplication_key)
      VALUES(recipient,a.applicant_id,j.event_type,heading,left(message,5000),jsonb_build_object('href',link,'campaign_id',c.campaign_id,'application_id',a.application_id,'club_id',c.club_id),j.deduplication_key)
      ON CONFLICT(recipient_id,deduplication_key) DO NOTHING;
      GET DIAGNOSTICS inserted = ROW_COUNT;
      IF inserted>0 THEN recipients:=array_append(recipients,recipient); END IF;
     END LOOP;
    ELSE
     recipient:=a.applicant_id;
     heading:=CASE WHEN j.event_type='application.accepted' THEN 'Đơn ứng tuyển đã được duyệt' ELSE 'Kết quả ứng tuyển CLB' END;
     message:=c.title||': '||coalesce(a.result_message,CASE WHEN j.event_type='application.accepted' THEN 'Bạn đã được thêm vào CLB.' ELSE 'Đơn của bạn chưa được chấp thuận.' END);
     link:='/me/recruitment-applications/'||a.application_id;
     INSERT INTO public.notifications(recipient_id,actor_id,type,title,body,data,deduplication_key)
     VALUES(recipient,(j.payload->>'actor_id')::uuid,j.event_type,heading,left(message,5000),jsonb_build_object('href',link,'campaign_id',c.campaign_id,'application_id',a.application_id,'club_id',c.club_id),j.deduplication_key)
     ON CONFLICT(recipient_id,deduplication_key) DO NOTHING;
     GET DIAGNOSTICS inserted = ROW_COUNT;
     IF inserted>0 THEN recipients:=array_append(recipients,recipient); END IF;
    END IF;
   ELSE
    SELECT * INTO c FROM public.recruitment_campaigns WHERE campaign_id=j.entity_id;
    IF NOT FOUND THEN
     UPDATE public.notification_jobs SET status='cancelled',claim_token=NULL,locked_until=NULL WHERE job_id=j.job_id;
     CONTINUE;
    END IF;
    -- Club owners receive campaign lifecycle updates. Other domain jobs remain for their own workers.
    FOR recipient IN SELECT user_id FROM public.club_memberships WHERE club_id=c.club_id AND role='chairperson' AND status='active'
    LOOP
     INSERT INTO public.notifications(recipient_id,actor_id,type,title,body,data,deduplication_key)
     VALUES(recipient,(j.payload->>'actor_id')::uuid,j.event_type,'Cập nhật đợt tuyển',left(c.title||CASE j.event_type WHEN 'recruitment.open' THEN ': Đợt tuyển đã được công khai.' WHEN 'recruitment.closed' THEN ': Đã đóng nhận đơn.' WHEN 'recruitment.completed' THEN ': Đợt tuyển đã hoàn tất.' ELSE ': Đợt tuyển đã hủy.' END,5000),jsonb_build_object('href','/workspace/'||c.club_id||'/recruitments/'||c.campaign_id||'/edit','campaign_id',c.campaign_id,'club_id',c.club_id),j.deduplication_key)
     ON CONFLICT(recipient_id,deduplication_key) DO NOTHING;
     GET DIAGNOSTICS inserted = ROW_COUNT;
     IF inserted>0 THEN recipients:=array_append(recipients,recipient); END IF;
    END LOOP;
   END IF;
   UPDATE public.notification_jobs SET status='completed',processed_at=clock_timestamp(),claim_token=NULL,locked_until=NULL,last_error=NULL WHERE job_id=j.job_id;
  EXCEPTION WHEN OTHERS THEN
   -- The insert subtransaction rolls back; retry is safe due to recipient/dedup unique key.
   UPDATE public.notification_jobs SET status=CASE WHEN attempt_count>=5 THEN 'failed' ELSE 'pending' END,
    run_at=clock_timestamp()+interval '30 seconds'*least(attempt_count*attempt_count,100),claim_token=NULL,locked_until=NULL,last_error='Notification delivery failed; retry or inspect this job.' WHERE job_id=j.job_id;
  END;
 END LOOP;
 RETURN jsonb_build_object('recipient_ids',(SELECT coalesce(jsonb_agg(DISTINCT x),'[]'::jsonb) FROM unnest(recipients) AS x));
END $$;
REVOKE ALL ON FUNCTION public.recruitment_deliver_notifications(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recruitment_deliver_notifications(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.recruitment_read_notifications(p_actor uuid,p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
 UPDATE public.notifications SET read_at=greatest(clock_timestamp(),created_at)
 WHERE recipient_id=p_actor AND read_at IS NULL AND (p_id IS NULL OR notification_id=p_id);
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN jsonb_build_object('updated',affected);
END $$;
REVOKE ALL ON FUNCTION public.recruitment_read_notifications(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recruitment_read_notifications(uuid,uuid) TO service_role;
COMMIT;
