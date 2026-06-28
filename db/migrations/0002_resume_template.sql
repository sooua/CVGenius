-- PDF template choice per resume (P2 multi-template export).
-- Additive, non-null with a default — safe on existing rows.
-- Apply with `pnpm db:push`, or paste into the Supabase SQL editor.

ALTER TABLE "resumes"
  ADD COLUMN IF NOT EXISTS "template" varchar(20) NOT NULL DEFAULT 'classic';
