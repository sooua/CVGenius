-- ─────────────────────────────────────────────────────────────────────────
-- FirstCV · Row Level Security policies
-- ─────────────────────────────────────────────────────────────────────────
--
-- Why this file:
--   Our Next.js app talks to Postgres through drizzle, using DATABASE_URL
--   (the postgres role), which BYPASSRLS. The app itself checks `userId`
--   on every query, so the server code is already tenant-safe. These
--   policies are a second line of defense for any path that goes through
--   Supabase's anon/service role or Realtime — including the Supabase
--   dashboard, a future browser-side Supabase client call, or CDC
--   subscriptions we may add later.
--
-- How to apply:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Paste this file and run
--   3. Re-run whenever you add a new table or change the structure
--
-- All policies are idempotent via DROP POLICY IF EXISTS guards.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── users ───────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Inserts into users happen from the DAL (first-login upsert) via postgres
-- role. If you ever enable user-driven inserts from the client, add a
-- matching INSERT policy here.

-- ─── resumes ─────────────────────────────────────────────────────────────
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resumes_owner_all ON public.resumes;
CREATE POLICY resumes_owner_all ON public.resumes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Future: if we want Realtime-subscribe to /r/[token] share URLs from an
-- unauthenticated browser, uncomment this policy. Today the public route
-- is server-rendered, so this is not needed.
-- DROP POLICY IF EXISTS resumes_public_share_select ON public.resumes;
-- CREATE POLICY resumes_public_share_select ON public.resumes
--   FOR SELECT USING (share_enabled = true);

-- ─── resume_versions ─────────────────────────────────────────────────────
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resume_versions_owner_all ON public.resume_versions;
CREATE POLICY resume_versions_owner_all ON public.resume_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.resumes r
      WHERE r.id = resume_versions.resume_id AND r.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.resumes r
      WHERE r.id = resume_versions.resume_id AND r.user_id = auth.uid()
    )
  );

-- ─── resume_share_views ──────────────────────────────────────────────────
-- Owner can read their resumes' view rows. Inserts come from the server
-- (postgres role, bypasses RLS) when a public link is opened.
ALTER TABLE public.resume_share_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resume_share_views_owner_select ON public.resume_share_views;
CREATE POLICY resume_share_views_owner_select ON public.resume_share_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.resumes r
      WHERE r.id = resume_share_views.resume_id AND r.user_id = auth.uid()
    )
  );

-- ─── job_targets ─────────────────────────────────────────────────────────
ALTER TABLE public.job_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_targets_owner_all ON public.job_targets;
CREATE POLICY job_targets_owner_all ON public.job_targets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── ai_tasks ────────────────────────────────────────────────────────────
ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_tasks_owner_all ON public.ai_tasks;
CREATE POLICY ai_tasks_owner_all ON public.ai_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── orders ──────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_owner_select ON public.orders;
CREATE POLICY orders_owner_select ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- Inserts and updates on orders are driven by the Stripe webhook + our
-- server action (both run as postgres role), so no client-side write
-- policies. If you add a pricing page that inserts from the browser, add
-- INSERT + UPDATE policies with auth.uid() = user_id here.

-- ─────────────────────────────────────────────────────────────────────────
-- Verification queries — useful after running the script.
-- ─────────────────────────────────────────────────────────────────────────
-- Which tables have RLS enabled:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- List all policies:
--   SELECT schemaname, tablename, policyname, cmd, qual
--     FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
