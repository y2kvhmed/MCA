-- ============================================================
-- ASSIGNMENTS: let any teacher of a school manage that school's assignments
-- ============================================================
-- Before: only the teacher who created an assignment (or an admin) could update
-- it. RLS silently ignores updates it does not allow, so editing a colleague's
-- assignment reported success but changed nothing (e.g. an extended deadline
-- never actually saved).
--
-- After: any teacher who teaches the assignment's school can update it, in
-- addition to the original creator and admins. Deletes stay restricted to the
-- creator and admins so a colleague's work cannot be removed by accident.
--
-- Safe to re-run.

BEGIN;

DROP POLICY IF EXISTS assignments_update ON public.assignments;

CREATE POLICY assignments_update ON public.assignments FOR UPDATE
  USING (
    public.is_admin()
    OR teacher_id = auth.uid()
    OR (public.is_teacher() AND public.teaches_school(school_id))
  )
  WITH CHECK (
    public.is_admin()
    OR teacher_id = auth.uid()
    OR (public.is_teacher() AND public.teaches_school(school_id))
  );

COMMIT;

-- ---------- verify ----------
SELECT polname AS policy, pg_get_expr(polqual, polrelid) AS using_expression
FROM pg_policy
WHERE polrelid = 'public.assignments'::regclass
ORDER BY polname;

-- ---------- rollback ----------
/*
BEGIN;
DROP POLICY IF EXISTS assignments_update ON public.assignments;
CREATE POLICY assignments_update ON public.assignments FOR UPDATE
  USING (teacher_id = auth.uid() OR public.is_admin())
  WITH CHECK (teacher_id = auth.uid() OR public.is_admin());
COMMIT;
*/
