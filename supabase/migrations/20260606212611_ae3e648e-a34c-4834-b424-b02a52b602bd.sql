ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_completed_steps text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tour_completed_at timestamptz;