-- ==============================================================================
-- MULTI-SCHOOL TEACHER ASSIGNMENT MIGRATION & VERIFICATION SCRIPT
-- ==============================================================================
-- Run this standalone script in the Supabase SQL Editor.
-- It is 100% idempotent and safe to run multiple times.
-- ==============================================================================

-- 1. Ensure the teacher_schools junction table exists
CREATE TABLE IF NOT EXISTS public.teacher_schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(teacher_id, school_id)
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_teacher_schools_teacher_id ON public.teacher_schools(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schools_school_id ON public.teacher_schools(school_id);

-- 3. Enable Row Level Security (RLS) and configure policies
ALTER TABLE public.teacher_schools ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all on teacher_schools" ON public.teacher_schools;
    CREATE POLICY "Allow all on teacher_schools" ON public.teacher_schools 
    FOR ALL USING (true) WITH CHECK (true);
END $$;

-- 4. Grant table permissions to app roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.teacher_schools TO anon, authenticated, service_role;

-- 5. Automatically backfill/sync any existing teachers from app_users into teacher_schools
INSERT INTO public.teacher_schools (teacher_id, school_id)
SELECT id, school_id 
FROM public.app_users 
WHERE role = 'teacher' 
  AND school_id IS NOT NULL
ON CONFLICT (teacher_id, school_id) DO NOTHING;

-- 6. Verification output
SELECT 
    'SUCCESS: Multi-school teacher assignment schema is live!' AS status,
    (SELECT COUNT(*) FROM public.teacher_schools) AS total_teacher_school_links,
    (SELECT COUNT(*) FROM public.app_users WHERE role = 'teacher') AS total_teachers;
