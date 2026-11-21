CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA clubspace_v2_private;
CREATE TABLE public.clubs(club_id uuid PRIMARY KEY,name text,status text);
CREATE TABLE public.club_follows(club_id uuid,user_id uuid,PRIMARY KEY(club_id,user_id));
CREATE TABLE public.club_posts(post_id uuid PRIMARY KEY,club_id uuid,title text,publication_status text,visibility text,reviewed_by uuid,author_id uuid);
CREATE TABLE public.club_activities(activity_id uuid PRIMARY KEY,club_id uuid,title text,publication_status text,lifecycle_status text,reviewed_by uuid,created_by uuid);
CREATE TABLE public.recruitment_campaigns(campaign_id uuid PRIMARY KEY,club_id uuid,title text,status text,deleted_at timestamptz,updated_by uuid);
CREATE TABLE public.notifications(notification_id uuid DEFAULT gen_random_uuid(),recipient_id uuid,actor_id uuid,type text,title text,body text,data jsonb,deduplication_key text,created_at timestamptz DEFAULT clock_timestamp(),read_at timestamptz,UNIQUE(recipient_id,deduplication_key));
