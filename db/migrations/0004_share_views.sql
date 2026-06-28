-- Share view tracking (P3 — Reactive-Resume-style view analytics).
-- One row per open of a public /r/<token> link. No PII.
-- Apply with `pnpm db:push`, or paste into the Supabase SQL editor.
-- Remember to also apply the RLS policy in db/policies.sql.

CREATE TABLE IF NOT EXISTS "resume_share_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "resume_id" uuid NOT NULL REFERENCES "resumes" ("id") ON DELETE CASCADE,
  "viewed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "resume_share_views_resume_id_idx"
  ON "resume_share_views" ("resume_id");
