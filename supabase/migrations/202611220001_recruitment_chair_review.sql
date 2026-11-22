BEGIN;

ALTER TABLE public.recruitment_campaigns DROP CONSTRAINT IF EXISTS recruitment_campaigns_status_check;
ALTER TABLE public.recruitment_campaigns ADD CONSTRAINT recruitment_campaigns_status_check
  CHECK (status IN ('draft','pending_review','open','closed','completed','cancelled'));

CREATE OR REPLACE FUNCTION clubspace_v2_private.guard_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM clubspace_v2_private.require_chair(NEW.updated_by,NEW.club_id);
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NEW.created_by<>NEW.updated_by THEN RAISE EXCEPTION 'Create own draft'; END IF;
 ELSE
  IF ROW(NEW.campaign_id,NEW.club_id,NEW.created_by) IS DISTINCT FROM ROW(OLD.campaign_id,OLD.club_id,OLD.created_by) THEN RAISE EXCEPTION 'Campaign identity immutable'; END IF;
  IF OLD.status<>'draft' AND ROW(NEW.title,NEW.description,NEW.cover_url,NEW.application_opens_at,NEW.application_closes_at) IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.cover_url,OLD.application_opens_at,OLD.application_closes_at) THEN RAISE EXCEPTION 'Published configuration frozen'; END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='draft' AND NEW.status IN('pending_review','cancelled')) OR (OLD.status='pending_review' AND NEW.status IN('draft','open','cancelled')) OR (OLD.status='open' AND NEW.status IN('closed','cancelled')) OR (OLD.status='closed' AND NEW.status IN('completed','cancelled'))) THEN RAISE EXCEPTION 'Invalid campaign transition'; END IF;
 END IF;
 IF NEW.status IN ('pending_review','open') AND NEW.status IS DISTINCT FROM OLD.status
    AND NEW.application_closes_at <= clock_timestamp() THEN
  RAISE EXCEPTION 'Recruitment deadline passed' USING ERRCODE='22023';
 END IF;
 IF NEW.status='open' AND (TG_OP='INSERT' OR OLD.status<>'open') THEN
  IF NOT EXISTS(SELECT FROM public.recruitment_departments WHERE campaign_id=NEW.campaign_id) OR EXISTS(SELECT FROM public.recruitment_departments rd JOIN public.club_departments d USING(department_id) WHERE rd.campaign_id=NEW.campaign_id AND (d.status<>'active' OR d.is_management OR NOT EXISTS(SELECT FROM public.recruitment_questions q WHERE q.form_version_id=rd.current_form_version_id))) THEN RAISE EXCEPTION 'Configure active departments and forms before publishing'; END IF;
  NEW.published_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_v3_publish(p_actor uuid,p_club uuid,p_id uuid,p_expected timestamptz,p_close boolean DEFAULT false)
RETURNS public.recruitment_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.recruitment_campaigns;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 UPDATE public.recruitment_campaigns SET status=CASE WHEN p_close THEN 'closed' ELSE 'open' END,updated_by=p_actor
 WHERE campaign_id=p_id AND club_id=p_club AND updated_at=p_expected AND status=CASE WHEN p_close THEN 'open' ELSE 'pending_review' END AND deleted_at IS NULL RETURNING * INTO c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recruitment changed; reload' USING ERRCODE='40001'; END IF;
 RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.recruitment_v3_review(
 p_actor uuid,p_club uuid,p_id uuid,p_expected timestamptz,p_return boolean
)
RETURNS public.recruitment_campaigns LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.recruitment_campaigns;
BEGIN
 PERFORM clubspace_v2_private.require_chair(p_actor,p_club);
 UPDATE public.recruitment_campaigns
 SET status=CASE WHEN p_return THEN 'draft' ELSE 'pending_review' END,updated_by=p_actor
 WHERE campaign_id=p_id AND club_id=p_club AND updated_at=p_expected AND deleted_at IS NULL
 AND status=CASE WHEN p_return THEN 'pending_review' ELSE 'draft' END
 RETURNING * INTO c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recruitment changed; reload' USING ERRCODE='40001'; END IF;
 RETURN c;
END $$;

REVOKE ALL ON FUNCTION public.recruitment_v3_review(uuid,uuid,uuid,timestamptz,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recruitment_v3_review(uuid,uuid,uuid,timestamptz,boolean) TO service_role;

COMMIT;
