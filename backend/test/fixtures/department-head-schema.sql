CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA clubspace_private; CREATE SCHEMA clubspace_v2_private;
CREATE TABLE public.clubs(club_id uuid PRIMARY KEY,name text,status text);
CREATE TABLE public.club_departments(department_id uuid PRIMARY KEY,club_id uuid,name text,status text,is_management boolean);
CREATE TABLE public.club_memberships(membership_id uuid PRIMARY KEY,user_id uuid,club_id uuid,department_id uuid,role text,status text,updated_at timestamptz DEFAULT clock_timestamp());
CREATE TABLE public.notifications(notification_id uuid DEFAULT gen_random_uuid(),recipient_id uuid,actor_id uuid,type text,title text,body text,data jsonb,deduplication_key text,created_at timestamptz DEFAULT clock_timestamp(),read_at timestamptz,UNIQUE(recipient_id,deduplication_key));
CREATE TABLE public.audit_logs(actor_id uuid,club_id uuid,action text,entity_type text,entity_id uuid,change_data jsonb);
CREATE FUNCTION clubspace_v2_private.audit(uuid,uuid,text,text,uuid,jsonb) RETURNS void LANGUAGE sql AS 'INSERT INTO public.audit_logs VALUES($1,$2,$3,$4,$5,$6)';
CREATE OR REPLACE FUNCTION clubspace_private.guard_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE dept public.club_departments%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.club_id IS DISTINCT FROM OLD.club_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Membership user and club are immutable; create a new history row instead.';
  END IF;
  SELECT * INTO dept FROM public.club_departments
    WHERE department_id = NEW.department_id AND club_id = NEW.club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Department must belong to the membership club.'; END IF;
  IF NEW.status = 'active' AND dept.status <> 'active' THEN RAISE EXCEPTION 'Active members require an active department.'; END IF;
  IF NEW.role = 'chairperson' AND NOT dept.is_management THEN RAISE EXCEPTION 'Chairperson must belong to the management department.'; END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION clubspace_private.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.require_chair(p_user uuid, p_club uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m uuid; BEGIN m:=clubspace_v2_private.require_member(p_user,p_club);
 IF NOT EXISTS(SELECT FROM public.club_memberships WHERE membership_id=m AND role='chairperson') THEN RAISE EXCEPTION 'Current chairperson required' USING ERRCODE='42501'; END IF; END $function$;

CREATE OR REPLACE FUNCTION clubspace_v2_private.require_member(p_user uuid, p_club uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE m uuid; BEGIN
 SELECT x.membership_id INTO m FROM public.club_memberships x JOIN public.clubs c ON c.club_id=x.club_id
 JOIN public.club_departments d ON d.department_id=x.department_id
 WHERE x.user_id=p_user AND x.club_id=p_club AND x.status='active' AND c.status='published' AND d.status='active' FOR SHARE OF x,c,d;
 IF m IS NULL THEN RAISE EXCEPTION 'Active membership in a published club required' USING ERRCODE='42501'; END IF; RETURN m; END $function$;

CREATE TRIGGER membership_guard BEFORE UPDATE ON public.club_memberships FOR EACH ROW EXECUTE FUNCTION clubspace_private.guard_membership();
CREATE TRIGGER membership_touch BEFORE UPDATE ON public.club_memberships FOR EACH ROW EXECUTE FUNCTION clubspace_private.touch_updated_at();
INSERT INTO public.clubs VALUES('00000000-0000-4000-8000-000000000101','Test club','published');
INSERT INTO public.club_departments VALUES('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','Management','active',true),('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000101','Technical','active',false);
INSERT INTO public.club_memberships VALUES('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201','chairperson','active',clock_timestamp()),('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000202','member','active',clock_timestamp());
