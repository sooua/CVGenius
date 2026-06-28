-- Per-resume section order (P3 custom ordering).
-- Nullable jsonb (null = default order) — safe on existing rows.
-- Apply with `pnpm db:push`, or paste into the Supabase SQL editor.

ALTER TABLE "resumes"
  ADD COLUMN IF NOT EXISTS "section_order" jsonb;
