ALTER TABLE public.profiles
  ADD COLUMN plan_type           TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_type IN ('free','chat','voice')),
  ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active','inactive','past_due','canceled')),
  ADD COLUMN stripe_customer_id  TEXT UNIQUE,
  ADD COLUMN stripe_sub_id       TEXT UNIQUE,
  ADD COLUMN plan_expires_at     TIMESTAMPTZ;
