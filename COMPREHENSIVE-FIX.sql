-- ============================================================================
-- COMPREHENSIVE FIX SQL FOR PHYSICS LEARNING APP
-- This SQL file ensures all database structures support the required functionality
-- ============================================================================

-- 1. Ensure assigned_schools column exists for multi-school teacher support
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS assigned_schools TEXT[] DEFAULT '{}';

-- 2. Create index for better performance on assigned_schools
CREATE INDEX IF NOT EXISTS idx_app_users_assigned_schools ON app_users USING GIN (assigned_schools);

-- 3. Ensure all necessary columns exist in study_materials table
ALTER TABLE study_materials
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS material_type TEXT DEFAULT 'document',
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN DEFAULT true;

-- 4. Ensure messages table supports file attachments
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'message',
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 5. Ensure submissions table has all necessary file fields
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

-- 6. Ensure lessons table supports video uploads
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS video_path TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- 7. Remove grade/score related columns (make them nullable for backward compatibility)
-- We won't drop them to avoid data loss, but we'll make them nullable
ALTER TABLE assignments
ALTER COLUMN max_score DROP NOT NULL;

ALTER TABLE submissions
ALTER COLUMN score DROP NOT NULL;

-- 8. Update delete_school_cascade function to handle all related data
CREATE OR REPLACE FUNCTION delete_school_cascade(school_id_param UUID)
RETURNS void AS $$
BEGIN
  -- Delete all messages for this school
  DELETE FROM messages WHERE school_id = school_id_param;
  
  -- Delete all submissions for assignments in this school
  DELETE FROM submissions 
  WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id = school_id_param);
  
  -- Delete all assignments for this school
  DELETE FROM assignments WHERE school_id = school_id_param;
  
  -- Delete all study materials for this school
  DELETE FROM study_materials WHERE school_id = school_id_param;
  
  -- Delete all lessons for this school
  DELETE FROM lessons WHERE school_id = school_id_param;
  
  -- Delete all users in this school
  DELETE FROM app_users WHERE school_id = school_id_param;
  
  -- Finally delete the school
  DELETE FROM schools WHERE id = school_id_param;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to get materials for students by school
CREATE OR REPLACE FUNCTION get_materials_for_student(student_school_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  file_path TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  material_type TEXT,
  created_at TIMESTAMPTZ,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  school_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id,
    sm.title,
    sm.description,
    sm.file_path,
    sm.file_url,
    sm.file_name,
    sm.file_size,
    sm.material_type,
    sm.created_at,
    sm.uploaded_by,
    u.name as uploaded_by_name,
    sm.school_id
  FROM study_materials sm
  LEFT JOIN app_users u ON sm.uploaded_by = u.id
  WHERE sm.school_id = student_school_id
    AND sm.is_published = true
  ORDER BY sm.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 10. Update RLS policies for study_materials to allow students to view
DROP POLICY IF EXISTS "Students can view materials from their school" ON study_materials;
CREATE POLICY "Students can view materials from their school"
ON study_materials FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM app_users WHERE id = auth.uid()
  )
  AND is_published = true
);

-- 11. Update RLS policies for messages to support file attachments
DROP POLICY IF EXISTS "Users can insert messages in their school" ON messages;
CREATE POLICY "Users can insert messages in their school"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  school_id IN (
    SELECT school_id FROM app_users WHERE id = auth.uid()
    UNION
    SELECT unnest(assigned_schools) FROM app_users WHERE id = auth.uid()
  )
);

-- 12. Ensure storage buckets exist (this needs to be run in Supabase dashboard)
-- Run these commands in Supabase Storage dashboard:
-- CREATE BUCKET IF NOT EXISTS materials;
-- CREATE BUCKET IF NOT EXISTS study-materials;
-- CREATE BUCKET IF NOT EXISTS videos;
-- CREATE BUCKET IF NOT EXISTS lessons;
-- CREATE BUCKET IF NOT EXISTS chat-files;
-- CREATE BUCKET IF NOT EXISTS assignment-submissions;

-- 13. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_study_materials_school_id ON study_materials(school_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_uploaded_by ON study_materials(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON messages(school_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_school_id ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON lessons(school_id);

-- 14. Update app_users to ensure school_id is properly set
-- This helps with the "not assigned" issue
UPDATE app_users 
SET school_id = (SELECT id FROM schools LIMIT 1)
WHERE school_id IS NULL AND role IN ('teacher', 'student');

-- 15. Create helper function to check if teacher has access to school
CREATE OR REPLACE FUNCTION teacher_has_school_access(teacher_id UUID, check_school_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_school_id UUID;
  user_assigned_schools TEXT[];
BEGIN
  SELECT school_id, assigned_schools INTO user_school_id, user_assigned_schools
  FROM app_users
  WHERE id = teacher_id;
  
  -- Check if school matches user's primary school_id
  IF user_school_id = check_school_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if school is in assigned_schools array
  IF check_school_id::TEXT = ANY(user_assigned_schools) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 16. Create function to get teacher's accessible schools
CREATE OR REPLACE FUNCTION get_teacher_schools(teacher_id UUID)
RETURNS TABLE (
  school_id UUID,
  school_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT s.id, s.name
  FROM schools s
  INNER JOIN app_users u ON u.id = teacher_id
  WHERE s.id = u.school_id
     OR s.id::TEXT = ANY(u.assigned_schools)
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- 17. Update submissions to ensure proper cascade on assignment deletion
ALTER TABLE submissions
DROP CONSTRAINT IF EXISTS submissions_assignment_id_fkey,
ADD CONSTRAINT submissions_assignment_id_fkey 
  FOREIGN KEY (assignment_id) 
  REFERENCES assignments(id) 
  ON DELETE CASCADE;

-- 18. Ensure proper cascade for study_materials
ALTER TABLE study_materials
DROP CONSTRAINT IF EXISTS study_materials_school_id_fkey,
ADD CONSTRAINT study_materials_school_id_fkey 
  FOREIGN KEY (school_id) 
  REFERENCES schools(id) 
  ON DELETE CASCADE;

-- 19. Ensure proper cascade for messages
ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_school_id_fkey,
ADD CONSTRAINT messages_school_id_fkey 
  FOREIGN KEY (school_id) 
  REFERENCES schools(id) 
  ON DELETE CASCADE;

-- 20. Create view for assignment progress (replaces grades)
CREATE OR REPLACE VIEW student_assignment_progress AS
SELECT 
  s.id as student_id,
  s.name as student_name,
  s.school_id,
  COUNT(DISTINCT a.id) as total_assignments,
  COUNT(DISTINCT sub.id) as submitted_assignments,
  CASE 
    WHEN COUNT(DISTINCT a.id) > 0 
    THEN ROUND((COUNT(DISTINCT sub.id)::NUMERIC / COUNT(DISTINCT a.id)::NUMERIC) * 100, 2)
    ELSE 0
  END as completion_percentage
FROM app_users s
LEFT JOIN assignments a ON a.school_id = s.school_id
LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = s.id
WHERE s.role = 'student'
GROUP BY s.id, s.name, s.school_id;

-- 21. Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_school_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_materials_for_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION teacher_has_school_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_schools(UUID) TO authenticated;
GRANT SELECT ON student_assignment_progress TO authenticated;

-- 22. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the fixes)
-- ============================================================================

-- Check if assigned_schools column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'app_users' AND column_name = 'assigned_schools';

-- Check study_materials structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'study_materials';

-- Check messages structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages';

-- Check submissions structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'submissions';

-- Verify functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('delete_school_cascade', 'get_materials_for_student', 'teacher_has_school_access', 'get_teacher_schools');

-- ============================================================================
-- END OF COMPREHENSIVE FIX SQL
-- ============================================================================
