-- =============================================================================
-- ONLINE ATTENDANCE — JOIN LOG (one row per "Join Online Lesson" press)
-- =============================================================================
-- WHY
--   attendance_records keeps ONE row per student per sheet (UNIQUE(sheet_id,
--   student_id)), so it can only hold the final status. Teachers asked to see
--   every time a student pressed Join, and to label anyone who first pressed
--   more than 40 minutes after the lesson started as LATE.
--
-- WHAT THIS DOES
--   1. attendance_joins — append-only log: one row per press, with the press
--      time (joined_at) and whether that press was late (is_late).
--   2. Staff can read them; only the service role writes (same as
--      attendance_records), so students cannot edit their own log.
--
-- SAFETY
--   Purely additive. Existing attendance_records rows are untouched. Rollback
--   is at the bottom of this file.
--
-- RUN ORDER
--   Run this in the Supabase SQL Editor BEFORE deploying the build that writes
--   to attendance_joins.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.attendance_joins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.attendance_sheets(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Multiple presses per student are expected, so no unique constraint here.
CREATE INDEX IF NOT EXISTS idx_attendance_joins_sheet ON public.attendance_joins (sheet_id);
CREATE INDEX IF NOT EXISTS idx_attendance_joins_sheet_student
  ON public.attendance_joins (sheet_id, student_id);

ALTER TABLE public.attendance_joins ENABLE ROW LEVEL SECURITY;

-- Staff (teacher/admin) read the log; students never do.
DROP POLICY IF EXISTS attendance_joins_select ON public.attendance_joins;
CREATE POLICY attendance_joins_select ON public.attendance_joins FOR SELECT
  USING (public.is_staff());

-- Writes happen with the service-role key, which bypasses RLS. Staff may manage
-- rows too, matching attendance_records, so an admin can clean up if needed.
DROP POLICY IF EXISTS attendance_joins_staff_write ON public.attendance_joins;
CREATE POLICY attendance_joins_staff_write ON public.attendance_joins FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- -----------------------------------------------------------------------------
-- ROLLBACK — run this block manually only if you need to undo the above.
-- -----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS attendance_joins_staff_write ON public.attendance_joins;
-- DROP POLICY IF EXISTS attendance_joins_select ON public.attendance_joins;
-- DROP TABLE IF EXISTS public.attendance_joins;
