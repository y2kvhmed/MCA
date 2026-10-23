-- ==============================================================================
-- SECURE-VIDEO-STORAGE-AND-TEST-RESULTS.sql
-- 1. Locks down video & recording storage buckets (Private, requires signed URLs)
-- 2. Creates the student_test_results table for tracking test scores, marks, feedback & PDFs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURE STORAGE BUCKETS (VIDEOS & RECORDINGS CANNOT BE ACCESSED PUBLICLY)
-- ------------------------------------------------------------------------------
-- Ensure 'recordings' and 'videos' buckets are strictly PRIVATE.
-- Public direct URLs will be rejected; only authenticated time-limited signed URLs work.
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('recordings', 'videos');

-- Ensure buckets exist if not created yet
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('recordings', 'recordings', false, 1073741824, NULL), -- 1 GB private
  ('videos', 'videos', false, 1073741824, NULL),         -- 1 GB private
  ('test-results', 'test-results', true, 52428800, ARRAY['application/pdf']) -- 50 MB for test PDFs
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Grant permissions for storage
GRANT ALL ON storage.buckets TO anon, authenticated, service_role;
GRANT ALL ON storage.objects TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. CREATE STUDENT TEST RESULTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    score NUMERIC(6, 2) NOT NULL,
    max_score NUMERIC(6, 2) NOT NULL DEFAULT 100,
    percentage NUMERIC(6, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    pdf_url TEXT,
    pdf_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically calculate and maintain percentage on insert/update
CREATE OR REPLACE FUNCTION public.calculate_student_test_percentage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.max_score IS NOT NULL AND NEW.max_score > 0 THEN
        NEW.percentage := ROUND((NEW.score / NEW.max_score) * 100, 2);
    ELSE
        NEW.percentage := 0;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_student_test_percentage ON public.student_test_results;
CREATE TRIGGER trg_calculate_student_test_percentage
BEFORE INSERT OR UPDATE ON public.student_test_results
FOR EACH ROW EXECUTE FUNCTION public.calculate_student_test_percentage();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_student_test_results_student_date 
ON public.student_test_results(student_id, test_date DESC);

CREATE INDEX IF NOT EXISTS idx_student_test_results_school 
ON public.student_test_results(school_id);

CREATE INDEX IF NOT EXISTS idx_student_test_results_teacher 
ON public.student_test_results(teacher_id);

-- Enable RLS
ALTER TABLE public.student_test_results ENABLE ROW LEVEL SECURITY;

-- Transparent Access Policy
DROP POLICY IF EXISTS "Allow all operations on student_test_results" ON public.student_test_results;
CREATE POLICY "Allow all operations on student_test_results" 
ON public.student_test_results 
FOR ALL USING (true) WITH CHECK (true);
