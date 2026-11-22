-- =============================================================================
-- SECURITY FIX 2: Supabase Advisor — SQL-level cleanup
-- =============================================================================
-- Fixes the parts of the Security Advisor report that can be fixed with SQL
-- ALONE, with NO app-code change and NO feature breakage:
--
--   1. "Function Search Path Mutable"  (~10 warnings)
--      -> pins search_path on every public function.
--
--   2. "SECURITY DEFINER view"  (2 ERRORS)
--      -> tables: v_student_assignment_status, recordings
--      -> switches them to security_invoker so they no longer bypass the
--         caller's RLS. (No behavior change today, because the underlying
--         table policies are still permissive.)
--
--   3. "RLS disabled" on push_subscriptions  (1 ERROR)
--      -> turns RLS back on and adds a permissive policy so web push keeps
--         working exactly as before.
--
-- Idempotent: safe to run multiple times.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES **NOT** FIX (and why it cannot be done with SQL alone)
-- ---------------------------------------------------------------------------
-- The remaining "RLS Policy Always True" warnings (~57) on the data tables
-- (app_users, submissions, grades, etc.) are NOT fixable here. The app uses
-- CUSTOM auth (a JSON blob in the device storage), never a Supabase Auth
-- session, so `auth.uid()` is always NULL. Replacing those policies with
-- `auth.uid()`-based rules would block every request, including login.
--
-- Removing the open access requires APP changes first:
--   * move sensitive writes behind a server route using the SERVICE ROLE key,
--   * then replace the `USING (true)` policies with real per-user rules.
-- That is SECURITY-FIX-3+ (app-side), not SQL.
--
-- One residual advisor item will remain even after this script:
--   * "Sensitive Columns Exposed" on push_subscriptions (endpoint / p256dh /
--     auth keys). The client reads those columns directly (lib/webPush.ts), so
--     they cannot be revoked without breaking web push. The clean fix is a
--     SECURITY DEFINER RPC (get_push_subscriptions) + a one-line app change.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK (run only if something breaks):
-- ---------------------------------------------------------------------------
--   DO $$
--   DECLARE f RECORD;
--   BEGIN
--     FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--              WHERE n.nspname='public' AND p.prokind='f'
--     LOOP EXECUTE format('ALTER FUNCTION %s RESET search_path', f.oid::regprocedure); END LOOP;
--   END $$;
--   ALTER VIEW public.v_student_assignment_status SET (security_invoker = false);
--   ALTER VIEW public.recordings SET (security_invoker = false);
--   ALTER TABLE public.push_subscriptions DISABLE ROW LEVEL SECURITY;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Pin search_path on every function in the public schema.
--    "public, extensions" is used (not just "public") so functions that call
--    pgcrypto (crypt/gen_salt, e.g. login_user) keep resolving on Supabase,
--    where extensions live in the `extensions` schema. A non-existent schema in
--    search_path is silently ignored, so this is safe either way.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f.oid::regprocedure);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Make the two SECURITY DEFINER views use the caller's privileges instead.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v RECORD;
BEGIN
    FOR v IN
        SELECT c.oid, n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'v'
          AND c.relname IN ('v_student_assignment_status', 'recordings')
    LOOP
        EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', v.nspname, v.relname);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. push_subscriptions: re-enable RLS with a permissive policy.
--    The client (lib/webPush.ts) upserts, deletes and selects from this table
--    with the anon key, so the policy must stay permissive for push to work.
-- -----------------------------------------------------------------------------
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow all on push_subscriptions" ON public.push_subscriptions
    FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.push_subscriptions TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Verification — read the result in the SQL editor.
--    functions_missing_search_path  -> should be 0
--    views_still_security_definer   -> should be 0
--    push_subscriptions_rls_enabled -> should be true
-- -----------------------------------------------------------------------------
SELECT
    (
        SELECT count(*)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND (
              p.proconfig IS NULL
              OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
          )
    ) AS functions_missing_search_path,
    (
        SELECT count(*)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'v'
          AND NOT COALESCE(c.reloptions @> ARRAY['security_invoker=true'], false)
    ) AS views_still_security_definer,
    (
        SELECT relrowsecurity FROM pg_class WHERE oid = 'public.push_subscriptions'::regclass
    ) AS push_subscriptions_rls_enabled;
