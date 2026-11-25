DO $$ BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.support_reports'::regclass) THEN RAISE EXCEPTION 'RLS missing'; END IF;
  IF (SELECT count(*) FROM pg_indexes WHERE tablename='support_reports') <> 5 THEN RAISE EXCEPTION 'Expected primary key and four indexes'; END IF;
END $$;
SET ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM * FROM public.support_reports; RAISE EXCEPTION 'anon read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM * FROM public.support_reports; RAISE EXCEPTION 'authenticated read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE service_role;
INSERT INTO public.support_reports(report_id,reporter_id,category,title,description,page_path)
VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','meetings','Camera không hoạt động','Camera không hoạt động khi tôi vào phòng họp.','/workspace/club');
DO $$ DECLARE original timestamptz; BEGIN
  SELECT updated_at INTO original FROM public.support_reports LIMIT 1;
  BEGIN
    UPDATE public.support_reports SET status='resolved' WHERE report_id='33333333-3333-4333-8333-333333333333';
    RAISE EXCEPTION 'Closing without response accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.support_reports SET status='resolved', admin_response='Đã sửa cấu hình camera.', processed_by='22222222-2222-4222-8222-222222222222', resolved_at=clock_timestamp()
  WHERE report_id='33333333-3333-4333-8333-333333333333';
  IF NOT EXISTS(SELECT 1 FROM public.support_reports WHERE updated_at > original AND status='resolved') THEN RAISE EXCEPTION 'Update timestamp or state failed'; END IF;
  BEGIN
    UPDATE public.support_reports SET page_path='//outside.example'; RAISE EXCEPTION 'External path accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.support_reports SET reporter_id='99999999-9999-4999-8999-999999999999'; RAISE EXCEPTION 'Unknown reporter accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.support_reports SELECT * FROM public.support_reports; RAISE EXCEPTION 'Duplicate ID accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN DELETE FROM public.support_reports; RAISE EXCEPTION 'Service role delete allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
