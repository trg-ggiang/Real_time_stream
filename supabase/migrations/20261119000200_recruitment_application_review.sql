ALTER TABLE public.recruitment_applications
  ADD COLUMN IF NOT EXISTS score integer CHECK (score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS internal_note text CHECK (length(internal_note) <= 5000),
  ADD COLUMN IF NOT EXISTS feedback text CHECK (length(feedback) <= 5000),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(user_id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

GRANT UPDATE ON public.recruitment_applications TO service_role;
