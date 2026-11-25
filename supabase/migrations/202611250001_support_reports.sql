BEGIN;

CREATE TABLE public.support_reports (
  report_id uuid PRIMARY KEY,
  reporter_id uuid NOT NULL CONSTRAINT support_reports_reporter_id_fkey REFERENCES public.users(user_id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('account', 'clubs', 'recruitment', 'meetings', 'content', 'other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 5 AND 150),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 20 AND 5000),
  steps text NOT NULL DEFAULT '' CHECK (char_length(steps) <= 3000),
  page_path text NOT NULL DEFAULT '' CHECK (char_length(page_path) <= 500 AND (page_path = '' OR page_path ~ '^/[^/?#[:space:]\\][^?#[:space:]\\]*$' OR page_path = '/')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'rejected')),
  admin_response text NOT NULL DEFAULT '' CHECK (char_length(admin_response) <= 3000),
  processed_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  CHECK (status NOT IN ('resolved', 'rejected') OR char_length(btrim(admin_response)) >= 10),
  CHECK ((status IN ('resolved', 'rejected')) = (resolved_at IS NOT NULL))
);

CREATE INDEX support_reports_reporter_created_idx ON public.support_reports(reporter_id, created_at DESC, report_id);
CREATE INDEX support_reports_status_created_idx ON public.support_reports(status, created_at DESC, report_id);
CREATE INDEX support_reports_created_idx ON public.support_reports(created_at DESC, report_id);
CREATE INDEX support_reports_processed_by_idx ON public.support_reports(processed_by) WHERE processed_by IS NOT NULL;

ALTER TABLE public.support_reports ENABLE ROW LEVEL SECURITY;
-- Application JWTs are verified by NestJS. Browsers never access this table directly.
REVOKE ALL ON public.support_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.support_reports TO service_role;

CREATE FUNCTION public.touch_support_report_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_support_report_updated_at() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER support_reports_updated_at BEFORE UPDATE ON public.support_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_support_report_updated_at();

NOTIFY pgrst, 'reload schema';
COMMIT;
