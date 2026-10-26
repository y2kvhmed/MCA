-- ==============================================================================
-- CREATE-TESTS-TABLE.sql
-- 1. Creates the 'tests' table to group student results
-- 2. Links 'student_test_results' to the 'tests' table
-- ==============================================================================

-- 1. CREATE TESTS TABLE
CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    max_score NUMERIC(6, 2) NOT NULL DEFAULT 100,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LINK STUDENT TEST RESULTS TO TESTS
ALTER TABLE public.student_test_results ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE;

-- Add unique constraint to allow upsert by (student_id, test_id)
ALTER TABLE public.student_test_results DROP CONSTRAINT IF EXISTS unique_student_test;
ALTER TABLE public.student_test_results ADD CONSTRAINT unique_student_test UNIQUE (student_id, test_id);

-- Enable RLS for tests
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

-- Transparent Access Policy for tests
DROP POLICY IF EXISTS "Allow all operations on tests" ON public.tests;
CREATE POLICY "Allow all operations on tests" 
ON public.tests 
FOR ALL USING (true) WITH CHECK (true);

-- Performance Index
CREATE INDEX IF NOT EXISTS idx_tests_school_date ON public.tests(school_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_test_results_test_id ON public.student_test_results(test_id);
