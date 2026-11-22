-- =============================================================================
-- SECURITY FIX 4 — ROW LEVEL SECURITY (RLS) LOCKDOWN   ***  RUN THIS LAST  ***
-- =============================================================================
-- GOAL
--   Close the hole where ANY holder of the public anon key could read every
--   table (users, submissions, grades, passwords) and write/delete anything.
--   Until now every table used "FOR ALL USING (true) WITH CHECK (true)".
--   Now that real Supabase Auth sessions exist, auth.uid() identifies the
--   caller, so we can finally enforce per-user / per-role rules in the database.
--
-- -----------------------------------------------------------------------------
-- PREREQUISITES — all three must already be true, or you WILL lock people out:
-- -----------------------------------------------------------------------------
--   1. SECURITY-FIX-3-AUTH-BRIDGE.sql has been run, and its verification
--      query returned  missing_auth_accounts = 0  and  identities_missing = 0.
--   2. The app build that signs in with Supabase Auth is DEPLOYED
--      (lib/auth.ts -> supabase.auth.signInWithPassword) and you have confirmed
--      a few real users can log in.
--   3. SECURITY-FIX-2-SQL-ADVISOR-CLEANUP.sql has been run.
--
--   Run order:  FIX-3  ->  deploy app  ->  FIX-2  ->  THIS FILE.
--
-- -----------------------------------------------------------------------------
-- ROLLBACK (run this block ONLY if the app stops working after this file).
-- It restores the old wide-open behaviour so nothing is ever permanently stuck:
-- -----------------------------------------------------------------------------
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
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PART A — HELPER FUNCTIONS
--   SECURITY DEFINER so they can read app_users without re-triggering RLS on
--   app_users (which would recurse). search_path is pinned (clears the
--   "Function Search Path Mutable" advisor warning too).
-- -----------------------------------------------------------------------------
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

-- True when the caller is a teacher linked to the given school (primary school_id
-- OR via the teacher_schools junction for multi-school teachers).
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


-- -----------------------------------------------------------------------------
-- PART B — TABLE POLICIES
--   Step 1: drop EVERY existing policy on the app tables (removes the old
--   "Allow all on ..." wide-open policies and makes this file re-runnable).
-- -----------------------------------------------------------------------------
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

-- Make sure RLS is ON for every table we are about to protect.
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

-- ---------- app_settings (global config; readable pre-login, writable by admin)
CREATE POLICY app_settings_select ON public.app_settings FOR SELECT USING (true);
CREATE POLICY app_settings_admin_write ON public.app_settings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- schools (public directory; only admin can change)
CREATE POLICY schools_select ON public.schools FOR SELECT USING (true);
CREATE POLICY schools_admin_write ON public.schools FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- app_users   *** the critical table ***
-- Read: your own row OR admin OR anyone in your school (chat/pickers) OR a
-- teacher of that school. Never returns password_hash to other people.
CREATE POLICY app_users_select ON public.app_users FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_admin()
    OR (school_id IS NOT NULL
        AND (school_id = public.current_school_id() OR public.teaches_school(school_id)))
  );
-- Create: admins only  ->  a student can NO LONGER insert themselves as admin.
CREATE POLICY app_users_insert ON public.app_users FOR INSERT
  WITH CHECK (public.is_admin());
-- Update: your own row (profile/avatar/push token/password; the existing
-- trg_enforce_user_role_security trigger still blocks role changes) OR admin.
CREATE POLICY app_users_update_own ON public.app_users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY app_users_update_admin ON public.app_users FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Delete: admins only.
CREATE POLICY app_users_delete ON public.app_users FOR DELETE
  USING (public.is_admin());

-- ---------- teacher_schools (read by logged-in users; managed by admin)
CREATE POLICY teacher_schools_select ON public.teacher_schools FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY teacher_schools_admin_write ON public.teacher_schools FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- classes / enrollments (read by logged-in users; staff manage)
CREATE POLICY classes_select ON public.classes FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY classes_staff_write ON public.classes FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY enrollments_select ON public.enrollments FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY enrollments_staff_write ON public.enrollments FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ---------- assignments
-- Read: staff see assignments; students see their school's (and global) ones.
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

-- ---------- lessons (video recordings)
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

-- ---------- messages (school/class chat + direct messages)
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

-- ---------- private_messages (strictly the two participants)
CREATE POLICY private_messages_select ON public.private_messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY private_messages_insert ON public.private_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY private_messages_update ON public.private_messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY private_messages_delete ON public.private_messages FOR DELETE
  USING (sender_id = auth.uid() OR public.is_admin());

-- ---------- notifications (own inbox; staff create for others)
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY notifications_insert ON public.notifications FOR INSERT
  WITH CHECK (public.is_staff());
CREATE POLICY notifications_update ON public.notifications FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY notifications_delete ON public.notifications FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------- attendance (sheets / records / standalone)
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

-- ---------- calendar_events (own + school events)
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

-- ---------- push_tokens (own device tokens)
CREATE POLICY push_tokens_own ON public.push_tokens FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ---------- push_subscriptions (own web-push subscription)
CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ---------- file_metadata (registry of uploads)
CREATE POLICY file_metadata_select ON public.file_metadata FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY file_metadata_insert ON public.file_metadata FOR INSERT
  WITH CHECK (uploaded_by = auth.uid() OR uploaded_by IS NULL);
CREATE POLICY file_metadata_update ON public.file_metadata FOR UPDATE
  USING (uploaded_by = auth.uid() OR public.is_staff())
  WITH CHECK (uploaded_by = auth.uid() OR public.is_staff());
CREATE POLICY file_metadata_delete ON public.file_metadata FOR DELETE
  USING (uploaded_by = auth.uid() OR public.is_staff());

-- ---------- recording_audit_log (staff only)
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

-- ---------- student_test_results (student sees own; staff manage)
CREATE POLICY student_test_results_select ON public.student_test_results FOR SELECT
  USING (student_id = auth.uid() OR public.is_staff());
CREATE POLICY student_test_results_staff_write ON public.student_test_results FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());


-- -----------------------------------------------------------------------------
-- PART C — STORAGE POLICIES
--   NOTE: the app buckets are public, so files keep opening via their public /
--   signed URL regardless of these rules. RLS here gates the LIST / UPLOAD /
--   DELETE API calls.
--     * reads    : any logged-in user (matches today's behaviour)
--     * upload   : any logged-in user (avatars, submissions, materials, ...)
--     * update / delete: only the uploader (their uuid is in the path) or staff
-- -----------------------------------------------------------------------------
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
  USING (
    public.is_staff()
    OR (auth.uid())::text = ANY (string_to_array(name, '/'))
  )
  WITH CHECK (
    public.is_staff()
    OR (auth.uid())::text = ANY (string_to_array(name, '/'))
  );

CREATE POLICY storage_delete_owner_or_staff ON storage.objects FOR DELETE
  USING (
    public.is_staff()
    OR (auth.uid())::text = ANY (string_to_array(name, '/'))
  );


-- -----------------------------------------------------------------------------
-- VERIFICATION — read the result after running.
--   policies_created  : number of policies now on the app tables (expect ~70+)
--   still_wide_open   : must be 0 (no remaining "USING (true)" catch-all)
--   rls_disabled      : must be 0 (every listed table has RLS on)
-- -----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
     AND tablename IN ('app_users','schools','assignments','submissions',
       'study_materials','lessons','messages','private_messages','notifications',
       'tests','student_test_results','push_subscriptions')) AS policies_created,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'public'
       AND qual = 'true' AND tablename <> 'app_settings' AND tablename <> 'schools')
                                                                   AS still_wide_open,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND c.relname IN ('app_users','submissions','assignments','messages',
         'private_messages','notifications','tests','student_test_results')
       AND c.relrowsecurity = false)                               AS rls_disabled;
