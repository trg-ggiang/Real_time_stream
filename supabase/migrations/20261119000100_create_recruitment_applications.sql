CREATE TABLE IF NOT EXISTS public.recruitment_applications (
  application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.recruitment_campaigns(campaign_id),
  recruitment_department_id uuid NOT NULL REFERENCES public.recruitment_departments(recruitment_department_id),
  user_id uuid NOT NULL REFERENCES public.users(user_id),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
  student_code text NOT NULL CHECK (length(btrim(student_code)) BETWEEN 1 AND 32),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  portfolio_url text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruitment_applications_one_per_department UNIQUE (campaign_id, recruitment_department_id, user_id)
);

CREATE INDEX IF NOT EXISTS recruitment_applications_queue_idx
  ON public.recruitment_applications (campaign_id, recruitment_department_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS recruitment_applications_user_idx
  ON public.recruitment_applications (user_id, submitted_at DESC);

ALTER TABLE public.recruitment_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recruitment_applications FROM anon, authenticated;
GRANT SELECT, INSERT ON public.recruitment_applications TO service_role;
