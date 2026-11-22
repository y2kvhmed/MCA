-- =============================================================================
-- SECURITY — ALL FIXES IN ONE FILE   (FIX-3 + FIX-2 + FIX-4 combined)
-- =============================================================================
-- Replaces running SECURITY-FIX-3 / FIX-2 / FIX-4 separately.
-- (SECURITY-FIX-1 is the OLD custom-auth design and is intentionally NOT here.)
--
-- ###########################################################################
-- ##  READ THIS FIRST — THE ORDER MATTERS                                 ##
-- ###########################################################################
-- 1. Deploy the NEW app build (the one that logs in with Supabase Auth,
--    lib/auth.ts -> supabase.auth.signInWithPassword) at (about) the same time
--    you run this file. As soon as this file runs, the OLD login stops working
--    because plain-text passwords are replaced with hashes.
-- 2. Run this whole file in the Supabase SQL editor.
-- 3. Read the verification SELECT at the very bottom:
--      missing_auth_accounts   = 0
--      identities_missing      = 0
--      plaintext_passwords_left= 0
--      rls_disabled            = 0
--    and confirm a real user can log in.
--
-- It is idempotent (safe to run again).
--
-- IF ANYTHING BREAKS: every PART has its own rollback comment right above it.
-- The RLS rollback (bottom of PART 3) is the "undo switch" that restores the
-- old wide-open behaviour if the app stops working.
--
-- Run order inside this file:  PART 1 (Auth bridge) -> PART 2 (Advisor cleanup)
--                              -> PART 3 (RLS lockdown).
-- =============================================================================


-- ###########################################################################
-- PART 1 / 3 — SUPABASE AUTH BRIDGE   (was SECURITY-FIX-3)
-- ###########################################################################
-- ROLLBACK: DROP TRIGGER IF EXISTS trg_sync_app_user_to_auth ON public.app_users;
--           DROP FUNCTION IF EXISTS public.sync_app_user_to_auth();
--           (existing auth.users rows can be left as-is)
-- ---------------------------------------------------------------------------
-- Creates a real Supabase Auth account for EVERY row in app_users (same uuid,
-- email and password), installs a trigger to mirror future create/password
-- changes, then wipes the clear-text secret down to a bcrypt hash.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.sync_app_user_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_hash  text;
  v_email text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.password_hash IS NOT DISTINCT FROM OLD.password_hash
       AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
      RETURN NEW;
    END IF;
  END IF;

  v_email := lower(trim(NEW.email));

  IF NEW.password_hash IS NULL OR NEW.password_hash = '' THEN
    RETURN NEW;
  ELSIF NEW.password_hash LIKE '$2%' THEN
    v_hash := NEW.password_hash;
  ELSE
    v_hash := crypt(NEW.password_hash, gen_salt('bf'));
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    NEW.id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.created_at, NOW()),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', NEW.role),
    jsonb_build_object('role', NEW.role, 'name', NEW.name)
  )
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email              = EXCLUDED.email,
        updated_at         = NOW();

  EXECUTE format(
    'INSERT INTO auth.identities
       (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
     VALUES (%L, %L, %L::jsonb, %L, %L, NOW(), NOW(), NOW())
     ON CONFLICT DO NOTHING',
    NEW.id::text,
    NEW.id::text,
    json_build_object('sub', NEW.id::text, 'email', v_email, 'email_verified', true)::text,
    'email',
    NEW.id::text
  );

  IF NEW.password_hash NOT LIKE '$2%' THEN
    UPDATE public.app_users SET password_hash = v_hash WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_app_user_to_auth ON public.app_users;
CREATE TRIGGER trg_sync_app_user_to_auth
AFTER INSERT OR UPDATE OF password_hash, email ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.sync_app_user_to_auth();

-- Backfill every existing user. Each row is isolated so one bad email cannot
-- abort the run.
DO $$
DECLARE
  r       RECORD;
  v_hash  text;
  v_email text;
  ok      int := 0;
  failed  int := 0;
BEGIN
  FOR r IN SELECT id, email, password_hash, role, name, created_at FROM public.app_users LOOP
    BEGIN
      v_email := lower(trim(r.email));

      IF r.password_hash IS NULL OR r.password_hash = '' THEN
        failed := failed + 1;
        RAISE NOTICE 'Auth bridge skipped % (%) : empty password', r.email, r.id;
        CONTINUE;
      ELSIF r.password_hash LIKE '$2%' THEN
        v_hash := r.password_hash;
      ELSE
        v_hash := crypt(r.password_hash, gen_salt('bf'));
      END IF;

      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) VALUES (
        r.id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        v_hash,
        COALESCE(r.created_at, NOW()),
        COALESCE(r.created_at, NOW()),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', r.role),
        jsonb_build_object('role', r.role, 'name', r.name)
      )
      ON CONFLICT (id) DO UPDATE
        SET encrypted_password = EXCLUDED.encrypted_password,
            email              = EXCLUDED.email,
            updated_at         = NOW();

      EXECUTE format(
        'INSERT INTO auth.identities
           (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
         VALUES (%L, %L, %L::jsonb, %L, %L, NOW(), NOW(), NOW())
         ON CONFLICT DO NOTHING',
        r.id::text,
        r.id::text,
        json_build_object('sub', r.id::text, 'email', v_email, 'email_verified', true)::text,
        'email',
        r.id::text
      );

      IF r.password_hash NOT LIKE '$2%' THEN
        UPDATE public.app_users SET password_hash = v_hash WHERE id = r.id;
      END IF;

      ok := ok + 1;
    EXCEPTION WHEN others THEN
      failed := failed + 1;
      RAISE NOTICE 'Auth bridge skipped % (%): %', r.email, r.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Auth bridge complete. mirrored %, skipped %', ok, failed;
END $$;


-- ###########################################################################
-- PART 2 / 3 — SUPABASE ADVISOR CLEANUP   (was SECURITY-FIX-2)
-- ###########################################################################
-- ROLLBACK:
--   ALTER VIEW public.v_student_assignment_status SET (security_invoker = false);
--   ALTER VIEW public.recordings SET (security_invoker = false);
--   (push_subscriptions is handled again by PART 3 anyway)
-- ---------------------------------------------------------------------------
-- Pins search_path on every public function; switches the two SECURITY DEFINER
-- views to security_invoker; re-enables RLS on push_subscriptions.
-- ---------------------------------------------------------------------------

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

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.push_subscriptions TO anon, authenticated, service_role;


-- ###########################################################################
-- PART 3 / 3 — ROW LEVEL SECURITY LOCKDOWN   (was SECURITY-FIX-4)
-- ###########################################################################
-- ============================ ROLLBACK (undo switch) =======================
-- Run this ONLY if the app stops working after this file. It restores the old
-- wide-open behaviour so nothing is ever permanently stuck:
--
--   DO $$
--   DECLARE pol RECORD; t text;
--   BEGIN
--     FOR pol IN SELECT schemaname, tablename, policyname FROM pg_policies
--                WHERE schemaname = 'public'
--     LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
--            pol.policyname, pol.schemaname, pol.tablename); END LOOP;
--     FOR t IN SELECT unnest(ARRAY[
--        'app_settings','schools','app_users','teacher_schools','classes',
--        'enrollments','assignments','submissions','assignment_comments',
--        'study_materials','lessons','student_notes','messages',
--        'private_messages','notifications','attendance_sheets',
--        'attendance_records','attendance','calendar_events','push_tokens',
--        'file_metadata','recording_audit_log','tests','student_test_results',
--        'push_subscriptions'])
--     LOOP EXECUTE format(
--        'CREATE POLICY "Allow all on %1$s" ON public.%1$I FOR ALL USING (true) WITH CHECK (true)', t);
--     END LOOP;
--     FOR pol IN SELECT policyname FROM pg_policies
--                WHERE schemaname='storage' AND tablename='objects'
--     LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname); END LOOP;
--   END $$;
--   CREATE POLICY "Public Read All Storage Objects"  ON storage.objects FOR SELECT USING (true);
--   CREATE POLICY "Public Insert All Storage Objects" ON storage.objects FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Public Update All Storage Objects" ON storage.objects FOR UPDATE USING (true);
--   CREATE POLICY "Public Delete All Storage Objects" ON storage.objects FOR DELETE USING (true);
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 3A — Helper functions (SECURITY DEFINER so they can read app_users without
--      recursion; search_path pinned).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.app_users WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'admin'); $$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role = 'teacher'); $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND role IN ('teacher','admin')); $$;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT school_id FROM public.app_users WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.teaches_school(p_school uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_school IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.app_users
             WHERE id = auth.uid() AND role = 'teacher' AND school_id = p_school)
    OR EXISTS (SELECT 1 FROM public.teacher_schools
             WHERE teacher_id = auth.uid() AND school_id = p_school)
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_app_role(), public.is_admin(),
  public.is_teacher(), public.is_staff(), public.current_school_id(),
  public.teaches_school(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3B — Drop every existing policy on the app tables (removes the old
--      "Allow all ..." wide-open policies; makes this file re-runnable).
-- ---------------------------------------------------------------------------
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'app_settings','schools','app_users','teacher_schools','classes',
        'enrollments','assignments','submissions','assignment_comments',
        'study_materials','lessons','student_notes','messages',
        'private_messages','notifications','attendance_sheets',
        'attendance_records','attendance','calendar_events','push_tokens',
        'file_metadata','recording_audit_log','tests','student_test_results',
        'push_subscriptions')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.app_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_schools      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_materials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sheets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_metadata        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_audit_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions   ENABLE ROW LEVEL SECURITY;

-- ---------- app_settings (readable pre-login; admin writes)
CREATE POLICY app_settings_select ON public.app_settings FOR SELECT USING (true);
CREATE POLICY app_settings_admin_write ON public.app_settings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- schools (public directory; admin writes)
CREATE POLICY schools_select ON public.schools FOR SELECT USING (true);
CREATE POLICY schools_admin_write ON public.schools FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- app_users   *** the critical table ***
CREATE POLICY app_users_select ON public.app_users FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_admin()
    OR (school_id IS NOT NULL
        AND (school_id = public.current_school_id() OR public.teaches_school(school_id)))
  );
CREATE POLICY app_users_insert ON public.app_users FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY app_users_update_own ON public.app_users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY app_users_update_admin ON public.app_users FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY app_users_delete ON public.app_users FOR DELETE
  USING (public.is_admin());

-- ---------- teacher_schools
CREATE POLICY teacher_schools_select ON public.teacher_schools FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY teacher_schools_admin_write ON public.teacher_schools FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- classes / enrollments
CREATE POLICY classes_select ON public.classes FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY classes_staff_write ON public.classes FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY enrollments_select ON public.enrollments FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY enrollments_staff_write ON public.enrollments FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- assignments
CREATE POLICY assignments_select ON public.assignments FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (public.is_staff() OR school_id IS NULL OR school_id = public.current_school_id())
  );
CREATE POLICY assignments_insert ON public.assignments FOR INSERT
  WITH CHECK (public.is_staff() AND (teacher_id = auth.uid() OR public.is_admin()));
CREATE POLICY assignments_update ON public.assignments FOR UPDATE
  USING (teacher_id = auth.uid() OR public.is_admin())
  WITH CHECK (teacher_id = auth.uid() OR public.is_admin());
CREATE POLICY assignments_delete ON public.assignments FOR DELETE
  USING (teacher_id = auth.uid() OR public.is_admin());

-- ---------- submissions
CREATE POLICY submissions_select ON public.submissions FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR (public.is_teacher() AND EXISTS (
          SELECT 1 FROM public.assignments a
          WHERE a.id = submissions.assignment_id
            AND (a.teacher_id = auth.uid() OR public.teaches_school(a.school_id))))
  );
CREATE POLICY submissions_insert ON public.submissions FOR INSERT
  WITH CHECK (student_id = auth.uid());
CREATE POLICY submissions_update ON public.submissions FOR UPDATE
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.assignments a
               WHERE a.id = submissions.assignment_id AND a.teacher_id = auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.assignments a
               WHERE a.id = submissions.assignment_id AND a.teacher_id = auth.uid())
  );
CREATE POLICY submissions_delete ON public.submissions FOR DELETE
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.assignments a
               WHERE a.id = submissions.assignment_id AND a.teacher_id = auth.uid())
  );

-- ---------- assignment_comments
CREATE POLICY assignment_comments_select ON public.assignment_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY assignment_comments_insert ON public.assignment_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY assignment_comments_update ON public.assignment_comments FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY assignment_comments_delete ON public.assignment_comments FOR DELETE
  USING (user_id = auth.uid() OR public.is_staff());

-- ---------- study_materials
CREATE POLICY study_materials_select ON public.study_materials FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (public.is_staff() OR school_id IS NULL OR school_id = public.current_school_id())
  );
CREATE POLICY study_materials_insert ON public.study_materials FOR INSERT
  WITH CHECK (public.is_staff());
CREATE POLICY study_materials_update ON public.study_materials FOR UPDATE
  USING ((public.is_teacher() AND teacher_id = auth.uid()) OR public.is_admin())
  WITH CHECK ((public.is_teacher() AND teacher_id = auth.uid()) OR public.is_admin());
CREATE POLICY study_materials_delete ON public.study_materials FOR DELETE
  USING ((public.is_teacher() AND teacher_id = auth.uid()) OR public.is_admin());

-- ---------- lessons
CREATE POLICY lessons_select ON public.lessons FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (public.is_staff() OR school_id IS NULL OR school_id = public.current_school_id())
  );
CREATE POLICY lessons_insert ON public.lessons FOR INSERT
  WITH CHECK (public.is_staff());
CREATE POLICY lessons_update ON public.lessons FOR UPDATE
  USING (teacher_id = auth.uid() OR public.is_admin())
  WITH CHECK (teacher_id = auth.uid() OR public.is_admin());
CREATE POLICY lessons_delete ON public.lessons FOR DELETE
  USING (teacher_id = auth.uid() OR public.is_admin());

-- ---------- student_notes (private teacher notes -> staff only)
CREATE POLICY student_notes_staff ON public.student_notes FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- messages
CREATE POLICY messages_select ON public.messages FOR SELECT
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (school_id IS NOT NULL AND school_id = public.current_school_id())
  );
CREATE POLICY messages_insert ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY messages_update ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY messages_delete ON public.messages FOR DELETE
  USING (sender_id = auth.uid() OR public.is_admin());

-- ---------- private_messages (only the two participants)
CREATE POLICY private_messages_select ON public.private_messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY private_messages_insert ON public.private_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY private_messages_update ON public.private_messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY private_messages_delete ON public.private_messages FOR DELETE
  USING (sender_id = auth.uid() OR public.is_admin());

-- ---------- notifications
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY notifications_insert ON public.notifications FOR INSERT
  WITH CHECK (public.is_staff());
CREATE POLICY notifications_update ON public.notifications FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY notifications_delete ON public.notifications FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------- attendance
CREATE POLICY attendance_sheets_select ON public.attendance_sheets FOR SELECT
  USING (public.is_staff());
CREATE POLICY attendance_sheets_staff_write ON public.attendance_sheets FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY attendance_records_select ON public.attendance_records FOR SELECT
  USING (public.is_staff() OR student_id = auth.uid());
CREATE POLICY attendance_records_staff_write ON public.attendance_records FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY attendance_select ON public.attendance FOR SELECT
  USING (public.is_staff() OR student_id = auth.uid());
CREATE POLICY attendance_staff_write ON public.attendance FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- calendar_events
CREATE POLICY calendar_events_select ON public.calendar_events FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR (school_id IS NOT NULL AND school_id = public.current_school_id())
  );
CREATE POLICY calendar_events_insert ON public.calendar_events FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_staff());
CREATE POLICY calendar_events_update ON public.calendar_events FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY calendar_events_delete ON public.calendar_events FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------- push_tokens
CREATE POLICY push_tokens_own ON public.push_tokens FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ---------- push_subscriptions
CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ---------- file_metadata
CREATE POLICY file_metadata_select ON public.file_metadata FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY file_metadata_insert ON public.file_metadata FOR INSERT
  WITH CHECK (uploaded_by = auth.uid() OR uploaded_by IS NULL);
CREATE POLICY file_metadata_update ON public.file_metadata FOR UPDATE
  USING (uploaded_by = auth.uid() OR public.is_staff())
  WITH CHECK (uploaded_by = auth.uid() OR public.is_staff());
CREATE POLICY file_metadata_delete ON public.file_metadata FOR DELETE
  USING (uploaded_by = auth.uid() OR public.is_staff());

-- ---------- recording_audit_log
CREATE POLICY recording_audit_log_staff ON public.recording_audit_log FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- tests
CREATE POLICY tests_select ON public.tests FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (public.is_staff() OR school_id IS NULL OR school_id = public.current_school_id())
  );
CREATE POLICY tests_staff_write ON public.tests FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- student_test_results
CREATE POLICY student_test_results_select ON public.student_test_results FOR SELECT
  USING (student_id = auth.uid() OR public.is_staff());
CREATE POLICY student_test_results_staff_write ON public.student_test_results FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------------------------------------------------------------------------
-- 3C — Storage policies (buckets are public, so file URLs keep working; this
--      only gates the LIST / UPLOAD / DELETE API calls).
-- ---------------------------------------------------------------------------
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY storage_read_authenticated ON storage.objects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY storage_insert_authenticated ON storage.objects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY storage_update_owner_or_staff ON storage.objects FOR UPDATE
  USING (public.is_staff() OR (auth.uid())::text = ANY (string_to_array(name, '/')))
  WITH CHECK (public.is_staff() OR (auth.uid())::text = ANY (string_to_array(name, '/')));

CREATE POLICY storage_delete_owner_or_staff ON storage.objects FOR DELETE
  USING (public.is_staff() OR (auth.uid())::text = ANY (string_to_array(name, '/')));


-- ###########################################################################
-- VERIFICATION — read the result below. Everything should be clean:
--   missing_auth_accounts / identities_missing / plaintext_passwords_left -> 0
--   rls_disabled -> 0     still_wide_open -> 0
--   push_subscriptions_rls_enabled -> true
-- ###########################################################################
SELECT
  (SELECT count(*) FROM public.app_users)                                  AS app_users_total,
  (SELECT count(*) FROM auth.users)                                        AS auth_users_total,
  (SELECT count(*) FROM public.app_users u
     WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id))      AS missing_auth_accounts,
  (SELECT count(*) FROM public.app_users u
     WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id)) AS identities_missing,
  (SELECT count(*) FROM public.app_users
     WHERE password_hash IS NOT NULL AND password_hash <> ''
       AND password_hash NOT LIKE '$2%')                                   AS plaintext_passwords_left,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND (p.proconfig IS NULL
            OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
  )                                                                        AS functions_missing_search_path,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.push_subscriptions'::regclass)
                                                                           AS push_subscriptions_rls_enabled,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND c.relname IN ('app_users','submissions','assignments','messages',
         'private_messages','notifications','tests','student_test_results')
       AND c.relrowsecurity = false)                                       AS rls_disabled,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public' AND qual = 'true'
       AND tablename NOT IN ('app_settings','schools'))                    AS still_wide_open;
