-- Share link expiry + passcode (P1 privacy hardening).
-- Both columns are nullable and additive — safe to run on existing data.
-- Apply with `pnpm db:push`, or paste into the Supabase SQL editor.

ALTER TABLE "resumes"
  ADD COLUMN IF NOT EXISTS "share_expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "share_passcode" varchar(64);
