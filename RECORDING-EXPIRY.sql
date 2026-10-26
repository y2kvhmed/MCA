-- ==============================================================================
-- RECORDING / LESSON EXPIRY MIGRATION & VERIFICATION SCRIPT
-- ==============================================================================
-- Adds an optional expiry date to lessons (the table that backs "recordings").
--   * expires_at = NULL  -> the recording NEVER expires.
--   * expires_at = <ts>  -> on/after that timestamp the recording is hidden from
--                           every listing and can no longer be played.
-- Run this standalone script in the Supabase SQL Editor.
-- It is 100% idempotent and safe to run multiple times.
-- ==============================================================================

-- 1. Add the nullable expiry column (NULL means "never expires")
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. Partial index for expiry lookups (only rows that actually expire)
CREATE INDEX IF NOT EXISTS idx_lessons_expires_at ON public.lessons(expires_at) WHERE expires_at IS NOT NULL;

-- 3. Verification output
SELECT
    'SUCCESS: Recording expiry column is live!' AS status,
    (SELECT COUNT(*) FROM public.lessons) AS total_lessons,
    (SELECT COUNT(*) FROM public.lessons WHERE expires_at IS NOT NULL) AS lessons_with_expiry;
