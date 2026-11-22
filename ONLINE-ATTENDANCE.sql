-- =============================================================================
-- ONLINE (ZOOM) ATTENDANCE — an "online" sheet the teacher opens per lesson
-- =============================================================================
-- WHY
--   The teacher creates the sheet from the normal "+" button, choosing "Online
--   lesson" and the lesson's start/end time. Students then press "Join Online
--   Lesson"; a press inside that window records them PRESENT. Because the online
--   sheet is a different row (session_type = 'online') from the normal on-site
--   sheet for the same day, the two can never overwrite each other.
--
-- WHAT THIS DOES
--   1. attendance_sheets.session_type — 'onsite' (default, existing rows) | 'online'.
--   2. attendance_sheets.start_time / end_time — the window during which student
--      presses count as present.
--   3. Guarantees exactly ONE online sheet per school per day.
--
-- SAFETY
--   Existing rows are untouched: they default to 'onsite' with no time window.
--   Rollback is at the bottom of this file.
--
-- RUN ORDER
--   Run this BEFORE the app build that adds the Join button.
-- =============================================================================

ALTER TABLE public.attendance_sheets
  ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) NOT NULL DEFAULT 'onsite';

ALTER TABLE public.attendance_sheets
  ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE public.attendance_sheets
  ADD COLUMN IF NOT EXISTS end_time TIME;

-- One online sheet per school per day, so every student press that day lands on the
-- same sheet. (A plain UNIQUE index would not do this because it also has to coexist
-- with the existing UNIQUE(teacher_id, school_id, date) for normal sheets.)
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sheets_one_online_per_day
  ON public.attendance_sheets (school_id, date)
  WHERE session_type = 'online';

CREATE INDEX IF NOT EXISTS idx_attendance_sheets_session_type
  ON public.attendance_sheets (session_type);

-- -----------------------------------------------------------------------------
-- ROLLBACK — run this block manually only if you need to undo the above.
-- -----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.attendance_sheets_one_online_per_day;
-- DROP INDEX IF EXISTS public.idx_attendance_sheets_session_type;
-- DELETE FROM public.attendance_records
--   WHERE sheet_id IN (SELECT id FROM public.attendance_sheets WHERE session_type = 'online');
-- DELETE FROM public.attendance_sheets WHERE session_type = 'online';
-- ALTER TABLE public.attendance_sheets DROP COLUMN IF EXISTS start_time;
-- ALTER TABLE public.attendance_sheets DROP COLUMN IF EXISTS end_time;
-- ALTER TABLE public.attendance_sheets DROP COLUMN IF EXISTS session_type;
