BEGIN;

-- Deliver in the publication transaction: no worker or retrospective fan-out.
CREATE OR REPLACE FUNCTION clubspace_v2_private.notify_club_followers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entity uuid; event_name text; heading text; href text; actor uuid; club_name text;
BEGIN
 IF TG_TABLE_NAME='recruitment_campaigns' THEN
  IF NEW.status<>'open' OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
   IF OLD.status='open' THEN RETURN NEW; END IF;
  END IF;
  entity:=NEW.campaign_id; event_name:='recruitment.published'; heading:='CLB bạn quan tâm mở đợt tuyển thành viên';
  href:='/recruitments/'||entity; actor:=NEW.updated_by;
 ELSE
  IF NEW.publication_status<>'published' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
   IF OLD.publication_status='published' THEN RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME='club_posts' THEN
   IF NEW.visibility<>'public' THEN RETURN NEW; END IF;
   entity:=NEW.post_id; event_name:='post.published'; heading:='CLB bạn quan tâm có bài viết mới';
   href:='/posts/'||entity; actor:=coalesce(NEW.reviewed_by,NEW.author_id);
  ELSE
   IF NEW.lifecycle_status NOT IN('scheduled','ongoing') THEN RETURN NEW; END IF;
   entity:=NEW.activity_id; event_name:='activity.published'; heading:='CLB bạn quan tâm có hoạt động mới';
   href:='/activities/'||entity; actor:=coalesce(NEW.reviewed_by,NEW.created_by);
  END IF;
 END IF;
 SELECT name INTO club_name FROM public.clubs WHERE club_id=NEW.club_id AND status='published';
 IF NOT FOUND THEN RETURN NEW; END IF;
 INSERT INTO public.notifications(recipient_id,actor_id,type,title,body,data,deduplication_key)
 SELECT f.user_id,actor,event_name,heading,left(club_name||': '||NEW.title,5000),
  jsonb_build_object('club_id',NEW.club_id,'href',href),event_name||':'||entity
 FROM public.club_follows f WHERE f.club_id=NEW.club_id
 ON CONFLICT(recipient_id,deduplication_key) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION clubspace_v2_private.notify_club_followers() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS followed_club_publication ON public.club_posts;
CREATE TRIGGER followed_club_publication AFTER INSERT OR UPDATE ON public.club_posts
 FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.notify_club_followers();
DROP TRIGGER IF EXISTS followed_club_publication ON public.club_activities;
CREATE TRIGGER followed_club_publication AFTER INSERT OR UPDATE ON public.club_activities
 FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.notify_club_followers();
DROP TRIGGER IF EXISTS followed_club_publication ON public.recruitment_campaigns;
CREATE TRIGGER followed_club_publication AFTER INSERT OR UPDATE ON public.recruitment_campaigns
 FOR EACH ROW EXECUTE FUNCTION clubspace_v2_private.notify_club_followers();

CREATE OR REPLACE FUNCTION public.clubspace_read_head_notifications(p_actor uuid,p_through timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 UPDATE public.notifications SET read_at=greatest(clock_timestamp(),created_at)
 WHERE recipient_id=p_actor AND type IN('department.head_assigned','recruitment.application','recruitment.accepted','recruitment.rejected','post.published','activity.published','recruitment.published')
 AND read_at IS NULL AND created_at<=p_through;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.clubspace_read_head_notifications(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clubspace_read_head_notifications(uuid,timestamptz) TO service_role;
COMMIT;
