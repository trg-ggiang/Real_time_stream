-- Development migration: existing clubspace v2 tables/functions are required.
BEGIN;
CREATE OR REPLACE FUNCTION public.clubspace_set_department_head(p_actor uuid,p_membership uuid,p_is_head boolean,p_expected_updated_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.club_memberships; dept public.club_departments; club_name text;
BEGIN
 IF p_actor IS NULL OR p_is_head IS NULL OR p_expected_updated_at IS NULL THEN RAISE EXCEPTION 'Actor, head flag and expected version required' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.club_memberships WHERE membership_id=p_membership;
 IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found' USING ERRCODE='P0002'; END IF;
 PERFORM clubspace_v2_private.require_chair(p_actor,m.club_id);
 SELECT * INTO m FROM public.club_memberships WHERE membership_id=p_membership FOR UPDATE;
 IF m.status<>'active' OR m.role='chairperson' OR m.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Membership changed or not eligible' USING ERRCODE='40001'; END IF;
 SELECT * INTO dept FROM public.club_departments WHERE department_id=m.department_id AND club_id=m.club_id FOR SHARE;
 IF NOT FOUND OR (p_is_head AND (dept.status<>'active' OR dept.is_management)) THEN RAISE EXCEPTION 'Active ordinary department required' USING ERRCODE='22023'; END IF;
 IF (p_is_head AND m.role='head') OR (NOT p_is_head AND m.role='member') THEN RAISE EXCEPTION 'Role already changed' USING ERRCODE='40001'; END IF;
 UPDATE public.club_memberships SET role=CASE WHEN p_is_head THEN 'head' ELSE 'member' END WHERE membership_id=m.membership_id;
 PERFORM clubspace_v2_private.audit(p_actor,m.club_id,'department.head_changed','membership',m.membership_id,jsonb_build_object('old_role',m.role,'new_role',CASE WHEN p_is_head THEN 'head' ELSE 'member' END));
 IF p_is_head THEN
  SELECT name INTO club_name FROM public.clubs WHERE club_id=m.club_id;
  INSERT INTO public.notifications(recipient_id,actor_id,type,title,body,data,deduplication_key)
  VALUES(m.user_id,p_actor,'department.head_assigned','Bạn được bổ nhiệm làm trưởng ban',left('Bạn đã được chọn làm trưởng '||dept.name||' của CLB '||club_name||'.',5000),
   jsonb_build_object('club_id',m.club_id,'department_id',m.department_id,'membership_id',m.membership_id),
   'department.head_assigned:'||m.membership_id||':'||gen_random_uuid());
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.clubspace_set_department_head(uuid,uuid,boolean,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clubspace_set_department_head(uuid,uuid,boolean,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.clubspace_read_head_notifications(p_actor uuid,p_through timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE affected integer;
BEGIN
 IF p_actor IS NULL OR p_through IS NULL THEN RAISE EXCEPTION 'Recipient and cutoff required' USING ERRCODE='22023'; END IF;
 UPDATE public.notifications SET read_at=greatest(clock_timestamp(),created_at)
 WHERE recipient_id=p_actor AND type='department.head_assigned' AND read_at IS NULL AND created_at<=p_through;
 GET DIAGNOSTICS affected=ROW_COUNT; RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.clubspace_read_head_notifications(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clubspace_read_head_notifications(uuid,timestamptz) TO service_role;
COMMIT;
