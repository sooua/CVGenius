-- Turn job_targets into a lightweight application tracker (P3).
-- resume_id becomes nullable + ON DELETE SET NULL (keep the record if the
-- linked resume is deleted); category becomes nullable; add tracking fields.
-- `pnpm db:push` will compute this diff automatically; SQL provided for ref.

ALTER TABLE "job_targets" ALTER COLUMN "resume_id" DROP NOT NULL;
ALTER TABLE "job_targets" ALTER COLUMN "category" DROP NOT NULL;

ALTER TABLE "job_targets"
  DROP CONSTRAINT IF EXISTS "job_targets_resume_id_resumes_id_fk";
ALTER TABLE "job_targets"
  ADD CONSTRAINT "job_targets_resume_id_resumes_id_fk"
  FOREIGN KEY ("resume_id") REFERENCES "resumes" ("id") ON DELETE SET NULL;

ALTER TABLE "job_targets"
  ADD COLUMN IF NOT EXISTS "company" varchar(120),
  ADD COLUMN IF NOT EXISTS "role" varchar(120),
  ADD COLUMN IF NOT EXISTS "job_url" text,
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'saved',
  ADD COLUMN IF NOT EXISTS "applied_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
